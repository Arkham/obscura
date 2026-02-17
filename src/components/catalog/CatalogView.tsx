import { useState, useCallback, useEffect } from 'react';
import { useCatalogStore } from '../../store/catalogStore';
import type { CatalogEntry } from '../../store/catalogStore';
import { openDirectory, listRawFiles } from '../../io/filesystem';
import { fileExists } from '../../io/filesystem';
import { extractThumbnailUrl } from '../../raw/thumbnail';
import { saveRecentFolder, getRecentFolders, requestPermission } from '../../io/recentFolders';
import { ThumbnailGrid } from './ThumbnailGrid';
import { AppHeader } from '../AppHeader';
import styles from './CatalogView.module.css';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface CatalogViewProps {
  onOpenEditor: (index: number) => void;
}

interface RecentEntry {
  name: string;
  handle: FileSystemDirectoryHandle;
  lastOpened: number;
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
  const [recentFolders, setRecentFolders] = useState<RecentEntry[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    getRecentFolders().then(setRecentFolders);
  }, []);

  const loadFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setDirectory(handle);
    setIsLoading(true);
    setLoadProgress('Scanning for RAW files...');
    saveRecentFolder(handle).then(() => getRecentFolders().then(setRecentFolders));

    const rawFiles = await listRawFiles(handle);
    if (rawFiles.length === 0) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    const initialEntries: CatalogEntry[] = rawFiles.map((fh) => ({
      name: fh.name,
      fileHandle: fh,
      thumbnailUrl: null,
      hasSidecar: false,
    }));
    setEntries(initialEntries);

    const sidecarChecks = await Promise.all(
      rawFiles.map((fh) => fileExists(handle, `${fh.name}.json`)),
    );

    const withSidecars = initialEntries.map((entry, i) => ({
      ...entry,
      hasSidecar: sidecarChecks[i],
    }));
    setEntries(withSidecars);

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
  }, [setDirectory, setEntries, setSelectedIndex]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await openDirectory();
      await loadFolder(handle);
    } catch (err) {
      setIsLoading(false);
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Failed to open directory:', err);
      }
    }
  }, [loadFolder]);

  const handleOpenRecent = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const granted = await requestPermission(handle);
    if (!granted) return;
    try {
      await loadFolder(handle);
    } catch (err) {
      console.error('Failed to open recent folder:', err);
    }
  }, [loadFolder]);

  const DEMO_URL =
    'https://upload.wikimedia.org/wikipedia/commons/9/99/Joseph_Mallord_William_Turner_%28British_-_Modern_Rome-Campo_Vaccino_-_Google_Art_Project.jpg';

  const handleTryDemo = useCallback(async () => {
    setDemoLoading(true);
    try {
      const res = await fetch(DEMO_URL);
      const buffer = await res.arrayBuffer();
      const file = new File([buffer], 'modern-rome.jpg', { type: 'image/jpeg' });
      const thumbUrl = URL.createObjectURL(file);

      const mockHandle = {
        kind: 'file' as const,
        name: 'modern-rome.jpg',
        getFile: async () => file,
      } as unknown as FileSystemFileHandle;

      const entry: CatalogEntry = {
        name: 'modern-rome.jpg',
        fileHandle: mockHandle,
        thumbnailUrl: thumbUrl,
        hasSidecar: false,
      };

      setEntries([entry]);
      setSelectedIndex(0);
      onOpenEditor(0);
    } catch (err) {
      console.error('Failed to load demo image:', err);
    } finally {
      setDemoLoading(false);
    }
  }, [setEntries, setSelectedIndex, onOpenEditor]);

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

  return (
    <div className={styles.catalog}>
      <AppHeader />
      <div className={styles.body}>
        <div className={styles.sidebar}>
          <button className={styles.openBtn} onClick={handleOpenFolder}>
            Open Folder
          </button>
          {recentFolders.length > 0 && (
            <div className={styles.recentList}>
              <span className={styles.recentLabel}>Recent</span>
              {recentFolders.map((f) => (
                <button
                  key={f.name}
                  className={styles.recentItem}
                  data-active={dirHandle?.name === f.name}
                  onClick={() => handleOpenRecent(f.handle)}
                >
                  <span className={styles.recentName}>{f.name}</span>
                  <span className={styles.recentTime}>{formatRelativeTime(f.lastOpened)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.main}>
          {!dirHandle ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>Open a folder to get started</span>
              {recentFolders.length === 0 && (
                <button
                  className={styles.demoLink}
                  onClick={handleTryDemo}
                  disabled={demoLoading}
                >
                  {demoLoading ? 'Loading demo...' : 'or try a demo'}
                </button>
              )}
            </div>
          ) : isLoading && entries.length === 0 ? (
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
      </div>
    </div>
  );
}
