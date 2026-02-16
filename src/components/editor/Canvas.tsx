import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { RenderPipeline } from '../../engine/pipeline';
import { updateHistogram } from '../../engine/histogram';
import { useEditStore } from '../../store/editStore';
import styles from './Canvas.module.css';

export interface CanvasHandle {
  setImage: (texture: WebGLTexture, width: number, height: number) => void;
  getPipeline: () => RenderPipeline | null;
}

interface CanvasProps {
  cropMode?: boolean;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas({ cropMode }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const edits = useEditStore((s) => s.edits);

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
    };
  }, []);

  // Re-render when edits change (skip crop when in crop mode to show full image)
  useEffect(() => {
    const p = pipelineRef.current;
    if (!p) return;
    if (cropMode) {
      p.render({ ...edits, crop: null });
    } else {
      p.render(edits);
    }
    updateHistogram(p.getGL(), p._lastViewport);
  }, [edits, cropMode]);

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
        const renderEdits = cropMode ? { ...edits, crop: null } : edits;
        pipelineRef.current?.render(renderEdits);
        if (pipelineRef.current) {
          updateHistogram(pipelineRef.current.getGL(), pipelineRef.current._lastViewport);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [edits, cropMode]);

  // Zoom via scroll wheel (native listener to allow preventDefault on non-passive event)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.1, Math.min(20, z * delta)));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Pan via mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Expose setImage to parent
  useImperativeHandle(ref, () => ({
    setImage: (texture: WebGLTexture, width: number, height: number) => {
      const p = pipelineRef.current;
      if (!p) return;
      p.setSourceTexture(texture, width, height);
      p.render(edits);
      updateHistogram(p.getGL(), p._lastViewport);
    },
    getPipeline: () => pipelineRef.current,
  }), [edits]);

  const canvasStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    cursor: isPanningRef.current ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className={styles.canvas} style={canvasStyle} />
    </div>
  );
});
