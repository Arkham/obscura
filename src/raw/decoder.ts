import { extractEmbeddedJpeg } from './thumbnail';

export interface DecodedImage {
  data: Float32Array;  // Linear RGB, 3 floats per pixel, range 0-1
  width: number;
  height: number;
  whiteBalance: { r: number; g: number; b: number };
  colorTemp: number;
}

export interface RawDecoder {
  decode(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage>;
}

/** Parse 16-bit PPM (P6) output from dcraw into pixel data */
function parsePpm(data: Uint8Array): { width: number; height: number; pixels: Float32Array } {
  let offset = 0;

  // Read a token (skip whitespace and comments)
  function nextToken(): string {
    while (offset < data.length) {
      if (data[offset] === 0x23) { // '#' comment
        while (offset < data.length && data[offset] !== 0x0a) offset++;
        offset++;
      } else if (data[offset] <= 0x20) {
        offset++;
      } else {
        break;
      }
    }
    let token = '';
    while (offset < data.length && data[offset] > 0x20) {
      token += String.fromCharCode(data[offset++]);
    }
    return token;
  }

  const magic = nextToken();
  if (magic !== 'P6') throw new Error(`Expected P6 PPM, got ${magic}`);

  const width = parseInt(nextToken());
  const height = parseInt(nextToken());
  const maxval = parseInt(nextToken());

  // Skip exactly one whitespace byte after maxval
  offset++;

  const pixelCount = width * height;
  const pixels = new Float32Array(pixelCount * 3);
  const scale = 1.0 / maxval;

  if (maxval > 255) {
    // 16-bit big-endian
    for (let i = 0; i < pixelCount * 3; i++) {
      pixels[i] = ((data[offset] << 8) | data[offset + 1]) * scale;
      offset += 2;
    }
  } else {
    for (let i = 0; i < pixelCount * 3; i++) {
      pixels[i] = data[offset++] * scale;
    }
  }

  return { width, height, pixels };
}

/** sRGB gamma to linear */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// dcraw is loaded via <script> tag (sloppy mode required for Emscripten asm.js)
// and exposed as window.dcraw
declare global {
  interface Window {
    dcraw: (data: Uint8Array, options: Record<string, boolean | string>) => Uint8Array;
  }
}

function getDcraw(): (data: Uint8Array, options: Record<string, boolean | string>) => Uint8Array {
  if (typeof window.dcraw !== 'function') {
    throw new Error('dcraw not loaded — ensure <script src="/vendor/dcraw.js"> is in index.html');
  }
  return window.dcraw;
}

/** Decode using dcraw (asm.js) */
async function decodeWithDcraw(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage> {
  const dcraw = getDcraw();

  const options: Record<string, boolean | string> = {
    use16BitLinearMode: true,       // -4: 16-bit linear (no gamma, no auto-bright)
    useCameraWhiteBalance: true,    // -w: use camera WB
    setInterpolationQuality: '3',   // -q 3: AHD demosaicing
  };
  if (halfSize) {
    options.setHalfSizeMode = true;  // -h: half-size
  }

  const ppmData = dcraw(new Uint8Array(buffer), options) as Uint8Array;
  if (!ppmData || ppmData.length === 0) {
    throw new Error('dcraw returned no output');
  }

  const { width, height, pixels } = parsePpm(ppmData);

  return {
    data: pixels,
    width,
    height,
    whiteBalance: { r: 1, g: 1, b: 1 },
    colorTemp: 5500,
  };
}

/** Decode the embedded JPEG preview as a fallback */
async function decodeFromEmbeddedJpeg(buffer: ArrayBuffer): Promise<DecodedImage> {
  const blob = extractEmbeddedJpeg(new Uint8Array(buffer));
  if (!blob) throw new Error('No embedded JPEG found in RAW file');

  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixelCount = canvas.width * canvas.height;
  const data = new Float32Array(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    data[i * 3] = srgbToLinear(imageData.data[i * 4] / 255);
    data[i * 3 + 1] = srgbToLinear(imageData.data[i * 4 + 1] / 255);
    data[i * 3 + 2] = srgbToLinear(imageData.data[i * 4 + 2] / 255);
  }

  return {
    data,
    width: canvas.width,
    height: canvas.height,
    whiteBalance: { r: 1, g: 1, b: 1 },
    colorTemp: 5500,
  };
}

export function createRawDecoder(): RawDecoder {
  return {
    async decode(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage> {
      try {
        return await decodeWithDcraw(buffer, halfSize);
      } catch (err) {
        console.warn('dcraw decode failed, falling back to embedded JPEG:', err);
        return await decodeFromEmbeddedJpeg(buffer);
      }
    },
  };
}
