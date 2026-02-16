/** Generate a gradient from black to white (left to right) */
export function createGradientData(width: number, height: number): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = x / (width - 1);
      data[i] = t;     // R
      data[i + 1] = t; // G
      data[i + 2] = t; // B
      data[i + 3] = 1; // A
    }
  }
  return data;
}

/** Generate a solid color patch */
export function createSolidColorData(
  width: number, height: number,
  r: number, g: number, b: number
): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 1;
  }
  return data;
}

/** Generate an HSL color wheel test pattern */
export function createColorWheelData(width: number, height: number): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const hue = x / width;
      const sat = 1.0;
      const lum = y / height;
      const [r, g, b] = hslToRgb(hue, sat, lum);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return data;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1/3), hue2rgb(h), hue2rgb(h - 1/3)];
}
