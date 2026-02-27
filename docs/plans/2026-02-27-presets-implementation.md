# Presets System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a built-in preset system with 17 Fujifilm film simulation presets, accessible from a new panel in the left sidebar.

**Architecture:** Presets are static data — partial `EditState` objects grouped into named collections. An `applyPreset` action on the edit store merges a preset onto defaults and replaces all edits. The UI is a new `PresetsPanel` component stacked above the existing `HistoryPanel` in the left sidebar.

**Tech Stack:** React 19, TypeScript, Zustand 5, CSS Modules, Vitest

---

### Task 1: Preset type definitions

**Files:**
- Create: `src/presets/types.ts`

**Step 1: Create the types file**

```typescript
// src/presets/types.ts
import type { EditState } from '../types/edits';

export interface Preset {
  id: string;
  name: string;
  description: string;
  edits: Partial<EditState>;
}

export interface PresetGroup {
  id: string;
  name: string;
  presets: Preset[];
}
```

**Step 2: Commit**

```bash
git add src/presets/types.ts
git commit -m "feat(presets): add Preset and PresetGroup type definitions"
```

---

### Task 2: Fujifilm film simulation preset data

**Files:**
- Create: `src/presets/fujifilm.ts`
- Test: `src/presets/__tests__/fujifilm.test.ts`

**Step 1: Write the test**

```typescript
// src/presets/__tests__/fujifilm.test.ts
import { describe, it, expect } from 'vitest';
import { fujifilmPresets } from '../fujifilm';
import { createDefaultEdits, PARAM_RANGES } from '../../types/edits';

describe('fujifilmPresets', () => {
  it('has correct group metadata', () => {
    expect(fujifilmPresets.id).toBe('fujifilm');
    expect(fujifilmPresets.name).toBe('Fujifilm');
    expect(fujifilmPresets.presets.length).toBe(17);
  });

  it('every preset has required fields', () => {
    for (const preset of fujifilmPresets.presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(typeof preset.edits).toBe('object');
    }
  });

  it('every preset has unique id', () => {
    const ids = fujifilmPresets.presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preset edits merge cleanly onto defaults', () => {
    const defaults = createDefaultEdits();
    for (const preset of fujifilmPresets.presets) {
      const merged = { ...defaults, ...preset.edits };
      // Should still be a valid EditState shape
      expect(typeof merged.exposure).toBe('number');
      expect(typeof merged.contrast).toBe('number');
      expect(typeof merged.saturation).toBe('number');
    }
  });

  it('preset values are within parameter ranges', () => {
    for (const preset of fujifilmPresets.presets) {
      for (const [key, value] of Object.entries(preset.edits)) {
        const range = PARAM_RANGES[key];
        if (range && typeof value === 'number') {
          expect(value).toBeGreaterThanOrEqual(range.min);
          expect(value).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/presets/__tests__/fujifilm.test.ts`
Expected: FAIL — module not found

**Step 3: Create the Fujifilm presets file**

Create `src/presets/fujifilm.ts` with all 17 presets. Each preset defines values for the basic tone params, presence params, tone curves, HSL arrays (8 entries: Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta), and color grading. Monochrome presets use saturation: -100 plus HSL/color grading to shape the tonal response.

Reference `src/types/edits.ts` for the `EditState` interface and `PARAM_RANGES` for valid value bounds. Tone curve points are `{x, y}` pairs from 0-1. HSL arrays are 8 entries matching `HSL_LABELS` order. Color grading zones have `{hue, saturation, luminance}` where hue is 0-360, saturation 0-100, luminance -100 to +100.

