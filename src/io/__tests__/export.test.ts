import { describe, it, expect } from 'vitest';
import { calcBorderDimensions } from '../export';
import type { ExportOptions } from '../export';

describe('export: calcBorderDimensions', () => {
  it('no border returns same dimensions', () => {
    const options: ExportOptions = { border: 'none', borderWidth: 5, quality: 92 };
    const result = calcBorderDimensions(100, 80, options);
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
    expect(result.borderPx).toBe(0);
  });

  it('zero borderWidth returns same dimensions', () => {
    const options: ExportOptions = { border: 'white', borderWidth: 0, quality: 92 };
    const result = calcBorderDimensions(100, 80, options);
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
    expect(result.borderPx).toBe(0);
  });

  it('white border adds correct padding', () => {
    // 5% of shorter side (80) = 4px per side
    const options: ExportOptions = { border: 'white', borderWidth: 5, quality: 92 };
    const result = calcBorderDimensions(100, 80, options);
    expect(result.width).toBe(108); // 100 + 4*2
    expect(result.height).toBe(88); // 80 + 4*2
    expect(result.borderPx).toBe(4);
  });

  it('black border adds correct padding', () => {
    // 10% of shorter side (150) = 15px per side
    const options: ExportOptions = { border: 'black', borderWidth: 10, quality: 92 };
    const result = calcBorderDimensions(200, 150, options);
    expect(result.width).toBe(230); // 200 + 15*2
    expect(result.height).toBe(180); // 150 + 15*2
    expect(result.borderPx).toBe(15);
  });

  it('border is calculated from shorter side', () => {
    // 10% of shorter side (500) = 50px per side
    const options: ExportOptions = { border: 'white', borderWidth: 10, quality: 92 };
    const result = calcBorderDimensions(1000, 500, options);
    expect(result.width).toBe(1100); // 1000 + 50*2
    expect(result.height).toBe(600); // 500 + 50*2
    expect(result.borderPx).toBe(50);
  });
});
