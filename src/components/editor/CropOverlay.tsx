import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditStore } from '../../store/editStore';
import styles from './CropOverlay.module.css';

interface CropOverlayProps {
  active: boolean;
  aspectRatio: number | null;
  canvasWidth: number;
  canvasHeight: number;
  onDone: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr' | 'move';

const HANDLE_SIZE = 8;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function CropOverlay({ active, aspectRatio, canvasWidth, canvasHeight, onDone }: CropOverlayProps) {
  const setParam = useEditStore((s) => s.setParam);
  const crop = useEditStore((s) => s.edits.crop);

  const [rect, setRect] = useState<Rect>(() => {
    if (crop) {
      return { x: crop.x * canvasWidth, y: crop.y * canvasHeight, w: crop.width * canvasWidth, h: crop.height * canvasHeight };
    }
    // Default to full image
    return { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
  });

  const [dragging, setDragging] = useState<HandleType | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, rect: { x: 0, y: 0, w: 0, h: 0 } });
  const svgRef = useRef<SVGSVGElement>(null);

  // Sync rect when canvas dimensions change
  useEffect(() => {
    if (!active) return;
    if (crop) {
      setRect({ x: crop.x * canvasWidth, y: crop.y * canvasHeight, w: crop.width * canvasWidth, h: crop.height * canvasHeight });
    } else {
      setRect({ x: 0, y: 0, w: canvasWidth, h: canvasHeight });
    }
  }, [canvasWidth, canvasHeight, active]);

  const commitCrop = useCallback(() => {
    if (canvasWidth === 0 || canvasHeight === 0) return;
    setParam('crop', {
      x: rect.x / canvasWidth,
      y: rect.y / canvasHeight,
      width: rect.w / canvasWidth,
      height: rect.h / canvasHeight,
      rotation: 0,
    });
  }, [rect, canvasWidth, canvasHeight, setParam]);

  const getSvgPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: HandleType) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getSvgPos(e);
    dragStartRef.current = { mouseX: pos.x, mouseY: pos.y, rect: { ...rect } };
    setDragging(handle);
  }, [getSvgPos, rect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = getSvgPos(e);
    const dx = pos.x - dragStartRef.current.mouseX;
    const dy = pos.y - dragStartRef.current.mouseY;
    const s = dragStartRef.current.rect;

    let newRect = { ...s };

    switch (dragging) {
      case 'move':
        newRect.x = clamp(s.x + dx, 0, canvasWidth - s.w);
        newRect.y = clamp(s.y + dy, 0, canvasHeight - s.h);
        break;
      case 'tl':
        newRect.x = clamp(s.x + dx, 0, s.x + s.w - 20);
        newRect.y = clamp(s.y + dy, 0, s.y + s.h - 20);
        newRect.w = s.x + s.w - newRect.x;
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'tr':
        newRect.w = clamp(s.w + dx, 20, canvasWidth - s.x);
        newRect.y = clamp(s.y + dy, 0, s.y + s.h - 20);
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'bl':
        newRect.x = clamp(s.x + dx, 0, s.x + s.w - 20);
        newRect.w = s.x + s.w - newRect.x;
        newRect.h = clamp(s.h + dy, 20, canvasHeight - s.y);
        break;
      case 'br':
        newRect.w = clamp(s.w + dx, 20, canvasWidth - s.x);
        newRect.h = clamp(s.h + dy, 20, canvasHeight - s.y);
        break;
      case 'tm':
        newRect.y = clamp(s.y + dy, 0, s.y + s.h - 20);
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'bm':
        newRect.h = clamp(s.h + dy, 20, canvasHeight - s.y);
        break;
      case 'ml':
        newRect.x = clamp(s.x + dx, 0, s.x + s.w - 20);
        newRect.w = s.x + s.w - newRect.x;
        break;
      case 'mr':
        newRect.w = clamp(s.w + dx, 20, canvasWidth - s.x);
        break;
    }

    // Enforce aspect ratio
    if (aspectRatio && dragging !== 'move') {
      if (dragging === 'tm' || dragging === 'bm') {
        newRect.w = newRect.h * aspectRatio;
      } else {
        newRect.h = newRect.w / aspectRatio;
      }
      newRect.w = Math.min(newRect.w, canvasWidth - newRect.x);
      newRect.h = Math.min(newRect.h, canvasHeight - newRect.y);
    }

    setRect(newRect);
  }, [dragging, getSvgPos, canvasWidth, canvasHeight, aspectRatio]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      commitCrop();
      setDragging(null);
    }
  }, [dragging, commitCrop]);

  if (!active) return null;

  const { x, y, w, h } = rect;
  const handles: Array<{ type: HandleType; cx: number; cy: number }> = [
    { type: 'tl', cx: x, cy: y },
    { type: 'tr', cx: x + w, cy: y },
    { type: 'bl', cx: x, cy: y + h },
    { type: 'br', cx: x + w, cy: y + h },
    { type: 'tm', cx: x + w / 2, cy: y },
    { type: 'bm', cx: x + w / 2, cy: y + h },
    { type: 'ml', cx: x, cy: y + h / 2 },
    { type: 'mr', cx: x + w, cy: y + h / 2 },
  ];

  return (
    <div className={styles.overlay} data-active={active}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dark mask outside crop */}
        <defs>
          <mask id="cropMask">
            <rect width={canvasWidth} height={canvasHeight} fill="white" />
            <rect x={x} y={y} width={w} height={h} fill="black" />
          </mask>
        </defs>
        <rect
          width={canvasWidth}
          height={canvasHeight}
          className={styles.darkMask}
          mask="url(#cropMask)"
        />

        {/* Crop rectangle — drag to move */}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          className={styles.cropRect}
          style={{ cursor: 'move' }}
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        />

        {/* Rule of thirds grid */}
        {[1 / 3, 2 / 3].map((t) => (
          <g key={t}>
            <line x1={x + w * t} y1={y} x2={x + w * t} y2={y + h} className={styles.gridLine} />
            <line x1={x} y1={y + h * t} x2={x + w} y2={y + h * t} className={styles.gridLine} />
          </g>
        ))}

        {/* Resize handles */}
        {handles.map(({ type, cx, cy }) => (
          <rect
            key={type}
            x={cx - HANDLE_SIZE / 2}
            y={cy - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            className={styles.handle}
            onMouseDown={(e) => handleMouseDown(e, type)}
          />
        ))}
      </svg>
    </div>
  );
}
