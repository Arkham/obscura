import { expect } from 'vitest';

/** Assert two pixels are within tolerance */
export function expectPixelClose(
  actual: [number, number, number, number],
  expected: [number, number, number, number],
  tolerance = 2
) {
  for (let i = 0; i < 4; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
  }
}

/** Assert a pixel matches a float RGB (0-1) value, with sRGB conversion */
export function expectPixelCloseSrgb(
  actual: [number, number, number, number],
  expectedLinear: [number, number, number],
  tolerance = 3
) {
  const expected = expectedLinear.map(v => {
    const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1/2.4) - 0.055;
    return Math.round(srgb * 255);
  });
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
  }
}
