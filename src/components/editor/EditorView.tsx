import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas, type CanvasHandle } from './Canvas';
import { CropOverlay } from './CropOverlay';
import { ExportDialog } from './ExportDialog';
import { HistoryPanel } from './HistoryPanel';
import { BasicPanel } from '../panels/BasicPanel';
import { PresencePanel } from '../panels/PresencePanel';
import { ToneCurvePanel } from '../panels/ToneCurvePanel';
import { HslPanel } from '../panels/HslPanel';
import { ColorGradingPanel } from '../panels/ColorGradingPanel';
import { DetailPanel } from '../panels/DetailPanel';
import { EffectsPanel } from '../panels/EffectsPanel';
import { CropPanel } from '../panels/CropPanel';
import { HistogramPanel } from '../panels/HistogramPanel';
import { MetadataPanel } from '../panels/MetadataPanel';
import { useEditStore } from '../../store/editStore';
import { useCatalogStore } from '../../store/catalogStore';
import { createDefaultEdits } from '../../types/edits';
import { createRawDecoder } from '../../raw/decoder';
import { createRgbFloatTexture } from '../../engine/texture-utils';
import { loadSidecar, loadHistory } from '../../io/sidecar';
import { extractMetadata, type ImageMetadata } from '../../raw/metadata';
import { decodeInWorker } from '../../raw/worker-decode';
import type { ExportOptions } from '../../io/export';
import { writeFile } from '../../io/filesystem';
import { useNotificationStore } from '../../store/notificationStore';
import { AppHeader } from '../AppHeader';
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
  const loadEdits = useEditStore((s) => s.loadEdits);
  const setAutoSaveTarget = useEditStore((s) => s.setAutoSaveTarget);
  const notify = useNotificationStore((s) => s.notify);

  const [cropMode, setCropMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const isFullResRef = useRef(false);
  const fullResLoadingRef = useRef(false);

  // Max full-res pixel budget (~20MP, needs ~640MB GPU for 4 RGBA16F buffers)
  const MAX_FULL_RES_PIXELS = 20_000_000;
  const ZOOM_THRESHOLD = 2;

  const handleZoomChange = useCallback((zoom: number) => {
    if (zoom < ZOOM_THRESHOLD || isFullResRef.current || fullResLoadingRef.current) return;

    const buffer = bufferRef.current;
    if (!buffer) return;

    fullResLoadingRef.current = true;

    (async () => {
      try {
        const decoded = await decodeInWorker(buffer, false);

        // Check pixel budget after decode (worker can't crash main thread)
        if (decoded.width * decoded.height > MAX_FULL_RES_PIXELS) {
          console.warn('Full-res image exceeds pixel budget, keeping half-size');
          return;
        }

        const canvas = canvasRef.current;
        const gl = canvas?.getPipeline()?.getGL();
        if (!canvas || !gl) return;

        const tex = createRgbFloatTexture(gl, decoded.width, decoded.height, decoded.data);
        canvas.setImage(tex, decoded.width, decoded.height);
        isFullResRef.current = true;
      } catch (err) {
        console.warn('Full-res decode failed, keeping half-size:', err);
      } finally {
        fullResLoadingRef.current = false;
      }
    })();
  }, []);

  // Load and decode the selected RAW file into the WebGL pipeline
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= entries.length) return;

    const entry = entries[selectedIndex];
    let cancelled = false;

    (async () => {
      setIsDecoding(true);
      setMetadata(null);
      bufferRef.current = null;
      isFullResRef.current = false;
      fullResLoadingRef.current = false;
      try {
        // Load saved edits and history from sidecar (if any) before decoding
        let savedEdits: Partial<import('../../types/edits').EditState> | null = null;
        let savedHistory: Awaited<ReturnType<typeof loadHistory>> = null;
        if (dirHandle) {
          try {
            savedEdits = await loadSidecar(dirHandle, entry.name);
            savedHistory = await loadHistory(dirHandle, entry.name);
          } catch {
            // No sidecar or read error — use defaults
          }
        }
        if (cancelled) return;

        loadEdits(savedEdits ?? {}, savedHistory);
        if (dirHandle) {
          setAutoSaveTarget(dirHandle, entry.name);
        }

        const file = await entry.fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        bufferRef.current = buffer;

        if (!cancelled) {
          setMetadata(extractMetadata(buffer));
        }

        const decoder = createRawDecoder();
        const decoded = await decoder.decode(buffer, true); // halfSize for fast preview

        if (cancelled) return;

        const canvas = canvasRef.current;
        const gl = canvas?.getPipeline()?.getGL();
        if (!canvas || !gl) return;

        const tex = createRgbFloatTexture(gl, decoded.width, decoded.height, decoded.data);
        canvas.setImage(tex, decoded.width, decoded.height);
      } catch (err) {
        console.error(`Failed to decode ${entry.name}:`, err);
      } finally {
        if (!cancelled) setIsDecoding(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedIndex, entries, dirHandle, loadEdits, setAutoSaveTarget]);

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
    async (options: ExportOptions, fileName: string) => {
      const pipeline = canvasRef.current?.getPipeline();
      if (!pipeline || !dirHandle || selectedIndex < 0) return;

      const entry = entries[selectedIndex];
      const file = await entry.fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      const { exportJpeg } = await import('../../io/export');
      const { createRawDecoder } = await import('../../raw/decoder');
      const decoder = createRawDecoder();

      const blob = await exportJpeg(pipeline, edits, buffer, decoder, options);
      await writeFile(dirHandle, fileName, blob);
      notify(`Exported "${fileName}"`, 'success');
    },
    [dirHandle, entries, selectedIndex, edits, notify],
  );

  // Before/after: render default edits while Space is held
  useEffect(() => {
    const view = canvasRef.current?.getView();
    if (showBefore) {
      canvasRef.current?.getPipeline()?.render(createDefaultEdits(), view);
    } else {
      const renderEdits = cropMode ? { ...edits, crop: null } : edits;
      canvasRef.current?.getPipeline()?.render(renderEdits, view);
    }
  }, [showBefore, edits, cropMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Undo/Redo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        useEditStore.getState().undo();
        return;
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        useEditStore.getState().redo();
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedIndex < entries.length - 1) setSelectedIndex(selectedIndex + 1);
          break;
        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            resetAll();
          }
          break;
        case 'e':
        case 'E':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setShowExport(true);
          }
          break;
        case 'Escape':
          if (showExport) {
            setShowExport(false);
          } else if (cropMode) {
            setCropMode(false);
          } else {
            onBack();
          }
          break;
        case ' ':
          e.preventDefault();
          setShowBefore(true);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setShowBefore(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIndex, entries.length, setSelectedIndex, resetAll, onBack, showExport, cropMode]);

  // Compute viewport rect for crop overlay directly from image/canvas dimensions
  // (avoids stale _lastViewport when switching crop mode)
  const pipeline = canvasRef.current?.getPipeline();
  const canvasEl = pipeline?.getGL().canvas as HTMLCanvasElement | undefined;
  const dpr = window.devicePixelRatio || 1;
  let flippedViewport = { x: 0, y: 0, w: 0, h: 0 };
  if (pipeline && canvasEl) {
    const { width: imgW, height: imgH } = pipeline.getImageDimensions();
    const canvasW = canvasEl.width;
    const canvasH = canvasEl.height;
    if (imgW > 0 && imgH > 0 && canvasW > 0 && canvasH > 0) {
      // In crop mode we show the full image; otherwise use cropped dimensions
      const crop = (!cropMode && edits.crop) ? edits.crop : { x: 0, y: 0, width: 1, height: 1 };
      const dispW = imgW * crop.width;
      const dispH = imgH * crop.height;
      const imgAspect = dispW / dispH;
      const canvasAspect = canvasW / canvasH;

      let viewW: number, viewH: number;
      if (imgAspect > canvasAspect) {
        viewW = canvasW;
        viewH = Math.round(canvasW / imgAspect);
      } else {
        viewH = canvasH;
        viewW = Math.round(canvasH * imgAspect);
      }
      const viewX = Math.round((canvasW - viewW) / 2);
      const viewY = Math.round((canvasH - viewH) / 2);

      // Convert WebGL pixels to CSS pixels and flip Y (WebGL is bottom-up)
      const cssCH = canvasEl.clientHeight;
      flippedViewport = {
        x: viewX / dpr,
        y: cssCH - (viewY + viewH) / dpr,
        w: viewW / dpr,
        h: viewH / dpr,
      };
    }
  }

  return (
    <div className={styles.editor}>
      <AppHeader
        actions={
          <div className={styles.toolbarActions}>
            <button className={styles.actionBtn} onClick={resetAll}>Reset</button>
            <button className={styles.actionBtn} onClick={() => setShowExport(true)}>Export</button>
          </div>
        }
      >
        <button className={styles.backBtn} onClick={onBack}>Back</button>
      </AppHeader>
      <div className={styles.main}>
        <div className={styles.leftSidebar}>
          <HistoryPanel />
        </div>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <Canvas ref={canvasRef} cropMode={cropMode} onZoomChange={handleZoomChange} />
          {isDecoding && (
            <div className={styles.decodingOverlay}>Decoding RAW...</div>
          )}
          <CropOverlay
            active={cropMode}
            aspectRatio={aspectRatio}
            viewport={flippedViewport}
            onDone={() => setCropMode(false)}
          />
        </div>
        <div className={styles.sidebar}>
          <div className={styles.panelScroll}>
            <HistogramPanel />
            <MetadataPanel metadata={metadata} />
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
              onSetAspectRatio={(ratio) => {
                setAspectRatio(ratio);
                if (ratio !== null) setCropMode(true);
              }}
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
          Prev
        </button>
        <span className={styles.filename}>
          {currentName}
          {showBefore && <span className={styles.beforeBadge}>Before</span>}
        </span>
        <span className={styles.counter}>
          {entries.length > 0 ? `${selectedIndex + 1} / ${entries.length}` : ''}
        </span>
        <button
          className={styles.navBtn}
          onClick={handleNext}
          disabled={selectedIndex >= entries.length - 1}
        >
          Next
        </button>
      </div>
      {showExport && (
        <ExportDialog
          defaultFileName={currentName ? currentName.replace(/\.[^.]+$/, '_edit.jpg') : 'export.jpg'}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
