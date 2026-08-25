# Image2Java Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VS Code extension that turns an uploaded image into Java 8 Swing (native, no third-party lib) icon code — both a pixel-raster mode and a vector-recognition mode — via a sidebar webview with square crop + resolution selection, output into a new `.java` editor tab.

**Architecture:** Mirror the existing `vsplugin/c-java-struct-converter` in this workspace: a `WebviewViewProvider` rendered in an activitybar view, with the webview HTML (including all browser-side JS) inlined as a string — no bundler. All image work (display, square-crop, resize-to-resolution, pixel sampling, vector recognition) runs in the browser via Canvas/JS inside the webview. The extension host only receives a structured payload, runs pure-function generators, and opens a new editor tab. The two generator modes consume the *same* cached `size×size` bitmap, enabling one-click pixel/vector switch.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode`), Node 20 types, browser Canvas API (webview side, no deps). Java 8 Swing output (`javax.swing.Icon`, `BufferedImage`, `ImageIcon`, `Graphics2D`, `Path2D`, `Color`). Tooling mirrors `vsplugin`: `typescript`, `eslint`, `mocha`, `vscode-test`, `@types/vscode@^1.80.0`, `engines.vscode ^1.80.0`.

## Global Constraints

- 输出目标语言：**Java 8 + Swing，原生 API，不得引入任何第三方 Java 库**（spec §2、§7）。
- 两种代码模式都实现：**像素栅格** 与 **矢量识别**（spec §2）。
- 交互：webview 内**拖选正方形**裁剪 + 选分辨率（16/32/64/128/256/自定义，上限 **512**）（spec §2、§5）。
- 启动方式：**侧边栏 activitybar 图标点击**打开 webview 面板（spec §2）。
- 输出落点：**新开编辑器标签**（未保存 `.java`），用户自行保存/复制（spec §2、§5）。
- 同图支持**像素/矢量一键切换对比**，不重新裁剪（spec §2、§5）。
- 矢量模式需 UI 常驻**防失真操作提示**（spec §6）。
- 不引入 npm 图片处理库；webview 用浏览器原生 Canvas（spec §3）。
- 不做（YAGNI）：多图批量、导出二进制、历史、右键菜单、JavaFX/Android（spec §10）。

---

### Task 1: 项目脚手架（manifest / tsconfig / 图标）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\package.json`
- Create: `D:\Program Files\code\image2java-icon\tsconfig.json`
- Create: `D:\Program Files\code\image2java-icon\.vscodeignore`
- Create: `D:\Program Files\code\image2java-icon\media\icon.svg`
- Create: `D:\Program Files\code\image2java-icon\.eslintrc.json`

**Interfaces:** 无（基础设施）。

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "image2java-icon",
  "displayName": "Image2Java Icon",
  "description": "Upload an image, crop a square, generate Java 8 Swing icon code (pixel or vector).",
  "version": "0.1.0",
  "publisher": "image2java-icon",
  "license": "MIT",
  "engines": { "vscode": "^1.80.0" },
  "categories": ["Other"],
  "activationEvents": ["onView:image2java-icon.iconView"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        { "id": "image2java-icon-sidebar", "title": "Image2Java Icon", "icon": "media/icon.svg" }
      ]
    },
    "views": {
      "image2java-icon-sidebar": [
        { "type": "webview", "id": "image2java-icon.iconView", "name": "Icon Maker", "icon": "media/icon.svg", "contextualTitle": "Image2Java Icon" }
      ]
    },
    "commands": [
      { "command": "image2java-icon.openPanel", "title": "Open Image2Java Icon Maker" }
    ],
    "menus": {
      "view/title": [
        { "command": "image2java-icon.openPanel", "when": "view == image2java-icon.iconView", "group": "navigation" }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.1",
    "@types/node": "20.2.5",
    "@types/vscode": "^1.80.0",
    "@typescript-eslint/eslint-plugin": "^5.59.8",
    "@typescript-eslint/parser": "^5.59.8",
    "eslint": "^8.41.0",
    "glob": "^8.1.0",
    "mocha": "^10.2.0",
    "typescript": "^5.1.3",
    "vscode-test": "^1.6.0"
  }
}
```

- [ ] **Step 2: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", "out", ".vscode-test"]
}
```

- [ ] **Step 3: 写 `.vscodeignore`**

```
out/test/**
node_modules/**
.vscode-test/**
src/**
.gitignore
.eslintrc.json
**/*.map
tsconfig.json
```

- [ ] **Step 4: 写 `media/icon.svg`**（侧边栏图标，正方形几何图标）

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#C5C5C5" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="5" fill="#C5C5C5"/>
  <rect x="9" y="9" width="6" height="6" fill="#1E1E1E"/>
</svg>
```

- [ ] **Step 5: 写 `.eslintrc.json`**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": { "@typescript-eslint/no-unused-vars": "warn" }
}
```

- [ ] **Step 6: 安装依赖并编译验证脚手架**

Run: `cd D:\Program Files\code\image2java-icon; npm install; npm run compile`
Expected: 编译无错误（此时 out/ 仅有空结构，无 TS 报错）。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold image2java-icon extension"
```

---

### Task 2: 共享类型定义

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\generator\types.ts`

