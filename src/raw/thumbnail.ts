/**
 * Extract an embedded JPEG preview from a RAW file's bytes.
 * Most RAW formats (CR2, NEF, ARW, DNG, RAF, PEF, CR3) embed one
 * or more JPEG previews. We scan for JPEG SOI/EOI markers and
 * return the largest one found, which is typically the full-size
 * or half-size preview — much faster than doing a full RAW decode.
 */
export function extractEmbeddedJpeg(data: Uint8Array): Blob | null {
  const candidates: { start: number; end: number }[] = [];

  for (let i = 0; i < data.length - 3; i++) {
    // JPEG SOI: FF D8 FF
    if (data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff) {
      // Search for the LAST FF D9 (EOI) before the next SOI or EOF.
      // RAW files can contain FF D9 bytes inside TIFF metadata, so
      // greedily scanning for the last EOI avoids truncating the JPEG.
      let lastEoi = -1;
      for (let j = i + 3; j < data.length - 1; j++) {
        // Stop if we hit another SOI — that's a separate embedded JPEG
        if (data[j] === 0xff && data[j + 1] === 0xd8 && data[j + 2] === 0xff) {
          break;
        }
        if (data[j] === 0xff && data[j + 1] === 0xd9) {
          lastEoi = j + 2;
        }
      }
      if (lastEoi > i) {
        candidates.push({ start: i, end: lastEoi });
        i = lastEoi - 1; // skip past this JPEG
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the largest embedded JPEG (usually the full-size preview)
  const best = candidates.reduce((a, b) =>
    (b.end - b.start) > (a.end - a.start) ? b : a,
  );

  // Minimum size sanity check — a valid JPEG preview is at least a few KB
  if (best.end - best.start < 1000) return null;

  return new Blob([data.subarray(best.start, best.end)], { type: 'image/jpeg' });
}

export async function extractThumbnailUrl(
  _decoder: unknown,
  buffer: ArrayBuffer,
): Promise<string | null> {
  const data = new Uint8Array(buffer);
  const blob = extractEmbeddedJpeg(data);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
