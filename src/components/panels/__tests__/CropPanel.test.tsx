import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CropPanel } from '../CropPanel';
import { useEditStore } from '../../../store/editStore';

describe('CropPanel', () => {
  const defaultProps = {
    cropMode: false,
    onToggleCropMode: vi.fn(),
    aspectRatio: null as number | null,
    onSetAspectRatio: vi.fn(),
  };

  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
    vi.clearAllMocks();
  });

  it('renders aspect ratio buttons', () => {
    render(<CropPanel {...defaultProps} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('1:1')).toBeInTheDocument();
    expect(screen.getByText('4:3')).toBeInTheDocument();
    expect(screen.getByText('3:2')).toBeInTheDocument();
    expect(screen.getByText('16:9')).toBeInTheDocument();
  });

  it('toggles crop mode', () => {
    const onToggle = vi.fn();
    render(<CropPanel {...defaultProps} onToggleCropMode={onToggle} />);
    // "Crop" appears in both section title (span) and action button
    const cropElements = screen.getAllByText('Crop');
    const actionBtn = cropElements.find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(actionBtn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows Done when crop mode is active', () => {
    render(<CropPanel {...defaultProps} cropMode={true} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('calls onSetAspectRatio when ratio button clicked', () => {
    const onSet = vi.fn();
    render(<CropPanel {...defaultProps} onSetAspectRatio={onSet} />);
    fireEvent.click(screen.getByText('1:1'));
    expect(onSet).toHaveBeenCalledWith(1);
  });

  it('shows crop info when crop is set', () => {
    useEditStore.getState().setParam('crop', { x: 0, y: 0, width: 0.5, height: 0.5, rotation: 0 });
    render(<CropPanel {...defaultProps} />);
    expect(screen.getByText('50% x 50%')).toBeInTheDocument();
  });

  it('clears crop on Clear button click', () => {
    useEditStore.getState().setParam('crop', { x: 0, y: 0, width: 0.5, height: 0.5, rotation: 0 });
    render(<CropPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(useEditStore.getState().edits.crop).toBeNull();
  });
});
