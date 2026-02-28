import { describe, it, expect, afterEach } from 'vitest';
import { extractMetadata } from '../metadata';

describe('extractMetadata', () => {
  const originalDcraw = (globalThis as any).window?.dcraw;

  afterEach(() => {
    if (typeof window !== 'undefined') {
      if (originalDcraw !== undefined) {
        (window as any).dcraw = originalDcraw;
      } else {
        delete (window as any).dcraw;
      }
    }
  });

  function mockDcraw(output: string) {
    (window as any).dcraw = () => output;
  }

  it('returns empty metadata when dcraw is not available', () => {
    delete (window as any).dcraw;
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.camera).toBeNull();
    expect(meta.iso).toBeNull();
  });

  it('parses camera model', () => {
    mockDcraw('Camera: Fujifilm X-T5\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.camera).toBe('Fujifilm X-T5');
  });

  it('parses ISO speed', () => {
    mockDcraw('ISO speed: 400\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.iso).toBe(400);
  });

  it('parses fractional shutter speed', () => {
    mockDcraw('Shutter: 1/250.0 sec\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.shutterSpeed).toBe('1/250.0');
  });

  it('converts decimal shutter to fraction', () => {
    mockDcraw('Shutter: 0.004000 sec\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.shutterSpeed).toBe('1/250');
  });

  it('parses aperture', () => {
    mockDcraw('Aperture: f/2.8\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.aperture).toBe('f/2.8');
  });

  it('parses focal length', () => {
    mockDcraw('Focal length: 50.0 mm\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.focalLength).toBe('50mm');
  });

  it('parses image size', () => {
    mockDcraw('Image size: 6240 x 4160\n');
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.imageWidth).toBe(6240);
    expect(meta.imageHeight).toBe(4160);
  });

  it('handles multi-line output', () => {
    mockDcraw(
      'Camera: Sony A7III\nISO speed: 800\nShutter: 1/125.0 sec\nAperture: f/4.0\nFocal length: 35.0 mm\nImage size: 6000 x 4000\n',
    );
    const meta = extractMetadata(new ArrayBuffer(0));
    expect(meta.camera).toBe('Sony A7III');
    expect(meta.iso).toBe(800);
    expect(meta.shutterSpeed).toBe('1/125.0');
    expect(meta.aperture).toBe('f/4.0');
    expect(meta.focalLength).toBe('35mm');
    expect(meta.imageWidth).toBe(6000);
    expect(meta.imageHeight).toBe(4000);
  });
});
