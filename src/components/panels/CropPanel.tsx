import { useCallback } from 'react';
import { useEditStore } from '../../store/editStore';
import { PanelSection } from './PanelSection';
import styles from './CropPanel.module.css';

const ASPECT_RATIOS = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
] as const;

interface CropPanelProps {
  cropMode: boolean;
  onToggleCropMode: () => void;
  aspectRatio: number | null;
  onSetAspectRatio: (ratio: number | null) => void;
}

export function CropPanel({
  cropMode,
  onToggleCropMode,
  aspectRatio,
  onSetAspectRatio,
}: CropPanelProps) {
  const crop = useEditStore((s) => s.edits.crop);
  const setParam = useEditStore((s) => s.setParam);

  const handleClear = useCallback(() => {
    setParam('crop', null);
  }, [setParam]);

  return (
    <PanelSection title="Crop" defaultOpen={false}>
      <div className={styles.ratioRow}>
        {ASPECT_RATIOS.map(({ label, value }) => (
          <button
            key={label}
            className={styles.ratioBtn}
            data-active={aspectRatio === value}
            onClick={() => onSetAspectRatio(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          data-active={cropMode}
          onClick={onToggleCropMode}
          type="button"
        >
          {cropMode ? 'Done' : 'Crop'}
        </button>
        <button
          className={styles.actionBtn}
          onClick={handleClear}
          disabled={!crop}
          type="button"
        >
          Clear
        </button>
      </div>
      {crop && (
        <div className={styles.info}>
          {Math.round(crop.width * 100)}% x {Math.round(crop.height * 100)}%
          {crop.rotation !== 0 && ` (${crop.rotation}\u00B0)`}
        </div>
      )}
    </PanelSection>
  );
}
