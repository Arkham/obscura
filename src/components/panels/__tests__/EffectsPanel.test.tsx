import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EffectsPanel } from '../EffectsPanel';
import { useEditStore } from '../../../store/editStore';

describe('EffectsPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders vignette sliders', () => {
    render(<EffectsPanel />);
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Midpoint')).toBeInTheDocument();
    expect(screen.getByText('Roundness')).toBeInTheDocument();
    expect(screen.getByText('Feather')).toBeInTheDocument();
  });

  it('updates nested vignette params', () => {
    render(<EffectsPanel />);
    // Expand the outer Effects section (defaultOpen={false})
    // Vignette sub-section is open by default
    fireEvent.click(screen.getByText('Effects'));
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '-50' } });
    expect(useEditStore.getState().edits.vignette.amount).toBe(-50);
  });
});
