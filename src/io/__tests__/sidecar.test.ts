import { describe, it, expect } from 'vitest';
import { serializeSidecar, deserializeSidecar } from '../sidecar';
import { createDefaultEdits } from '../../types/edits';

describe('sidecar serialization', () => {
  it('serializes only non-default values (sparse)', () => {
    const edits = createDefaultEdits();
    edits.exposure = 1.5;
    edits.contrast = 25;
    const json = serializeSidecar(edits);
    const parsed = JSON.parse(json);

    expect(parsed.exposure).toBe(1.5);
    expect(parsed.contrast).toBe(25);
    // Default values should NOT be present
    expect(parsed.whiteBalance).toBeUndefined();
    expect(parsed.highlights).toBeUndefined();
    expect(parsed.saturation).toBeUndefined();
  });

  it('serializes empty edits as empty object', () => {
    const edits = createDefaultEdits();
    const json = serializeSidecar(edits);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toHaveLength(0);
  });

  it('round-trips through serialize/deserialize', () => {
    const edits = createDefaultEdits();
    edits.exposure = -2.0;
    edits.toneCurve.rgb = [
      { x: 0, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 },
    ];
    edits.hsl.hue = [10, -20, 30, 0, 0, 0, -15, 5];

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);
    const restored = { ...createDefaultEdits(), ...partial };

    expect(restored.exposure).toBe(-2.0);
    expect(restored.toneCurve.rgb).toEqual(edits.toneCurve.rgb);
    expect(restored.hsl.hue).toEqual(edits.hsl.hue);
    // Values not in sidecar should be defaults
    expect(restored.contrast).toBe(0);
  });

  it('handles complex nested edits', () => {
    const edits = createDefaultEdits();
    edits.colorGrading.shadows = { hue: 220, saturation: 30, luminance: -10 };
    edits.sharpening = { amount: 50, radius: 1.5, detail: 40 };

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);

    expect(partial.colorGrading?.shadows).toEqual({ hue: 220, saturation: 30, luminance: -10 });
    expect(partial.sharpening).toEqual({ amount: 50, radius: 1.5, detail: 40 });
  });
});
