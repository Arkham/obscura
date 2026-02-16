# Fiat Lux Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based RAW photo editor with WebGL shader pipeline, libraw WASM decoding, catalog browsing, and JPEG export with borders.

**Architecture:** React + TypeScript SPA. RAW files decoded via libraw WASM to linear float buffers. All image adjustments run as WebGL fragment shaders with edit parameters as uniforms. File System Access API for reading folders and writing JSON sidecar files. Zustand for state management.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, CSS Modules, WebGL2, GLSL, libraw (WASM via Emscripten), vite-plugin-glsl

**Testing Stack:** Vitest, @testing-library/react, @testing-library/jest-dom, headless-gl (WebGL in Node), jsdom, pixelmatch (visual regression)

**Design doc:** `docs/plans/2026-02-16-raw-editor-design.md`

---

## Phase 1: Project Foundation

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.module.css`

**Step 1: Initialize project**

```bash
npm create vite@latest . -- --template react-ts
```

Accept overwrite prompts (directory has only docs/).

**Step 2: Install dependencies**

```bash
npm install zustand
npm install -D vite-plugin-glsl vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom pixelmatch pngjs gl @types/gl @types/pngjs
```

**Step 3: Configure vite for GLSL imports**

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), glsl()],
  assetsInclude: ['**/*.wasm'],
});
```

**Step 4: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), glsl()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
    },
  },
});
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Step 5: Add GLSL type declaration**

Create `src/glsl.d.ts`:
```typescript
declare module '*.frag' {
  const value: string;
  export default value;
}
declare module '*.vert' {
  const value: string;
  export default value;
}
```

**Step 5: Create minimal App shell**

`src/App.tsx` — two-view router using state (no react-router needed):
```typescript
import { useState } from 'react';
import styles from './App.module.css';

type View = 'catalog' | 'editor';

export default function App() {
  const [view, setView] = useState<View>('catalog');

  return (
    <div className={styles.app}>
      {view === 'catalog' ? (
        <div>
          <h1>Fiat Lux</h1>
          <button onClick={() => setView('editor')}>Open Editor</button>
        </div>
      ) : (
        <div>
          <button onClick={() => setView('catalog')}>← Back</button>
          <h1>Editor</h1>
        </div>
      )}
    </div>
  );
}
```

**Step 6: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:5173 — should see "Fiat Lux" heading and navigation works between views.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Test Infrastructure — WebGL Test Helpers

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/test/gl-context.ts`
- Create: `src/test/test-textures.ts`
- Create: `src/test/pixel-helpers.ts`
- Create: `src/test/visual-regression.ts`

**Step 1: Create headless WebGL context factory**

`src/test/gl-context.ts` — wraps `headless-gl` to provide a WebGL2-like context for shader tests:
```typescript
import createContext from 'gl';

/**
 * Creates a headless WebGL context for testing.
 * headless-gl provides WebGL1. For WebGL2 features (GLSL 300 es),
 * we need to either:
 * a) Write GLSL 100 compatibility wrappers for tests, or
 * b) Use a browser-based test runner (Playwright/Puppeteer) for shader tests.
 *
 * Recommendation: Use headless-gl for simple texture/framebuffer tests,
 * and Vitest browser mode for full shader pipeline tests.
 */
export function createTestGLContext(width = 64, height = 64) {
  const gl = createContext(width, height);
  if (!gl) throw new Error('Failed to create headless GL context');
  return gl;
}

export function readPixels(
  gl: WebGLRenderingContext,
  x: number, y: number,
  width: number, height: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

export function readPixelAt(
  gl: WebGLRenderingContext,
  x: number, y: number
): [number, number, number, number] {
  const pixel = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return [pixel[0], pixel[1], pixel[2], pixel[3]];
}
```

**Step 2: Create synthetic test texture generators**

`src/test/test-textures.ts`:
```typescript
/** Generate a gradient from black to white (left to right) */
export function createGradientData(width: number, height: number): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = x / (width - 1);
      data[i] = t;     // R
      data[i + 1] = t; // G
      data[i + 2] = t; // B
      data[i + 3] = 1; // A
    }
  }
  return data;
}

/** Generate a solid color patch */
export function createSolidColorData(
  width: number, height: number,
  r: number, g: number, b: number
): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 1;
  }
  return data;
}

/** Generate an HSL color wheel test pattern */
export function createColorWheelData(width: number, height: number): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const hue = x / width;
      const sat = 1.0;
      const lum = y / height;
      // HSL to RGB
      const [r, g, b] = hslToRgb(hue, sat, lum);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return data;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1/3), hue2rgb(h), hue2rgb(h - 1/3)];
}
```

**Step 3: Create pixel assertion helpers**

`src/test/pixel-helpers.ts`:
```typescript
/** Assert two pixels are within tolerance */
export function expectPixelClose(
  actual: [number, number, number, number],
  expected: [number, number, number, number],
  tolerance = 2
) {
  for (let i = 0; i < 4; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
  }
}

/** Assert a pixel matches a float RGB (0-1) value, with sRGB conversion */
export function expectPixelCloseSrgb(
  actual: [number, number, number, number],
  expectedLinear: [number, number, number],
  tolerance = 3
) {
  const expected = expectedLinear.map(v => {
    const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1/2.4) - 0.055;
    return Math.round(srgb * 255);
  });
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
  }
}
```

**Step 4: Create visual regression helper**

`src/test/visual-regression.ts`:
```typescript
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASELINE_DIR = join(__dirname, '../../test-baselines');
const DIFF_DIR = join(__dirname, '../../test-diffs');

export function compareToBaseline(
  name: string,
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold = 0.01 // fraction of pixels that can differ
): { pass: boolean; diffCount: number; totalPixels: number } {
  const baselinePath = join(BASELINE_DIR, `${name}.png`);
  const diffPath = join(DIFF_DIR, `${name}-diff.png`);

  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  if (!existsSync(DIFF_DIR)) mkdirSync(DIFF_DIR, { recursive: true });

  // Save current render as PNG
  const currentPng = new PNG({ width, height });
  currentPng.data = Buffer.from(pixels);

  if (!existsSync(baselinePath)) {
    // No baseline — create it and pass
    writeFileSync(baselinePath, PNG.sync.write(currentPng));
    return { pass: true, diffCount: 0, totalPixels: width * height };
  }

  // Compare to baseline
  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const diff = new PNG({ width, height });
  const diffCount = pixelmatch(
    baselinePng.data, currentPng.data, diff.data,
    width, height,
    { threshold: 0.1 }
  );

  if (diffCount > 0) {
    writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const totalPixels = width * height;
  return {
    pass: diffCount / totalPixels <= threshold,
    diffCount,
    totalPixels,
  };
}

/** Update a baseline with new pixels */
export function updateBaseline(
  name: string,
  pixels: Uint8Array,
  width: number,
  height: number
) {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  const png = new PNG({ width, height });
  png.data = Buffer.from(pixels);
  writeFileSync(join(BASELINE_DIR, `${name}.png`), PNG.sync.write(png));
}
```

**Step 5: Verify — run `npm test` with no tests yet, confirm vitest starts and exits cleanly**

```bash
npm test
```

**Step 6: Commit**

```bash
git add src/test/ vitest.config.ts && git commit -m "feat: test infrastructure — headless GL, test textures, pixel helpers, visual regression"
```

---

### Task 3: Edit Types, Defaults, and Ranges

**Files:**
- Create: `src/types/edits.ts`

**Step 1: Define all edit types**

```typescript
export interface CurvePoint {
  x: number; // 0-1
  y: number; // 0-1
}

export interface EditState {
  // Basic
  whiteBalance: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;

  // Presence
  texture: number;
  clarity: number;
  dehaze: number;
  vibrance: number;
  saturation: number;

  // Tone Curve
  toneCurve: {
    rgb: CurvePoint[];
    red: CurvePoint[];
    green: CurvePoint[];
    blue: CurvePoint[];
  };

  // HSL — 8 hue ranges: Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
  hsl: {
    hue: number[];
    saturation: number[];
    luminance: number[];
  };

  // Color Grading
  colorGrading: {
    shadows: { hue: number; saturation: number; luminance: number };
    midtones: { hue: number; saturation: number; luminance: number };
    highlights: { hue: number; saturation: number; luminance: number };
    global: { hue: number; saturation: number; luminance: number };
  };

  // Detail
  sharpening: { amount: number; radius: number; detail: number };
  noiseReduction: { luminance: number; color: number };

  // Effects
  vignette: { amount: number; midpoint: number; roundness: number; feather: number };

  // Crop (null = no crop)
  crop: { x: number; y: number; width: number; height: number; rotation: number } | null;
}

export interface ParamRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const PARAM_RANGES: Record<string, ParamRange> = {
  whiteBalance: { min: 2000, max: 12000, step: 50, default: 5500 },
  tint: { min: -150, max: 150, step: 1, default: 0 },
  exposure: { min: -5, max: 5, step: 0.01, default: 0 },
  contrast: { min: -100, max: 100, step: 1, default: 0 },
  highlights: { min: -100, max: 100, step: 1, default: 0 },
  shadows: { min: -100, max: 100, step: 1, default: 0 },
  whites: { min: -100, max: 100, step: 1, default: 0 },
  blacks: { min: -100, max: 100, step: 1, default: 0 },
  texture: { min: -100, max: 100, step: 1, default: 0 },
  clarity: { min: -100, max: 100, step: 1, default: 0 },
  dehaze: { min: -100, max: 100, step: 1, default: 0 },
  vibrance: { min: -100, max: 100, step: 1, default: 0 },
  saturation: { min: -100, max: 100, step: 1, default: 0 },
  'sharpening.amount': { min: 0, max: 150, step: 1, default: 0 },
  'sharpening.radius': { min: 0.5, max: 3.0, step: 0.1, default: 1.0 },
  'sharpening.detail': { min: 0, max: 100, step: 1, default: 25 },
  'noiseReduction.luminance': { min: 0, max: 100, step: 1, default: 0 },
  'noiseReduction.color': { min: 0, max: 100, step: 1, default: 0 },
  'vignette.amount': { min: -100, max: 100, step: 1, default: 0 },
  'vignette.midpoint': { min: 0, max: 100, step: 1, default: 50 },
  'vignette.roundness': { min: -100, max: 100, step: 1, default: 0 },
  'vignette.feather': { min: 0, max: 100, step: 1, default: 50 },
};

export const HSL_LABELS = [
  'Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta',
] as const;

export function createDefaultEdits(): EditState {
  return {
    whiteBalance: 5500,
    tint: 0,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    texture: 0,
    clarity: 0,
    dehaze: 0,
    vibrance: 0,
    saturation: 0,
    toneCurve: {
      rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    },
    hsl: {
      hue: Array(8).fill(0),
      saturation: Array(8).fill(0),
      luminance: Array(8).fill(0),
    },
    colorGrading: {
      shadows: { hue: 0, saturation: 0, luminance: 0 },
      midtones: { hue: 0, saturation: 0, luminance: 0 },
      highlights: { hue: 0, saturation: 0, luminance: 0 },
      global: { hue: 0, saturation: 0, luminance: 0 },
    },
    sharpening: { amount: 0, radius: 1.0, detail: 25 },
    noiseReduction: { luminance: 0, color: 0 },
    vignette: { amount: 0, midpoint: 50, roundness: 0, feather: 50 },
    crop: null,
  };
}
```

**Step 2: Write tests for defaults and ranges**

Create `src/types/__tests__/edits.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createDefaultEdits, PARAM_RANGES, HSL_LABELS, EditState } from '../edits';