The 17 presets are:
1. **Provia/Standard** — near-default, slight contrast/vibrance bump
2. **Velvia/Vivid** — high contrast, high saturation, deep S-curve, boosted blue/green HSL
3. **Astia/Soft** — low contrast, soft highlights/shadows, gentle tones
4. **Classic Chrome** — medium-high contrast, low saturation, muted reds, warm shadows / cool highlights
5. **Classic Negative** — high contrast, desaturated, warm highlights / cool shadows split-tone
6. **PRO Neg. Hi** — moderate contrast, low saturation, portrait-optimized
7. **PRO Neg. Std** — flat/low contrast, low saturation, maximum editing latitude
8. **Eterna** — low contrast, very low saturation, lifted shadows, compressed highlights
9. **Eterna Bleach Bypass** — very high contrast, very low saturation, extreme S-curve
10. **Nostalgic Negative** — moderate contrast, amber warmth, cyan shadows
11. **Reala ACE** — near-default, slight vibrance, color-accurate
12. **ACROS** — monochrome, medium-high contrast, deep blacks
13. **ACROS + Ye** — ACROS with darkened blues, brightened yellows
14. **ACROS + R** — ACROS with dramatically darkened blues, brightened reds
15. **ACROS + G** — ACROS with brightened greens
16. **Monochrome** — basic B&W, medium contrast
17. **Sepia** — B&W with warm brown color grading

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/presets/__tests__/fujifilm.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/presets/fujifilm.ts src/presets/__tests__/fujifilm.test.ts
git commit -m "feat(presets): add 17 Fujifilm film simulation presets"
```

---

### Task 3: Preset registry

**Files:**
- Create: `src/presets/index.ts`

**Step 1: Create the registry**

```typescript
// src/presets/index.ts
import type { PresetGroup } from './types';
import { fujifilmPresets } from './fujifilm';

export const builtinPresetGroups: PresetGroup[] = [
  fujifilmPresets,
];

export type { Preset, PresetGroup } from './types';
```

**Step 2: Commit**

```bash
git add src/presets/index.ts
git commit -m "feat(presets): add preset registry"
```

---

### Task 4: Add `applyPreset` action to editStore

**Files:**
- Modify: `src/store/editStore.ts`
- Test: `src/store/__tests__/editStore.test.ts`

**Step 1: Write the test**

Add to the existing `src/store/__tests__/editStore.test.ts`:

```typescript
import { createDefaultEdits } from '../../types/edits';

// Add this test inside the existing describe('editStore', ...) block:

