import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorWheel } from '../ColorWheel';

describe('ColorWheel', () => {
  it('renders with label and luminance slider', () => {
    const onChange = vi.fn();
    render(
      <ColorWheel label="Shadows" hue={0} saturation={0} luminance={0} onChange={onChange} />,
    );
    expect(screen.getByText('Shadows')).toBeInTheDocument();
    expect(screen.getByText('Lum: 0')).toBeInTheDocument();
  });

  it('calls onChange when luminance slider changes', () => {
    const onChange = vi.fn();
    render(
      <ColorWheel label="Shadows" hue={180} saturation={50} luminance={0} onChange={onChange} />,
    );
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();

    fireEvent.change(slider, { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith(180, 50, 25);
  });

  it('calls onChange on mouse interaction with SVG', () => {
    const onChange = vi.fn();
    render(
      <ColorWheel label="Midtones" hue={0} saturation={0} luminance={0} onChange={onChange} />,
    );
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();

    // Mock getBoundingClientRect for the SVG
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    Object.defineProperty(svg!, 'getBoundingClientRect', { value: () => rect });

    // Click near the edge of the wheel (right side = hue ~90, high saturation)
    fireEvent.mouseDown(svg!, { clientX: 90, clientY: 50 });
    expect(onChange).toHaveBeenCalled();

    const [hue, sat] = [onChange.mock.calls[0][0], onChange.mock.calls[0][1]];
    expect(sat).toBeGreaterThan(0);
  });

  it('resets to center on double-click', () => {
    const onChange = vi.fn();
    render(
      <ColorWheel label="Global" hue={200} saturation={60} luminance={10} onChange={onChange} />,
    );
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();

    fireEvent.doubleClick(svg!);
    // Should reset hue and saturation to 0, keep luminance
    expect(onChange).toHaveBeenCalledWith(0, 0, 10);
  });
});
