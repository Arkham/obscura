import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { RenderPipeline } from '../../engine/pipeline';
import { updateHistogram } from '../../engine/histogram';
import { useEditStore } from '../../store/editStore';
import styles from './Canvas.module.css';

export interface CanvasHandle {
  setImage: (texture: WebGLTexture, width: number, height: number) => void;
  getPipeline: () => RenderPipeline | null;
  getView: () => { zoom: number; panX: number; panY: number };
}

interface CanvasProps {
  cropMode?: boolean;
  onZoomChange?: (zoom: number) => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas({ cropMode, onZoomChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);

  // Zoom/pan live in refs — updated synchronously, rendered via rAF
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(0);
  const histogramTimerRef = useRef(0);
  const cropModeRef = useRef(cropMode);
  cropModeRef.current = cropMode;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const edits = useEditStore((s) => s.edits);

  /** Build view params in device pixels from current refs */
  const getView = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    return {
      zoom: zoomRef.current,
      panX: panRef.current.x * dpr,
      panY: panRef.current.y * dpr,
    };
  }, []);

  /** Schedule a pipeline render on the next animation frame (deduplicates) */
  const scheduleRender = useCallback(() => {
    if (rafIdRef.current) return; // already scheduled
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      const p = pipelineRef.current;
      if (!p) return;
      const currentEdits = useEditStore.getState().edits;
      const renderEdits = cropModeRef.current ? { ...currentEdits, crop: null } : currentEdits;
      p.render(renderEdits, getView());
    });
  }, [getView]);

  /** Schedule a deferred histogram update (debounced, runs after zoom/pan settles) */
  const scheduleHistogram = useCallback(() => {
    clearTimeout(histogramTimerRef.current);
    histogramTimerRef.current = window.setTimeout(() => {
      const p = pipelineRef.current;
      if (p) updateHistogram(p.getGL(), p._lastViewport);
    }, 150);
  }, []);

  // Initialize pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      pipelineRef.current = new RenderPipeline(canvas);
    } catch (e) {
      console.error('Failed to initialize WebGL pipeline:', e);
    }

    return () => {
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
      cancelAnimationFrame(rafIdRef.current);
      clearTimeout(histogramTimerRef.current);
    };
  }, []);

  // Re-render when edits or crop mode change (immediate, with histogram)
  useEffect(() => {
    const p = pipelineRef.current;
    if (!p) return;
    const renderEdits = cropMode ? { ...edits, crop: null } : edits;
    p.render(renderEdits, getView());
    updateHistogram(p.getGL(), p._lastViewport);
  }, [edits, cropMode, getView]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const currentEdits = useEditStore.getState().edits;
        const renderEdits = cropModeRef.current ? { ...currentEdits, crop: null } : currentEdits;
        pipelineRef.current?.render(renderEdits, getView());
        if (pipelineRef.current) {
          updateHistogram(pipelineRef.current.getGL(), pipelineRef.current._lastViewport);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [getView]);

  // Zoom via scroll wheel (native listener to allow preventDefault on non-passive event)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      // Cursor position relative to container center
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;

      const oldZoom = zoomRef.current;
      const newZoom = Math.max(0.1, Math.min(20, oldZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      const factor = newZoom / oldZoom;
      zoomRef.current = newZoom;

      const p = panRef.current;
      panRef.current = {
        x: dx - (dx - p.x) * factor,
        y: dy - (dy - p.y) * factor,
      };

      scheduleRender();
      scheduleHistogram();
      onZoomChangeRef.current?.(newZoom);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [scheduleRender, scheduleHistogram]);

  // Pan via mouse drag (native listeners for pointermove performance)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
      container.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      panRef.current = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy,
      };
      scheduleRender();
      scheduleHistogram();
    };

    const onPointerUp = () => {
      isPanning = false;
      container.style.cursor = 'grab';
    };

    const onDoubleClick = () => {
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      scheduleRender();
      scheduleHistogram();
      onZoomChangeRef.current?.(1);
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerUp);
    container.addEventListener('dblclick', onDoubleClick);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerUp);
      container.removeEventListener('dblclick', onDoubleClick);
    };
  }, [scheduleRender, scheduleHistogram]);

  // Expose setImage to parent
  useImperativeHandle(ref, () => ({
    setImage: (texture: WebGLTexture, width: number, height: number) => {
      const p = pipelineRef.current;
      if (!p) return;
      p.setSourceTexture(texture, width, height);
      const currentEdits = useEditStore.getState().edits;
      p.render(currentEdits, getView());
      updateHistogram(p.getGL(), p._lastViewport);
    },
    getPipeline: () => pipelineRef.current,
    getView,
  }), [getView]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ cursor: 'grab' }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
});
