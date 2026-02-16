import { create } from 'zustand';

export interface CatalogEntry {
  name: string;
  fileHandle: FileSystemFileHandle;
  thumbnailUrl: string | null;
  hasSidecar: boolean;
}

interface CatalogStoreState {
  dirHandle: FileSystemDirectoryHandle | null;
  entries: CatalogEntry[];
  selectedIndex: number;
  setDirectory: (handle: FileSystemDirectoryHandle) => void;
  setEntries: (entries: CatalogEntry[]) => void;
  setSelectedIndex: (index: number) => void;
}

export const useCatalogStore = create<CatalogStoreState>((set) => ({
  dirHandle: null,
  entries: [],
  selectedIndex: -1,

  setDirectory: (handle) => set({ dirHandle: handle }),
  setEntries: (entries) => set({ entries }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
}));
