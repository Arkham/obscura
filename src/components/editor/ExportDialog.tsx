import { useState, useCallback } from 'react';
import type { ExportOptions } from '../../io/export';
import styles from './ExportDialog.module.css';

interface ExportDialogProps {
  onExport: (options: ExportOptions) => Promise<void>;
  onClose: () => void;
}

export function ExportDialog({ onExport, onClose }: ExportDialogProps) {
  const [quality, setQuality] = useState(92);
  const [border, setBorder] = useState<ExportOptions['border']>('none');
  const [borderWidth, setBorderWidth] = useState(5);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleExport = useCallback(async () => {
    setExporting(true);
    setProgress('Exporting...');
    try {
      await onExport({ quality, border, borderWidth });
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      setProgress('Export failed');
      setExporting(false);
    }
  }, [quality, border, borderWidth, onExport, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog}>
        <div className={styles.title}>Export JPEG</div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Quality</span>
          <div className={styles.fieldRow}>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
            />
            <span className={styles.fieldValue}>{quality}</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Border</span>
          <div className={styles.radioGroup}>
            {(['none', 'white', 'black'] as const).map((opt) => (
              <label key={opt} className={styles.radioLabel}>
                <input
                  type="radio"
                  name="border"
                  checked={border === opt}
                  onChange={() => setBorder(opt)}
                />
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {border !== 'none' && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Border Width (%)</span>
            <div className={styles.fieldRow}>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={borderWidth}
                onChange={(e) => setBorderWidth(parseInt(e.target.value))}
              />
              <span className={styles.fieldValue}>{borderWidth}%</span>
            </div>
          </div>
        )}

        {progress && <div className={styles.progress}>{progress}</div>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
