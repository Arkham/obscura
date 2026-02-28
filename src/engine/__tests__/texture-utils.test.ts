import { describe, it, expect } from 'vitest';
import { createRgbFloatTexture } from '../texture-utils';

function createMockGL2() {
  let capturedData: Float32Array | null = null;
  return {
    TEXTURE_2D: 0x0de1,
    RGBA32F: 0x8814,
    RGBA: 0x1908,
    FLOAT: 0x1406,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    createTexture: () => ({}),
    bindTexture: () => {},
    texImage2D: (
      _target: number,
      _level: number,
      _internalformat: number,
      _w: number,
      _h: number,
      _border: number,
      _format: number,
      _type: number,
      data: Float32Array,
    ) => {
      capturedData = new Float32Array(data);
    },
    texParameteri: () => {},
    getCapturedData: () => capturedData,
  };
}

describe('createRgbFloatTexture', () => {
  it('converts RGB to RGBA with alpha 1.0', () => {
    const gl = createMockGL2();
    // 2x1 image: red pixel, green pixel
    const rgb = new Float32Array([1, 0, 0, 0, 1, 0]);
    createRgbFloatTexture(gl as unknown as WebGL2RenderingContext, 2, 1, rgb);
    const rgba = gl.getCapturedData()!;
    expect(rgba.length).toBe(2 * 1 * 4);
    // Single row, no Y-flip effect
    // Pixel 0: R=1, G=0, B=0, A=1
    expect(rgba[0]).toBe(1);
    expect(rgba[1]).toBe(0);
    expect(rgba[2]).toBe(0);
    expect(rgba[3]).toBe(1);
  });

  it('flips Y axis', () => {
    const gl = createMockGL2();
    // 1x2 image: top row = red (1,0,0), bottom row = blue (0,0,1)
    const rgb = new Float32Array([1, 0, 0, 0, 0, 1]);
    createRgbFloatTexture(gl as unknown as WebGL2RenderingContext, 1, 2, rgb);
    const rgba = gl.getCapturedData()!;
    // After flip: src row 0 (red) maps to dst row 1, src row 1 (blue) maps to dst row 0
    // So rgba[0..3] = blue (0,0,1,1), rgba[4..7] = red (1,0,0,1)
    expect(rgba[0]).toBe(0); // blue pixel R
    expect(rgba[2]).toBe(1); // blue pixel B
    expect(rgba[4]).toBe(1); // red pixel R
    expect(rgba[6]).toBe(0); // red pixel B
  });
});
