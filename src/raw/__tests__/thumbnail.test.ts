import { describe, it, expect } from 'vitest';
import { extractEmbeddedJpeg } from '../thumbnail';

function buildJpeg(width: number, height: number, bodySize: number): Uint8Array {
  // Build a minimal JPEG: SOI + SOF0 marker + body padding + EOI
  const sofSegment = new Uint8Array([
    0xff, 0xc0, // SOF0 marker
    0x00, 0x0b, // segment length (11 bytes)
    0x08,       // precision
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01,       // num components
    0x01, 0x11, 0x00, // component data
  ]);
  const body = new Uint8Array(bodySize);
  const result = new Uint8Array(2 + sofSegment.length + body.length + 2);
  result[0] = 0xff; result[1] = 0xd8; // SOI
  result.set(sofSegment, 2);
  result.set(body, 2 + sofSegment.length);
  const end = result.length - 2;
  result[end] = 0xff; result[end + 1] = 0xd9; // EOI
  return result;
}

describe('extractEmbeddedJpeg', () => {
  it('returns null for empty data', () => {
    expect(extractEmbeddedJpeg(new Uint8Array(0))).toBeNull();
  });

  it('returns null for data without JPEG markers', () => {
    expect(extractEmbeddedJpeg(new Uint8Array(100))).toBeNull();
  });

  it('extracts a valid JPEG', () => {
    // 200x200 at ~0.5 bpp = 20000 bytes body
    const jpeg = buildJpeg(200, 200, 20000);
    const blob = extractEmbeddedJpeg(jpeg);
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/jpeg');
  });

  it('returns null for tiny JPEGs under 1000 bytes', () => {
    const jpeg = buildJpeg(10, 10, 50);
    expect(extractEmbeddedJpeg(jpeg)).toBeNull();
  });

  it('picks the largest displayable JPEG when multiple are embedded', () => {
    const small = buildJpeg(100, 100, 5000);
    const large = buildJpeg(400, 400, 80000);
    // Embed both in a container with some padding between
    const padding = new Uint8Array(50);
    const combined = new Uint8Array(small.length + padding.length + large.length);
    combined.set(small, 0);
    combined.set(padding, small.length);
    combined.set(large, small.length + padding.length);
    const blob = extractEmbeddedJpeg(combined);
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(small.length);
  });
});
