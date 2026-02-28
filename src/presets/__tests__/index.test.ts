import { describe, it, expect } from 'vitest';
import { builtinPresetGroups } from '../index';

describe('builtinPresetGroups', () => {
  it('exports at least one preset group', () => {
    expect(builtinPresetGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('every group has id, name, and presets', () => {
    for (const group of builtinPresetGroups) {
      expect(group.id).toBeTruthy();
      expect(group.name).toBeTruthy();
      expect(group.presets.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every preset has id, name, description, and edits', () => {
    for (const group of builtinPresetGroups) {
      for (const preset of group.presets) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(preset.edits).toBeDefined();
      }
    }
  });

  it('all preset ids are unique across groups', () => {
    const ids = builtinPresetGroups.flatMap((g) => g.presets.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
