import { useCallback, useRef, useState } from 'react';
import styles from './ColorWheel.module.css';

interface ColorWheelProps {
  label: string;
  hue: number; // 0-360
  saturation: number; // 0-100
  luminance: number; // -100 to +100
  onChange: (hue: number, saturation: number, luminance: number) => void;
}

const WHEEL_SIZE = 100;
const WHEEL_RADIUS = 44;
const CENTER = WHEEL_SIZE / 2;
const HANDLE_RADIUS = 5;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ColorWheel({ label, hue, saturation, luminance, onChange }: ColorWheelProps) {
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Convert hue/saturation to x/y in SVG coords
  const angleRad = ((hue - 90) * Math.PI) / 180;
  const dist = (saturation / 100) * WHEEL_RADIUS;
  const handleX = CENTER + Math.cos(angleRad) * dist;
  const handleY = CENTER + Math.sin(angleRad) * dist;

  const getSvgCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: CENTER, y: CENTER };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WHEEL_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * WHEEL_SIZE,
    };
  }, []);

  const updateFromCoords = useCallback(
    (svgX: number, svgY: number) => {
      const dx = svgX - CENTER;
      const dy = svgY - CENTER;
      let dist = Math.hypot(dx, dy);
      dist = Math.min(dist, WHEEL_RADIUS);

      const newSat = clamp((dist / WHEEL_RADIUS) * 100, 0, 100);
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;
      const newHue = Math.round(angle) % 360;

      onChange(newHue, Math.round(newSat), luminance);
    },
    [luminance, onChange],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const { x, y } = getSvgCoords(e);
      updateFromCoords(x, y);
    },
    [getSvgCoords, updateFromCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const { x, y } = getSvgCoords(e);
      updateFromCoords(x, y);
    },
    [dragging, getSvgCoords, updateFromCoords],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    onChange(0, 0, luminance);
  }, [luminance, onChange]);

  return (
    <div className={styles.wheel}>
      <span className={styles.label}>{label}</span>
      <div className={styles.wheelContainer}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <defs>
            <clipPath id={`ring-${label}`}>
              <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS} />
            </clipPath>
          </defs>
          {/* Background circle */}
          <circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS} fill="#2a2a2a" stroke="#555" strokeWidth={1} />
          {/* Hue ring using colored arcs */}
          {Array.from({ length: 12 }, (_, i) => {
            const startAngle = (i * 30 - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
            const innerR = WHEEL_RADIUS - 6;
            const outerR = WHEEL_RADIUS;
            const x1 = CENTER + Math.cos(startAngle) * outerR;
            const y1 = CENTER + Math.sin(startAngle) * outerR;
            const x2 = CENTER + Math.cos(endAngle) * outerR;
            const y2 = CENTER + Math.sin(endAngle) * outerR;
            const x3 = CENTER + Math.cos(endAngle) * innerR;
            const y3 = CENTER + Math.sin(endAngle) * innerR;
            const x4 = CENTER + Math.cos(startAngle) * innerR;
            const y4 = CENTER + Math.sin(startAngle) * innerR;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`}
                fill={`hsl(${i * 30}, 70%, 50%)`}
                opacity={0.6}
              />
            );
          })}
          {/* Crosshair */}
          <line x1={CENTER} y1={CENTER - 4} x2={CENTER} y2={CENTER + 4} stroke="#666" strokeWidth={0.5} />
          <line x1={CENTER - 4} y1={CENTER} x2={CENTER + 4} y2={CENTER} stroke="#666" strokeWidth={0.5} />
          {/* Handle */}
          <circle
            cx={handleX}
            cy={handleY}
            r={HANDLE_RADIUS}
            fill={saturation > 0 ? `hsl(${hue}, ${Math.min(saturation * 2, 100)}%, 60%)` : '#888'}
            stroke="#fff"
            strokeWidth={1.5}
          />
        </svg>
      </div>
      <div className={styles.lumSlider}>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={luminance}
          onChange={(e) => onChange(hue, saturation, parseInt(e.target.value))}
        />
      </div>
      <span className={styles.lumValue}>Lum: {luminance}</span>
    </div>
  );
}