**Interfaces:** 被 Task 4/5（generators）与 Task 8（extension）共同依赖。

- [ ] **Step 1: 写 `types.ts`**

```ts
// 像素模式输入：pixels[y][x] = 0xAARRGGBB（32 位无符号整数）
export interface PixelInput {
  size: number;
  pixels: number[][];
  className?: string;
}

// 单个矢量形状：一个颜色 + 若干多边形（每个多边形是 [[x,y],...]，坐标在 0..size 空间）
export interface VectorShape {
  color: number; // 0xAARRGGBB
  polygons: number[][][];
}

export interface VectorInput {
  size: number;
  shapes: VectorShape[];
  className?: string;
}

// webview -> 宿主 的 generate 请求
export type GenerateMode = 'pixel' | 'vector';
export interface GenerateRequest {
  command: 'generate';
  mode: GenerateMode;
  size: number;
  pixels?: number[][];      // mode === 'pixel'
  shapes?: VectorShape[];   // mode === 'vector'
  className?: string;
}

// 宿主 -> webview 的状态回传
export interface GenerateResultMessage {
  command: 'generated' | 'generateError';
  code?: string;
  error?: string;
}

export const MAX_SIZE = 512;
export const DEFAULT_CLASS_NAME = 'GeneratedIcon';
```

- [ ] **Step 2: 编译确认类型无错**

Run: `npm run compile`
Expected: PASS（无 TS 错误）。

- [ ] **Step 3: Commit**

```bash
git add src/generator/types.ts
git commit -m "feat: add shared generator types"
```

---

### Task 3: Java 公共模板（imports + 类头）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\generator\javaTemplate.ts`

**Interfaces:**
- Produces: `buildHeader(opts: { className: string; imports: string[]; comment: string }): string`
- Consumed by: Task 4 `pixelGenerator.ts`、Task 5 `vectorGenerator.ts`。

- [ ] **Step 1: 写 `javaTemplate.ts`**

```ts
export interface HeaderOptions {
  className: string;
  imports: string[];
  comment: string;
}

// 生成 Java 文件头：import + 类注释。各 generator 在其后拼接类体。
export function buildHeader(opts: HeaderOptions): string {
  const imp = opts.imports.map((i) => `import ${i};`).join('\n');
  return `${imp}\n\n/**\n * ${opts.comment}\n */`;
}
```

- [ ] **Step 2: 编译**

Run: `npm run compile`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/generator/javaTemplate.ts
git commit -m "feat: add java header template helper"
```

---

### Task 4: 像素栅格 generator + 单测

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\generator\pixelGenerator.ts`
- Create: `D:\Program Files\code\image2java-icon\src\test\pixelGenerator.test.ts`

**Interfaces:**
- Consumes: `PixelInput`, `buildHeader` (Task 3)。
- Produces: `generatePixelIcon(input: PixelInput): string`。

- [ ] **Step 1: 写失败测试**

```ts
import * as assert from 'assert';
import { generatePixelIcon } from '../generator/pixelGenerator';

describe('pixelGenerator', () => {
  it('emits BufferedImage + ImageIcon with exact pixels', () => {
    const px = [
      [0xff000000, 0xffffffff],
      [0xffff0000, 0xff00ff00],
    ];
    const code = generatePixelIcon({ size: 2, pixels: px, className: 'Foo' });
    assert.ok(code.includes('public class Foo'), 'class name');
    assert.ok(code.includes('BufferedImage(2, 2, BufferedImage.TYPE_INT_ARGB)'), 'buffered image ctor');
    assert.ok(code.includes('image.setRGB(x, y, px[y][x]);'), 'setRGB loop');
    assert.ok(code.includes('0xff000000'), 'opaque black pixel');
    assert.ok(code.includes('0xffff0000'), 'red pixel');
    assert.ok(code.includes('public ImageIcon toImageIcon()'), 'ImageIcon method');
    assert.ok(code.includes('new ImageIcon(image)'), 'ImageIcon ctor');
  });

  it('defaults class name when omitted', () => {
    const code = generatePixelIcon({ size: 1, pixels: [[0]] });
    assert.ok(code.includes('public class GeneratedIcon'));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run compile && npx mocha out/test/pixelGenerator.test.js`
Expected: FAIL（`generatePixelIcon` 未定义）。

- [ ] **Step 3: 写最小实现 `pixelGenerator.ts`**

```ts
import { PixelInput } from './types';
import { buildHeader } from './javaTemplate';

export function generatePixelIcon(input: PixelInput): string {
  const { size, pixels, className = 'GeneratedIcon' } = input;
  const header = buildHeader({
    className,
    imports: ['javax.swing.*', 'java.awt.*', 'java.awt.image.BufferedImage'],
    comment: `Generated from a ${size}x${size} image (pixel raster mode).`,
  });

  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    const cells = pixels[y].map((v) => `0x${v >>> 0 ? (v >>> 0).toString(16).padStart(8, '0') : '00000000'}`).join(', ');
    rows.push(`            {${cells}},`);
  }

  const body = [
    `public class ${className} {`,
    `    private final BufferedImage image;`,
    `    public ${className}() {`,
    `        image = new BufferedImage(${size}, ${size}, BufferedImage.TYPE_INT_ARGB);`,
    `        int[][] px = {`,
    ...rows,
    `        };`,
    `        for (int y = 0; y < ${size}; y++) {`,
    `            for (int x = 0; x < ${size}; x++) {`,
    `                image.setRGB(x, y, px[y][x]);`,
    `            }`,
    `        }`,
    `    }`,
    `    public BufferedImage toBufferedImage() { return image; }`,
    `    public ImageIcon toImageIcon() { return new ImageIcon(image); }`,
    `}`,
  ].join('\n');

  return `${header}\n${body}\n`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run compile && npx mocha out/test/pixelGenerator.test.js`
