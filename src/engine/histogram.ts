export interface HistogramData {
  r: Uint32Array; // 256 bins
  g: Uint32Array;
  b: Uint32Array;
  lum: Uint32Array;
}

// --- pub/sub ---
let _current: HistogramData | null = null;
const _listeners = new Set<() => void>();

export function getHistogramData(): HistogramData | null {
  return _current;
}

export function subscribeHistogram(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

function notify() {
  for (const cb of _listeners) cb();
}

// --- throttled computation ---
let _lastTime = 0;
const MIN_INTERVAL = 100; // ~10fps

export function updateHistogram(
  gl: WebGL2RenderingContext,
  viewport: { x: number; y: number; w: number; h: number },
): void {
  const { x: vx, y: vy, w: vw, h: vh } = viewport;
  if (vw <= 0 || vh <= 0) return;

  const now = performance.now();
  if (now - _lastTime < MIN_INTERVAL) return;
  _lastTime = now;

  // Read pixels from the default framebuffer (screen) within the image viewport
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const buf = new Uint8Array(vw * vh * 4);
  gl.readPixels(vx, vy, vw, vh, gl.RGBA, gl.UNSIGNED_BYTE, buf);

  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const lum = new Uint32Array(256);

  // Sample every 4th pixel for performance
  const totalPixels = vw * vh;
  for (let i = 0; i < totalPixels; i += 4) {
    const off = i * 4;
    const rr = buf[off];
    const gg = buf[off + 1];
    const bb = buf[off + 2];
    r[rr]++;
    g[gg]++;
    b[bb]++;
    // Luminance: 0.2126*R + 0.7152*G + 0.0722*B
    const l = Math.round(0.2126 * rr + 0.7152 * gg + 0.0722 * bb);
    lum[Math.min(255, l)]++;
  }

  _current = { r, g, b, lum };
  notify();
}
