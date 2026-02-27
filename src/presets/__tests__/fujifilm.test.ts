import { describe, it, expect } from 'vitest';
import { fujifilmPresets } from '../fujifilm';
import { createDefaultEdits, PARAM_RANGES } from '../../types/edits';

describe('fujifilmPresets', () => {
  it('has correct group metadata', () => {
    expect(fujifilmPresets.id).toBe('fujifilm');
    expect(fujifilmPresets.name).toBe('Fujifilm');
    expect(fujifilmPresets.presets.length).toBe(17);
  });

  it('every preset has required fields', () => {
    for (const preset of fujifilmPresets.presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(typeof preset.edits).toBe('object');
    }
  });

  it('every preset has unique id', () => {
    const ids = fujifilmPresets.presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preset edits merge cleanly onto defaults', () => {
    const defaults = createDefaultEdits();
    for (const preset of fujifilmPresets.presets) {
      const merged = { ...defaults, ...preset.edits };
      // Should still be a valid EditState shape
      expect(typeof merged.exposure).toBe('number');
      expect(typeof merged.contrast).toBe('number');
      expect(typeof merged.saturation).toBe('number');
    }
  });

  it('preset values are within parameter ranges', () => {
    for (const preset of fujifilmPresets.presets) {
      for (const [key, value] of Object.entries(preset.edits)) {
        const range = PARAM_RANGES[key];
        if (range && typeof value === 'number') {
          expect(value).toBeGreaterThanOrEqual(range.min);
          expect(value).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });
});
