import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel';
import { useEditStore } from '../../../store/editStore';

describe('DetailPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders sharpening and noise reduction sections', () => {
    render(<DetailPanel />);
    expect(screen.getByText('Sharpening')).toBeInTheDocument();
    expect(screen.getByText('Noise Reduction')).toBeInTheDocument();
  });

  it('renders sharpening sliders', () => {
    render(<DetailPanel />);
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Radius')).toBeInTheDocument();
    // 'Detail' appears as both the section title and a slider label
    expect(screen.getAllByText('Detail').length).toBeGreaterThanOrEqual(2);
  });

  it('renders noise reduction sliders', () => {
    render(<DetailPanel />);
    expect(screen.getByText('Luminance')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('updates nested sharpening params', () => {
    render(<DetailPanel />);
    // Expand the outer Detail section (defaultOpen={false})
    const detailElements = screen.getAllByText('Detail');
    fireEvent.click(detailElements[0]);
    const sliders = screen.getAllByRole('slider');
    // Amount is the first sharpening slider
    fireEvent.change(sliders[0], { target: { value: '75' } });
    expect(useEditStore.getState().edits.sharpening.amount).toBe(75);
  });
});
