import { useState, useCallback } from 'react';
import { useCatalogStore } from '../../store/catalogStore';
import type { CatalogEntry } from '../../store/catalogStore';
import { openDirectory, listRawFiles } from '../../io/filesystem';
import { fileExists } from '../../io/filesystem';
import { extractThumbnailUrl } from '../../raw/thumbnail';
import { ThumbnailGrid } from './ThumbnailGrid';
import { AppHeader } from '../AppHeader';
import styles from './CatalogView.module.css';

interface CatalogViewProps {
  onOpenEditor: (index: number) => void;
}

export function CatalogView({ onOpenEditor }: CatalogViewProps) {
  const dirHandle = useCatalogStore((s) => s.dirHandle);
  const entries = useCatalogStore((s) => s.entries);
  const selectedIndex = useCatalogStore((s) => s.selectedIndex);
  const setDirectory = useCatalogStore((s) => s.setDirectory);
  const setEntries = useCatalogStore((s) => s.setEntries);
  const setSelectedIndex = useCatalogStore((s) => s.setSelectedIndex);

  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState('');

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await openDirectory();
      setDirectory(handle);
      setIsLoading(true);
      setLoadProgress('Scanning for RAW files...');

      const rawFiles = await listRawFiles(handle);
      if (rawFiles.length === 0) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      // Create initial entries without thumbnails
      const initialEntries: CatalogEntry[] = rawFiles.map((fh) => ({
        name: fh.name,
        fileHandle: fh,
        thumbnailUrl: null,
        hasSidecar: false,
      }));
      setEntries(initialEntries);

      // Check for sidecars in parallel
      const sidecarChecks = await Promise.all(
        rawFiles.map((fh) => fileExists(handle, `${fh.name}.json`)),
      );

      const withSidecars = initialEntries.map((entry, i) => ({
        ...entry,
        hasSidecar: sidecarChecks[i],
      }));
      setEntries(withSidecars);

      // Extract thumbnails progressively
      const updatedEntries = [...withSidecars];

      for (let i = 0; i < rawFiles.length; i++) {
        setLoadProgress(`Extracting thumbnails... ${i + 1}/${rawFiles.length}`);
        try {
          const file = await rawFiles[i].getFile();
          const buffer = await file.arrayBuffer();
          const thumbUrl = await extractThumbnailUrl(null, buffer);
          updatedEntries[i] = { ...updatedEntries[i], thumbnailUrl: thumbUrl ?? '' };
          setEntries([...updatedEntries]);
        } catch (err) {
          console.warn(`Failed to extract thumbnail for ${rawFiles[i].name}:`, err);
          updatedEntries[i] = { ...updatedEntries[i], thumbnailUrl: '' };
          setEntries([...updatedEntries]);
        }
      }

      setIsLoading(false);
      if (rawFiles.length > 0) {
        setSelectedIndex(0);
      }
    } catch (err) {
      // User cancelled or permission denied
      setIsLoading(false);
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Failed to open directory:', err);
      }
    }
  }, [setDirectory, setEntries, setSelectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      setSelectedIndex(index);
    },
    [setSelectedIndex],
  );

  const handleOpen = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      onOpenEditor(index);
    },
    [setSelectedIndex, onOpenEditor],
  );

  if (!dirHandle) {
    return (
      <div className={styles.catalog}>
        <AppHeader />
        <div className={styles.empty}>
          <span className={styles.emptyText}>RAW Photo Editor</span>
          <button className={styles.openBtn} onClick={handleOpenFolder}>
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.catalog}>
      <AppHeader
        actions={
          <>
            <span className={styles.folderName}>{dirHandle.name}</span>
            <button className={styles.openBtn} onClick={handleOpenFolder}>
              Open Folder
            </button>
          </>
        }
      />
      {isLoading && entries.length === 0 ? (
        <div className={styles.loading}>{loadProgress}</div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyText}>No RAW files found in this folder</span>
        </div>
      ) : (
        <div className={styles.content}>
          {isLoading && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #a0a0a0)', marginBottom: 8 }}>
              {loadProgress}
            </div>
          )}
          <ThumbnailGrid
            entries={entries}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onOpen={handleOpen}
          />
        </div>
      )}
    </div>
  );
}
