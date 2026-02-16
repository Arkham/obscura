import type { RenderPipeline } from '../engine/pipeline';
import type { EditState } from '../types/edits';
import type { DecodedImage, RawDecoder } from '../raw/decoder';
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
  // 1. Decode full resolution
  const fullRes = await decoder.decode(rawBuffer, false);

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
