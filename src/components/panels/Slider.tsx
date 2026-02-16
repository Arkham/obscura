import { useState, useCallback } from 'react';
import { setSliderDragging } from '../../store/editStore';
import styles from './Slider.module.css';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, defaultValue, onChange }: SliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const formatValue = (v: number) => {
    if (step >= 1) return String(Math.round(v));
    if (step >= 0.1) return v.toFixed(1);
    return v.toFixed(2);
  };

  const handleDoubleClickTrack = useCallback(() => {
    onChange(defaultValue);
  }, [onChange, defaultValue]);

  const handleDoubleClickValue = useCallback(() => {
    setEditText(formatValue(value));
    setIsEditing(true);
  }, [value, step]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const parsed = parseFloat(editText);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  }, [editText, min, max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setIsEditing(false);
  }, [commitEdit]);

  // Compute fill percentage for track visualization
  const range = max - min;
  const isCentered = min < 0 && max > 0;
  let fillLeft: string, fillWidth: string;

  if (isCentered) {
    const center = ((0 - min) / range) * 100;
    const current = ((value - min) / range) * 100;
    if (value >= 0) {
      fillLeft = `${center}%`;
      fillWidth = `${current - center}%`;
    } else {
      fillLeft = `${current}%`;
      fillWidth = `${center - current}%`;
    }
  } else {
    fillLeft = '0%';
    fillWidth = `${((value - min) / range) * 100}%`;
  }

  return (
    <div className={styles.slider}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {isEditing ? (
          <input
            className={styles.editInput}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className={styles.value}
            onDoubleClick={handleDoubleClickValue}
          >
            {formatValue(value)}
          </span>
        )}
      </div>
      <div className={styles.trackContainer}>
        <div
          className={styles.fill}
          style={{ left: fillLeft, width: fillWidth }}
        />
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerDown={() => setSliderDragging(true)}
          onPointerUp={() => setSliderDragging(false)}
          onDoubleClick={handleDoubleClickTrack}
        />
      </div>
    </div>
  );
}
