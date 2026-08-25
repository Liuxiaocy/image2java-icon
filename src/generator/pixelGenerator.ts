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
