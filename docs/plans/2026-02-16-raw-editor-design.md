# Fiat Lux — Browser-Based RAW Photo Editor

## Overview

A personal, browser-based RAW photo editor with a Lightroom-style develop workflow. Runs entirely client-side (Chrome/Edge) using WebAssembly for RAW decoding and WebGL for real-time image adjustments.

**Audience:** Personal tool, single user, no auth.

**RAW formats:** Sony ARW, Pentax PEF/DNG (via libraw).

## Architecture

```
React UI (TypeScript)
  ├── Catalog View (thumbnail grid)
  ├── Editor View (canvas + adjustment panels)
  └── Export Dialog
         │
    Zustand Edit State
    (typed parameter object, drives all rendering)
         │
    WebGL Rendering Pipeline
    (multi-pass fragment shaders, parameters as uniforms)
         │
    WASM Module (libraw)
    (RAW decode → linear 16-bit RGB buffer)
         │
    File System Access API
    (read RAW files, write JSON sidecars, export JPEG)
```

**Data flow during editing:**
```
Slider drag → Zustand state update → WebGL uniforms update → GPU re-render → canvas display
```

## RAW Decoding Pipeline

libraw compiled to WASM via Emscripten.

Two decode modes:

| Mode | Purpose | Speed | Output |
|------|---------|-------|--------|
| Thumbnail extract | Catalog browsing | ~10-50ms | Embedded JPEG preview |
| Full decode | Editing | ~1-3s at 42MP | Linear 16-bit RGB buffer |

Full decode outputs linear data with no white balance or gamma applied. The output is a `Float32Array` uploaded to WebGL as a `FLOAT` texture.

**Preview strategy:**
- On image open: decode at half resolution (`half_size` flag) for interactive editing.
- On export: decode full resolution, run the same shader pipeline.
- Catalog thumbnails: extract embedded JPEG only (no full decode).

**Memory at 61MP:**
- Full-res float texture: ~976MB GPU memory
- Half-res: ~244MB — comfortable for most GPUs
- One image's textures in GPU memory at a time

## WebGL Shader Pipeline

All adjustments as GPU shader passes:

```
Pass 1: Main Adjustments (single fragment shader)
  ├── White balance + Tint
  ├── Exposure (multiply by 2^EV)
  ├── Highlights / Shadows / Whites / Blacks (parametric luminance zones)
  ├── Contrast (S-curve around midpoint)
  ├── Tone Curve (1D LUT texture, RGB master + per-channel)
  ├── HSL (convert to HSL, per-hue-range offsets, back to RGB)
  ├── Color Grading (3-way lift/gamma/gain + global)
  ├── Vibrance (inverse-saturation-weighted boost)
  ├── Saturation
  └── Linear RGB → sRGB gamma

Pass 2: Dehaze (dark channel prior, needs local sampling)

Pass 3: Texture / Clarity (local contrast via difference-of-gaussians, separable blur)

Pass 4: Sharpening (unsharp mask: Amount, Radius, Detail)

Pass 5: Noise Reduction (bilateral filter: Luminance NR, Color NR)

Pass 6: Post-crop Vignette (radial, relative to crop rectangle)

Pass 7: Final Output (to canvas or offscreen framebuffer for export)
```

**Crop:** UV coordinate transform, not pixel discard. Vignette computed relative to crop bounds.

**Tone curves:** User control points → cubic spline → baked into 256-entry 1D LUT texture. Four LUTs: RGB, R, G, B.

**HSL:** 8 hue ranges (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta) with soft transitions.

**Performance:** All passes combined <5ms at half-res on a decent GPU.

## UI Layout

### Catalog View

- Responsive thumbnail grid showing embedded JPEG previews
- Indicator dot on thumbnails with existing sidecar edits
- Double-click to open in Editor
- Sorted by filename

### Editor View

Left: WebGL canvas (zoomable, pannable).
Right: Collapsible adjustment panels.

| Section | Controls |
|---------|----------|
| Basic | White Balance, Tint, Exposure, Contrast, Highlights, Shadows, Whites, Blacks |
| Presence | Texture, Clarity, Dehaze, Vibrance, Saturation |
| Tone Curve | Interactive spline widget, RGB/R/G/B channel tabs |
| HSL / Color | Hue / Saturation / Luminance tabs, 8 color sliders each |
| Color Grading | 4 color wheels (Shadows, Midtones, Highlights, Global) + luminance per wheel |
| Detail | Sharpening (Amount, Radius, Detail), Noise Reduction (Luminance, Color) |
| Effects | Post-crop Vignette (Amount, Midpoint, Roundness, Feather) |
| Crop | Aspect ratio presets (Free, 1:1, 4:3, 3:2, 16:9), rotate, flip |

**Interactions:**
- Double-click slider number to type precise value
- Double-click slider track to reset to default
- Prev/Next navigation between images
- Keyboard: arrows for prev/next, F for fit/fill, R for reset
- Scroll to zoom, click-drag to pan when zoomed

### Export Dialog

- JPEG quality slider
- Border: None / White / Black
- Border width as percentage of shorter side
- Live preview

## Edit State & Persistence

Zustand store holding typed `EditState` object. All slider values, curve points, HSL arrays, color grading wheels, crop bounds.

**Sidecar files:** `IMG_0042.ARW.json` alongside the RAW file. Only non-default values stored (sparse). Version field for future migration. Auto-saved on 500ms debounce after last edit.

**Defaults:** All sliders 0 (neutral). White balance from camera metadata. Curves as straight diagonal. Crop null.

## Project Structure

```
fiat_lux/
├── package.json
├── vite.config.ts
├── index.html
├── public/
│   └── libraw.wasm
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── catalog/        # CatalogView, ThumbnailGrid
│   │   ├── editor/         # EditorView, Canvas, CropOverlay, ExportDialog
│   │   └── panels/         # BasicPanel, ToneCurvePanel, HslPanel, etc., Slider
│   ├── engine/
│   │   ├── pipeline.ts     # WebGL pipeline orchestrator
│   │   ├── shaders/        # GLSL fragment/vertex shaders
│   │   ├── texture-utils.ts
│   │   └── lut.ts          # Tone curve → 1D LUT
│   ├── raw/
│   │   ├── decoder.ts      # WASM wrapper for libraw
│   │   └── thumbnail.ts    # Embedded JPEG extraction
│   ├── store/
│   │   ├── editStore.ts
│   │   └── catalogStore.ts
│   ├── io/
│   │   ├── filesystem.ts   # File System Access API wrapper
│   │   ├── sidecar.ts
│   │   └── export.ts       # JPEG encode + border
│   └── types/
│       └── edits.ts        # EditState type, defaults, ranges
```

**Tooling:** Vite, React 18, TypeScript, Zustand, CSS modules, vite-plugin-glsl, libraw WASM.
