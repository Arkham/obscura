import { describe, it, expect } from 'vitest';

// Port of GLSL helper functions to TypeScript for verification
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1/2.4) - 0.055;
}

function applyExposure(r: number, g: number, b: number, ev: number): [number, number, number] {
  const mult = Math.pow(2, ev);
  return [r * mult, g * mult, b * mult];
}

describe('shader math', () => {
  it('luminance of pure white is 1.0', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1.0, 5);
  });

  it('luminance of pure black is 0.0', () => {
    expect(luminance(0, 0, 0)).toBeCloseTo(0.0, 5);
  });

  it('luminance weights green heaviest', () => {
    expect(luminance(0, 1, 0)).toBeGreaterThan(luminance(1, 0, 0));
    expect(luminance(0, 1, 0)).toBeGreaterThan(luminance(0, 0, 1));
  });

  it('linearToSrgb maps 0 to 0 and 1 to 1', () => {
    expect(linearToSrgb(0)).toBeCloseTo(0, 5);
    expect(linearToSrgb(1)).toBeCloseTo(1, 5);
  });

  it('linearToSrgb mid-gray (0.5 linear) maps to ~0.735 sRGB', () => {
    expect(linearToSrgb(0.5)).toBeCloseTo(0.735, 2);
  });

  it('exposure +1 EV doubles linear values', () => {
    const [r, g, b] = applyExposure(0.25, 0.25, 0.25, 1.0);
    expect(r).toBeCloseTo(0.5, 5);
    expect(g).toBeCloseTo(0.5, 5);
    expect(b).toBeCloseTo(0.5, 5);
  });

  it('exposure -1 EV halves linear values', () => {
    const [r] = applyExposure(0.5, 0.5, 0.5, -1.0);
    expect(r).toBeCloseTo(0.25, 5);
  });

  it('exposure 0 EV is identity', () => {
    const [r] = applyExposure(0.42, 0.42, 0.42, 0.0);
    expect(r).toBeCloseTo(0.42, 5);
  });
});
