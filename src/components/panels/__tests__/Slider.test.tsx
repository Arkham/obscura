import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from '../Slider';

describe('Slider', () => {
  const defaultProps = {
    label: 'Exposure',
    value: 0,
    min: -5,
    max: 5,
    step: 0.01,
    defaultValue: 0,
    onChange: vi.fn(),
  };

  it('renders label and value', () => {
    render(<Slider {...defaultProps} value={1.5} />);
    expect(screen.getByText('Exposure')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  it('calls onChange when slider moves', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole('slider');
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('resets to default on double-click of track', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} value={3.0} onChange={onChange} />);
    const input = screen.getByRole('slider');
    fireEvent.doubleClick(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('formats integer step values without decimals', () => {
    render(<Slider {...defaultProps} value={50} min={-100} max={100} step={1} />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('formats 0.1 step values with one decimal', () => {
    render(<Slider {...defaultProps} value={1.5} step={0.1} />);
    expect(screen.getByText('1.5')).toBeInTheDocument();
  });
});
