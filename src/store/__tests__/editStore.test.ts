import { describe, it, expect, beforeEach } from 'vitest';
import { useEditStore } from '../editStore';

describe('editStore', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    // Reset isDirty after resetAll sets it
    useEditStore.setState({ isDirty: false });
  });

  it('starts with default edits', () => {
    const state = useEditStore.getState();
    expect(state.edits.exposure).toBe(0);
    expect(state.edits.whiteBalance).toBe(5500);
    expect(state.isDirty).toBe(false);
  });

  it('setParam updates a top-level field and marks dirty', () => {
    useEditStore.getState().setParam('exposure', 1.5);
    const state = useEditStore.getState();
    expect(state.edits.exposure).toBe(1.5);
    expect(state.isDirty).toBe(true);
  });

  it('setNestedParam updates a nested field', () => {
    useEditStore.getState().setNestedParam('sharpening.amount', 75);
    expect(useEditStore.getState().edits.sharpening.amount).toBe(75);
  });

  it('loadEdits merges partial edits over defaults', () => {
    useEditStore.getState().loadEdits({ exposure: 2.0, contrast: 50 });
    const edits = useEditStore.getState().edits;
    expect(edits.exposure).toBe(2.0);
    expect(edits.contrast).toBe(50);
    expect(edits.whiteBalance).toBe(5500); // kept default
    expect(useEditStore.getState().isDirty).toBe(false);
  });

  it('resetAll returns all values to defaults', () => {
    useEditStore.getState().setParam('exposure', 3.0);
    useEditStore.getState().setParam('contrast', -50);
    useEditStore.getState().resetAll();
    const edits = useEditStore.getState().edits;
    expect(edits.exposure).toBe(0);
    expect(edits.contrast).toBe(0);
  });
});
