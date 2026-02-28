import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetadataPanel } from '../MetadataPanel';

describe('MetadataPanel', () => {
  it('shows "No metadata" when metadata is null', () => {
    render(<MetadataPanel metadata={null} />);
    expect(screen.getByText('No metadata')).toBeInTheDocument();
  });

  it('renders camera name', () => {
    render(
      <MetadataPanel
        metadata={{
          camera: 'Fujifilm X-T5',
          iso: null,
          shutterSpeed: null,
          aperture: null,
          focalLength: null,
          imageWidth: null,
          imageHeight: null,
        }}
      />,
    );
    expect(screen.getByText('Fujifilm X-T5')).toBeInTheDocument();
  });

  it('renders specs with separators', () => {
    render(
      <MetadataPanel
        metadata={{
          camera: 'Sony A7III',
          iso: 400,
          shutterSpeed: '1/250',
          aperture: 'f/2.8',
          focalLength: '50mm',
          imageWidth: 6000,
          imageHeight: 4000,
        }}
      />,
    );
    expect(screen.getByText('Sony A7III')).toBeInTheDocument();
    expect(screen.getByText('ISO 400')).toBeInTheDocument();
    expect(screen.getByText('50mm')).toBeInTheDocument();
    expect(screen.getByText('f/2.8')).toBeInTheDocument();
    expect(screen.getByText('1/250s')).toBeInTheDocument();
  });
});
