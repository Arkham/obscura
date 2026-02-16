import { create } from 'zustand';
import { type EditState, createDefaultEdits } from '../types/edits';
import { saveSidecar } from '../io/sidecar';

/** Human-readable labels for history entries */
const PARAM_LABELS: Record<string, string> = {
  whiteBalance: 'White Balance',
  tint: 'Tint',
  exposure: 'Exposure',
  contrast: 'Contrast',
  highlights: 'Highlights',
  shadows: 'Shadows',
  whites: 'Whites',
  blacks: 'Blacks',
  texture: 'Texture',
  clarity: 'Clarity',
  dehaze: 'Dehaze',
  vibrance: 'Vibrance',
  saturation: 'Saturation',
  toneCurve: 'Tone Curve',
  'toneCurve.rgb': 'Tone Curve (RGB)',
  'toneCurve.red': 'Tone Curve (Red)',
  'toneCurve.green': 'Tone Curve (Green)',
  'toneCurve.blue': 'Tone Curve (Blue)',
  hsl: 'HSL',
  'hsl.hue': 'HSL Hue',
  'hsl.saturation': 'HSL Saturation',
  'hsl.luminance': 'HSL Luminance',
  colorGrading: 'Color Grading',
  'colorGrading.shadows': 'Color Grading (Shadows)',
  'colorGrading.midtones': 'Color Grading (Midtones)',
  'colorGrading.highlights': 'Color Grading (Highlights)',
  'colorGrading.global': 'Color Grading (Global)',
  sharpening: 'Sharpening',
  'sharpening.amount': 'Sharpening Amount',
  'sharpening.radius': 'Sharpening Radius',
  'sharpening.detail': 'Sharpening Detail',
  noiseReduction: 'Noise Reduction',
  'noiseReduction.luminance': 'NR Luminance',
  'noiseReduction.color': 'NR Color',
  vignette: 'Vignette',
  'vignette.amount': 'Vignette Amount',
  'vignette.midpoint': 'Vignette Midpoint',
  'vignette.roundness': 'Vignette Roundness',
  'vignette.feather': 'Vignette Feather',
  crop: 'Crop',
};

function formatLabel(param: string, value: unknown): string {
  const name = PARAM_LABELS[param] ?? param;
  if (typeof value === 'number') {
    // Format number with at most 2 decimal places
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    return `${name}: ${formatted}`;
  }
  return name;
}

export interface HistoryEntry {
  edits: EditState;
  label: string;
  timestamp: number;
}

const MAX_HISTORY = 100;

interface EditStoreState {
  edits: EditState;
  isDirty: boolean;
  /** Currently active directory handle for auto-save */
  dirHandle: FileSystemDirectoryHandle | null;
  /** Currently active filename for auto-save */
  currentFileName: string | null;

  // History
  history: HistoryEntry[];
  historyIndex: number;

  setParam: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
  setNestedParam: (path: string, value: unknown) => void;
  loadEdits: (edits: Partial<EditState>) => void;
  resetAll: () => void;
  setAutoSaveTarget: (dir: FileSystemDirectoryHandle | null, fileName: string | null) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
}

// Debouncing state for history grouping (module-level to avoid store clutter)
let _pendingParam: string | null = null;
let _historyTimer: ReturnType<typeof setTimeout> | null = null;
/** Flag to suppress history pushes during undo/redo */
let _isNavigating = false;

function pushHistoryEntry(state: EditStoreState, label: string): Partial<EditStoreState> {
  // Truncate any redo entries after current position
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push({ edits: structuredClone(state.edits), label, timestamp: Date.now() });
  // Cap at MAX_HISTORY
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
  return { history, historyIndex: history.length - 1 };
}

