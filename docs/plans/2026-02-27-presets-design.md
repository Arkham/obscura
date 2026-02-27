# Presets System Design

## Overview

Add a built-in preset system to Obscura, starting with Fujifilm film simulation presets. Presets are grouped collections of partial `EditState` values that can be applied with one click to replace all current edits.

## Data Model

```typescript
interface Preset {
  id: string;                   // e.g., "fuji-velvia"
  name: string;                 // e.g., "Velvia/Vivid"
  description: string;          // e.g., "Bold, punchy landscapes"
  edits: Partial<EditState>;    // only the params this preset sets
}

interface PresetGroup {
  id: string;                   // e.g., "fujifilm"
  name: string;                 // e.g., "Fujifilm Film Simulations"
  presets: Preset[];
}
```

## Apply Behavior

When a preset is applied:
1. Start from `createDefaultEdits()`
2. Deep-merge the preset's partial edits on top
3. Replace all current edits entirely
4. Push a history entry labeled `Preset: <name>`

Presets always produce the same deterministic result regardless of prior editing state.

## UI

The left sidebar becomes a stacked layout:
- **Presets section** at the top — collapsible groups, each containing a list of preset buttons
- **History section** below — the existing HistoryPanel (unchanged)

Each preset group header is collapsible. Each preset is a clickable row showing name and description. Clicking applies it immediately.

## Fujifilm Film Simulations (17 presets)

**Color:**
1. Provia/Standard — balanced, neutral
2. Velvia/Vivid — bold, punchy landscapes
3. Astia/Soft — soft, flattering portraits
4. Classic Chrome — muted, photojournalistic
5. Classic Negative — punchy, split-toned snapshot
6. PRO Neg. Hi — controlled portrait, moderate contrast
7. PRO Neg. Std — flat, post-processing base
8. Eterna — cinematic, low saturation
9. Eterna Bleach Bypass — gritty, dramatic
10. Nostalgic Negative — amber warmth, vintage
11. Reala ACE — color-accurate

**Monochrome:**
12. ACROS — rich, fine-grain B&W
13. ACROS + Ye — ACROS with yellow filter
14. ACROS + R — ACROS with red filter
15. ACROS + G — ACROS with green filter
16. Monochrome — simple B&W
17. Sepia — warm brown-toned B&W

## Files

- **New:** `src/presets/types.ts` — Preset and PresetGroup interfaces
- **New:** `src/presets/fujifilm.ts` — all 17 Fujifilm presets
- **New:** `src/presets/index.ts` — registry of all built-in groups
- **New:** `src/components/editor/PresetsPanel.tsx` — presets UI component
- **New:** `src/components/editor/PresetsPanel.module.css` — presets panel styles
- **Modified:** `src/store/editStore.ts` — add `applyPreset` action
- **Modified:** `src/components/editor/EditorView.tsx` — add PresetsPanel to left sidebar
- **Modified:** `src/components/editor/EditorView.module.css` — left sidebar stacked layout
