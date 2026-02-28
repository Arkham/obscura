import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryPanel } from '../HistoryPanel';
import { useEditStore } from '../../../store/editStore';
import { createDefaultEdits } from '../../../types/edits';

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe('HistoryPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders header', () => {
    render(<HistoryPanel />);
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('displays history entries', () => {
    render(<HistoryPanel />);
    // After resetAll, there should be at least one entry
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows relative time for entries', () => {
    render(<HistoryPanel />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('renders entries from loaded history', () => {
    useEditStore.getState().loadEdits(createDefaultEdits(), {
      entries: [
        { label: 'Original', edits: {} },
        { label: 'Exposure: 1', edits: { exposure: 1 } },
      ],
      index: 1,
    });

    render(<HistoryPanel />);
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Exposure: 1')).toBeInTheDocument();
  });
});
