import { describe, it, expect } from 'vitest';
import { createDefaultEdits, PARAM_RANGES, HSL_LABELS } from '../edits';

describe('createDefaultEdits', () => {
  it('returns a valid EditState with all fields set', () => {
    const defaults = createDefaultEdits();
    expect(defaults.whiteBalance).toBe(5500);
    expect(defaults.exposure).toBe(0);
    expect(defaults.contrast).toBe(0);
    expect(defaults.crop).toBeNull();
  });

  it('returns HSL arrays of length 8', () => {
    const defaults = createDefaultEdits();
    expect(defaults.hsl.hue).toHaveLength(8);
    expect(defaults.hsl.saturation).toHaveLength(8);
    expect(defaults.hsl.luminance).toHaveLength(8);
  });

  it('returns tone curve with 2 endpoints per channel', () => {
    const defaults = createDefaultEdits();
    expect(defaults.toneCurve.rgb).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(defaults.toneCurve.red).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('returns a new object each call (no shared references)', () => {
    const a = createDefaultEdits();
    const b = createDefaultEdits();
    expect(a).not.toBe(b);
    expect(a.hsl.hue).not.toBe(b.hsl.hue);
  });
});

describe('PARAM_RANGES', () => {
  it('has min < max for all ranges', () => {
    for (const [, range] of Object.entries(PARAM_RANGES)) {
      expect(range.min).toBeLessThan(range.max);
    }
  });

  it('has default within min/max for all ranges', () => {
    for (const [, range] of Object.entries(PARAM_RANGES)) {
      expect(range.default).toBeGreaterThanOrEqual(range.min);
      expect(range.default).toBeLessThanOrEqual(range.max);
    }
  });

  it('has positive step for all ranges', () => {
    for (const [, range] of Object.entries(PARAM_RANGES)) {
      expect(range.step).toBeGreaterThan(0);
    }
  });
});

describe('HSL_LABELS', () => {
  it('has 8 labels', () => {
    expect(HSL_LABELS).toHaveLength(8);
  });
});
