import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresencePanel } from '../PresencePanel';
import { useEditStore } from '../../../store/editStore';

describe('PresencePanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders all 5 sliders', () => {
    render(<PresencePanel />);
    expect(screen.getByText('Texture')).toBeInTheDocument();
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('Dehaze')).toBeInTheDocument();
    expect(screen.getByText('Vibrance')).toBeInTheDocument();
    expect(screen.getByText('Saturation')).toBeInTheDocument();
  });

  it('updates store on slider change', () => {
    render(<PresencePanel />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '50' } });
    expect(useEditStore.getState().edits.texture).toBe(50);
  });
});
