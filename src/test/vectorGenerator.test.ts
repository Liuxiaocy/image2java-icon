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
