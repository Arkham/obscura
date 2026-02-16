import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '../catalogStore';

describe('catalogStore', () => {
  it('starts with empty entries and no selection', () => {
    const state = useCatalogStore.getState();
    expect(state.entries).toEqual([]);
    expect(state.selectedIndex).toBe(-1);
    expect(state.dirHandle).toBeNull();
  });

  it('setSelectedIndex updates selection', () => {
    useCatalogStore.getState().setSelectedIndex(3);
    expect(useCatalogStore.getState().selectedIndex).toBe(3);
  });
});
