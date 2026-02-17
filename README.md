# obscura

A browser-based RAW photo editor with a real-time WebGL2 rendering pipeline.

Open a folder of RAW files, adjust exposure, color, and tone, and export edited JPEGs — all without leaving the browser. No uploads, no servers. Everything runs locally.

## Features

**Non-destructive editing** with full undo/redo history and automatic sidecar persistence.

- **Basic adjustments** — white balance, tint, exposure, contrast, highlights, shadows, whites, blacks
- **Presence** — texture, clarity, dehaze, vibrance, saturation
- **Tone curves** — per-channel (R, G, B) and combined RGB curves with draggable control points
- **HSL** — hue, saturation, and luminance adjustments across 8 color ranges
- **Color grading** — interactive color wheels for shadows, midtones, highlights, and global
- **Sharpening** — unsharp mask with amount, radius, and detail threshold
- **Noise reduction** — luminance and color denoising
- **Vignette** — amount, midpoint, roundness, feather
- **Crop** — interactive overlay with aspect ratio lock
- **JPEG export** — configurable quality with optional white or black border
- **Before/after** — toggle to compare against the unedited original
- **Real-time histogram** — log-scaled RGB and luminance display

## Supported formats

ARW (Sony), CR2/CR3 (Canon), DNG (Adobe), NEF (Nikon), PEF (Pentax), RAF (Fujifilm).

RAW decoding is handled by [dcraw.js](https://github.com/zfedoran/dcraw.js) compiled to asm.js.

## How it works

Obscura uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read RAW files directly from disk.

The rendering pipeline is a multi-pass WebGL2 shader chain:

1. **Main pass** — white balance, exposure, contrast, tone curves (LUT-based), HSL, color grading
2. **Dehaze** — atmospheric haze removal
3. **Clarity/Texture** — high-pass filtering via separable Gaussian blur
4. **Sharpening** — unsharp mask at configurable radius
5. **Denoise** — spatial noise reduction
6. **Vignette** — corner darkening with crop awareness
7. **Output** — letterboxed to canvas with zoom and pan

All intermediate buffers use RGBA16F for full floating-point precision. Passes are skipped when their parameters are at default values.

Images load at half resolution for fast preview. When you zoom past 2x, a Web Worker decodes the full-resolution image in the background and swaps it in seamlessly.

Edits are saved automatically to a `db.json` sidecar file alongside your RAW files. Only parameters that differ from defaults are stored.

## Getting started

```
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) in Chrome or Edge (requires File System Access API support).

Click **Open Folder** and select a directory containing RAW files.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Left / Right` | Previous / next image |
| `R` | Reset all edits |
| `E` | Export dialog |
| `Space` | Toggle before/after |
| `Esc` | Close dialog / exit crop / back to catalog |
| `Double-click` | Fit image to canvas |
| `Scroll` | Zoom |

## Running tests

```
npm test
```

## Tech stack

- React 19 + TypeScript 5.9
- Vite 7
- Zustand 5
- WebGL2 + GLSL
- dcraw.js
- Vitest

## License

MIT
