import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetsPanel } from '../PresetsPanel';
import { useEditStore } from '../../../store/editStore';

describe('PresetsPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders preset group names', () => {
    render(<PresetsPanel />);
    expect(screen.getByText('Fujifilm')).toBeInTheDocument();
  });

  it('renders preset names within a group', () => {
    render(<PresetsPanel />);
    expect(screen.getByText('Velvia/Vivid')).toBeInTheDocument();
    expect(screen.getByText('Classic Chrome')).toBeInTheDocument();
  });

  it('applies preset on click', () => {
    render(<PresetsPanel />);
    fireEvent.click(screen.getByText('Velvia/Vivid'));

    const state = useEditStore.getState();
    // Velvia has high saturation — verify it was applied
    expect(state.edits.saturation).toBeGreaterThan(0);
    expect(state.edits.contrast).toBeGreaterThan(0);
  });

  it('creates a history entry when preset is applied', () => {
    render(<PresetsPanel />);
    fireEvent.click(screen.getByText('Velvia/Vivid'));

    const state = useEditStore.getState();
    const lastEntry = state.history[state.historyIndex];
    expect(lastEntry.label).toBe('Preset: Velvia/Vivid');
  });

  it('can collapse a preset group', () => {
    render(<PresetsPanel />);
    // Click the group header to collapse
    fireEvent.click(screen.getByText('Fujifilm'));
    // Presets inside should be hidden
    expect(screen.queryByText('Velvia/Vivid')).not.toBeVisible();
  });
});
