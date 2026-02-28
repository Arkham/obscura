import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HslPanel } from '../HslPanel';
import { useEditStore } from '../../../store/editStore';

describe('HslPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders hue/saturation/luminance tabs', () => {
    render(<HslPanel />);
    expect(screen.getByText('Hue')).toBeInTheDocument();
    expect(screen.getByText('Saturation')).toBeInTheDocument();
    expect(screen.getByText('Luminance')).toBeInTheDocument();
  });

  it('renders 8 color sliders', () => {
    render(<HslPanel />);
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Orange')).toBeInTheDocument();
    expect(screen.getByText('Yellow')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Aqua')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Purple')).toBeInTheDocument();
    expect(screen.getByText('Magenta')).toBeInTheDocument();
  });

  it('switches tabs', () => {
    render(<HslPanel />);
    fireEvent.click(screen.getByText('Saturation'));
    expect(screen.getByText('Saturation').getAttribute('data-active')).toBe('true');
  });

  it('updates hsl array on slider change', () => {
    render(<HslPanel />);
    const sliders = screen.getAllByRole('slider');
    // First slider is Red hue
    fireEvent.change(sliders[0], { target: { value: '25' } });
    expect(useEditStore.getState().edits.hsl.hue[0]).toBe(25);
  });
});
