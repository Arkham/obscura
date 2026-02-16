import { useRef, useCallback } from 'react';
import { Canvas, type CanvasHandle } from './Canvas';
import { BasicPanel } from '../panels/BasicPanel';
import { PresencePanel } from '../panels/PresencePanel';
import { ToneCurvePanel } from '../panels/ToneCurvePanel';
import { HslPanel } from '../panels/HslPanel';
import { ColorGradingPanel } from '../panels/ColorGradingPanel';
import { useEditStore } from '../../store/editStore';
import { useCatalogStore } from '../../store/catalogStore';
import styles from './EditorView.module.css';

interface EditorViewProps {
  onBack: () => void;
}

export function EditorView({ onBack }: EditorViewProps) {
  const canvasRef = useRef<CanvasHandle>(null);
  const entries = useCatalogStore((s) => s.entries);
  const selectedIndex = useCatalogStore((s) => s.selectedIndex);
  const setSelectedIndex = useCatalogStore((s) => s.setSelectedIndex);
  const resetAll = useEditStore((s) => s.resetAll);

  const currentName = selectedIndex >= 0 && selectedIndex < entries.length
    ? entries[selectedIndex].name
    : 'No image';

  const handlePrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  }, [selectedIndex, setSelectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex < entries.length - 1) setSelectedIndex(selectedIndex + 1);
  }, [selectedIndex, entries.length, setSelectedIndex]);

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onBack}>&larr; Back</button>
        <span className={styles.filename}>{currentName}</span>
        <div className={styles.toolbarActions}>
          <button className={styles.actionBtn} onClick={resetAll}>Reset</button>
        </div>
      </div>
      <div className={styles.main}>
        <Canvas ref={canvasRef} />
        <div className={styles.sidebar}>
          <div className={styles.panelScroll}>
            <BasicPanel />
            <PresencePanel />
            <ToneCurvePanel />
            <HslPanel />
            <ColorGradingPanel />
          </div>
        </div>
      </div>
      <div className={styles.bottomBar}>
        <button
          className={styles.navBtn}
          onClick={handlePrev}
          disabled={selectedIndex <= 0}
        >
          &larr; Prev
        </button>
        <span className={styles.counter}>
          {entries.length > 0 ? `${selectedIndex + 1} / ${entries.length}` : ''}
        </span>
        <button
          className={styles.navBtn}
          onClick={handleNext}
          disabled={selectedIndex >= entries.length - 1}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