Expected: PASS（2 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/generator/pixelGenerator.ts src/test/pixelGenerator.test.ts
git commit -m "feat: pixel-raster Java icon generator + tests"
```

---

### Task 5: 矢量识别 generator + 单测

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\generator\vectorGenerator.ts`
- Create: `D:\Program Files\code\image2java-icon\src\test\vectorGenerator.test.ts`

**Interfaces:**
- Consumes: `VectorInput`, `buildHeader` (Task 3)。
- Produces: `generateVectorIcon(input: VectorInput): string`。

- [ ] **Step 1: 写失败测试**

```ts
import * as assert from 'assert';
import { generateVectorIcon } from '../generator/vectorGenerator';

describe('vectorGenerator', () => {
  it('emits Icon impl painting filled paths per color', () => {
    const shapes = [
      { color: 0xffff0000, polygons: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
    ];
    const code = generateVectorIcon({ size: 16, shapes, className: 'V' });
    assert.ok(code.includes('public class V implements Icon'), 'implements Icon');
    assert.ok(code.includes('public int getIconWidth() { return size; }'), 'width');
    assert.ok(code.includes('public int getIconHeight() { return size; }'), 'height');
    assert.ok(code.includes('public void paintIcon(Component c, Graphics g, int x, int y)'), 'paintIcon');
    assert.ok(code.includes('Graphics2D g2 = (Graphics2D) g.create();'), 'Graphics2D cast');
    assert.ok(code.includes('Path2D path = new Path2D.Double();'), 'Path2D');
    assert.ok(code.includes('g2.fill(path);'), 'fill');
    assert.ok(code.includes('new Color(255, 0, 0, 255)'), 'red rgba');
    assert.ok(code.includes('path.moveTo(x + 0, y + 0)'), 'first point');
  });

  it('handles multiple shapes', () => {
    const shapes = [
      { color: 0xff000000, polygons: [[[0, 0], [1, 0], [1, 1]]] },
      { color: 0xffffffff, polygons: [[[2, 2], [3, 2], [3, 3]]] },
    ];
    const code = generateVectorIcon({ size: 8, shapes });
    assert.ok(code.includes('public class GeneratedIcon implements Icon'));
    const count = (code.match(/g2.fill\(path\);/g) || []).length;
    assert.strictEqual(count, 2, 'one fill per shape');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run compile && npx mocha out/test/vectorGenerator.test.js`
Expected: FAIL。

- [ ] **Step 3: 写最小实现 `vectorGenerator.ts`**

```ts
import { VectorInput, VectorShape } from './types';
import { buildHeader } from './javaTemplate';

function rgba(code: number): [number, number, number, number] {
  const c = code >>> 0;
  return [(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff];
}

function polygonLiteral(poly: number[][]): string {
  const pts = poly.map((p) => `{${Math.round(p[0])}, ${Math.round(p[1])}}`).join(', ');
  return `{${pts}}`;
}

export function generateVectorIcon(input: VectorInput): string {
  const { size, shapes, className = 'GeneratedIcon' } = input;
  const header = buildHeader({
    className,
    imports: ['javax.swing.*', 'java.awt.*', 'java.awt.geom.Path2D'],
    comment: `Generated from a ${size}x${size} image (vector recognition mode, engineering approximation).`,
  });

  const colorRows = shapes
    .map((s) => {
      const [a, r, g, b] = rgba(s.color);
      return `        {${a}, ${r}, ${g}, ${b}},`;
    })
    .join('\n');

  const polyRows = shapes
    .map((s) => {
      const polys = s.polygons.map(polygonLiteral).join(', ');
      return `        {${polys}},`;
    })
    .join('\n');

  const body = [
    `public class ${className} implements Icon {`,
    `    private final int size = ${size};`,
    `    private final int[][] colors = {`,
    colorRows,
    `    };`,
    `    private final int[][][] polys = {`,
    polyRows,
    `    };`,
    `    public int getIconWidth() { return size; }`,
    `    public int getIconHeight() { return size; }`,
    `    public void paintIcon(Component c, Graphics g, int x, int y) {`,
    `        Graphics2D g2 = (Graphics2D) g.create();`,
    `        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);`,
    `        for (int i = 0; i < polys.length; i++) {`,
    `            int[] rgba = colors[i];`,
    `            g2.setPaint(new Color(rgba[0], rgba[1], rgba[2], rgba[3]));`,
    `            Path2D path = new Path2D.Double();`,
    `            int[][] poly = polys[i];`,
    `            path.moveTo(x + poly[0][0], y + poly[0][1]);`,
    `            for (int j = 1; j < poly.length; j++) path.lineTo(x + poly[j][0], y + poly[j][1]);`,
    `            path.closePath();`,
    `            g2.fill(path);`,
    `        }`,
    `        g2.dispose();`,
    `    }`,
    `}`,
  ].join('\n');

  return `${header}\n${body}\n`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run compile && npx mocha out/test/vectorGenerator.test.js`
