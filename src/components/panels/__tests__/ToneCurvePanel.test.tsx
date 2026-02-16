import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToneCurvePanel } from '../ToneCurvePanel';
import { useEditStore } from '../../../store/editStore';

describe('ToneCurvePanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders with channel tabs', () => {
    render(<ToneCurvePanel />);
    expect(screen.getByText('RGB')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('starts with default 2-point curve', () => {
    render(<ToneCurvePanel />);
    const state = useEditStore.getState();
    expect(state.edits.toneCurve.rgb).toHaveLength(2);
    expect(state.edits.toneCurve.rgb[0]).toEqual({ x: 0, y: 0 });
    expect(state.edits.toneCurve.rgb[1]).toEqual({ x: 1, y: 1 });
  });

  it('switches channel on tab click', () => {
    render(<ToneCurvePanel />);
    const redTab = screen.getByText('Red');
    fireEvent.click(redTab);
    // Tab should be active (data-active="true")
    expect(redTab.getAttribute('data-active')).toBe('true');
  });

  it('adds a point on click within the SVG area', () => {
    render(<ToneCurvePanel />);
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();

    // Simulate a click on the SVG (in the middle area, not on existing endpoints)
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    Object.defineProperty(svg!, 'getBoundingClientRect', { value: () => rect });

    fireEvent.mouseDown(svg!, { clientX: 128, clientY: 128 });
    fireEvent.mouseUp(svg!);

    const state = useEditStore.getState();
    // Should have added a point (3 total now)
    expect(state.edits.toneCurve.rgb.length).toBeGreaterThanOrEqual(3);
  });
});
