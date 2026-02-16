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
