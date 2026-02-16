const DB_NAME = 'obscura';
const STORE_NAME = 'recent-folders';
const MAX_RECENT = 10;

interface RecentFolder {
  name: string;
  handle: FileSystemDirectoryHandle;
  lastOpened: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecentFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const entry: RecentFolder = { name: handle.name, handle, lastOpened: Date.now() };
  store.put(entry);

  // Prune old entries beyond MAX_RECENT
  const all = await new Promise<RecentFolder[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (all.length > MAX_RECENT) {
    all.sort((a, b) => b.lastOpened - a.lastOpened);
    for (const old of all.slice(MAX_RECENT)) {
      store.delete(old.name);
    }
  }
}

export async function getRecentFolders(): Promise<RecentFolder[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise<RecentFolder[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return all.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch {
    return false;
  }
}
