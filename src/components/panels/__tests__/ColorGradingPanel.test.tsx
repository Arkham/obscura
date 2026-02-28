import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColorGradingPanel } from '../ColorGradingPanel';
import { useEditStore } from '../../../store/editStore';

describe('ColorGradingPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders all 4 color wheel zones', () => {
    render(<ColorGradingPanel />);
    expect(screen.getByText('Shadows')).toBeInTheDocument();
    expect(screen.getByText('Midtones')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
  });
});
