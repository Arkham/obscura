import type { RenderPipeline } from '../engine/pipeline';
import type { EditState } from '../types/edits';
import type { RawDecoder } from '../raw/decoder';
import { createRgbFloatTexture } from '../engine/texture-utils';

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
  options: ExportOptions,
): Promise<Blob> {
  // 1. Decode at half resolution (dcraw asm.js can't handle full-res memory)
  const fullRes = await decoder.decode(rawBuffer, true);

  // 2. Upload full-res texture and render through pipeline
  const gl = pipeline.getGL();
  const tex = createRgbFloatTexture(gl, fullRes.width, fullRes.height, fullRes.data);
  const imageData = pipeline.renderToImageData(tex, fullRes.width, fullRes.height, edits);
  gl.deleteTexture(tex);

  // 3. Add border if requested
  const finalCanvas = addBorder(imageData, options);

  // 4. Encode as JPEG
  return new Promise((resolve) => {
    finalCanvas.toBlob(
      (blob) => resolve(blob!),
      'image/jpeg',
      options.quality / 100,
    );
  });
}

/** Calculate output dimensions after adding border */
export function calcBorderDimensions(
  imgWidth: number,
  imgHeight: number,
  options: ExportOptions,
): { width: number; height: number; borderPx: number } {
  if (options.border === 'none' || options.borderWidth === 0) {
    return { width: imgWidth, height: imgHeight, borderPx: 0 };
  }
  const shorter = Math.min(imgWidth, imgHeight);
  const borderPx = Math.round(shorter * options.borderWidth * 0.01);
  return {
    width: imgWidth + borderPx * 2,
    height: imgHeight + borderPx * 2,
    borderPx,
  };
}

export function addBorder(imageData: ImageData, options: ExportOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const { width, height, borderPx } = calcBorderDimensions(imageData.width, imageData.height, options);

  canvas.width = width;
  canvas.height = height;

  if (borderPx > 0) {
    ctx.fillStyle = options.border === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, borderPx, borderPx);
  } else {
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}
