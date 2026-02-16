import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { RenderPipeline } from '../../engine/pipeline';
import { useEditStore } from '../../store/editStore';
import styles from './Canvas.module.css';

export interface CanvasHandle {
  setImage: (texture: WebGLTexture, width: number, height: number) => void;
  getPipeline: () => RenderPipeline | null;
}

export const Canvas = forwardRef<CanvasHandle>(function Canvas(_props, ref) {
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

  // Re-render when edits change
  useEffect(() => {
    pipelineRef.current?.render(edits);
  }, [edits]);

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
        pipelineRef.current?.render(edits);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [edits]);

  // Zoom via scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(20, z * delta)));
  }, []);

  // Pan via mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [zoom]);

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
      pipelineRef.current?.setSourceTexture(texture, width, height);
      pipelineRef.current?.render(edits);
    },
    getPipeline: () => pipelineRef.current,
  }), [edits]);

  const canvasStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    cursor: zoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'default',
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className={styles.canvas} style={canvasStyle} />
    </div>
  );
});
