import { describe, it, expect } from 'vitest';
import { createDefaultEdits } from '../types/edits';
import { serializeSidecar, deserializeSidecar } from '../io/sidecar';

describe('integration: sidecar round-trip', () => {
  it('preserves complex edits through serialize/deserialize cycle', () => {
    const edits = createDefaultEdits();
    edits.exposure = 1.5;
    edits.contrast = -25;
    edits.highlights = 40;
    edits.shadows = -30;
    edits.toneCurve.rgb = [
      { x: 0, y: 0.05 },
      { x: 0.25, y: 0.15 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 0.95 },
    ];
    edits.hsl.saturation = [10, 20, -10, 0, 5, -30, 15, 0];
    edits.colorGrading.shadows = { hue: 220, saturation: 30, luminance: -5 };
    edits.sharpening = { amount: 40, radius: 1.2, detail: 30 };
    edits.vignette = { amount: -25, midpoint: 50, roundness: 0, feather: 60 };
    edits.crop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8, rotation: 0 };

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);
    const restored = { ...createDefaultEdits(), ...partial };

    expect(restored.exposure).toBe(edits.exposure);
    expect(restored.contrast).toBe(edits.contrast);
    expect(restored.highlights).toBe(edits.highlights);
    expect(restored.shadows).toBe(edits.shadows);
    expect(restored.toneCurve.rgb).toEqual(edits.toneCurve.rgb);
    expect(restored.hsl.saturation).toEqual(edits.hsl.saturation);
    expect(restored.colorGrading.shadows).toEqual(edits.colorGrading.shadows);
    expect(restored.sharpening).toEqual(edits.sharpening);
    expect(restored.vignette).toEqual(edits.vignette);
    expect(restored.crop).toEqual(edits.crop);
    // Fields not modified should be defaults
    expect(restored.whiteBalance).toBe(5500);
    expect(restored.dehaze).toBe(0);
    expect(restored.vibrance).toBe(0);
  });

  it('handles multiple serialize/deserialize cycles without drift', () => {
    const edits = createDefaultEdits();
    edits.exposure = 2.5;
    edits.toneCurve.red = [
      { x: 0, y: 0.1 },
      { x: 0.5, y: 0.6 },
      { x: 1, y: 0.9 },
    ];

    // First cycle
    const json1 = serializeSidecar(edits);
    const partial1 = deserializeSidecar(json1);
    const restored1 = { ...createDefaultEdits(), ...partial1 };

    // Second cycle
    const json2 = serializeSidecar(restored1);
    const partial2 = deserializeSidecar(json2);
    const restored2 = { ...createDefaultEdits(), ...partial2 };

    expect(restored2.exposure).toBe(edits.exposure);
    expect(restored2.toneCurve.red).toEqual(edits.toneCurve.red);
  });
});
