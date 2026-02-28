# Comprehensive Test Coverage Design

## Goal

Maximize test coverage across the app using TDD (write failing tests first, then verify they pass with correct implementation).

## Scope

~20 new test files covering pure logic, all UI panels, editor components, and WebGL engine utilities.

### Pure Logic (6 files)

| Module | Key Tests |
|--------|-----------|
| `notificationStore` | add/dismiss, 3s auto-dismiss, ID uniqueness |
| `presets/index` | registry exports valid groups, presets have required fields |
| `raw/metadata` | parse dcraw output, shutter speed fractions, handle missing fields |
| `raw/thumbnail` | JPEG SOI/EOI marker scanning, filter lossless data, min size |
| `engine/histogram` | bin computation from pixel data, luminance formula, pub/sub |
| `engine/texture-utils` | createFloatTexture, RGB→RGBA + Y-flip, createFramebuffer |

### UI Panels (9 files)

| Module | Key Tests |
|--------|-----------|
| `BasicPanel` | renders 8 sliders, slider change updates store |
| `PresencePanel` | renders 5 sliders, slider change updates store |
| `DetailPanel` | sharpening + noise reduction sections, nested param updates |
| `EffectsPanel` | vignette sliders, nested param updates |
| `HslPanel` | tab switching, 8 sliders per tab, array index updates |
| `ColorGradingPanel` | 4 color wheels, zone changes update store |
| `CropPanel` | toggle crop mode, set aspect ratio, clear crop |
| `HistogramPanel` | subscribes to histogram, renders canvas |
| `MetadataPanel` | renders fields, handles missing data |

### Editor Components (3 files)

| Module | Key Tests |
|--------|-----------|
| `HistoryPanel` | display entries, highlight current, relative time, click navigation |
| `AppHeader` | brand rendering, children/actions slots |
| `Toast` | render notifications, dismiss on click, type styling |

### WebGL Engine (2 files)

| Module | Key Tests |
|--------|-----------|
| `pipeline` | createProgram shader compilation, uniform setting, cleanup |
| `test-textures` | gradient/solid/colorwheel data correctness |

### Out of Scope

EditorView, Canvas, CropOverlay, filesystem, recentFolders, decoder (heavy browser API dependencies).

## TDD Approach

For each test file:
1. Write tests that assert expected behavior
2. Verify tests fail (red) — confirms tests actually check something
3. If tests already pass against existing implementation, that's fine (the code exists)
4. If a test reveals a bug, fix the implementation

## Testing Patterns

- **Panels**: Render component, verify sliders appear with correct labels, simulate slider changes via store, verify store updates
- **Stores**: Call actions directly, assert state changes
- **Pure functions**: Call with known inputs, assert outputs
- **WebGL**: Use headless-gl context from `src/test/gl-context.ts`
