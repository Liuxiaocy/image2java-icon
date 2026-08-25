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
