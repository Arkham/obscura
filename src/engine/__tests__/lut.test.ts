import { describe, it, expect } from 'vitest';
import { bakeCurveLut } from '../lut';

describe('bakeCurveLut', () => {
  it('returns identity curve for 2-point diagonal', () => {
    const lut = bakeCurveLut([{ x: 0, y: 0 }, { x: 1, y: 1 }], 256);
    expect(lut).toHaveLength(256);
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[127]).toBeCloseTo(127 / 255, 2);
    expect(lut[255]).toBeCloseTo(1, 3);
  });

  it('returns flat curve when both endpoints at same y', () => {
    const lut = bakeCurveLut([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], 256);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeCloseTo(0.5, 2);
    }
  });

  it('respects a midpoint lift', () => {
    const lut = bakeCurveLut([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.75 },
      { x: 1, y: 1 },
    ], 256);
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[128]).toBeCloseTo(0.75, 2);
    expect(lut[255]).toBeCloseTo(1, 3);
  });

  it('handles single-point input as identity', () => {
    const lut = bakeCurveLut([{ x: 0.5, y: 0.5 }], 256);
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[255]).toBeCloseTo(1, 3);
  });
});
