import LibRaw from 'libraw-wasm';

export interface DecodedImage {
  data: Float32Array;  // Linear RGB, 3 floats per pixel, range 0-1
  width: number;
  height: number;
  whiteBalance: { r: number; g: number; b: number };
  colorTemp: number;
}

export interface RawDecoder {
  decode(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage>;
  extractThumbnail(buffer: ArrayBuffer): Promise<Blob>;
}

/** Rough approximation of color temperature from camera WB multipliers */
function estimateColorTemp(camMul: number[] | undefined): number {
  if (!camMul || camMul.length < 3) return 5500;
  const rg = camMul[0] / camMul[1];
  // Higher R/G ratio means cooler (bluer) light → higher Kelvin
  // This is a rough linear approximation
  return Math.round(4000 + rg * 2000);
}

export function createLibRawDecoder(): RawDecoder {
  return {
    async decode(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage> {
      const raw = new LibRaw();

      await raw.open(new Uint8Array(buffer), {
        outputBps: 16,
        gamm: [1, 1],       // Linear gamma
        outputColor: 1,     // sRGB primaries
        noAutoBright: true,
        userQual: 3,         // AHD demosaicing
        halfSize,
      });

      const meta = await raw.metadata(true);
      const pixels = await raw.imageData() as Uint16Array;

      // pixels is Uint16Array with interleaved RGB (3 channels per pixel)
      const pixelCount = meta.width * meta.height;
      const data = new Float32Array(pixelCount * 3);
      const scale = 1.0 / 65535.0;

      for (let i = 0; i < pixelCount * 3; i++) {
        data[i] = pixels[i] * scale;
      }

      const camMul = meta.cam_mul;
      const wb = camMul && camMul.length >= 3
        ? { r: camMul[0], g: camMul[1], b: camMul[2] }
        : { r: 1, g: 1, b: 1 };

      return {
        data,
        width: meta.width,
        height: meta.height,
        whiteBalance: wb,
        colorTemp: estimateColorTemp(camMul),
      };
    },

    async extractThumbnail(buffer: ArrayBuffer): Promise<Blob> {
      const raw = new LibRaw();

      await raw.open(new Uint8Array(buffer), {
        halfSize: true,
        outputBps: 8,
        userQual: 0, // Fast bilinear for thumbnail
      });

      const meta = await raw.metadata();
      const pixels = await raw.imageData() as Uint8Array;

      // Create an ImageData and render to canvas, then convert to Blob
      // The pixels are RGB, we need RGBA for ImageData
      const rgba = new Uint8ClampedArray(meta.width * meta.height * 4);
      for (let i = 0; i < meta.width * meta.height; i++) {
        rgba[i * 4] = pixels[i * 3];
        rgba[i * 4 + 1] = pixels[i * 3 + 1];
        rgba[i * 4 + 2] = pixels[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }

      const canvas = new OffscreenCanvas(meta.width, meta.height);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(rgba, meta.width, meta.height), 0, 0);
      return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    },
  };
}
