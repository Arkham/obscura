import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistogramPanel } from '../HistogramPanel';

describe('HistogramPanel', () => {
  it('renders a canvas element', () => {
    render(<HistogramPanel />);
    expect(screen.getByText('Histogram')).toBeInTheDocument();
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });
});
