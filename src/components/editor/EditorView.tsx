import { useRef, useCallback, useState } from 'react';
import { Canvas, type CanvasHandle } from './Canvas';
import { CropOverlay } from './CropOverlay';
import { ExportDialog } from './ExportDialog';
import { BasicPanel } from '../panels/BasicPanel';
import { PresencePanel } from '../panels/PresencePanel';
import { ToneCurvePanel } from '../panels/ToneCurvePanel';
import { HslPanel } from '../panels/HslPanel';
import { ColorGradingPanel } from '../panels/ColorGradingPanel';
import { DetailPanel } from '../panels/DetailPanel';
import { EffectsPanel } from '../panels/EffectsPanel';
import { CropPanel } from '../panels/CropPanel';
import { useEditStore } from '../../store/editStore';
import { useCatalogStore } from '../../store/catalogStore';
import type { ExportOptions } from '../../io/export';
import { writeFile } from '../../io/filesystem';
import styles from './EditorView.module.css';

interface EditorViewProps {
  onBack: () => void;
}

export function EditorView({ onBack }: EditorViewProps) {
  const canvasRef = useRef<CanvasHandle>(null);
  const entries = useCatalogStore((s) => s.entries);
  const selectedIndex = useCatalogStore((s) => s.selectedIndex);
  const setSelectedIndex = useCatalogStore((s) => s.setSelectedIndex);
  const dirHandle = useCatalogStore((s) => s.dirHandle);
  const resetAll = useEditStore((s) => s.resetAll);
  const edits = useEditStore((s) => s.edits);

  const [cropMode, setCropMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);

  const currentName = selectedIndex >= 0 && selectedIndex < entries.length
    ? entries[selectedIndex].name
    : 'No image';

  const handlePrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  }, [selectedIndex, setSelectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex < entries.length - 1) setSelectedIndex(selectedIndex + 1);
  }, [selectedIndex, entries.length, setSelectedIndex]);

  const handleToggleCropMode = useCallback(() => {
    setCropMode((m) => !m);
  }, []);

  const handleExport = useCallback(
    async (options: ExportOptions) => {
      const pipeline = canvasRef.current?.getPipeline();
      if (!pipeline || !dirHandle || selectedIndex < 0) return;

      const entry = entries[selectedIndex];
      const file = await entry.fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      // Dynamic import to keep the export module out of the main bundle
      const { exportJpeg } = await import('../../io/export');
      const { createLibRawDecoder } = await import('../../raw/decoder');
      const decoder = createLibRawDecoder();

      const blob = await exportJpeg(pipeline, edits, buffer, decoder, options);

      // Save next to the RAW file
      const baseName = entry.name.replace(/\.[^.]+$/, '');
      const exportName = `${baseName}_edit.jpg`;
      await writeFile(dirHandle, exportName, blob);
    },
    [dirHandle, entries, selectedIndex, edits],
  );

  // Get canvas dimensions for crop overlay
  const pipeline = canvasRef.current?.getPipeline();
  const dims = pipeline?.getImageDimensions() ?? { width: 0, height: 0 };

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onBack}>&larr; Back</button>
        <span className={styles.filename}>{currentName}</span>
        <div className={styles.toolbarActions}>
          <button className={styles.actionBtn} onClick={resetAll}>Reset</button>
          <button className={styles.actionBtn} onClick={() => setShowExport(true)}>Export</button>
        </div>
      </div>
      <div className={styles.main}>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <Canvas ref={canvasRef} />
          <CropOverlay
            active={cropMode}
            aspectRatio={aspectRatio}
            canvasWidth={dims.width}
            canvasHeight={dims.height}
            onDone={() => setCropMode(false)}
          />
        </div>
        <div className={styles.sidebar}>
          <div className={styles.panelScroll}>
            <BasicPanel />
            <PresencePanel />
            <ToneCurvePanel />
            <HslPanel />
            <ColorGradingPanel />
            <DetailPanel />
            <EffectsPanel />
            <CropPanel
              cropMode={cropMode}
              onToggleCropMode={handleToggleCropMode}
              aspectRatio={aspectRatio}
              onSetAspectRatio={setAspectRatio}
            />
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
      {showExport && (
        <ExportDialog onExport={handleExport} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
