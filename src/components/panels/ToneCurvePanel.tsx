import { useState, useCallback, useRef } from 'react';
import { useEditStore } from '../../store/editStore';
import type { CurvePoint } from '../../types/edits';
import { PanelSection } from './PanelSection';
import styles from './ToneCurvePanel.module.css';

const CHANNELS = ['rgb', 'red', 'green', 'blue'] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  rgb: 'RGB',
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
};

const CHANNEL_COLORS: Record<Channel, string> = {
  rgb: '#e0e0e0',
  red: '#ff6666',
  green: '#66ff66',
  blue: '#6666ff',
};

const SVG_SIZE = 256;
const POINT_RADIUS = 6;
const GRAB_RADIUS = 12;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Build an SVG path for a monotonic cubic spline through sorted points */
function buildCurvePath(points: CurvePoint[]): string {
  if (points.length < 2) return '';
  const sorted = [...points].sort((a, b) => a.x - b.x);

  const pts = sorted.map((p) => ({ x: p.x * SVG_SIZE, y: (1 - p.y) * SVG_SIZE }));

  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  // Catmull-Rom to cubic bezier
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function ToneCurvePanel() {
  const [channel, setChannel] = useState<Channel>('rgb');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toneCurve = useEditStore((s) => s.edits.toneCurve);
  const setParam = useEditStore((s) => s.setParam);

  const points = toneCurve[channel];

  const setPoints = useCallback(
    (newPoints: CurvePoint[]) => {
      setParam('toneCurve', { ...toneCurve, [channel]: newPoints });
    },
    [toneCurve, channel, setParam],
  );

  const getSvgCoords = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: clamp(((e.clientX - rect.left) / rect.width) * SVG_SIZE, 0, SVG_SIZE),
        y: clamp(((e.clientY - rect.top) / rect.height) * SVG_SIZE, 0, SVG_SIZE),
      };
    },
    [],
  );

  const toNormalized = (svgX: number, svgY: number) => ({
    x: clamp(svgX / SVG_SIZE, 0, 1),
    y: clamp(1 - svgY / SVG_SIZE, 0, 1),
  });

  const findPointIndex = useCallback(
    (svgX: number, svgY: number): number => {
      for (let i = 0; i < points.length; i++) {
        const px = points[i].x * SVG_SIZE;
        const py = (1 - points[i].y) * SVG_SIZE;
        const dist = Math.hypot(svgX - px, svgY - py);
        if (dist <= GRAB_RADIUS) return i;
      }
      return -1;
    },
    [points],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const { x, y } = getSvgCoords(e);
      const idx = findPointIndex(x, y);

      if (idx >= 0) {
        setDragIndex(idx);
      } else {
        // Add a new point
        const norm = toNormalized(x, y);
        const newPoints = [...points, norm].sort((a, b) => a.x - b.x);
        setPoints(newPoints);
        // Find index of the newly added point
        const newIdx = newPoints.findIndex((p) => p.x === norm.x && p.y === norm.y);
        setDragIndex(newIdx);
      }
    },
    [getSvgCoords, findPointIndex, points, setPoints],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragIndex === null) return;
      const { x, y } = getSvgCoords(e);
      const norm = toNormalized(x, y);

      const newPoints = [...points];
      const isEndpoint0 = dragIndex === 0 && points[0].x === 0;
      const isEndpointN = dragIndex === points.length - 1 && points[points.length - 1].x === 1;

      if (isEndpoint0) {
        newPoints[dragIndex] = { x: 0, y: norm.y };
      } else if (isEndpointN) {
        newPoints[dragIndex] = { x: 1, y: norm.y };
      } else {
        // Constrain x between neighbors
        const sorted = [...points].sort((a, b) => a.x - b.x);
        const sortedIdx = sorted.findIndex(
          (p) => p.x === points[dragIndex].x && p.y === points[dragIndex].y,
        );
        const minX = sortedIdx > 0 ? sorted[sortedIdx - 1].x + 0.005 : 0;
        const maxX = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1].x - 0.005 : 1;
        newPoints[dragIndex] = { x: clamp(norm.x, minX, maxX), y: norm.y };
      }

      setPoints(newPoints);
    },
    [dragIndex, getSvgCoords, points, setPoints],
  );

  const handleMouseUp = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getSvgCoords(e);
      const idx = findPointIndex(x, y);
      if (idx < 0) return;

      // Don't remove endpoints
      const sorted = [...points].sort((a, b) => a.x - b.x);
      if (sorted[0] === points[idx] || sorted[sorted.length - 1] === points[idx]) return;

      const newPoints = points.filter((_, i) => i !== idx);
      setPoints(newPoints);
    },
    [getSvgCoords, findPointIndex, points, setPoints],
  );

  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const pathD = buildCurvePath(sortedPoints);
  const color = CHANNEL_COLORS[channel];

  return (
    <PanelSection title="Tone Curve">
      <div className={styles.tabs}>
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            className={styles.tab}
            data-active={ch === channel}
            onClick={() => setChannel(ch)}
            type="button"
          >
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>
      <div className={styles.curveContainer}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((t) => (
            <g key={t}>
              <line
                x1={t * SVG_SIZE}
                y1={0}
                x2={t * SVG_SIZE}
                y2={SVG_SIZE}
                stroke="#333"
                strokeWidth={0.5}
              />
              <line
                x1={0}
                y1={t * SVG_SIZE}
                x2={SVG_SIZE}
                y2={t * SVG_SIZE}
                stroke="#333"
                strokeWidth={0.5}
              />
            </g>
          ))}
          {/* Diagonal baseline */}
          <line
            x1={0}
            y1={SVG_SIZE}
            x2={SVG_SIZE}
            y2={0}
            stroke="#444"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
          {/* Curve path */}
          <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
          {/* Control points */}
          {sortedPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x * SVG_SIZE}
              cy={(1 - p.y) * SVG_SIZE}
              r={POINT_RADIUS}
              fill={dragIndex !== null && points[dragIndex] === p ? color : '#1a1a1a'}
              stroke={color}
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
    </PanelSection>
  );
}