it('applyPreset replaces edits with preset merged onto defaults', () => {
  // Set some edits first
  useEditStore.getState().setParam('exposure', 2.0);

  const preset = {
    id: 'test',
    name: 'Test Preset',
    description: 'test',
    edits: { contrast: 30, saturation: -20 },
  };

  useEditStore.getState().applyPreset(preset);

  const state = useEditStore.getState();
  // Preset values applied
  expect(state.edits.contrast).toBe(30);
  expect(state.edits.saturation).toBe(-20);
  // Non-preset values reset to defaults (not preserved from prior edits)
  expect(state.edits.exposure).toBe(0);
  // History entry created
  const lastEntry = state.history[state.historyIndex];
  expect(lastEntry.label).toBe('Preset: Test Preset');
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/__tests__/editStore.test.ts`
Expected: FAIL — `applyPreset` is not a function

**Step 3: Add `applyPreset` to editStore**

In `src/store/editStore.ts`:
- Add `applyPreset` to the `EditStoreState` interface: `applyPreset: (preset: { name: string; edits: Partial<EditState> }) => void;`
- Implement it in the store create call. It should:
  1. Call `flushPending()`
  2. Deep-merge preset edits onto `createDefaultEdits()` (handle nested objects: `toneCurve`, `hsl`, `colorGrading`, `sharpening`, `noiseReduction`, `vignette`)
  3. Push a history entry labeled `Preset: <name>`
  4. Set the new edits and mark dirty

The deep merge must handle nested objects properly. For each key in `preset.edits`, if both the default and preset value are plain objects (not arrays, not null), spread-merge them; otherwise use the preset value directly. This ensures a preset that only sets `colorGrading.shadows` doesn't blow away `colorGrading.midtones`.

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store/__tests__/editStore.test.ts`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/store/editStore.ts src/store/__tests__/editStore.test.ts
git commit -m "feat(presets): add applyPreset action to editStore"
```

---

### Task 5: PresetsPanel component

**Files:**
- Create: `src/components/editor/PresetsPanel.tsx`
- Create: `src/components/editor/PresetsPanel.module.css`
- Test: `src/components/editor/__tests__/PresetsPanel.test.tsx`

**Step 1: Write the test**

```typescript
// src/components/editor/__tests__/PresetsPanel.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetsPanel } from '../PresetsPanel';
import { useEditStore } from '../../../store/editStore';

describe('PresetsPanel', () => {
  beforeEach(() => {
    useEditStore.getState().resetAll();
    useEditStore.setState({ isDirty: false });
  });

  it('renders preset group names', () => {
    render(<PresetsPanel />);
    expect(screen.getByText('Fujifilm')).toBeInTheDocument();
  });

  it('renders preset names within a group', () => {
    render(<PresetsPanel />);
    expect(screen.getByText('Velvia/Vivid')).toBeInTheDocument();
    expect(screen.getByText('Classic Chrome')).toBeInTheDocument();
  });

  it('applies preset on click', () => {
    render(<PresetsPanel />);
    fireEvent.click(screen.getByText('Velvia/Vivid'));

    const state = useEditStore.getState();
    // Velvia has high saturation — verify it was applied
    expect(state.edits.saturation).toBeGreaterThan(0);
    expect(state.edits.contrast).toBeGreaterThan(0);
  });

  it('creates a history entry when preset is applied', () => {
    render(<PresetsPanel />);
    fireEvent.click(screen.getByText('Velvia/Vivid'));

    const state = useEditStore.getState();
    const lastEntry = state.history[state.historyIndex];
    expect(lastEntry.label).toBe('Preset: Velvia/Vivid');
  });

  it('can collapse a preset group', () => {
    render(<PresetsPanel />);
    // Click the group header to collapse
    fireEvent.click(screen.getByText('Fujifilm'));
    // Presets inside should be hidden
    expect(screen.queryByText('Velvia/Vivid')).not.toBeVisible();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/editor/__tests__/PresetsPanel.test.tsx`
Expected: FAIL — module not found

**Step 3: Create the PresetsPanel CSS module**

Create `src/components/editor/PresetsPanel.module.css`. Follow the styling patterns from `HistoryPanel.module.css`:
- `.panel` — flex column, takes available height, overflow hidden
- `.header` — "Presets" label styled like HistoryPanel's header (11px uppercase, text-secondary)
- `.list` — flex column, overflow-y auto, padding 4px 0
- `.groupHeader` — collapsible group header button (chevron + group name), styled like PanelSection header but slightly smaller (11px, text-secondary)
- `.groupContent` — container for preset items, toggled by collapse state
- `.preset` — clickable row button, full width, text-align left, 12px text-primary, hover bg-tertiary
- `.presetName` — preset name, flex 1, ellipsis overflow
- `.presetDesc` — description text, 10px, text-secondary

**Step 4: Create the PresetsPanel component**

Create `src/components/editor/PresetsPanel.tsx`:
- Import `builtinPresetGroups` from `../../presets`
- Import `useEditStore` for the `applyPreset` action
- Render a panel header "Presets"
- For each group: a collapsible header (using local `useState` for open/closed, default open) with a chevron + group name
- Inside each group: list of preset buttons, each showing `preset.name` and `preset.description`
- On click: call `applyPreset(preset)`

**Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/editor/__tests__/PresetsPanel.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/editor/PresetsPanel.tsx src/components/editor/PresetsPanel.module.css src/components/editor/__tests__/PresetsPanel.test.tsx
git commit -m "feat(presets): add PresetsPanel component"
```

---

### Task 6: Integrate PresetsPanel into EditorView

**Files:**
- Modify: `src/components/editor/EditorView.tsx`
- Modify: `src/components/editor/EditorView.module.css`

**Step 1: Update the left sidebar layout CSS**

In `src/components/editor/EditorView.module.css`, the `.leftSidebar` already has `display: flex; flex-direction: column`. Add a `.leftSidebarSection` class for each section that allows the presets panel to scroll independently from the history panel. Both sections should be flexible, but presets takes up the top portion and history the bottom, each with their own overflow.

**Step 2: Update EditorView.tsx**

In `src/components/editor/EditorView.tsx`:
- Import `PresetsPanel` from `./PresetsPanel`
- In the left sidebar div, add `<PresetsPanel />` above `<HistoryPanel />`
- Wrap each in a div with the appropriate CSS class so they split the sidebar vertically (presets on top, history on bottom, both scrollable)

**Step 3: Verify the app builds**

Run: `npx vite build`
Expected: Build succeeds with no errors

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/components/editor/EditorView.tsx src/components/editor/EditorView.module.css
git commit -m "feat(presets): integrate PresetsPanel into editor left sidebar"
```

---

### Task 7: Final verification

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run the linter**

Run: `npx eslint src/presets src/components/editor/PresetsPanel.tsx src/store/editStore.ts`
Expected: No errors

**Step 3: Manual smoke test**

Run: `npx vite dev`
Verify:
- Left sidebar shows Presets section above History
- Fujifilm group is visible and collapsible
- All 17 presets are listed with names and descriptions
- Clicking a preset applies it (sliders update, image re-renders)
- History shows "Preset: <name>" entry after applying
- Undo reverts the preset application
- Applying another preset fully replaces the previous one
