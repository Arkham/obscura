import { describe, it, expect } from 'vitest';
import { createGradientData, createSolidColorData, createColorWheelData } from '../test-textures';

describe('createGradientData', () => {
  it('produces correct dimensions', () => {
    const data = createGradientData(8, 4);
    expect(data.length).toBe(8 * 4 * 4);
  });

  it('is black on left edge and white on right edge', () => {
    const data = createGradientData(8, 1);
    // First pixel: black
    expect(data[0]).toBeCloseTo(0, 1);
    expect(data[1]).toBeCloseTo(0, 1);
    expect(data[2]).toBeCloseTo(0, 1);
    expect(data[3]).toBe(1); // alpha
    // Last pixel: white
    const last = (8 - 1) * 4;
    expect(data[last]).toBeCloseTo(1, 1);
    expect(data[last + 1]).toBeCloseTo(1, 1);
    expect(data[last + 2]).toBeCloseTo(1, 1);
  });
});

describe('createSolidColorData', () => {
  it('fills all pixels with the given color', () => {
    const data = createSolidColorData(2, 2, 0.5, 0.3, 0.8);
    for (let i = 0; i < 4; i++) {
      expect(data[i * 4]).toBeCloseTo(0.5);
      expect(data[i * 4 + 1]).toBeCloseTo(0.3);
      expect(data[i * 4 + 2]).toBeCloseTo(0.8);
      expect(data[i * 4 + 3]).toBe(1);
    }
  });
});

describe('createColorWheelData', () => {
  it('produces correct dimensions', () => {
    const data = createColorWheelData(16, 16);
    expect(data.length).toBe(16 * 16 * 4);
  });

  it('has alpha 1 for all pixels', () => {
    const data = createColorWheelData(4, 4);
    for (let i = 0; i < 16; i++) {
      expect(data[i * 4 + 3]).toBe(1);
    }
  });
});
