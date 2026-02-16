import { create } from 'zustand';
import { type EditState, createDefaultEdits } from '../types/edits';

interface EditStoreState {
  edits: EditState;
  isDirty: boolean;
  setParam: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
  setNestedParam: (path: string, value: unknown) => void;
  loadEdits: (edits: Partial<EditState>) => void;
  resetAll: () => void;
}

export const useEditStore = create<EditStoreState>((set) => ({
  edits: createDefaultEdits(),
  isDirty: false,

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
}));
