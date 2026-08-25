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
