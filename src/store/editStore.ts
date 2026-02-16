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

interface SavedHistory {
  entries: { label: string; edits: Partial<EditState>; timestamp?: number }[];
  index: number;
}

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
  loadEdits: (edits: Partial<EditState>, savedHistory?: SavedHistory | null) => void;
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
/** Flag to suppress history pushes while a slider is being dragged */
let _isDragging = false;

/**
 * Flush any pending slider drag into a history entry.
 * Only creates an entry if the edits actually changed from the last history snapshot.
 */
function flushPending() {
  if (_isDragging) return;

  if (_historyTimer) {
    clearTimeout(_historyTimer);
    _historyTimer = null;
  }

  const param = _pendingParam;
  _pendingParam = null;

  if (!param) return;

  const state = useEditStore.getState();
  const lastEntry = state.history[state.historyIndex];

  // Only push if edits actually changed from the last history snapshot
  if (JSON.stringify(state.edits) === JSON.stringify(lastEntry.edits)) return;

  // Resolve current value of the changed param for the label
  let value: unknown;
  if (param.includes('.')) {
    const parts = param.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let v: any = state.edits;
    for (const p of parts) v = v?.[p];
    value = v;
  } else {
    value = state.edits[param as keyof EditState];
  }

  const label = formatLabel(param, value);

  // Push current state as new history entry (truncating redo stack)
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push({ edits: structuredClone(state.edits), label, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
  useEditStore.setState({ history, historyIndex: history.length - 1 });
}

/** Call from slider pointerdown/pointerup to defer history until release */
export function setSliderDragging(dragging: boolean) {
  _isDragging = dragging;
  if (!dragging) flushPending();
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

    // If switching to a different param, flush the pending one first
    if (_pendingParam !== null && _pendingParam !== paramKey) {
      flushPending();
    }

    // Update edits in real-time for preview
    set((state) => ({
      edits: { ...state.edits, [key]: value },
      isDirty: true,
    }));

    // Start/reset debounce timer — history entry created only when slider stops
    if (_historyTimer) clearTimeout(_historyTimer);
    _pendingParam = paramKey;
    _historyTimer = setTimeout(flushPending, 500);
  },

  setNestedParam: (path, value) => {
    if (_isNavigating) return;

    // If switching to a different param, flush the pending one first
    if (_pendingParam !== null && _pendingParam !== path) {
      flushPending();
    }

    // Update edits in real-time for preview
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

    if (_historyTimer) clearTimeout(_historyTimer);
    _pendingParam = path;
    _historyTimer = setTimeout(flushPending, 500);
  },

  loadEdits: (partial, savedHistory) => {
    flushPending();
    const edits = { ...createDefaultEdits(), ...partial };
    if (savedHistory && savedHistory.entries.length > 0) {
      const entries: HistoryEntry[] = savedHistory.entries.map((e) => ({
        label: e.label,
        edits: { ...createDefaultEdits(), ...e.edits },
        timestamp: e.timestamp ?? Date.now(),
      }));
      set({
        edits,
        isDirty: false,
        history: entries,
        historyIndex: Math.min(savedHistory.index, entries.length - 1),
      });
    } else {
      set({
        edits,
        isDirty: false,
        history: [{ edits: structuredClone(edits), label: 'Original', timestamp: Date.now() }],
        historyIndex: 0,
      });
    }
  },

  resetAll: () => {
    flushPending();
    const state = get();
    const defaultEdits = createDefaultEdits();
    if (JSON.stringify(state.edits) !== JSON.stringify(defaultEdits)) {
      // Edits differ from defaults — push a "Reset All" history entry
      const history = state.history.slice(0, state.historyIndex + 1);
      history.push({ edits: structuredClone(defaultEdits), label: 'Reset All', timestamp: Date.now() });
      if (history.length > MAX_HISTORY) history.shift();
      set({ edits: defaultEdits, isDirty: true, history, historyIndex: history.length - 1 });
    } else {
      set({ edits: defaultEdits, isDirty: true });
    }
  },

  setAutoSaveTarget: (dir, fileName) =>
    set({ dirHandle: dir, currentFileName: fileName }),

  undo: () => {
    flushPending();
    const state = get();
    if (state.historyIndex <= 0) return;
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
    flushPending();
    const state = get();
    if (index < 0 || index >= state.history.length || index === state.historyIndex) return;
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
    const { dirHandle, currentFileName, edits, history, historyIndex } = useEditStore.getState();
    if (dirHandle && currentFileName) {
      saveSidecar(dirHandle, currentFileName, edits, { entries: history, index: historyIndex }).catch((err) =>
        console.error('Auto-save failed:', err),
      );
    }
  }, 500);
});
