import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASELINE_DIR = join(__dirname, '../../test-baselines');
const DIFF_DIR = join(__dirname, '../../test-diffs');

export function compareToBaseline(
  name: string,
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold = 0.01 // fraction of pixels that can differ
): { pass: boolean; diffCount: number; totalPixels: number } {
  const baselinePath = join(BASELINE_DIR, `${name}.png`);
  const diffPath = join(DIFF_DIR, `${name}-diff.png`);

  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  if (!existsSync(DIFF_DIR)) mkdirSync(DIFF_DIR, { recursive: true });

  // Save current render as PNG
  const currentPng = new PNG({ width, height });
  currentPng.data = Buffer.from(pixels);

  if (!existsSync(baselinePath)) {
    // No baseline — create it and pass
    writeFileSync(baselinePath, PNG.sync.write(currentPng));
    return { pass: true, diffCount: 0, totalPixels: width * height };
  }

  // Compare to baseline
  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const diff = new PNG({ width, height });
  const diffCount = pixelmatch(
    baselinePng.data, currentPng.data, diff.data,
    width, height,
    { threshold: 0.1 }
  );

  if (diffCount > 0) {
    writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const totalPixels = width * height;
  return {
    pass: diffCount / totalPixels <= threshold,
    diffCount,
    totalPixels,
  };
}

/** Update a baseline with new pixels */
export function updateBaseline(
  name: string,
  pixels: Uint8Array,
  width: number,
  height: number
) {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  const png = new PNG({ width, height });
  png.data = Buffer.from(pixels);
  writeFileSync(join(BASELINE_DIR, `${name}.png`), PNG.sync.write(png));
}