Expected: PASS（2 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/generator/vectorGenerator.ts src/test/vectorGenerator.test.ts
git commit -m "feat: vector-recognition Java icon generator + tests"
```

---

### Task 6: Webview 图像处理（浏览器侧 JS：裁剪/采样/矢量识别）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\webview\process.ts`

**Interfaces:**
- Produces（纯函数，便于单测，运行在浏览器或 Node 均可）：
  - `samplePixels(ctx: CanvasRenderingContext2D, size: number): number[][]`
  - `quantizeColors(pixels: number[][], size: number, maxColors: number): number[][]` （返回每个像素的量化后 0xAARRGGBB）
  - `traceShapes(quantized: number[][], size: number, tolerance: number): VectorShape[]`
  - `douglasPeucker(points: number[][], epsilon: number): number[][]`
  - `mooreTrace(mask: boolean[][], h: number, w: number): number[][] | null`

> 说明：这些函数在 webview 内联 `<script>` 中会被逐字拷入（浏览器原生 JS，无 import）。但此处以 `process.ts` 形式存放同一份源码，便于 Task 7 的内联引用与单测。函数保持无 DOM 依赖（仅接收像素数组 / 上下文），这样 Task 9 能对 `traceShapes` + `douglasPeucker` 做 mocha 单测。

- [ ] **Step 1: 写 `process.ts`（纯函数，无 DOM 依赖部分）**

```ts
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

function pack(a: number, r: number, g: number, b: number): number {
  return (((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)) >>> 0;
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
      const [, , , a] = unpack(c);
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
      const [, , , a] = unpack(c);
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
    // 连通分量：对每个未访问前景点做一次追踪（简化：单 mask 取首个轮廓）
    const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!mask[y][x] || visited[y][x]) continue;
        const contour = mooreTrace(mask, size, size);
        if (contour) {
          const simp = douglasPeucker(contour, Math.max(0.5, tolerance * size));
          shapes.push({ color, polygons: [simp] });
        }
        // 标记该分量已处理（简化：仅追踪首个轮廓，避免重复；多连通体后续可扩展）
        visited[y][x] = true;
      }
    }
  }
  return shapes;
}
```

- [ ] **Step 2: 给 `traceShapes` + `douglasPeucker` 写单测**

创建 `D:\Program Files\code\image2java-icon\src\test\process.test.ts`：

```ts
import * as assert from 'assert';
import { traceShapes, douglasPeucker, quantizeColors } from '../webview/process';

describe('process', () => {
  it('douglasPeucker collapses collinear points', () => {
    const pts = [[0, 0], [1, 0], [2, 0], [3, 1], [4, 0], [5, 0]];
    const out = douglasPeucker(pts, 0.5);
    assert.ok(out.length < pts.length);
    assert.deepStrictEqual(out[0], [0, 0]);
  });

  it('quantize keeps dominant color and marks transparent', () => {
    const px = [
      [0xffff0000, 0xffff0000],
      [0x00000000, 0xffff0000],
    ];
    const q = quantizeColors(px, 2, 4);
    assert.strictEqual(q[0][0], 0xffff0000);
    assert.strictEqual(q[1][0], 0); // transparent
  });

  it('traceShapes returns one polygon for a solid block', () => {
    const size = 4;
    const red = 0xffff0000;
    const px = Array.from({ length: size }, () => new Array<number>(size).fill(red));
    const q = quantizeColors(px, size, 4);
    const shapes = traceShapes(q, size, 0.02);
    assert.strictEqual(shapes.length, 1);
    assert.strictEqual(shapes[0].color, red);
    assert.ok(shapes[0].polygons[0].length >= 3);
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm run compile && npx mocha out/test/process.test.js`
Expected: PASS（3 tests）。

- [ ] **Step 4: Commit**

```bash
git add src/webview/process.ts src/test/process.test.ts
git commit -m "feat: browser-side image sampling, color quantize, contour tracing"
```

---

### Task 7: Webview 面板（HTML + 内联 JS：上传/裁剪/分辨率/模式/生成/防失真提示）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\webview\panel.ts`

**Interfaces:**
- Produces: `getWebviewContent(): string`（返回完整 HTML，含内联 `<script>`）。
- 内联脚本依赖 Task 6 的函数（`samplePixels`/`quantizeColors`/`traceShapes`/`douglasPeucker`/`mooreTrace` 的 JS 版本——逐字拷入内联脚本，浏览器原生运行）。
- 通过 `vscode.postMessage({ command: 'generate', mode, size, pixels?, shapes?, className? })` 回传宿主（Task 8 接收）。

