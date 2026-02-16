import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../pipeline';
import { createFloatTexture } from '../texture-utils';
import { createDefaultEdits } from '../../types/edits';
import { createSolidColorData, createGradientData } from '../../test/test-textures';

describe('RenderPipeline (browser)', () => {
  function createTestPipeline(width = 64, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const pipeline = new RenderPipeline(canvas);
    return { canvas, pipeline };
  }

  function readCenterPixel(canvas: HTMLCanvasElement): [number, number, number, number] {
    const gl = canvas.getContext('webgl2')!;
    const pixel = new Uint8Array(4);
    gl.readPixels(canvas.width / 2, canvas.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [pixel[0], pixel[1], pixel[2], pixel[3]];
  }

  it('passthrough renders correct colors for solid input', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    // Mid-gray in linear = 0.5, which in sRGB ~ 188/255
    const data = createSolidColorData(64, 64, 0.5, 0.5, 0.5);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);
    pipeline.render(createDefaultEdits());

    const pixel = readCenterPixel(canvas);
    // After sRGB gamma, 0.5 linear -> ~188
    expect(pixel[0]).toBeGreaterThan(170);
    expect(pixel[0]).toBeLessThan(200);
  });

  it('exposure +1 EV approximately doubles brightness', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    const data = createSolidColorData(64, 64, 0.25, 0.25, 0.25);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);

    // Render at default exposure
    const defaultEdits = createDefaultEdits();
    pipeline.render(defaultEdits);
    const basePixel = readCenterPixel(canvas);

    // Render at +1 EV
    const brightEdits = createDefaultEdits();
    brightEdits.exposure = 1.0;
    pipeline.render(brightEdits);
    const brightPixel = readCenterPixel(canvas);

    // Pixel should be notably brighter
    expect(brightPixel[0]).toBeGreaterThan(basePixel[0] + 20);
  });

  it('identity edits preserve a gradient without clipping', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    const data = createGradientData(64, 64);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);
    pipeline.render(createDefaultEdits());

    // Left edge should be near black
    const leftPixel = new Uint8Array(4);
    gl.readPixels(1, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, leftPixel);
    expect(leftPixel[0]).toBeLessThan(20);

    // Right edge should be near white
    const rightPixel = new Uint8Array(4);
    gl.readPixels(62, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rightPixel);
    expect(rightPixel[0]).toBeGreaterThan(240);
  });

  it('saturation -100 produces a grayscale image', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    // A saturated red pixel
    const data = createSolidColorData(64, 64, 0.8, 0.2, 0.1);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);

    const edits = createDefaultEdits();
    edits.saturation = -100;
    pipeline.render(edits);

    const pixel = readCenterPixel(canvas);
    // R, G, B should be approximately equal (grayscale)
    expect(Math.abs(pixel[0] - pixel[1])).toBeLessThan(5);
    expect(Math.abs(pixel[1] - pixel[2])).toBeLessThan(5);
  });
});