describe('createDefaultEdits', () => {
  it('returns a valid EditState with all fields set', () => {
    const defaults = createDefaultEdits();
    expect(defaults.whiteBalance).toBe(5500);
    expect(defaults.exposure).toBe(0);
    expect(defaults.contrast).toBe(0);
    expect(defaults.crop).toBeNull();
  });

  it('returns HSL arrays of length 8', () => {
    const defaults = createDefaultEdits();
    expect(defaults.hsl.hue).toHaveLength(8);
    expect(defaults.hsl.saturation).toHaveLength(8);
    expect(defaults.hsl.luminance).toHaveLength(8);
  });

  it('returns tone curve with 2 endpoints per channel', () => {
    const defaults = createDefaultEdits();
    expect(defaults.toneCurve.rgb).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(defaults.toneCurve.red).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('returns a new object each call (no shared references)', () => {
    const a = createDefaultEdits();
    const b = createDefaultEdits();
    expect(a).not.toBe(b);
    expect(a.hsl.hue).not.toBe(b.hsl.hue);
  });
});

describe('PARAM_RANGES', () => {
  it('has min < max for all ranges', () => {
    for (const [key, range] of Object.entries(PARAM_RANGES)) {
      expect(range.min).toBeLessThan(range.max);
    }
  });

  it('has default within min/max for all ranges', () => {
    for (const [key, range] of Object.entries(PARAM_RANGES)) {
      expect(range.default).toBeGreaterThanOrEqual(range.min);
      expect(range.default).toBeLessThanOrEqual(range.max);
    }
  });

  it('has positive step for all ranges', () => {
    for (const [key, range] of Object.entries(PARAM_RANGES)) {
      expect(range.step).toBeGreaterThan(0);
    }
  });
});

describe('HSL_LABELS', () => {
  it('has 8 labels', () => {
    expect(HSL_LABELS).toHaveLength(8);
  });
});
```

**Step 3: Run tests**

```bash
npm test
```
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/types/ && git commit -m "feat: add EditState types, defaults, ranges, and tests"
```

---

### Task 4: Zustand Stores

**Files:**
- Create: `src/store/editStore.ts`
- Create: `src/store/catalogStore.ts`

**Step 1: Create edit store**

`src/store/editStore.ts`:
```typescript
import { create } from 'zustand';
import { EditState, createDefaultEdits } from '../types/edits';

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
```

**Step 2: Create catalog store**

`src/store/catalogStore.ts`:
```typescript
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
```

**Step 3: Write store tests**

Create `src/store/__tests__/editStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditStore } from '../editStore';

describe('editStore', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    // Reset isDirty after resetAll sets it
    useEditStore.setState({ isDirty: false });
  });

  it('starts with default edits', () => {
    const state = useEditStore.getState();
    expect(state.edits.exposure).toBe(0);
    expect(state.edits.whiteBalance).toBe(5500);
    expect(state.isDirty).toBe(false);
  });

  it('setParam updates a top-level field and marks dirty', () => {
    useEditStore.getState().setParam('exposure', 1.5);
    const state = useEditStore.getState();
    expect(state.edits.exposure).toBe(1.5);
    expect(state.isDirty).toBe(true);
  });

  it('setNestedParam updates a nested field', () => {
    useEditStore.getState().setNestedParam('sharpening.amount', 75);
    expect(useEditStore.getState().edits.sharpening.amount).toBe(75);
  });

  it('loadEdits merges partial edits over defaults', () => {
    useEditStore.getState().loadEdits({ exposure: 2.0, contrast: 50 });
    const edits = useEditStore.getState().edits;
    expect(edits.exposure).toBe(2.0);
    expect(edits.contrast).toBe(50);
    expect(edits.whiteBalance).toBe(5500); // kept default
    expect(useEditStore.getState().isDirty).toBe(false);
  });

  it('resetAll returns all values to defaults', () => {
    useEditStore.getState().setParam('exposure', 3.0);
    useEditStore.getState().setParam('contrast', -50);
    useEditStore.getState().resetAll();
    const edits = useEditStore.getState().edits;
    expect(edits.exposure).toBe(0);
    expect(edits.contrast).toBe(0);
  });
});
```

Create `src/store/__tests__/catalogStore.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '../catalogStore';

describe('catalogStore', () => {
  it('starts with empty entries and no selection', () => {
    const state = useCatalogStore.getState();
    expect(state.entries).toEqual([]);
    expect(state.selectedIndex).toBe(-1);
    expect(state.dirHandle).toBeNull();
  });

  it('setSelectedIndex updates selection', () => {
    useCatalogStore.getState().setSelectedIndex(3);
    expect(useCatalogStore.getState().selectedIndex).toBe(3);
  });
});
```

**Step 4: Run tests**

```bash
npm test
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/store/ && git commit -m "feat: add Zustand edit and catalog stores with tests"
```

---

## Phase 2: WebGL Pipeline Foundation

### Task 4: WebGL2 Context and Fullscreen Quad Rendering

**Files:**
- Create: `src/engine/pipeline.ts`
- Create: `src/engine/texture-utils.ts`
- Create: `src/engine/shaders/passthrough.vert`
- Create: `src/engine/shaders/passthrough.frag`

This task sets up the WebGL2 rendering infrastructure: creating a context, compiling shaders, and rendering a fullscreen quad. We test with a passthrough shader that just displays an uploaded texture.

**Step 1: Create vertex shader for fullscreen quad**

`src/engine/shaders/passthrough.vert`:
```glsl
#version 300 es
precision highp float;

// Fullscreen triangle (no vertex buffer needed)
// Vertices: (-1,-1), (3,-1), (-1,3) — covers entire clip space
out vec2 vUv;

void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  vUv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
```

**Step 2: Create passthrough fragment shader**

`src/engine/shaders/passthrough.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;

void main() {
  fragColor = texture(uTexture, vUv);
}
```

**Step 3: Create texture utilities**

`src/engine/texture-utils.ts` — functions to upload Float32Array and Uint8Array image data as WebGL textures:
```typescript
export function createFloatTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data: Float32Array
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createRgbFloatTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data: Float32Array
): WebGLTexture {
  // Convert RGB float data to RGBA float (WebGL requires RGBA for float textures)
  const rgba = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = 1.0;
  }
  return createFloatTexture(gl, width, height, rgba);
}

export function createFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer: fb, texture: tex };
}
```

**Step 4: Create the pipeline orchestrator**

`src/engine/pipeline.ts` — compiles shaders, manages render passes, provides `render()` that takes edit state and re-renders:

```typescript
import { EditState } from '../types/edits';
import { createFramebuffer } from './texture-utils';
import passthroughVert from './shaders/passthrough.vert';
import passthroughFrag from './shaders/passthrough.frag';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export class RenderPipeline {
  private gl: WebGL2RenderingContext;
  private passthroughProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private sourceTexture: WebGLTexture | null = null;
  private imageWidth = 0;
  private imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })!;
    if (!gl) throw new Error('WebGL2 not available');

    // Enable float texture support
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not available');
    gl.getExtension('OES_texture_float_linear');

    this.gl = gl;
    this.passthroughProgram = createProgram(gl, passthroughVert, passthroughFrag);

    // Empty VAO for attribute-less rendering (fullscreen triangle)
    this.vao = gl.createVertexArray()!;
  }

  setSourceTexture(texture: WebGLTexture, width: number, height: number) {
    this.sourceTexture = texture;
    this.imageWidth = width;
    this.imageHeight = height;
  }

  render(edits: EditState) {
    const { gl } = this;
    if (!this.sourceTexture) return;

    // For now, just passthrough. Later tasks will add adjustment passes.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.passthroughProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.passthroughProgram, 'uTexture'), 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.passthroughProgram);
    gl.deleteVertexArray(this.vao);
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
  }
}
```

**Step 5: Verify — render a test gradient**

Temporarily add to EditorView: create a canvas, instantiate `RenderPipeline`, upload a synthetic gradient as a float texture, call `render()`. You should see a color gradient on screen.

**Step 6: Commit**

```bash
git add src/engine/ && git commit -m "feat: WebGL2 pipeline foundation with passthrough shader"
```

---

### Task 5: Canvas Component with Zoom/Pan

**Files:**
- Create: `src/components/editor/Canvas.tsx`
- Create: `src/components/editor/Canvas.module.css`

The Canvas component wraps the WebGL canvas, handles resize, zoom (scroll wheel), and pan (click-drag). It holds the `RenderPipeline` instance and re-renders when edit state changes.

**Step 1: Implement Canvas component**

Key behaviors:
- Creates `<canvas>` element, initializes `RenderPipeline` in a ref
- Subscribes to `useEditStore` — on any edit change, calls `pipeline.render(edits)`
- Handles `wheel` for zoom (scale factor around mouse position)
- Handles `mousedown/mousemove/mouseup` for panning when zoomed
- Handles resize via `ResizeObserver` to match canvas resolution to container size
- Exposes `setImage(texture, width, height)` via ref for parent to call

The zoom/pan is implemented as a CSS transform on the canvas or as a viewport uniform passed to the shader. The simpler approach: apply zoom/pan as a `transform` style on the canvas element and let the browser handle it. This avoids modifying the shader pipeline for zoom.

**Step 2: Verify — Canvas renders and zoom/pan works**

Open browser, should see the test gradient. Scroll to zoom, drag to pan.

**Step 3: Commit**

```bash
git add src/components/editor/ && git commit -m "feat: Canvas component with zoom/pan"
```

---

## Phase 3: RAW Decoding

### Task 6: libraw WASM Integration

**Files:**
- Create: `src/raw/decoder.ts`
- Create: `src/raw/thumbnail.ts`

This is the most uncertain task — it depends on finding or building a working libraw WASM module. There are several approaches, listed in order of preference:

**Option A: Use `libraw-wasm` npm package** (if it exists and works)
```bash
npm install libraw-wasm
```

**Option B: Use `@nicolo-ribaudo/chroma-js` or similar existing WASM RAW decoder**

**Option C: Compile libraw from source with Emscripten**

This requires Emscripten installed. The compilation exports two key functions:
- `decode(buffer: ArrayBuffer, halfSize: boolean) → { data: Float32Array, width: number, height: number, metadata: {...} }`
- `extractThumbnail(buffer: ArrayBuffer) → Uint8Array` (JPEG bytes)

**Step 1: Create decoder wrapper interface**

`src/raw/decoder.ts`:
```typescript
export interface DecodedImage {
  data: Float32Array;  // Linear RGB, 3 floats per pixel, range 0-1
  width: number;
  height: number;
  whiteBalance: { r: number; g: number; b: number }; // Camera WB multipliers
  colorTemp: number; // Approximate color temperature in Kelvin
}

export interface RawDecoder {
  decode(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage>;
  extractThumbnail(buffer: ArrayBuffer): Promise<Blob>;
}
```

**Step 2: Implement decoder using available WASM library**

The implementation depends on which option is available. The decoder must:
1. Accept raw ArrayBuffer from File System Access API
2. Call libraw to demosaic and output linear RGB (no WB, no gamma)
3. Normalize output to 0-1 float range
4. Extract camera white balance multipliers from EXIF
5. For thumbnail: extract embedded JPEG and return as Blob

If no npm package works, build libraw from source:
```bash
git clone https://github.com/LibRaw/LibRaw.git
cd LibRaw
emcmake cmake . -DBUILD_SHARED_LIBS=OFF
emmake make
```

Then create Emscripten bindings that expose the two functions.

**Step 3: Implement thumbnail extractor**

`src/raw/thumbnail.ts`:
```typescript
import { RawDecoder } from './decoder';

export async function extractThumbnailUrl(
  decoder: RawDecoder,
  buffer: ArrayBuffer
): Promise<string> {
  const blob = await decoder.extractThumbnail(buffer);
  return URL.createObjectURL(blob);
}
```

**Step 4: Verify — decode a test ARW file**

Load a Sony ARW file, call `decode()`, verify the returned `Float32Array` has expected dimensions and non-zero values. Upload to WebGL texture and verify it displays (will look dark/flat since it's linear with no adjustments — that's correct).

**Step 5: Commit**

```bash
git add src/raw/ && git commit -m "feat: libraw WASM decoder and thumbnail extraction"
```

---

## Phase 4: Main Adjustments Shader

### Task 7: Main Fragment Shader — White Balance, Exposure, Contrast

**Files:**
- Create: `src/engine/shaders/main.frag`
- Modify: `src/engine/pipeline.ts` — add main adjustment pass

This is the core shader. We build it incrementally across Tasks 7-9.

**Step 1: Create main adjustment fragment shader**

`src/engine/shaders/main.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;

// Basic adjustments
uniform vec3 uWhiteBalance;   // RGB multipliers
uniform float uExposure;       // EV stops (-5 to +5)
uniform float uContrast;       // -100 to +100
uniform float uHighlights;     // -100 to +100
uniform float uShadows;        // -100 to +100
uniform float uWhites;         // -100 to +100
uniform float uBlacks;         // -100 to +100
uniform float uVibrance;       // -100 to +100
uniform float uSaturation;     // -100 to +100

// Tone curve LUTs
uniform sampler2D uCurveRGB;
uniform sampler2D uCurveR;
uniform sampler2D uCurveG;
uniform sampler2D uCurveB;

// HSL adjustments (8 hue ranges)
uniform float uHslHue[8];
uniform float uHslSat[8];
uniform float uHslLum[8];

// Color grading
uniform vec3 uGradeShadowColor;    // hue, saturation, luminance
uniform vec3 uGradeMidtoneColor;
uniform vec3 uGradeHighlightColor;
uniform vec3 uGradeGlobalColor;

// --- Helper functions ---

vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float d = maxC - minC;
  float s = 0.0;
  float h = 0.0;

  if (d > 0.001) {
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s < 0.001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// sRGB gamma
vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
  return mix(lo, hi, step(0.0031308, c));
}

// --- Tone mapping zones ---
// Attempt to emulate Lightroom's parametric tone adjustments.
// Each zone has a weight function; adjustments blend by luminance.

vec3 applyToneZones(vec3 rgb, float highlights, float shadows, float whites, float blacks) {
  float lum = luminance(rgb);

  // Zone weight functions (smooth transitions)
  float shadowW = 1.0 - smoothstep(0.0, 0.5, lum);
  float highlightW = smoothstep(0.5, 1.0, lum);
  float blackW = 1.0 - smoothstep(0.0, 0.25, lum);
  float whiteW = smoothstep(0.75, 1.0, lum);

  // Apply as luminance multiplier
  float adj = 1.0;
  adj += shadows * 0.01 * shadowW;
  adj += highlights * 0.01 * highlightW;
  adj += blacks * 0.01 * blackW;
  adj += whites * 0.01 * whiteW;

  return rgb * max(adj, 0.0);
}

// --- Contrast (S-curve) ---
vec3 applyContrast(vec3 rgb, float contrast) {
  float c = contrast * 0.01;
  float midpoint = 0.5;
  // Simple S-curve: lift midtones, push shadows/highlights
  rgb = (rgb - midpoint) * (1.0 + c) + midpoint;
  return rgb;
}

// --- HSL adjustments ---
vec3 applyHsl(vec3 rgb, float hueAdj[8], float satAdj[8], float lumAdj[8]) {
  vec3 hsl = rgb2hsl(rgb);
  float h = hsl.x; // 0-1

  // 8 hue centers evenly spaced at 0/360, 30/360, 60/360, ...
  // Red=0, Orange=30, Yellow=60, Green=120, Aqua=180, Blue=240, Purple=270, Magenta=330
  float centers[8] = float[8](0.0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.75, 0.9167);

  for (int i = 0; i < 8; i++) {
    float dist = abs(h - centers[i]);
    dist = min(dist, 1.0 - dist); // wrap around
    float weight = 1.0 - smoothstep(0.0, 0.0833, dist); // ~30 degree overlap

    hsl.x += hueAdj[i] / 360.0 * weight;
    hsl.y += hsl.y * satAdj[i] * 0.01 * weight;
    hsl.z += hsl.z * lumAdj[i] * 0.01 * weight;
  }

  hsl.x = fract(hsl.x);
  hsl.y = clamp(hsl.y, 0.0, 1.0);
  hsl.z = clamp(hsl.z, 0.0, 1.0);

  return hsl2rgb(hsl);
}

// --- Color Grading (3-way + global) ---
vec3 applyColorGrading(vec3 rgb, vec3 shadowGrade, vec3 midtoneGrade, vec3 highlightGrade, vec3 globalGrade) {
  float lum = luminance(rgb);

  // Zone weights
  float shadowW = 1.0 - smoothstep(0.0, 0.5, lum);
  float highlightW = smoothstep(0.5, 1.0, lum);
  float midtoneW = 1.0 - shadowW - highlightW;
  midtoneW = max(midtoneW, 0.0);

  // Each grade: hue (degrees/360), saturation (0-100), luminance (-100 to 100)
  // Convert hue+sat to a tint color, blend into the zone
  vec3 tint = vec3(0.0);

  // Helper: grade to RGB tint
  vec3 gradeToTint(vec3 g) {
    if (g.y < 0.001) return vec3(0.0);
    float h = g.x / 360.0;
    float s = g.y * 0.01;
    vec3 tintColor = hsl2rgb(vec3(h, 1.0, 0.5));
    return (tintColor - 0.5) * s;
  }

  tint += gradeToTint(shadowGrade) * shadowW;
  tint += gradeToTint(midtoneGrade) * midtoneW;
  tint += gradeToTint(highlightGrade) * highlightW;
  tint += gradeToTint(globalGrade);

  rgb += tint;

  // Apply luminance offsets
  rgb *= 1.0 + (shadowGrade.z * 0.01 * shadowW);
  rgb *= 1.0 + (midtoneGrade.z * 0.01 * midtoneW);
  rgb *= 1.0 + (highlightGrade.z * 0.01 * highlightW);
  rgb *= 1.0 + (globalGrade.z * 0.01);

  return rgb;
}

// --- Vibrance ---
vec3 applyVibrance(vec3 rgb, float vibrance) {
  float v = vibrance * 0.01;
  float sat = length(rgb - vec3(luminance(rgb)));
  float weight = 1.0 - sat; // boost less-saturated colors more
  float boost = 1.0 + v * weight;
  float lum = luminance(rgb);
  return mix(vec3(lum), rgb, boost);
}

// --- Main ---
void main() {
  vec3 rgb = texture(uSource, vUv).rgb;

  // 1. White balance
  rgb *= uWhiteBalance;

  // 2. Exposure
  rgb *= pow(2.0, uExposure);

  // 3. Tone zones (highlights, shadows, whites, blacks)
  rgb = applyToneZones(rgb, uHighlights, uShadows, uWhites, uBlacks);

  // 4. Contrast
  // Apply after converting to sRGB-ish space for perceptual correctness
  rgb = max(rgb, 0.0);
  vec3 srgbIsh = pow(rgb, vec3(1.0/2.2)); // rough gamma for contrast
  srgbIsh = applyContrast(srgbIsh, uContrast);
  rgb = pow(max(srgbIsh, 0.0), vec3(2.2)); // back to linear

  // 5. Tone curves (applied in gamma space via LUT)
  vec3 curved = linearToSrgb(max(rgb, 0.0));
  curved.r = texture(uCurveRGB, vec2(curved.r, 0.5)).r;
  curved.g = texture(uCurveRGB, vec2(curved.g, 0.5)).r;
  curved.b = texture(uCurveRGB, vec2(curved.b, 0.5)).r;
  curved.r = texture(uCurveR, vec2(curved.r, 0.5)).r;
  curved.g = texture(uCurveG, vec2(curved.g, 0.5)).r;
  curved.b = texture(uCurveB, vec2(curved.b, 0.5)).r;
  // Stay in gamma space from here (HSL, vibrance, saturation operate perceptually)
  rgb = curved;

  // 6. HSL adjustments
  rgb = applyHsl(rgb, uHslHue, uHslSat, uHslLum);

  // 7. Color grading
  rgb = applyColorGrading(rgb, uGradeShadowColor, uGradeMidtoneColor, uGradeHighlightColor, uGradeGlobalColor);

  // 8. Vibrance
  rgb = applyVibrance(rgb, uVibrance);

  // 9. Saturation
  float lum = luminance(rgb);
  rgb = mix(vec3(lum), rgb, 1.0 + uSaturation * 0.01);

  rgb = clamp(rgb, 0.0, 1.0);
  fragColor = vec4(rgb, 1.0);
}
```

**Note:** The `gradeToTint` function-in-function is not valid GLSL. During implementation, inline it or declare it as a standalone function. The shader above is the algorithmic reference — the implementer should adapt syntax as needed for GLSL compliance.

**Step 2: Update pipeline to use main shader**

Modify `src/engine/pipeline.ts`:
- Import `main.frag` shader
- Create the main program alongside the passthrough program
- In `render()`: bind source texture, set all uniforms from `EditState`, draw
- Create identity LUT textures (diagonal line) for tone curves when no curve is set

**Step 3: Create LUT utility**

Create `src/engine/lut.ts`:
```typescript
import { CurvePoint } from '../types/edits';

// Monotone cubic spline interpolation for curve points
export function bakeCurveLut(points: CurvePoint[], size: number = 256): Float32Array {
  const lut = new Float32Array(size);

  if (points.length < 2) {
    // Identity
    for (let i = 0; i < size; i++) lut[i] = i / (size - 1);
    return lut;
  }

  // Sort points by x
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Linear interpolation between control points
  // (Replace with monotone cubic spline for smoother results)
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    // Find surrounding points
    let lo = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j + 1].x >= t) { lo = j; break; }
      lo = j;
    }
    const hi = Math.min(lo + 1, sorted.length - 1);
    if (lo === hi) {
      lut[i] = sorted[lo].y;
    } else {
      const frac = (t - sorted[lo].x) / (sorted[hi].x - sorted[lo].x);
      lut[i] = sorted[lo].y + frac * (sorted[hi].y - sorted[lo].y);
    }
  }
  return lut;
}

export function uploadLutTexture(
  gl: WebGL2RenderingContext,
  lut: Float32Array
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // 1D LUT stored as a Nx1 R32F texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, lut.length, 1, 0, gl.RED, gl.FLOAT, lut);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
```

**Step 4: Write LUT baking tests**

Create `src/engine/__tests__/lut.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { bakeCurveLut } from '../lut';

describe('bakeCurveLut', () => {
  it('returns identity curve for 2-point diagonal', () => {
    const lut = bakeCurveLut([{ x: 0, y: 0 }, { x: 1, y: 1 }], 256);
    expect(lut).toHaveLength(256);
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[127]).toBeCloseTo(127 / 255, 2);
    expect(lut[255]).toBeCloseTo(1, 3);
  });

  it('returns flat curve when both endpoints at same y', () => {
    const lut = bakeCurveLut([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], 256);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeCloseTo(0.5, 2);
    }
  });

  it('respects a midpoint lift', () => {
    const lut = bakeCurveLut([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.75 }, // lift midtones
      { x: 1, y: 1 },
    ], 256);
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[128]).toBeCloseTo(0.75, 2); // midpoint lifted
    expect(lut[255]).toBeCloseTo(1, 3);
  });

  it('handles single-point input as identity', () => {
    const lut = bakeCurveLut([{ x: 0.5, y: 0.5 }], 256);
    // Less than 2 points → identity
    expect(lut[0]).toBeCloseTo(0, 3);
    expect(lut[255]).toBeCloseTo(1, 3);
  });
});
```

**Step 5: Verify — load a RAW file, drag exposure slider, see real-time change**

At this point the full main shader is wired up. Load a RAW, verify:
- Exposure slider brightens/darkens the image
- White balance slider shifts color temperature
- Contrast adds an S-curve
- Highlights/Shadows adjust tonal ranges

**Step 6: Run LUT tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/engine/ && git commit -m "feat: main adjustments shader with WB, exposure, contrast, tone zones, curves, HSL, color grading, vibrance, saturation"
```

---

### Task 8: Multi-Pass Effects — Gaussian Blur Infrastructure

**Files:**
- Create: `src/engine/shaders/blur.frag`
- Modify: `src/engine/pipeline.ts` — add blur pass infrastructure

Many effects (clarity, texture, sharpening, noise reduction) need gaussian blur. This task adds a separable two-pass gaussian blur that can be reused.

**Step 1: Create separable blur shader**

`src/engine/shaders/blur.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uDirection; // (1/width, 0) for horizontal, (0, 1/height) for vertical
uniform float uRadius;   // blur radius in pixels

void main() {
  // 9-tap gaussian approximation, scaled by radius
  float weights[5] = float[5](0.2270, 0.1945, 0.1216, 0.0541, 0.0162);

  vec3 sum = texture(uSource, vUv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * float(i) * uRadius;
    sum += texture(uSource, vUv + offset).rgb * weights[i];
    sum += texture(uSource, vUv - offset).rgb * weights[i];
  }

  fragColor = vec4(sum, 1.0);
}
```

**Step 2: Add blur pass helper to pipeline**

In `pipeline.ts`, add a method:
```typescript
blurPass(source: WebGLTexture, target: { framebuffer, texture }, width: number, height: number, radius: number)
```

This performs a horizontal blur into an intermediate framebuffer, then a vertical blur into the target.

**Step 3: Commit**

```bash
git add src/engine/ && git commit -m "feat: separable gaussian blur shader infrastructure"
```

---

### Task 9: Multi-Pass Effects — Dehaze, Clarity/Texture, Sharpening, Noise Reduction, Vignette

**Files:**
- Create: `src/engine/shaders/dehaze.frag`
- Create: `src/engine/shaders/clarity.frag`
- Create: `src/engine/shaders/sharpen.frag`
- Create: `src/engine/shaders/denoise.frag`
- Create: `src/engine/shaders/vignette.frag`
- Modify: `src/engine/pipeline.ts` — wire up all passes

**Step 1: Dehaze shader**

`src/engine/shaders/dehaze.frag` — simplified dark channel prior:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uDehaze;     // -100 to +100
uniform vec2 uTexelSize;   // 1/width, 1/height

void main() {
  if (abs(uDehaze) < 0.5) {
    fragColor = texture(uSource, vUv);
    return;
  }

  vec3 rgb = texture(uSource, vUv).rgb;

  // Estimate atmospheric light from local minimum (simplified)
  float localMin = 1.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec3 s = texture(uSource, vUv + vec2(float(x), float(y)) * uTexelSize * 4.0).rgb;
      localMin = min(localMin, min(s.r, min(s.g, s.b)));
    }
  }

  float amount = uDehaze * 0.01;
  float transmission = 1.0 - amount * localMin;
  transmission = max(transmission, 0.1);

  vec3 atmosphere = vec3(localMin);
  rgb = (rgb - atmosphere * amount) / transmission;

  fragColor = vec4(max(rgb, 0.0), 1.0);
}
```

**Step 2: Clarity/Texture shader**

`src/engine/shaders/clarity.frag` — local contrast enhancement using difference from blurred version:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;    // original (after main pass)
uniform sampler2D uBlurred;   // gaussian-blurred version
uniform float uClarity;       // -100 to +100
uniform float uTexture;       // -100 to +100

void main() {
  vec3 sharp = texture(uSource, vUv).rgb;
  vec3 blurred = texture(uBlurred, vUv).rgb;
  vec3 detail = sharp - blurred;

  // Clarity = larger-radius local contrast
  // Texture = finer detail enhancement
  // Both use the same blurred reference but at different radii
  // (The pipeline runs this pass twice with different blur radii)
  float amount = (uClarity + uTexture) * 0.01;
  vec3 result = sharp + detail * amount;

  fragColor = vec4(max(result, 0.0), 1.0);
}
```

**Note:** In practice, clarity and texture use different blur radii. The pipeline should:
1. Blur at large radius → apply clarity difference
2. Blur at small radius → apply texture difference

**Step 3: Sharpening shader (unsharp mask)**

`src/engine/shaders/sharpen.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform sampler2D uBlurred;
uniform float uAmount;    // 0 to 150
uniform float uDetail;    // masking threshold 0-100

void main() {
  vec3 sharp = texture(uSource, vUv).rgb;
  vec3 blurred = texture(uBlurred, vUv).rgb;
  vec3 diff = sharp - blurred;

  // Edge mask: only sharpen areas with significant detail
  float edgeStrength = length(diff);
  float mask = smoothstep(uDetail * 0.001, uDetail * 0.005, edgeStrength);

  vec3 result = sharp + diff * (uAmount * 0.01) * mask;
  fragColor = vec4(max(result, 0.0), 1.0);
}
```

**Step 4: Noise reduction shader (bilateral filter)**

`src/engine/shaders/denoise.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uLuminanceNR;  // 0-100
uniform float uColorNR;       // 0-100
uniform vec2 uTexelSize;

void main() {
  if (uLuminanceNR < 0.5 && uColorNR < 0.5) {
    fragColor = texture(uSource, vUv);
    return;
  }

  vec3 center = texture(uSource, vUv).rgb;
  float centerLum = dot(center, vec3(0.2126, 0.7152, 0.0722));

  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;

  float sigmaSpace = 3.0;
  float sigmaLum = max(uLuminanceNR * 0.003, 0.001);
  float sigmaColor = max(uColorNR * 0.003, 0.001);

  int radius = 4;
  for (int x = -radius; x <= radius; x++) {
    for (int y = -radius; y <= radius; y++) {
      vec2 offset = vec2(float(x), float(y)) * uTexelSize;
      vec3 sample_color = texture(uSource, vUv + offset).rgb;
      float sampleLum = dot(sample_color, vec3(0.2126, 0.7152, 0.0722));

      float spatialW = exp(-float(x*x + y*y) / (2.0 * sigmaSpace * sigmaSpace));
      float lumW = exp(-(centerLum - sampleLum) * (centerLum - sampleLum) / (2.0 * sigmaLum * sigmaLum));
      float colorW = exp(-dot(center - sample_color, center - sample_color) / (2.0 * sigmaColor * sigmaColor));

      float w = spatialW * lumW * colorW;
      sumColor += sample_color * w;
      sumWeight += w;
    }
  }

  fragColor = vec4(sumColor / sumWeight, 1.0);
}
```

**Step 5: Vignette shader**

`src/engine/shaders/vignette.frag`:
```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uAmount;      // -100 to +100
uniform float uMidpoint;    // 0-100
uniform float uRoundness;   // -100 to +100
uniform float uFeather;     // 0-100
uniform vec4 uCropRect;     // x, y, width, height (0-1 normalized)

void main() {
  vec3 rgb = texture(uSource, vUv).rgb;

  if (abs(uAmount) < 0.5) {
    fragColor = vec4(rgb, 1.0);
    return;
  }

  // UV relative to crop center
  vec2 cropCenter = uCropRect.xy + uCropRect.zw * 0.5;
  vec2 cropSize = uCropRect.zw;
  vec2 uv = (vUv - cropCenter) / (cropSize * 0.5);

  // Roundness: 0 = oval matching crop aspect, +100 = circle, -100 = more elongated
  float aspect = cropSize.x / cropSize.y;
  float roundFactor = mix(aspect, 1.0, (uRoundness + 100.0) / 200.0);
  uv.x *= roundFactor;

  float dist = length(uv);
  float mid = uMidpoint * 0.01;
  float feath = max(uFeather * 0.01, 0.01);
  float vign = smoothstep(mid - feath, mid + feath, dist);

  float amount = uAmount * -0.01; // negative amount = darken edges
  rgb *= 1.0 + amount * vign;

  fragColor = vec4(max(rgb, 0.0), 1.0);
}
```

**Step 6: Wire all passes into pipeline.render()**

Update `pipeline.ts` to run the full pass chain:
1. Main adjustments → framebuffer A
2. Dehaze (from A) → framebuffer B
3. Blur B at large radius → temp; Clarity pass (B + temp) → A
4. Blur A at small radius → temp; Texture pass (A + temp) → B
5. Blur B at sharpen radius → temp; Sharpen pass (B + temp) → A
6. Denoise (from A) → B
7. Vignette (from B) → screen (or export framebuffer)

Each pass that has amount=0 should be skipped (passthrough) for performance.

**Step 7: Verify — all effects visible**

Test each effect one at a time: set dehaze to 50, verify haze removal. Set clarity to 50, verify local contrast boost. Etc.

**Step 8: Commit**

```bash
git add src/engine/ && git commit -m "feat: dehaze, clarity/texture, sharpening, noise reduction, vignette shaders"
```

---

## Phase 5: UI Components

### Task 10: Reusable Slider Component

**Files:**
- Create: `src/components/panels/Slider.tsx`
- Create: `src/components/panels/Slider.module.css`

**Step 1: Implement Slider**

Features:
- Label, current value display, min/max/step
- Double-click track → reset to default value
- Double-click value → editable text input for precise entry
- Colored track fill from center (for -100 to +100 ranges) or from left (for 0+ ranges)
- Calls `onChange(value)` on every input event for real-time feedback

```typescript
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
}
```

**Step 2: Style with CSS modules**

Clean, dark-themed slider matching a photo editor aesthetic. Dark background (#1e1e1e), light text, accent color for the filled track portion.

**Step 3: Write Slider component tests**

Create `src/components/panels/__tests__/Slider.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Slider } from '../Slider';