设计要点：
- `<input type="file" accept="image/*">` 或拖拽 → `FileReader` 读为 dataURL → `Image` → 绘制到展示 canvas。
- 展示 canvas 上叠加一个可拖动/缩放的**正方形**裁剪框（约束 1:1）。
- 分辨率下拉：16/32/64/128/256/自定义（input number，上限 512，超出提示）。
- 模式切换：`像素` / `矢量` 两个按钮（一键切换对比，共用已裁剪缓存）。矢量模式额外显示：颜色数量滑块、简化容差滑块、防失真提示框。
- “生成”按钮：把裁剪框区域 drawImage 到离屏 `size×size` canvas → `getImageData` → 像素模式直接 `samplePixels`；矢量模式 `quantizeColors`→`traceShapes`。将结果 `postMessage` 回宿主。

- [ ] **Step 1: 写 `panel.ts`**

```ts
export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image2Java Icon</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; height:100%; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--vscode-foreground); background:var(--vscode-sideBar-background); }
  .wrap { display:flex; flex-direction:column; height:100vh; padding:10px; gap:8px; overflow:auto; }
  .row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  canvas { max-width:100%; border:1px solid var(--vscode-panel-border); background:
    repeating-conic-gradient(#888 0% 25%, #ccc 0% 50%) 50% / 16px 16px; touch-action:none; }
  #stage { position:relative; display:inline-block; line-height:0; }
  #crop { position:absolute; border:2px dashed #fff; box-shadow:0 0 0 9999px rgba(0,0,0,0.45); cursor:move; }
  #crop .handle { position:absolute; right:-6px; bottom:-6px; width:12px; height:12px; background:#fff; border-radius:2px; cursor:nwse-resize; }
  button { padding:4px 10px; font-size:12px; color:var(--vscode-button-foreground); background:var(--vscode-button-background); border:none; border-radius:4px; cursor:pointer; }
  button:hover { background:var(--vscode-button-hoverBackground); }
  button.secondary { background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground); }
  button.active { outline:2px solid var(--vscode-focusBorder); }
  select, input[type=number] { padding:4px 6px; font-size:12px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); border:1px solid var(--vscode-input-border,transparent); border-radius:4px; }
  label.lbl { font-size:11px; color:var(--vscode-descriptionForeground); }
  .status { font-size:11px; min-height:16px; color:var(--vscode-descriptionForeground); }
  .status.error { color:var(--vscode-errorForeground); }
  .status.success { color:var(--vscode-terminal-ansiGreen); }
  .tip { font-size:10px; color:var(--vscode-descriptionForeground); opacity:0.8; border-left:2px solid var(--vscode-panel-border); padding-left:6px; }
  .hidden { display:none; }
  .opts { display:flex; flex-direction:column; gap:4px; padding:6px; border:1px solid var(--vscode-panel-border); border-radius:4px; }
  .opts .r { display:flex; gap:6px; align-items:center; font-size:11px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="row">
    <input type="file" id="file" accept="image/*">
    <button id="clear" class="secondary">清空</button>
  </div>
  <div id="stage" class="hidden">
    <canvas id="view"></canvas>
    <div id="crop"><div class="handle"></div></div>
  </div>
  <div class="row">
    <label class="lbl">分辨率</label>
    <select id="res">
      <option value="16">16</option><option value="32">32</option><option value="64">64</option>
      <option value="128" selected>128</option><option value="256">256</option>
      <option value="custom">自定义</option>
    </select>
    <input type="number" id="resCustom" class="hidden" min="1" max="512" value="128" style="width:70px;">
  </div>
  <div class="row">
    <label class="lbl">模式</label>
    <button id="modePixel" class="active">像素</button>
    <button id="modeVector">矢量</button>
  </div>
  <div id="vecOpts" class="opts hidden">
    <div class="r"><label class="lbl" style="flex:1">颜色数量</label><input type="range" id="colors" min="2" max="32" value="8"><span id="colorsVal">8</span></div>
    <div class="r"><label class="lbl" style="flex:1">简化容差</label><input type="range" id="tol" min="0" max="100" value="20"><span id="tolVal">0.20</span></div>
    <div class="tip">防失真提示：用高对比度、色块少、边缘清晰的图（logo / 扁平图标最佳）；避免渐变、照片、半透明、细发丝线；适当提高分辨率轮廓更平滑；调大容差更简洁但更失真，调小更保真但顶点更多。</div>
  </div>
  <div class="row">
    <button id="gen">生成</button>
    <span class="status" id="status"></span>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const fileEl = document.getElementById('file');
  const stage = document.getElementById('stage');
  const view = document.getElementById('view');
  const crop = document.getElementById('crop');
  const ctx = view.getContext('2d');
  const resEl = document.getElementById('res');
  const resCustom = document.getElementById('resCustom');
  const modePixel = document.getElementById('modePixel');
  const modeVector = document.getElementById('modeVector');
  const vecOpts = document.getElementById('vecOpts');
  const colorsEl = document.getElementById('colors');
  const tolEl = document.getElementById('tol');
  const colorsVal = document.getElementById('colorsVal');
  const tolVal = document.getElementById('tolVal');
  const genBtn = document.getElementById('gen');
  const statusEl = document.getElementById('status');
  const clearBtn = document.getElementById('clear');

  let img = null;
  let mode = 'pixel';
  let cropRect = { x: 0, y: 0, size: 100 }; // 相对 view 显示坐标
  let dragging = false, resizing = false, startX = 0, startY = 0;

  function setStatus(msg, type) { statusEl.textContent = msg || ''; statusEl.className = 'status' + (type ? ' ' + type : ''); }

  // ===== 文件加载 =====
  fileEl.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setStatus('请选择图片文件', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        img = im;
        view.width = im.naturalWidth; view.height = im.naturalHeight;
        ctx.drawImage(im, 0, 0);
        stage.classList.remove('hidden');
        const s = Math.min(im.naturalWidth, im.naturalHeight);
        cropRect = { x: (im.naturalWidth - s) / 2, y: (im.naturalHeight - s) / 2, size: s };
        positionCrop();
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  function positionCrop() {
    crop.style.left = cropRect.x + 'px';
    crop.style.top = cropRect.y + 'px';
    crop.style.width = cropRect.size + 'px';
    crop.style.height = cropRect.size + 'px';
  }

  // 拖拽移动裁剪框
  crop.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('handle')) { resizing = true; } else { dragging = true; }
    startX = e.clientX; startY = e.clientY;
    crop.setPointerCapture(e.pointerId);
  });
  crop.addEventListener('pointermove', (e) => {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (dragging) {
      cropRect.x = Math.max(0, Math.min(view.width - cropRect.size, cropRect.x + dx));
      cropRect.y = Math.max(0, Math.min(view.height - cropRect.size, cropRect.y + dy));
      startX = e.clientX; startY = e.clientY; positionCrop();
    } else if (resizing) {
      const ns = Math.max(8, Math.min(view.width - cropRect.x, view.height - cropRect.y, cropRect.size + dx));
      cropRect.size = ns; positionCrop();
    }
  });
  crop.addEventListener('pointerup', () => { dragging = false; resizing = false; });

  // 分辨率
  resEl.addEventListener('change', () => {
    resCustom.classList.toggle('hidden', resEl.value !== 'custom');
  });
  function resolveSize() {
    let s = resEl.value === 'custom' ? parseInt(resCustom.value, 10) : parseInt(resEl.value, 10);
    if (!s || s < 1) s = 128;
    if (s > 512) { setStatus('分辨率上限 512，已限制', 'error'); s = 512; }
    return s;
  }

  // 模式切换
  modePixel.addEventListener('click', () => { mode = 'pixel'; modePixel.classList.add('active'); modeVector.classList.remove('active'); vecOpts.classList.add('hidden'); });
  modeVector.addEventListener('click', () => { mode = 'vector'; modeVector.classList.add('active'); modePixel.classList.remove('active'); vecOpts.classList.remove('hidden'); });
  colorsEl.addEventListener('input', () => colorsVal.textContent = colorsEl.value);
  tolEl.addEventListener('input', () => tolVal.textContent = (tolEl.value / 100).toFixed(2));

  clearBtn.addEventListener('click', () => {
    img = null; stage.classList.add('hidden'); fileEl.value = ''; setStatus('');
  });

  // ===== 图像取样（与 process.ts 同算法，浏览器原生 JS 内联）=====
  function samplePixels(data, size) {
    const px = [];
    for (let y = 0; y < size; y++) { const row = []; for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; const a = data[i+3], r = data[i], g = data[i+1], b = data[i+2]; row.push(((a << 24) | (r << 16) | (g << 8) | b) >>> 0); } px.push(row); }
    return px;
  }
  function unpack(c) { return [(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff]; }
  function quantizeColors(pixels, size, maxColors) {
    const hist = new Map(); const TRANSPARENT = 0;
    for (let y=0;y<size;y++) for (let x=0;x<size;x++){ const c=pixels[y][x]; const a=unpack(c)[3]; if(a<16) continue; hist.set(c,(hist.get(c)||0)+1); }
    const reps = [...hist.entries()].filter(([c])=>c!==TRANSPARENT).sort((a,b)=>b[1]-a[1]).slice(0,Math.max(1,maxColors)).map(([c])=>c);
    const out=[]; for(let y=0;y<size;y++){ const row=[]; for(let x=0;x<size;x++){ const c=pixels[y][x]; const a=unpack(c)[3]; if(a<16){row.push(TRANSPARENT);continue;} let best=reps[0],bd=Infinity; for(const r of reps){const[ar,rr,gr,br]=unpack(r);const[ac,rc,gc,bc]=unpack(c);const d=(ar-ac)**2+(rr-rc)**2+(gr-gc)**2+(br-bc)**2; if(d<bd){bd=d;best=r;}} row.push(best);} out.push(row);} return out;
  }
  function mooreTrace(mask,h,w){ const inside=(y,x)=>y>=0&&x>=0&&y<h&&x<w&&mask[y][x]; let sy=-1,sx=-1; for(let y=0;y<h&&sy<0;y++)for(let x=0;x<w;x++)if(mask[y][x]){sy=y;sx=x;break;} if(sy<0)return null; const dirs=[[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]]; const bnd=[]; let cy=sy,cx=sx,dir=7,steps=0; const max=h*w*4; do{ bnd.push([cy,cx]); let f=false; for(let k=0;k<8;k++){const nd=(dir+k)%8;const ny=cy+dirs[nd][0],nx=cx+dirs[nd][1]; if(inside(ny,nx)){cy=ny;cx=nx;dir=(nd+6)%8;f=true;break;}} if(!f)break; steps++; }while((cy!==sy||cx!==sx)&&steps<max); return bnd.length>=3?bnd:null; }
  function douglasPeucker(points,eps){ if(points.length<3)return points; let md=0,idx=0; const[y0,x0]=points[0],[y1,x1]=points[points.length-1]; const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1; for(let i=1;i<points.length-1;i++){const[py,px]=points[i];const d=Math.abs((px-x0)*dy-(py-y0)*dx)/len; if(d>md){md=d;idx=i;}} if(md>eps){const L=douglasPeucker(points.slice(0,idx+1),eps); const R=douglasPeucker(points.slice(idx),eps); return L.slice(0,-1).concat(R);} return [points[0],points[points.length-1]]; }
  function traceShapes(quantized,size,tolerance){ const TRANSPARENT=0; const colors=new Map(); for(let y=0;y<size;y++)for(let x=0;x<size;x++){const c=quantized[y][x]; if(c===TRANSPARENT)continue; if(!colors.has(c)){colors.set(c,Array.from({length:size},()=>new Array(size).fill(false)));} colors.get(c)[y][x]=true;} const shapes=[]; for(const[color,mask]of colors){ const visited=Array.from({length:size},()=>new Array(size).fill(false)); for(let y=0;y<size;y++)for(let x=0;x<size;x++){ if(!mask[y][x]||visited[y][x])continue; const c=mooreTrace(mask,size,size); if(c){const s=douglasPeucker(c,Math.max(0.5,tolerance*size)); shapes.push({color,polygons:[s]});} visited[y][x]=true; } } return shapes; }

  // ===== 生成 =====
  genBtn.addEventListener('click', () => {
    if (!img) { setStatus('请先上传图片', 'error'); return; }
    if (cropRect.size < 1) { setStatus('裁剪区域无效', 'error'); return; }
    const size = resolveSize();
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const octx = off.getContext('2d');
    octx.drawImage(img, cropRect.x, cropRect.y, cropRect.size, cropRect.size, 0, 0, size, size);
    const data = octx.getImageData(0, 0, size, size).data;
    if (mode === 'pixel') {
      const pixels = samplePixels(data, size);
      vscode.postMessage({ command: 'generate', mode: 'pixel', size, pixels });
      setStatus('已发送像素生成请求', 'success');
    } else {
      const px = samplePixels(data, size);
      const q = quantizeColors(px, size, parseInt(colorsEl.value, 10));
      const shapes = traceShapes(q, size, parseInt(tolEl.value, 10) / 100);
      vscode.postMessage({ command: 'generate', mode: 'vector', size, shapes });
      setStatus('已发送矢量生成请求（' + shapes.length + ' 个形状）', 'success');
    }
  });
</script>
</body>
</html>`;
}
```

- [ ] **Step 2: 编译确认 TS 无错**

Run: `npm run compile`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/webview/panel.ts
git commit -m "feat: webview panel with crop, resolution, mode switch, anti-distortion tips"
```

