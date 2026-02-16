import type { CurvePoint } from '../types/edits';

export function bakeCurveLut(points: CurvePoint[], size: number = 256): Float32Array {
  const lut = new Float32Array(size);

  if (points.length < 2) {
    // Identity
    for (let i = 0; i < size; i++) lut[i] = i / (size - 1);
    return lut;
  }

  // Sort points by x
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Linear interpolation between control points
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    let lo = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j + 1].x >= t) { lo = j; break; }
      lo = j;
    }
    const hi = Math.min(lo + 1, sorted.length - 1);
    if (lo === hi) {
      lut[i] = sorted[lo].y;
    } else {
      const frac = (t - sorted[lo].x) / (sorted[hi].x - sorted[lo].x);
      lut[i] = sorted[lo].y + frac * (sorted[hi].y - sorted[lo].y);
    }
  }
  return lut;
}

export function uploadLutTexture(
  gl: WebGL2RenderingContext,
  lut: Float32Array
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, lut.length, 1, 0, gl.RED, gl.FLOAT, lut);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