export const useEditStore = create<EditStoreState>((set, get) => ({
  edits: createDefaultEdits(),
  isDirty: false,
  dirHandle: null,
  currentFileName: null,
  history: [{ edits: createDefaultEdits(), label: 'Original', timestamp: Date.now() }],
  historyIndex: 0,

  setParam: (key, value) => {
    if (_isNavigating) return;

    const paramKey = key as string;
    const label = formatLabel(paramKey, value);

    if (_pendingParam === paramKey && _historyTimer) {
      // Same param within debounce window — just update edits, reset timer
      clearTimeout(_historyTimer);
      set((state) => ({
        edits: { ...state.edits, [key]: value },
        isDirty: true,
      }));
    } else {
      // Different param or first edit — push previous state to history, then update
      if (_historyTimer) clearTimeout(_historyTimer);
      set((state) => ({
        ...pushHistoryEntry(state, label),
        edits: { ...state.edits, [key]: value },
        isDirty: true,
      }));
    }

    _pendingParam = paramKey;
    _historyTimer = setTimeout(() => {
      // Debounce expired — flush: snapshot the current state as the history entry
      // Replace the last history entry with the final value
      const s = get();
      const history = [...s.history];
      history[s.historyIndex] = {
        edits: structuredClone(s.edits),
        label: formatLabel(paramKey, s.edits[key as keyof EditState]),
        timestamp: Date.now(),
      };
      set({ history });
      _pendingParam = null;
      _historyTimer = null;
    }, 500);
  },

  setNestedParam: (path, value) => {
    if (_isNavigating) return;

    const label = formatLabel(path, value);

    if (_pendingParam === path && _historyTimer) {
      clearTimeout(_historyTimer);
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
      });
    } else {
      if (_historyTimer) clearTimeout(_historyTimer);
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
        return { ...pushHistoryEntry(state, label), edits, isDirty: true };
      });
    }

    _pendingParam = path;
    _historyTimer = setTimeout(() => {
      const s = get();
      const history = [...s.history];
      // Resolve the nested value for the final label
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let v: any = s.edits;
      for (const p of parts) v = v?.[p];
      history[s.historyIndex] = {
        edits: structuredClone(s.edits),
        label: formatLabel(path, v),
        timestamp: Date.now(),
      };
      set({ history });
      _pendingParam = null;
      _historyTimer = null;
    }, 500);
  },

  loadEdits: (partial) => {
    // Flush any pending history timer
    if (_historyTimer) {
      clearTimeout(_historyTimer);
      _historyTimer = null;
      _pendingParam = null;
    }
    const edits = { ...createDefaultEdits(), ...partial };
    set(() => ({
      edits,
      isDirty: false,
      history: [{ edits: structuredClone(edits), label: 'Original', timestamp: Date.now() }],
      historyIndex: 0,
    }));
  },

  resetAll: () => {
    if (_historyTimer) {
      clearTimeout(_historyTimer);
      _historyTimer = null;
      _pendingParam = null;
    }
    set((state) => ({
      ...pushHistoryEntry(state, 'Reset All'),
      edits: createDefaultEdits(),
      isDirty: true,
    }));
  },

  setAutoSaveTarget: (dir, fileName) =>
    set({ dirHandle: dir, currentFileName: fileName }),

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    // Flush pending debounce
    if (_historyTimer) {
      clearTimeout(_historyTimer);
      _historyTimer = null;
      _pendingParam = null;
      // Snapshot current state before navigating
      const history = [...state.history];
      history[state.historyIndex] = {
        edits: structuredClone(state.edits),
        label: history[state.historyIndex].label,
        timestamp: Date.now(),
      };
      const newIndex = state.historyIndex - 1;
      _isNavigating = true;
      set({
        history,
        historyIndex: newIndex,
        edits: structuredClone(history[newIndex].edits),
        isDirty: true,
      });
      _isNavigating = false;
      return;
    }
    const newIndex = state.historyIndex - 1;
    _isNavigating = true;
    set({
      historyIndex: newIndex,
      edits: structuredClone(state.history[newIndex].edits),
      isDirty: true,
    });
    _isNavigating = false;
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    _isNavigating = true;
    set({
      historyIndex: newIndex,
      edits: structuredClone(state.history[newIndex].edits),
      isDirty: true,
    });
    _isNavigating = false;
  },

  jumpToHistory: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.history.length || index === state.historyIndex) return;
    // Flush pending debounce
    if (_historyTimer) {
      clearTimeout(_historyTimer);
      _historyTimer = null;
      _pendingParam = null;
    }
    _isNavigating = true;
    set({
      historyIndex: index,
      edits: structuredClone(state.history[index].edits),
      isDirty: true,
    });
    _isNavigating = false;
  },
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