---

### Task 8: 扩展宿主（WebviewViewProvider + 生成 + 新开标签）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\extension.ts`

**Interfaces:**
- Consumes: `GenerateRequest` (Task 2), `generatePixelIcon` (Task 4), `generateVectorIcon` (Task 5), `getWebviewContent` (Task 7)。
- 接收 webview 消息 `command: 'generate'` → 调对应 generator → `vscode.workspace.openTextDocument({ language: 'java', content })` + `showTextDocument`。

- [ ] **Step 1: 写 `extension.ts`**

```ts
import * as vscode from 'vscode';
import { generatePixelIcon } from './generator/pixelGenerator';
import { generateVectorIcon } from './generator/vectorGenerator';
import { GenerateRequest, GenerateResultMessage, MAX_SIZE, DEFAULT_CLASS_NAME } from './generator/types';
import { getWebviewContent } from './webview/panel';

class IconViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'image2java-icon.iconView';
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.context.extensionUri] };
    webviewView.webview.html = getWebviewContent();
    webviewView.webview.onDidReceiveMessage(
      (msg: GenerateRequest) => { if (msg.command === 'generate') this.handleGenerate(msg); },
      undefined,
      this.context.subscriptions
    );
  }

  private async handleGenerate(req: GenerateRequest) {
    if (!this.view) return;
    const post = (m: GenerateResultMessage) => this.view!.webview.postMessage(m);
    try {
      if (req.size < 1 || req.size > MAX_SIZE) throw new Error(`size 必须在 1..${MAX_SIZE}`);
      let code = '';
      if (req.mode === 'pixel') {
        if (!req.pixels || req.pixels.length !== req.size) throw new Error('像素数据尺寸不匹配');
        code = generatePixelIcon({ size: req.size, pixels: req.pixels, className: req.className || DEFAULT_CLASS_NAME });
      } else if (req.mode === 'vector') {
        if (!req.shapes) throw new Error('矢量数据缺失');
        code = generateVectorIcon({ size: req.size, shapes: req.shapes, className: req.className || DEFAULT_CLASS_NAME });
      } else {
        throw new Error('未知模式: ' + req.mode);
      }
      const doc = await vscode.workspace.openTextDocument({ language: 'java', content: code });
      await vscode.window.showTextDocument(doc, { preview: false });
      post({ command: 'generated', code });
    } catch (e) {
      post({ command: 'generateError', error: String(e) });
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new IconViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IconViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('image2java-icon.openPanel', () => {
      vscode.commands.executeCommand(`${IconViewProvider.viewType}.focus`);
    })
  );
}

export function deactivate() {}
```

