import { create } from 'zustand';
import { type EditState, createDefaultEdits } from '../types/edits';
import { saveSidecar } from '../io/sidecar';

interface EditStoreState {
  edits: EditState;
  isDirty: boolean;
  /** Currently active directory handle for auto-save */
  dirHandle: FileSystemDirectoryHandle | null;
  /** Currently active filename for auto-save */
  currentFileName: string | null;
  setParam: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
  setNestedParam: (path: string, value: unknown) => void;
  loadEdits: (edits: Partial<EditState>) => void;
  resetAll: () => void;
  setAutoSaveTarget: (dir: FileSystemDirectoryHandle | null, fileName: string | null) => void;
}

export const useEditStore = create<EditStoreState>((set) => ({
  edits: createDefaultEdits(),
  isDirty: false,
  dirHandle: null,
  currentFileName: null,

  setParam: (key, value) =>
    set((state) => ({
      edits: { ...state.edits, [key]: value },
      isDirty: true,
    })),

  setNestedParam: (path, value) =>
    set((state) => {
      const parts = path.split('.');
      const edits = { ...state.edits };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = edits;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return { edits, isDirty: true };
    }),

  loadEdits: (partial) =>
    set(() => ({
      edits: { ...createDefaultEdits(), ...partial },
      isDirty: false,
    })),

  resetAll: () =>
    set(() => ({
      edits: createDefaultEdits(),
      isDirty: true,
    })),

  setAutoSaveTarget: (dir, fileName) =>
    set({ dirHandle: dir, currentFileName: fileName }),
}));

// Debounced auto-save: subscribe to store changes and save sidecar after 500ms
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

useEditStore.subscribe((state) => {
  if (!state.isDirty || !state.dirHandle || !state.currentFileName) return;

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const { dirHandle, currentFileName, edits } = useEditStore.getState();
    if (dirHandle && currentFileName) {
      saveSidecar(dirHandle, currentFileName, edits).catch((err) =>
        console.error('Auto-save failed:', err),
      );
    }
  }, 500);
});
