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
