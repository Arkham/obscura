import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditStore } from '../../store/editStore';
import styles from './CropOverlay.module.css';

interface CropOverlayProps {
  active: boolean;
  aspectRatio: number | null;
  /** Viewport rect of the rendered image in CSS pixels, relative to container */
  viewport: { x: number; y: number; w: number; h: number };
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
const MIN_SIZE = 20;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function CropOverlay({ active, aspectRatio, viewport, onDone: _onDone }: CropOverlayProps) {
  const setParam = useEditStore((s) => s.setParam);
  const crop = useEditStore((s) => s.edits.crop);

  // Convert normalized crop (texture Y-up) to pixel rect (CSS Y-down) within viewport
  const cropToPixels = useCallback((c: { x: number; y: number; width: number; height: number } | null): Rect => {
    if (c) {
      return {
        x: viewport.x + c.x * viewport.w,
        y: viewport.y + (1 - c.y - c.height) * viewport.h,
        w: c.width * viewport.w,
        h: c.height * viewport.h,
      };
    }
    return { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h };
  }, [viewport]);

  const [rect, setRect] = useState<Rect>(() => cropToPixels(crop));
  const [dragging, setDragging] = useState<HandleType | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, rect: { x: 0, y: 0, w: 0, h: 0 } });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Convert pixel rect (CSS Y-down) to normalized crop (texture Y-up)
  const commitCrop = useCallback((r: Rect) => {
    if (viewport.w === 0 || viewport.h === 0) return;
    const normX = (r.x - viewport.x) / viewport.w;
    const normY = (r.y - viewport.y) / viewport.h;
    const normW = r.w / viewport.w;
    const normH = r.h / viewport.h;
    setParam('crop', {
      x: normX,
      y: 1 - normY - normH,
      width: normW,
      height: normH,
      rotation: 0,
    });
  }, [viewport, setParam]);

  // Sync rect when viewport or crop changes (but not during drag)
  // When entering crop mode, default to full viewport if no crop is set
  useEffect(() => {
    if (!active || dragging) return;
    if (crop) {
      setRect(cropToPixels(crop));
    } else {
      setRect({ x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h });
    }
  }, [viewport, active, crop, cropToPixels, dragging]);

  // Adjust rect when aspect ratio changes — fit the largest rect of that ratio in the viewport
  useEffect(() => {
    if (!active || !aspectRatio || dragging) return;

    let newW: number, newH: number;
    if (viewport.w / viewport.h > aspectRatio) {
      newH = viewport.h;
      newW = newH * aspectRatio;
    } else {
      newW = viewport.w;
      newH = newW / aspectRatio;
    }
    const newX = viewport.x + (viewport.w - newW) / 2;
    const newY = viewport.y + (viewport.h - newH) / 2;
    const newRect = { x: newX, y: newY, w: newW, h: newH };
    setRect(newRect);
    commitCrop(newRect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio]);

  const getLocalPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: HandleType) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getLocalPos(e);
    dragStartRef.current = { mouseX: pos.x, mouseY: pos.y, rect: { ...rect } };
    setDragging(handle);
  }, [getLocalPos, rect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = getLocalPos(e);
    const dx = pos.x - dragStartRef.current.mouseX;
    const dy = pos.y - dragStartRef.current.mouseY;
    const s = dragStartRef.current.rect;

    // Bounds: crop must stay within the viewport
    const vx = viewport.x;
    const vy = viewport.y;
    const vr = viewport.x + viewport.w;
    const vb = viewport.y + viewport.h;

    let newRect = { ...s };

    switch (dragging) {
      case 'move':
        newRect.x = clamp(s.x + dx, vx, vr - s.w);
        newRect.y = clamp(s.y + dy, vy, vb - s.h);
        break;
      case 'tl':
        newRect.x = clamp(s.x + dx, vx, s.x + s.w - MIN_SIZE);
        newRect.y = clamp(s.y + dy, vy, s.y + s.h - MIN_SIZE);
        newRect.w = s.x + s.w - newRect.x;
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'tr':
        newRect.w = clamp(s.w + dx, MIN_SIZE, vr - s.x);
        newRect.y = clamp(s.y + dy, vy, s.y + s.h - MIN_SIZE);
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'bl':
        newRect.x = clamp(s.x + dx, vx, s.x + s.w - MIN_SIZE);
        newRect.w = s.x + s.w - newRect.x;
        newRect.h = clamp(s.h + dy, MIN_SIZE, vb - s.y);
        break;
      case 'br':
        newRect.w = clamp(s.w + dx, MIN_SIZE, vr - s.x);
        newRect.h = clamp(s.h + dy, MIN_SIZE, vb - s.y);
        break;
      case 'tm':
        newRect.y = clamp(s.y + dy, vy, s.y + s.h - MIN_SIZE);
        newRect.h = s.y + s.h - newRect.y;
        break;
      case 'bm':
        newRect.h = clamp(s.h + dy, MIN_SIZE, vb - s.y);
        break;
      case 'ml':
        newRect.x = clamp(s.x + dx, vx, s.x + s.w - MIN_SIZE);
        newRect.w = s.x + s.w - newRect.x;
        break;
      case 'mr':
        newRect.w = clamp(s.w + dx, MIN_SIZE, vr - s.x);
        break;
    }

    // Enforce aspect ratio
    if (aspectRatio && dragging !== 'move') {
      if (dragging === 'tm' || dragging === 'bm') {
        newRect.w = newRect.h * aspectRatio;
      } else {
        newRect.h = newRect.w / aspectRatio;
      }
      newRect.w = Math.min(newRect.w, vr - newRect.x);
      newRect.h = Math.min(newRect.h, vb - newRect.y);
    }

    setRect(newRect);
  }, [dragging, getLocalPos, viewport, aspectRatio]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      commitCrop(rect);
      setDragging(null);
    }
  }, [dragging, commitCrop, rect]);

  if (!active || viewport.w === 0 || viewport.h === 0) return null;

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
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-active={active}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Dark mask outside crop */}
      <div className={styles.darkMask} style={{ top: 0, left: 0, right: 0, height: y }} />
      <div className={styles.darkMask} style={{ top: y + h, left: 0, right: 0, bottom: 0 }} />
      <div className={styles.darkMask} style={{ top: y, left: 0, width: x, height: h }} />
      <div className={styles.darkMask} style={{ top: y, left: x + w, right: 0, height: h }} />

      {/* Crop rectangle — drag to move */}
      <div
        className={styles.cropRect}
        style={{ left: x, top: y, width: w, height: h, cursor: 'move' }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Rule of thirds grid */}
        <div className={styles.gridLineH} style={{ top: '33.33%' }} />
        <div className={styles.gridLineH} style={{ top: '66.67%' }} />
        <div className={styles.gridLineV} style={{ left: '33.33%' }} />
        <div className={styles.gridLineV} style={{ left: '66.67%' }} />
      </div>

      {/* Resize handles */}
      {handles.map(({ type, cx, cy }) => (
        <div
          key={type}
          className={styles.handle}
          style={{ left: cx - HANDLE_SIZE / 2, top: cy - HANDLE_SIZE / 2, width: HANDLE_SIZE, height: HANDLE_SIZE }}
          onMouseDown={(e) => handleMouseDown(e, type)}
        />
      ))}
    </div>
  );
}
