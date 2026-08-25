import { VectorShape } from '../generator/types';

export function samplePixels(data: Uint8ClampedArray, size: number): number[][] {
  const px: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const a = data[i + 3];
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      row.push(((a << 24) | (r << 16) | (g << 8) | b) >>> 0);
    }
    px.push(row);
  }
  return px;
}

function unpack(c: number): [number, number, number, number] {
  return [(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff];
}

// 简单颜色量化：统计出现最多的颜色，按出现次数取前 maxColors 个代表色，
// 其余像素映射到最近代表色。透明（alpha < 16）保持为特殊哨兵 0，表示“不绘制”。
const TRANSPARENT = 0;
export function quantizeColors(pixels: number[][], size: number, maxColors: number): number[][] {
  const hist = new Map<number, number>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixels[y][x];
      const [a] = unpack(c);
      if (a < 16) continue;
      hist.set(c, (hist.get(c) || 0) + 1);
    }
  }
  const reps = [...hist.entries()]
    .filter(([c]) => c !== TRANSPARENT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, maxColors))
    .map(([c]) => c);
  const out: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const c = pixels[y][x];
      const [a] = unpack(c);
      if (a < 16) { row.push(TRANSPARENT); continue; }
      let best = reps[0];
      let bestD = Infinity;
      for (const r of reps) {
        const [ar, rr, gr, br] = unpack(r);
        const [ac, rc, gc, bc] = unpack(c);
        const d = (ar - ac) ** 2 + (rr - rc) ** 2 + (gr - gc) ** 2 + (br - bc) ** 2;
        if (d < bestD) { bestD = d; best = r; }
      }
      row.push(best);
    }
    out.push(row);
  }
  return out;
}

// Moore 邻域边界追踪：在二值 mask 中找第一个前景点，按 Moore 邻接返回有序边界点。
export function mooreTrace(mask: boolean[][], h: number, w: number): number[][] | null {
  const inside = (y: number, x: number) => y >= 0 && x >= 0 && y < h && x < w && mask[y][x];
  let startY = -1, startX = -1;
  for (let y = 0; y < h && startY < 0; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y][x]) { startY = y; startX = x; break; }
    }
  }
  if (startY < 0) return null;
  const dirs = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  const boundary: number[][] = [];
  let cy = startY, cx = startX;
  let dir = 7; // 从起始点左上方开始搜索
  const maxSteps = h * w * 4;
  let steps = 0;
  do {
    boundary.push([cy, cx]);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + k) % 8;
      const ny = cy + dirs[nd][0];
      const nx = cx + dirs[nd][1];
      if (inside(ny, nx)) {
        cy = ny; cx = nx; dir = (nd + 6) % 8; found = true; break;
      }
    }
    if (!found) break;
    steps++;
  } while ((cy !== startY || cx !== startX) && steps < maxSteps);
  return boundary.length >= 3 ? boundary : null;
}

export function douglasPeucker(points: number[][], epsilon: number): number[][] {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  const [y0, x0] = points[0];
  const [y1, x1] = points[points.length - 1];
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [py, px] = points[i];
    const d = Math.abs((px - x0) * dy - (py - y0) * dx) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = douglasPeucker(points.slice(0, idx + 1), epsilon);
    const right = douglasPeucker(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

// 将量化图按颜色分组，逐色构建 mask -> Moore 追踪 -> 简化 -> 多边形。
export function traceShapes(quantized: number[][], size: number, tolerance: number): VectorShape[] {
  const colors = new Map<number, boolean[][]>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = quantized[y][x];
      if (c === TRANSPARENT) continue;
      if (!colors.has(c)) {
        colors.set(c, Array.from({ length: size }, () => new Array<boolean>(size).fill(false)));
      }
      colors.get(c)![y][x] = true;
    }
  }
  const shapes: VectorShape[] = [];
  for (const [color, mask] of colors) {
    const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!mask[y][x] || visited[y][x]) continue;
        // 洪水填充标记整个连通分量，避免对同色 mask 重复追踪
        const stack: [number, number][] = [[y, x]];
        while (stack.length) {
          const [cy, cx] = stack.pop()!;
          if (cy < 0 || cx < 0 || cy >= size || cx >= size) continue;
          if (!mask[cy][cx] || visited[cy][cx]) continue;
          visited[cy][cx] = true;
          stack.push([cy + 1, cx], [cy - 1, cx], [cy, cx + 1], [cy, cx - 1]);
        }
        const contour = mooreTrace(mask, size, size);
        if (contour) {
          const simp = douglasPeucker(contour, Math.max(0.5, tolerance * size));
          shapes.push({ color, polygons: [simp] });
        }
      }
    }
  }
  return shapes;
}
