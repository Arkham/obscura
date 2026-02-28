import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../pipeline';
import { createFloatTexture } from '../texture-utils';
import { createDefaultEdits } from '../../types/edits';
import {
  createGradientData,
  createSolidColorData,
  createColorWheelData,
} from '../../test/test-textures';
import { builtinPresetGroups } from '../../presets/index';

const SIZE = 32;

async function hashPixels(data: Uint8ClampedArray): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function createTestPipeline(width = SIZE, height = SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const pipeline = new RenderPipeline(canvas);
  const gl = canvas.getContext('webgl2')!;
  return { canvas, pipeline, gl };
}

function renderAndHash(
  pipeline: RenderPipeline,
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  width: number,
  height: number,
  edits: ReturnType<typeof createDefaultEdits>,
): Promise<string> {
  const imageData = pipeline.renderToImageData(texture, width, height, edits);
  return hashPixels(imageData.data);
}

describe('visual regression snapshots', () => {
  describe('individual effects', () => {
    it('exposure +1', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.exposure = 1.0;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('exposure -1', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.exposure = -1.0;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('contrast +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.contrast = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('highlights +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.highlights = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('shadows +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.shadows = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('whites +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.whites = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('blacks -50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.blacks = -50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('saturation +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.saturation = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('vibrance +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.vibrance = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('white balance 3500K', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.whiteBalance = 3500;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('dehaze +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.dehaze = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('detail effects', () => {
    it('clarity +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.clarity = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('texture +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.texture = 50;
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('sharpening amount 80', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.sharpening = { amount: 80, radius: 1.0, detail: 50 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('noise reduction luminance 50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.noiseReduction = { luminance: 50, color: 0 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('vignette', () => {
    it('vignette -50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.vignette = { amount: -50, midpoint: 50, roundness: 0, feather: 50 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('vignette +50', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.vignette = { amount: 50, midpoint: 50, roundness: 0, feather: 50 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('HSL adjustments', () => {
    it('hue shift red +30', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.hsl.hue[0] = 30; // Red hue shift
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('saturation green +40', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.hsl.saturation[3] = 40; // Green saturation
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('luminance blue -30', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.hsl.luminance[5] = -30; // Blue luminance
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('tone curves', () => {
    it('S-curve on gradient', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.toneCurve.rgb = [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.15 },
        { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.85 },
        { x: 1, y: 1 },
      ];
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('red channel lift', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.toneCurve.red = [
        { x: 0, y: 0.1 },
        { x: 1, y: 1 },
      ];
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('color grading', () => {
    it('shadow tint blue', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.colorGrading.shadows = { hue: 210, saturation: 30, luminance: 0 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('highlight tint warm', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.colorGrading.highlights = { hue: 40, saturation: 25, luminance: 5 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('midtone + global tint', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.colorGrading.midtones = { hue: 120, saturation: 15, luminance: 0 };
      edits.colorGrading.global = { hue: 30, saturation: 10, luminance: 0 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('presets', () => {
    const allPresets = builtinPresetGroups.flatMap((g) =>
      g.presets.map((p) => [p.id, p] as const),
    );

    it.each(allPresets)('preset %s', async (_id, preset) => {
      const { pipeline, gl } = createTestPipeline();
      const data = createGradientData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = { ...createDefaultEdits(), ...preset.edits };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });

  describe('combined effects', () => {
    it('exposure + contrast + saturation + vignette', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.exposure = 0.5;
      edits.contrast = 30;
      edits.saturation = -20;
      edits.vignette = { amount: -30, midpoint: 50, roundness: 0, feather: 50 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });

    it('full edit stack: WB + exposure + HSL + curves + grading + sharpening', async () => {
      const { pipeline, gl } = createTestPipeline();
      const data = createColorWheelData(SIZE, SIZE);
      const tex = createFloatTexture(gl, SIZE, SIZE, data);
      const edits = createDefaultEdits();
      edits.whiteBalance = 4500;
      edits.exposure = 0.3;
      edits.contrast = 15;
      edits.highlights = -20;
      edits.shadows = 10;
      edits.vibrance = 15;
      edits.saturation = -5;
      edits.hsl.hue[0] = 10;
      edits.hsl.saturation[3] = 20;
      edits.toneCurve.rgb = [
        { x: 0, y: 0.02 },
        { x: 0.25, y: 0.22 },
        { x: 0.75, y: 0.78 },
        { x: 1, y: 0.98 },
      ];
      edits.colorGrading.shadows = { hue: 210, saturation: 15, luminance: -3 };
      edits.colorGrading.highlights = { hue: 40, saturation: 10, luminance: 2 };
      edits.sharpening = { amount: 60, radius: 1.0, detail: 40 };
      const hash = await renderAndHash(pipeline, gl, tex, SIZE, SIZE, edits);
      expect(hash).toMatchSnapshot();
    });
  });
});
