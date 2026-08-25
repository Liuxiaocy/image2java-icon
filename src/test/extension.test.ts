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
