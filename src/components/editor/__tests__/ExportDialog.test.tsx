import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportDialog } from '../ExportDialog';

describe('ExportDialog', () => {
  it('renders with default values', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<ExportDialog onExport={onExport} onClose={onClose} />);

    expect(screen.getByText('Export JPEG')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<ExportDialog onExport={onExport} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onExport with options when Export is clicked', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ExportDialog onExport={onExport} onClose={onClose} />);

    fireEvent.click(screen.getByText('Export'));

    // onExport should be called with default options
    expect(onExport).toHaveBeenCalledTimes(1);
    const options = onExport.mock.calls[0][0];
    expect(options.quality).toBe(92);
    expect(options.border).toBe('none');
    expect(options.borderWidth).toBe(5);
  });

  it('shows border width slider when border is selected', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<ExportDialog onExport={onExport} onClose={onClose} />);

    // Initially no border width slider visible (border='none')
    expect(screen.queryByText('Border Width (%)')).not.toBeInTheDocument();

    // Select 'White' border
    const whiteRadio = screen.getByLabelText('White');
    fireEvent.click(whiteRadio);

    // Now border width slider should appear
    expect(screen.getByText('Border Width (%)')).toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<ExportDialog onExport={onExport} onClose={onClose} />);

    // Click on the backdrop (first child of container)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
