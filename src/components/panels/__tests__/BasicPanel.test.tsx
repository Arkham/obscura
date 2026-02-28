import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BasicPanel } from '../BasicPanel';
import { useEditStore } from '../../../store/editStore';

describe('BasicPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders all 8 sliders', () => {
    render(<BasicPanel />);
    expect(screen.getByText('White Balance')).toBeInTheDocument();
    expect(screen.getByText('Tint')).toBeInTheDocument();
    expect(screen.getByText('Exposure')).toBeInTheDocument();
    expect(screen.getByText('Contrast')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Shadows')).toBeInTheDocument();
    expect(screen.getByText('Whites')).toBeInTheDocument();
    expect(screen.getByText('Blacks')).toBeInTheDocument();
  });

  it('reflects store values in slider', () => {
    useEditStore.getState().setParam('exposure', 2.5);
    render(<BasicPanel />);
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('updates store on slider change', () => {
    render(<BasicPanel />);
    const sliders = screen.getAllByRole('slider');
    // Find the exposure slider (3rd one, index 2)
    const exposureSlider = sliders[2];
    fireEvent.change(exposureSlider, { target: { value: '1.5' } });
    expect(useEditStore.getState().edits.exposure).toBe(1.5);
  });
});