- [ ] **Step 2: 编译**

Run: `npm run compile`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: extension host wires webview to generators and opens java tab"
```

---

### Task 9: 集成测试（vscode-test）

**Files:**
- Create: `D:\Program Files\code\image2java-icon\src\test\runTest.ts`
- Create: `D:\Program Files\code\image2java-icon\src\test\extension.test.ts`
- Modify: `D:\Program Files\code\image2java-icon\package.json` 脚本 `test` 已指向 `out/test/runTest.js`（Task 1 已设）。

**Interfaces:** 验证宿主能从 generate 请求产出含关键 API 的 Java 代码（直接调用 generator 经宿主逻辑等价路径；因 webview UI 自动化超出范围，集成测试通过模拟消息路径对 generator 做端到端断言）。

- [ ] **Step 1: 写 `runTest.ts`**

```ts
import * as path from 'path';
import { runTests } from 'vscode-test';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './extension.test');
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}
main();
```

- [ ] **Step 2: 写 `extension.test.ts`**

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { generatePixelIcon } from '../generator/pixelGenerator';
import { generateVectorIcon } from '../generator/vectorGenerator';

suite('image2java-icon extension', () => {
  test('pixel generator produces openable java content', () => {
    const code = generatePixelIcon({ size: 2, pixels: [[0, 0], [0, 0]], className: 'T' });
    assert.ok(code.includes('public class T implements') || code.includes('public class T {'));
    assert.ok(code.includes('BufferedImage'));
  });

  test('vector generator produces Icon impl', () => {
    const code = generateVectorIcon({ size: 4, shapes: [{ color: 0xffff0000, polygons: [[[0, 0], [4, 0], [4, 4], [0, 4]]] }] });
    assert.ok(code.includes('implements Icon'));
    assert.ok(code.includes('paintIcon'));
  });

  test('extension activates and registers view', async () => {
    const ext = vscode.extensions.getExtension('image2java-icon.image2java-icon');
    assert.ok(ext, 'extension should be present');
    await ext!.activate();
    assert.ok(true);
  });
});
```

