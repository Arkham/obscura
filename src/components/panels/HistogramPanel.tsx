import { useRef, useEffect, useSyncExternalStore } from 'react';
import { subscribeHistogram, getHistogramData } from '../../engine/histogram';
import { PanelSection } from './PanelSection';
import styles from './HistogramPanel.module.css';

export function HistogramPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const data = useSyncExternalStore(subscribeHistogram, getHistogramData);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Log-scale: apply log(1 + count) to each bin, then normalize to peak.
    // This prevents a single dominant tone from squashing the rest of the graph.
    const logR = new Float32Array(256);
    const logG = new Float32Array(256);
    const logB = new Float32Array(256);
    const logLum = new Float32Array(256);
    let peak = 0;
    for (let i = 0; i < 256; i++) {
      logR[i] = Math.log(1 + data.r[i]);
      logG[i] = Math.log(1 + data.g[i]);
      logB[i] = Math.log(1 + data.b[i]);
      logLum[i] = Math.log(1 + data.lum[i]);
      // Skip bin 0 and 255 (clipped extremes) for peak normalization
      if (i > 0 && i < 255) {
        if (logR[i] > peak) peak = logR[i];
        if (logG[i] > peak) peak = logG[i];
        if (logB[i] > peak) peak = logB[i];
        if (logLum[i] > peak) peak = logLum[i];
      }
    }
    if (peak === 0) peak = 1;

    // Find the active range across all channels so the graph fills the width
    let lo = 0;
    let hi = 255;
    while (lo < 255 && data.r[lo] + data.g[lo] + data.b[lo] === 0) lo++;
    while (hi > lo && data.r[hi] + data.g[hi] + data.b[hi] === 0) hi--;
    const span = Math.max(hi - lo, 1);

    const drawChannel = (bins: Float32Array, color: string, alpha: number) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = lo; i <= hi; i++) {
        const x = ((i - lo) / span) * w;
        const val = Math.min(bins[i] / peak, 1);
        const y = h - val * h;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };

    drawChannel(logLum, '#ffffff', 0.3);
    drawChannel(logR, '#ff4444', 0.4);
    drawChannel(logG, '#44cc44', 0.4);
    drawChannel(logB, '#4488ff', 0.4);

    ctx.globalAlpha = 1;
  }, [data]);

  return (
    <PanelSection title="Histogram">
      <canvas ref={canvasRef} className={styles.canvas} />
    </PanelSection>
  );
}