describe('Slider', () => {
  const defaultProps = {
    label: 'Exposure',
    value: 0,
    min: -5,
    max: 5,
    step: 0.01,
    defaultValue: 0,
    onChange: vi.fn(),
  };

  it('renders label and value', () => {
    render(<Slider {...defaultProps} value={1.5} />);
    expect(screen.getByText('Exposure')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  it('calls onChange when slider moves', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole('slider');
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('resets to default on double-click of track', async () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} value={3.0} onChange={onChange} />);
    const input = screen.getByRole('slider');
    fireEvent.doubleClick(input);
    expect(onChange).toHaveBeenCalledWith(0); // default value
  });
});
```

**Step 4: Run tests and verify**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/components/panels/ && git commit -m "feat: reusable Slider component with reset, precise input, and tests"
```

---

### Task 11: Editor View Layout and Basic Panel

**Files:**
- Create: `src/components/editor/EditorView.tsx`
- Create: `src/components/editor/EditorView.module.css`
- Create: `src/components/panels/BasicPanel.tsx`
- Create: `src/components/panels/PresencePanel.tsx`
- Create: `src/components/panels/PanelSection.tsx`
- Create: `src/components/panels/PanelSection.module.css`
- Modify: `src/App.tsx` — wire up EditorView

**Step 1: Create collapsible PanelSection**

Generic wrapper that renders a clickable header and collapses/expands its children.

**Step 2: Create BasicPanel**

Renders 8 sliders (WB, Tint, Exposure, Contrast, Highlights, Shadows, Whites, Blacks) inside a PanelSection. Each slider reads from `useEditStore` and calls `setParam` on change.

**Step 3: Create PresencePanel**

5 sliders: Texture, Clarity, Dehaze, Vibrance, Saturation.

**Step 4: Create EditorView layout**

Left side: Canvas component (fills available space).
Right side: scrollable panel sidebar (300px wide) with BasicPanel and PresencePanel.
Top bar: back button, filename, Export/Reset buttons.
Bottom bar: prev/next arrows.

**Step 5: Verify — open editor, adjust sliders, see image update in real-time**

**Step 6: Commit**

```bash
git add src/components/ && git commit -m "feat: EditorView layout with Basic and Presence panels"
```

---

### Task 12: Tone Curve Panel

**Files:**
- Create: `src/components/panels/ToneCurvePanel.tsx`
- Create: `src/components/panels/ToneCurvePanel.module.css`

**Step 1: Implement interactive curve widget**

- SVG-based curve editor inside a square container
- Background: subtle grid lines, histogram (optional, can add later)
- Shows current curve as a smooth path (cubic bezier between points)
- Tab bar: RGB | Red | Green | Blue
- Click on curve to add a point
- Drag points to adjust
- Double-click point to remove it (except endpoints)
- Endpoints (0,0) and (1,1) can be dragged vertically but not removed

On point change:
1. Update `toneCurve[channel]` in edit store
2. The pipeline re-bakes the LUT texture and re-renders

**Step 2: Verify — add/move/remove curve points, see tonal changes**

**Step 3: Commit**

```bash
git add src/components/panels/ToneCurve* && git commit -m "feat: interactive tone curve panel with per-channel support"
```

---

### Task 13: HSL Panel

**Files:**
- Create: `src/components/panels/HslPanel.tsx`
- Create: `src/components/panels/HslPanel.module.css`

**Step 1: Implement HSL panel**

- Tab bar: Hue | Saturation | Luminance
- Each tab shows 8 sliders (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
- Slider track color matches the hue it controls (red slider has red-tinted track, etc.)
- All sliders range -100 to +100, default 0

**Step 2: Verify — adjust individual hue ranges, see targeted color shifts**

**Step 3: Commit**

```bash
git add src/components/panels/Hsl* && git commit -m "feat: HSL color panel with hue/saturation/luminance tabs"
```

---

### Task 14: Color Grading Panel

**Files:**
- Create: `src/components/panels/ColorGradingPanel.tsx`
- Create: `src/components/panels/ColorGradingPanel.module.css`
- Create: `src/components/panels/ColorWheel.tsx`
- Create: `src/components/panels/ColorWheel.module.css`

**Step 1: Implement ColorWheel component**

- Circular SVG widget showing a hue wheel
- Draggable point in the center — distance from center = saturation, angle = hue
- Luminance slider below the wheel (-100 to +100)
- Label above (e.g., "Shadows")

```typescript
interface ColorWheelProps {
  label: string;
  hue: number;        // 0-360
  saturation: number;  // 0-100
  luminance: number;   // -100 to +100
  onChange: (hue: number, saturation: number, luminance: number) => void;
}
```

**Step 2: Create ColorGradingPanel**

- 4 color wheels in a 2x2 grid: Shadows, Midtones, Highlights, Global
- Each wheel reads/writes from `colorGrading[zone]` in edit store

**Step 3: Verify — drag color wheels, see color shifts in tonal zones**

**Step 4: Commit**

```bash
git add src/components/panels/Color* && git commit -m "feat: color grading panel with 3-way color wheels"
```

---

### Task 15: Detail and Effects Panels

**Files:**
- Create: `src/components/panels/DetailPanel.tsx`
- Create: `src/components/panels/EffectsPanel.tsx`

**Step 1: DetailPanel**

Two sub-sections:
- Sharpening: Amount (0-150), Radius (0.5-3.0), Detail (0-100) sliders
- Noise Reduction: Luminance (0-100), Color (0-100) sliders

**Step 2: EffectsPanel**

Post-crop Vignette: Amount (-100 to +100), Midpoint (0-100), Roundness (-100 to +100), Feather (0-100) sliders.

**Step 3: Commit**

```bash
git add src/components/panels/Detail* src/components/panels/Effects* && git commit -m "feat: detail and effects panels"
```

---

## Phase 6: File System & Catalog

### Task 16: File System Access API Wrapper

**Files:**
- Create: `src/io/filesystem.ts`

**Step 1: Implement filesystem wrapper**

```typescript
const RAW_EXTENSIONS = ['.arw', '.pef', '.dng', '.nef', '.cr2', '.cr3', '.raf'];

export async function openDirectory(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function listRawFiles(
  dir: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (RAW_EXTENSIONS.includes(ext)) {
        files.push(handle);
      }
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readFile(handle: FileSystemFileHandle): Promise<ArrayBuffer> {
  const file = await handle.getFile();
  return file.arrayBuffer();
}

export async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: string | Blob
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function fileExists(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add src/io/filesystem.ts && git commit -m "feat: File System Access API wrapper"
```

---

### Task 17: Sidecar Persistence

**Files:**
- Create: `src/io/sidecar.ts`
- Modify: `src/store/editStore.ts` — add auto-save debounce

**Step 1: Implement sidecar read/write**

`src/io/sidecar.ts`:
```typescript
import { EditState, createDefaultEdits } from '../types/edits';
import { readFile, writeFile, fileExists } from './filesystem';

const SIDECAR_VERSION = 1;

interface SidecarFile {
  version: number;
  app: string;
  lastModified: string;
  edits: Partial<EditState>;
}

function diffFromDefaults(edits: EditState): Partial<EditState> {
  const defaults = createDefaultEdits();
  const diff: any = {};

  for (const [key, value] of Object.entries(edits)) {
    const defaultVal = (defaults as any)[key];
    if (JSON.stringify(value) !== JSON.stringify(defaultVal)) {
      diff[key] = value;
    }
  }
  return diff;
}

export function serializeSidecar(edits: EditState): string {
  const sidecar: SidecarFile = {
    version: SIDECAR_VERSION,
    app: 'fiat-lux',
    lastModified: new Date().toISOString(),
    edits: diffFromDefaults(edits),
  };
  return JSON.stringify(sidecar, null, 2);
}

export function deserializeSidecar(json: string): Partial<EditState> {
  const sidecar: SidecarFile = JSON.parse(json);
  // Future: handle version migration here
  return sidecar.edits;
}

export async function loadSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string
): Promise<Partial<EditState> | null> {
  const sidecarName = `${rawFileName}.json`;
  if (!(await fileExists(dir, sidecarName))) return null;
  const handle = await dir.getFileHandle(sidecarName);
  const buffer = await readFile(handle);
  const text = new TextDecoder().decode(buffer);
  return deserializeSidecar(text);
}

export async function saveSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string,
  edits: EditState
): Promise<void> {
  const sidecarName = `${rawFileName}.json`;
  const json = serializeSidecar(edits);
  await writeFile(dir, sidecarName, json);
}
```

**Step 2: Write sidecar serialization tests**

Create `src/io/__tests__/sidecar.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { serializeSidecar, deserializeSidecar } from '../sidecar';
import { createDefaultEdits, EditState } from '../../types/edits';

describe('sidecar serialization', () => {
  it('serializes only non-default values (sparse)', () => {
    const edits = createDefaultEdits();
    edits.exposure = 1.5;
    edits.contrast = 25;
    const json = serializeSidecar(edits);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.app).toBe('fiat-lux');
    expect(parsed.edits.exposure).toBe(1.5);
    expect(parsed.edits.contrast).toBe(25);
    // Default values should NOT be present
    expect(parsed.edits.whiteBalance).toBeUndefined();
    expect(parsed.edits.highlights).toBeUndefined();
    expect(parsed.edits.saturation).toBeUndefined();
  });

  it('serializes empty edits as empty object', () => {
    const edits = createDefaultEdits();
    const json = serializeSidecar(edits);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.edits)).toHaveLength(0);
  });

  it('round-trips through serialize/deserialize', () => {
    const edits = createDefaultEdits();
    edits.exposure = -2.0;
    edits.toneCurve.rgb = [
      { x: 0, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 },
    ];
    edits.hsl.hue = [10, -20, 30, 0, 0, 0, -15, 5];

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);
    const restored = { ...createDefaultEdits(), ...partial };

    expect(restored.exposure).toBe(-2.0);
    expect(restored.toneCurve.rgb).toEqual(edits.toneCurve.rgb);
    expect(restored.hsl.hue).toEqual(edits.hsl.hue);
    // Values not in sidecar should be defaults
    expect(restored.contrast).toBe(0);
  });

  it('handles complex nested edits', () => {
    const edits = createDefaultEdits();
    edits.colorGrading.shadows = { hue: 220, saturation: 30, luminance: -10 };
    edits.sharpening = { amount: 50, radius: 1.5, detail: 40 };

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);

    expect(partial.colorGrading?.shadows).toEqual({ hue: 220, saturation: 30, luminance: -10 });
    expect(partial.sharpening).toEqual({ amount: 50, radius: 1.5, detail: 40 });
  });
});
```

**Step 3: Add debounced auto-save to edit store**

In `editStore.ts`, subscribe to changes and auto-save after 500ms debounce. The store needs access to the directory handle and current filename (passed in when an image is opened).

**Step 4: Run tests**

```bash
npm test
```

**Step 5: Verify — edit an image, close tab, reopen — edits are restored**

**Step 6: Commit**

```bash
git add src/io/ src/store/editStore.ts && git commit -m "feat: sidecar persistence with auto-save and tests"
```

---

### Task 18: Catalog View

**Files:**
- Create: `src/components/catalog/CatalogView.tsx`
- Create: `src/components/catalog/CatalogView.module.css`
- Create: `src/components/catalog/ThumbnailGrid.tsx`
- Create: `src/components/catalog/ThumbnailGrid.module.css`
- Modify: `src/App.tsx` — wire up catalog

**Step 1: CatalogView**

- "Open Folder" button → calls `openDirectory()`, stores handle in catalog store
- On directory open: list RAW files, extract thumbnails in parallel (using Web Workers or sequential with progress), check for sidecars
- Pass entries to ThumbnailGrid

**Step 2: ThumbnailGrid**

- CSS Grid of thumbnail cards
- Each card: thumbnail image (from embedded JPEG), filename below
- Small colored dot on cards with existing sidecars
- Double-click → sets selected index in catalog store, switches App view to editor
- Lazy loading: only extract thumbnails for visible items (IntersectionObserver)

**Step 3: Wire into App**

App passes selected file handle to EditorView when switching to editor view. EditorView decodes the RAW and starts editing.

**Step 4: Verify — open a folder of RAW files, see thumbnails, double-click to edit**

**Step 5: Commit**

```bash
git add src/components/catalog/ src/App.tsx && git commit -m "feat: catalog view with thumbnail grid"
```

---

## Phase 7: Crop & Export

### Task 19: Crop Tool

**Files:**
- Create: `src/components/editor/CropOverlay.tsx`
- Create: `src/components/editor/CropOverlay.module.css`
- Create: `src/components/panels/CropPanel.tsx`
- Modify: `src/engine/pipeline.ts` — apply crop UV transform

**Step 1: CropPanel**

- Aspect ratio buttons: Free, 1:1, 4:3, 3:2, 16:9
- Rotate 90 CW / CCW buttons
- Flip H / V buttons
- "Apply" activates crop mode, "Clear" removes crop

**Step 2: CropOverlay**

- When crop mode active, renders a draggable rectangle over the canvas
- 8 handles (corners + midpoints) for resizing
- Darkened area outside the crop rectangle
- Rule-of-thirds grid lines inside crop rectangle
- Respects aspect ratio constraint if one is selected
- On confirm: stores `{ x, y, width, height, rotation }` in edit store (normalized 0-1 coordinates)

**Step 3: Pipeline crop integration**

- When `crop` is set in edits, the vignette pass uses crop-relative UVs
- Canvas component adjusts its display to show only the cropped region (via UV transform in the final passthrough)
- Export renders only the cropped region

**Step 4: Verify — enter crop mode, drag to select region, confirm, image shows cropped**

**Step 5: Commit**

```bash
git add src/components/editor/Crop* src/components/panels/Crop* src/engine/ && git commit -m "feat: crop tool with overlay, aspect ratios, and UV-based cropping"
```

---

### Task 20: JPEG Export with Border

**Files:**
- Create: `src/io/export.ts`
- Create: `src/components/editor/ExportDialog.tsx`
- Create: `src/components/editor/ExportDialog.module.css`

**Step 1: Implement export pipeline**

`src/io/export.ts`:
```typescript
export interface ExportOptions {
  quality: number;        // 1-100
  border: 'none' | 'white' | 'black';
  borderWidth: number;    // percentage of shorter side (0-20)
}

export async function exportJpeg(
  pipeline: RenderPipeline,
  edits: EditState,
  rawBuffer: ArrayBuffer,
  decoder: RawDecoder,
  options: ExportOptions
): Promise<Blob> {
  // 1. Decode full resolution
  const fullRes = await decoder.decode(rawBuffer, false);

  // 2. Render through pipeline at full res into offscreen framebuffer
  // (pipeline needs a method for this: renderToBuffer(image, edits) → ImageData)
  const imageData = pipeline.renderToImageData(fullRes, edits);

  // 3. Add border if requested
  const finalCanvas = addBorder(imageData, options);

  // 4. Encode as JPEG
  return new Promise((resolve) => {
    finalCanvas.toBlob(
      (blob) => resolve(blob!),
      'image/jpeg',
      options.quality / 100
    );
  });
}

function addBorder(imageData: ImageData, options: ExportOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (options.border === 'none' || options.borderWidth === 0) {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  const shorter = Math.min(imageData.width, imageData.height);
  const borderPx = Math.round(shorter * options.borderWidth * 0.01);

  canvas.width = imageData.width + borderPx * 2;
  canvas.height = imageData.height + borderPx * 2;

  ctx.fillStyle = options.border === 'white' ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imageData, borderPx, borderPx);

  return canvas;
}
```

**Step 2: Add renderToImageData to pipeline**

In `pipeline.ts`, add a method that:
1. Creates a temporary full-resolution framebuffer
2. Uploads the full-res texture
3. Runs all shader passes at full resolution
4. Reads back pixels via `gl.readPixels()`
5. Returns `ImageData`
6. Cleans up the temporary framebuffer

**Step 3: ExportDialog component**

Modal overlay with:
- Quality slider (1-100, default 92)
- Border radio buttons (None, White, Black)
- Border width slider (0-20%, default 5%)
- Output dimensions display (accounting for crop + border)
- Export button → calls `exportJpeg()`, then saves via File System Access API
- Progress indicator during export (full-res decode + render can take a few seconds)

**Step 4: Verify — export a JPEG, open it, verify adjustments and border are applied correctly**

**Step 5: Commit**

```bash
git add src/io/export.ts src/components/editor/Export* && git commit -m "feat: JPEG export with configurable border"
```

---

## Phase 8: Keyboard Shortcuts & Polish

### Task 21: Keyboard Navigation and Shortcuts

**Files:**
- Modify: `src/components/editor/EditorView.tsx` — add keyboard handlers
- Modify: `src/App.tsx` — add global keyboard handlers

**Step 1: Add keyboard shortcuts**

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next image (in editor) |
| `F` | Toggle fit/fill zoom |
| `R` | Reset all edits |
| `Escape` | Exit crop mode / close export dialog / back to catalog |
| `Space` | Toggle before/after (show original vs edited) |
| `E` | Open export dialog |

**Step 2: Add before/after toggle**

When holding Space, pipeline renders with default edits (showing the unedited image). Release to show edits again. Useful for comparing.

**Step 3: Commit**

```bash
git add src/components/ && git commit -m "feat: keyboard shortcuts and before/after toggle"
```

---

### Task 22: App Styling and Dark Theme

**Files:**
- Create: `src/index.css` — global reset and CSS variables
- Modify all `*.module.css` files — consistent dark theme

**Step 1: Define CSS variables**

```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3d3d3d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #4a9eff;
  --border: #404040;
  --slider-track: #555555;
  --slider-fill: #4a9eff;
}
```

**Step 2: Style all components consistently**

Dark background, clean panel separators, subtle hover states, smooth transitions on panel collapse.

**Step 3: Commit**

```bash
git add src/ && git commit -m "feat: dark theme and consistent styling"
```

---

## Phase 9: Comprehensive Test Suites

### Task 23: Shader Pipeline Tests (Browser-Based)

**Files:**
- Create: `src/engine/__tests__/pipeline.test.ts`
- Create: `src/engine/__tests__/shader-math.test.ts`
- Modify: `vitest.config.ts` — add browser test config

Since headless-gl only supports WebGL1, shader pipeline tests that use GLSL 300 es need to run in a real browser context. Use Vitest's browser mode with Playwright.

**Step 1: Add Vitest browser mode**

```bash
npm install -D @vitest/browser playwright
npx playwright install chromium
```

Add a separate vitest workspace config for browser tests:
```typescript
// vitest.workspace.ts
export default [
  {
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['src/**/*.browser-test.ts'],
      environment: 'jsdom',
    },
  },
  {
    test: {
      include: ['src/**/*.browser-test.ts'],
      browser: {
        enabled: true,
        provider: 'playwright',
        name: 'chromium',
        headless: true,
      },
    },
  },
];
```

**Step 2: Write shader pipeline tests**

Create `src/engine/__tests__/pipeline.browser-test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../pipeline';
import { createFloatTexture } from '../texture-utils';
import { createDefaultEdits } from '../../types/edits';
import { createSolidColorData, createGradientData } from '../../test/test-textures';

describe('RenderPipeline (browser)', () => {
  function createTestPipeline(width = 64, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const pipeline = new RenderPipeline(canvas);
    return { canvas, pipeline };
  }

  function readCenterPixel(canvas: HTMLCanvasElement): [number, number, number, number] {
    const gl = canvas.getContext('webgl2')!;
    const pixel = new Uint8Array(4);
    gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [pixel[0], pixel[1], pixel[2], pixel[3]];
  }

  it('passthrough renders correct colors for solid input', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    // Mid-gray in linear = 0.5, which in sRGB ≈ 188/255
    const data = createSolidColorData(64, 64, 0.5, 0.5, 0.5);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);
    pipeline.render(createDefaultEdits());

    const pixel = readCenterPixel(canvas);
    // After sRGB gamma, 0.5 linear → ~188
    expect(pixel[0]).toBeGreaterThan(170);
    expect(pixel[0]).toBeLessThan(200);
  });

  it('exposure +1 EV approximately doubles brightness', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    const data = createSolidColorData(64, 64, 0.25, 0.25, 0.25);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);

    // Render at default exposure
    const defaultEdits = createDefaultEdits();
    pipeline.render(defaultEdits);
    const basePixel = readCenterPixel(canvas);

    // Render at +1 EV
    const brightEdits = createDefaultEdits();
    brightEdits.exposure = 1.0;
    pipeline.render(brightEdits);
    const brightPixel = readCenterPixel(canvas);

    // Pixel should be notably brighter
    expect(brightPixel[0]).toBeGreaterThan(basePixel[0] + 20);
  });

  it('identity edits preserve a gradient without clipping', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    const data = createGradientData(64, 64);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);
    pipeline.render(createDefaultEdits());

    // Left edge should be near black
    const leftPixel = new Uint8Array(4);
    gl.readPixels(1, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, leftPixel);
    expect(leftPixel[0]).toBeLessThan(20);

    // Right edge should be near white
    const rightPixel = new Uint8Array(4);
    gl.readPixels(62, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rightPixel);
    expect(rightPixel[0]).toBeGreaterThan(240);
  });

  it('saturation -100 produces a grayscale image', () => {
    const { canvas, pipeline } = createTestPipeline();
    const gl = canvas.getContext('webgl2')!;
    // A saturated red pixel
    const data = createSolidColorData(64, 64, 0.8, 0.2, 0.1);
    const tex = createFloatTexture(gl, 64, 64, data);
    pipeline.setSourceTexture(tex, 64, 64);

    const edits = createDefaultEdits();
    edits.saturation = -100;
    pipeline.render(edits);

    const pixel = readCenterPixel(canvas);
    // R, G, B should be approximately equal (grayscale)
    expect(Math.abs(pixel[0] - pixel[1])).toBeLessThan(5);
    expect(Math.abs(pixel[1] - pixel[2])).toBeLessThan(5);
  });
});
```

**Step 3: Write shader math unit tests**

Create `src/engine/__tests__/shader-math.test.ts` — test the same algorithms used in the shader but implemented in TypeScript. This validates the shader logic without WebGL:
```typescript
import { describe, it, expect } from 'vitest';

// Port of GLSL helper functions to TypeScript for verification
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1/2.4) - 0.055;
}

function applyExposure(r: number, g: number, b: number, ev: number): [number, number, number] {
  const mult = Math.pow(2, ev);
  return [r * mult, g * mult, b * mult];
}

describe('shader math', () => {
  it('luminance of pure white is 1.0', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1.0, 5);
  });

  it('luminance of pure black is 0.0', () => {
    expect(luminance(0, 0, 0)).toBeCloseTo(0.0, 5);
  });

  it('luminance weights green heaviest', () => {
    expect(luminance(0, 1, 0)).toBeGreaterThan(luminance(1, 0, 0));
    expect(luminance(0, 1, 0)).toBeGreaterThan(luminance(0, 0, 1));
  });

  it('linearToSrgb maps 0 to 0 and 1 to 1', () => {
    expect(linearToSrgb(0)).toBeCloseTo(0, 5);
    expect(linearToSrgb(1)).toBeCloseTo(1, 5);
  });

  it('linearToSrgb mid-gray (0.5 linear) maps to ~0.735 sRGB', () => {
    expect(linearToSrgb(0.5)).toBeCloseTo(0.735, 2);
  });

  it('exposure +1 EV doubles linear values', () => {
    const [r, g, b] = applyExposure(0.25, 0.25, 0.25, 1.0);
    expect(r).toBeCloseTo(0.5, 5);
    expect(g).toBeCloseTo(0.5, 5);
  });

  it('exposure -1 EV halves linear values', () => {
    const [r, g, b] = applyExposure(0.5, 0.5, 0.5, -1.0);
    expect(r).toBeCloseTo(0.25, 5);
  });

  it('exposure 0 EV is identity', () => {
    const [r, g, b] = applyExposure(0.42, 0.42, 0.42, 0.0);
    expect(r).toBeCloseTo(0.42, 5);
  });
});
```

**Step 4: Run all tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/engine/__tests__/ vitest.workspace.ts && git commit -m "test: shader pipeline and math tests"
```

---

### Task 24: Component Tests

**Files:**
- Create: `src/components/panels/__tests__/PanelSection.test.tsx`
- Create: `src/components/panels/__tests__/ToneCurvePanel.test.tsx`
- Create: `src/components/panels/__tests__/ColorWheel.test.tsx`
- Create: `src/components/editor/__tests__/ExportDialog.test.tsx`

**Step 1: PanelSection collapse/expand test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelSection } from '../PanelSection';

describe('PanelSection', () => {
  it('renders title and children', () => {
    render(
      <PanelSection title="Basic">
        <div data-testid="child">content</div>
      </PanelSection>
    );
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('collapses and expands on header click', () => {
    render(
      <PanelSection title="Basic">
        <div data-testid="child">content</div>
      </PanelSection>
    );
    fireEvent.click(screen.getByText('Basic'));
    expect(screen.queryByTestId('child')).not.toBeVisible();
    fireEvent.click(screen.getByText('Basic'));
    expect(screen.getByTestId('child')).toBeVisible();
  });
});
```

**Step 2: ToneCurvePanel test — point add/remove**

Test that clicking on the curve area adds a point, and double-clicking removes it. Verify the store is updated.

**Step 3: ColorWheel test — drag interaction**

Test that mousedown + mousemove on the wheel computes correct hue/saturation values and calls onChange.

**Step 4: ExportDialog test — form interaction**

Test that changing quality slider, selecting border color, and clicking export triggers the callback with correct options.

**Step 5: Run tests**

```bash
npm test
```

**Step 6: Commit**

```bash
git add src/components/**/tests/ && git commit -m "test: component tests for panels, curve, color wheel, export dialog"
```

---

### Task 25: Integration Tests

**Files:**
- Create: `src/__tests__/integration.test.ts`
- Create: `src/io/__tests__/export.test.ts`

**Step 1: Sidecar round-trip integration test**

Test the full flow: create edits → serialize to sidecar → deserialize → verify edits match.

```typescript
import { describe, it, expect } from 'vitest';
import { createDefaultEdits } from '../types/edits';
import { serializeSidecar, deserializeSidecar } from '../io/sidecar';

describe('integration: sidecar round-trip', () => {
  it('preserves complex edits through serialize/deserialize cycle', () => {
    const edits = createDefaultEdits();
    edits.exposure = 1.5;
    edits.contrast = -25;
    edits.highlights = 40;
    edits.shadows = -30;
    edits.toneCurve.rgb = [
      { x: 0, y: 0.05 },
      { x: 0.25, y: 0.15 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 0.95 },
    ];
    edits.hsl.saturation = [10, 20, -10, 0, 5, -30, 15, 0];
    edits.colorGrading.shadows = { hue: 220, saturation: 30, luminance: -5 };
    edits.sharpening = { amount: 40, radius: 1.2, detail: 30 };
    edits.vignette = { amount: -25, midpoint: 50, roundness: 0, feather: 60 };
    edits.crop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8, rotation: 0 };

    const json = serializeSidecar(edits);
    const partial = deserializeSidecar(json);
    const restored = { ...createDefaultEdits(), ...partial };

    expect(restored.exposure).toBe(edits.exposure);
    expect(restored.toneCurve.rgb).toEqual(edits.toneCurve.rgb);
    expect(restored.hsl.saturation).toEqual(edits.hsl.saturation);
    expect(restored.colorGrading.shadows).toEqual(edits.colorGrading.shadows);
    expect(restored.crop).toEqual(edits.crop);
    // Fields not modified should be defaults
    expect(restored.whiteBalance).toBe(5500);
    expect(restored.dehaze).toBe(0);
  });
});
```

**Step 2: Export border calculation test**

Test that the `addBorder` function correctly adds borders:
- No border → same dimensions
- White border at 5% → dimensions increase by correct amount
- Black border → correct fill color

```typescript
import { describe, it, expect } from 'vitest';
// Import the addBorder function (may need to export it for testing)

describe('export: addBorder', () => {
  it('no border returns same dimensions', () => {
    const imageData = new ImageData(100, 80);
    const canvas = addBorder(imageData, { border: 'none', borderWidth: 5, quality: 92 });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(80);
  });

  it('white border adds correct padding', () => {
    const imageData = new ImageData(100, 80);
    // 5% of shorter side (80) = 4px per side
    const canvas = addBorder(imageData, { border: 'white', borderWidth: 5, quality: 92 });
    expect(canvas.width).toBe(108); // 100 + 4*2
    expect(canvas.height).toBe(88); // 80 + 4*2
  });
});
```

**Step 3: Run all tests**

```bash
npm test
```

**Step 4: Commit**

```bash
git add src/__tests__/ src/io/__tests__/ && git commit -m "test: integration tests for sidecar round-trip and export"
```

---

### Task 26: Visual Regression Test Suite

**Files:**
- Create: `src/engine/__tests__/visual-regression.browser-test.ts`
- Create: `test-baselines/` (auto-generated on first run)

**Step 1: Create visual regression tests for the shader pipeline**

These tests render known inputs through the pipeline with fixed edits, then compare the output against saved baselines.

```typescript
import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../pipeline';
import { createFloatTexture } from '../texture-utils';
import { createDefaultEdits } from '../../types/edits';
import { createGradientData, createColorWheelData } from '../../test/test-textures';
import { compareToBaseline } from '../../test/visual-regression';

describe('visual regression', () => {
  function renderToPixels(
    edits: ReturnType<typeof createDefaultEdits>,
    testData: Float32Array,
    width = 64,
    height = 64
  ): Uint8Array {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const pipeline = new RenderPipeline(canvas);
    const gl = canvas.getContext('webgl2')!;
    const tex = createFloatTexture(gl, width, height, testData);
    pipeline.setSourceTexture(tex, width, height);
    pipeline.render(edits);

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    pipeline.destroy();
    return pixels;
  }

  it('gradient with default edits matches baseline', () => {
    const data = createGradientData(64, 64);
    const pixels = renderToPixels(createDefaultEdits(), data);
    const result = compareToBaseline('gradient-default', pixels, 64, 64);
    expect(result.pass).toBe(true);
  });

  it('gradient with +2 EV exposure matches baseline', () => {
    const edits = createDefaultEdits();
    edits.exposure = 2.0;
    const data = createGradientData(64, 64);
    const pixels = renderToPixels(edits, data);
    const result = compareToBaseline('gradient-exposure-plus2', pixels, 64, 64);
    expect(result.pass).toBe(true);
  });

  it('color wheel with contrast +50 matches baseline', () => {
    const edits = createDefaultEdits();
    edits.contrast = 50;
    const data = createColorWheelData(64, 64);
    const pixels = renderToPixels(edits, data);
    const result = compareToBaseline('colorwheel-contrast-50', pixels, 64, 64);
    expect(result.pass).toBe(true);
  });

  it('color wheel with HSL hue shift matches baseline', () => {
    const edits = createDefaultEdits();
    edits.hsl.hue = [30, 0, 0, 0, 0, 0, 0, 0]; // shift reds by 30
    const data = createColorWheelData(64, 64);
    const pixels = renderToPixels(edits, data);
    const result = compareToBaseline('colorwheel-hsl-red-hue-30', pixels, 64, 64);
    expect(result.pass).toBe(true);
  });

  it('gradient with S-curve tone curve matches baseline', () => {
    const edits = createDefaultEdits();
    edits.toneCurve.rgb = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.15 },
      { x: 0.75, y: 0.85 },
      { x: 1, y: 1 },
    ];
    const data = createGradientData(64, 64);
    const pixels = renderToPixels(edits, data);
    const result = compareToBaseline('gradient-scurve', pixels, 64, 64);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2: Generate initial baselines**

Run tests once. The first run creates baseline PNGs in `test-baselines/`. Subsequent runs compare against them.

```bash
npm test
```

Visually inspect the baseline PNGs to confirm they look correct. If they do, commit them.

**Step 3: Add baselines to git**

```bash
git add test-baselines/ src/engine/__tests__/visual-regression* && git commit -m "test: visual regression tests with baselines for shader pipeline"
```

**Step 4: Add `test-diffs/` to `.gitignore`**

Diff images are generated on failure for debugging — don't commit them.

---

## Task Dependency Summary

```
Task 1  (scaffold + test deps)
  → Task 2  (test infrastructure)
  → Task 3  (types + tests)
    → Task 4  (stores + tests)
      → Task 5  (WebGL pipeline)
        → Task 6  (Canvas component)
        → Task 7  (RAW decoder) [can parallel with 6]
          → Task 8  (main shader + LUT tests)
            → Task 9  (blur infra)
              → Task 10 (all effect shaders)
            → Task 11 (Slider + tests) [can parallel with 9-10]
              → Task 12 (Editor + Basic/Presence panels)
                → Task 13 (Tone curve panel)
                → Task 14 (HSL panel) [can parallel with 13]
                → Task 15 (Color grading panel) [can parallel with 13]
                → Task 16 (Detail + Effects panels) [can parallel with 13]
            → Task 17 (filesystem) [can parallel with 11]
              → Task 18 (sidecar + tests)
              → Task 19 (catalog)
            → Task 20 (crop) [after 12]
            → Task 21 (export) [after 10, 17]
  → Task 22 (keyboard shortcuts) [after 12]
  → Task 23 (dark theme) [after all components]

Testing phase (after all implementation):
  → Task 24 (shader pipeline tests — browser-based)
  → Task 25 (component tests)
  → Task 26 (integration tests)
  → Task 27 (visual regression tests)
```

## Notes for the Implementer

1. **libraw WASM is the biggest risk.** If no pre-built package works, compiling libraw with Emscripten is a multi-hour task. Consider starting with a fallback: load TIFF/PNG files for pipeline testing, then add RAW support once the WASM build is sorted.

2. **Test with real images early.** Don't build 10 panels before seeing if the shader pipeline produces correct results. Get a RAW file rendering through the main shader by Task 7, then iterate.

3. **Shader debugging.** Use `#define DEBUG` guards in shaders to output intermediate values as colors. For example, output just the luminance zone weights to verify they're correct before trusting the full adjustment chain.

4. **The main shader is doing a lot.** If you hit performance issues or the shader gets too complex, consider splitting it into multiple passes (but profile first — a single pass is almost always faster).

5. **WebGL2 float texture support.** Requires `EXT_color_buffer_float` extension. This is widely supported in Chrome but verify on your target machine. The pipeline constructor already checks for this.

6. **Color science.** The shader algorithms are approximations. They won't match Lightroom exactly. That's fine — the goal is a usable personal tool, not pixel-perfect Adobe compatibility. Tune the math by eye using real photos.

7. **Testing strategy.** Five test layers: (1) Unit tests for pure logic (types, store, sidecar, LUT). (2) Shader pipeline tests in browser via Vitest browser mode + Playwright. (3) Visual regression via pixel-comparison against baselines. (4) Component tests with React Testing Library. (5) Integration tests for full workflows. Run `npm test` frequently during development. When shader output changes intentionally, update baselines with the visual regression helper.

8. **Test baselines.** Visual regression baselines are committed to git in `test-baselines/`. The first run of visual regression tests auto-generates them. Review visually before committing. Diff images from failures go to `test-diffs/` (gitignored).