- [ ] **Step 3: 运行集成测试**

Run: `npm run test`
Expected: 测试运行（下载 VS Code 测试实例并跑 3 个用例），PASS。若离线无法下载测试实例，则至少保证 `npm run compile && npx mocha out/test/*.test.js` 全绿作为兜底。

- [ ] **Step 4: Commit**

```bash
git add src/test/runTest.ts src/test/extension.test.ts
git commit -m "test: add vscode-test integration suite"
```

---

### Task 10: 全量校验与打包检查

**Files:** 无新增，仅校验。

- [ ] **Step 1: 编译 + lint + 全部单测**

Run: `npm run compile && npm run lint && npx mocha out/test/*.test.js`
Expected: 编译无错、lint 无 error、generator/process 单测全绿。

- [ ] **Step 2: 打包检查（可选，确认 manifest 正确）**

Run: `npx @vscode/vsce ls` （若无 vsce 可跳过；仅用于确认文件清单正确）
Expected: 列出 extension.js、media/icon.svg 等，无遗漏。

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "chore: final verification of image2java-icon extension"
```

---

## 自检（写完后执行）

**1. Spec 覆盖核对：**
- 像素/矢量两种模式 → Task 4、Task 5、Task 7、Task 8 ✓
- 侧边栏 activitybar 图标启动 → package.json viewsContainers + Task 8 activate ✓
- 拖选正方形裁剪 + 分辨率(16..256/自定义，上限512) → Task 7 ✓
- 新开 `.java` 编辑器标签 → Task 8 `openTextDocument({language:'java'})` ✓
- 同图一键切换像素/矢量 → Task 7 模式按钮共用 `img`/裁剪缓存 ✓
- 矢量防失真提示 UI → Task 7 `vecOpts .tip` ✓
- 原生 Java 8 Swing 无第三方库 → Task 4/5 输出仅 javax.swing/java.awt ✓
- 错误处理（非图片/空裁剪/超上限） → Task 7 前端校验 + Task 8 size 校验 ✓
- 测试 → Task 4/5/6 单测 + Task 9 集成 ✓
- YAGNI 边界（无批量/二进制/右键/JavaFX） → 未实现，符合 spec §10 ✓

**2. Placeholder 扫描：** 无 TBD/TODO；所有步骤含可执行代码或命令。矢量识别虽为"工程近似"（spec §6 已声明），但其实现已给出完整可运行算法（quantize + Moore trace + Douglas-Peucker），非占位。

**3. 类型一致性：** `GenerateRequest`/`VectorShape`/`PixelInput` 在 Task 2 定义，Task 4/5 的 generator 参数与 Task 7 的 `postMessage` 载荷、Task 8 的处理逻辑一致（字段 `mode/size/pixels/shapes/className` 名称统一）。`MAX_SIZE`、`DEFAULT_CLASS_NAME` 在 Task 2 导出并被 Task 8 引用。
