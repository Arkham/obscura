import type { RawDecoder } from './decoder';

export async function extractThumbnailUrl(
  decoder: RawDecoder,
  buffer: ArrayBuffer
): Promise<string> {
  const blob = await decoder.extractThumbnail(buffer);
  return URL.createObjectURL(blob);
}
