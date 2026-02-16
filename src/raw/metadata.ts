export interface ImageMetadata {
  camera: string | null;
  iso: number | null;
  shutterSpeed: string | null; // "1/250" format
  aperture: string | null; // "f/2.8" format
  focalLength: string | null; // "50mm" format
  imageWidth: number | null;
  imageHeight: number | null;
}

export function extractMetadata(buffer: ArrayBuffer): ImageMetadata {
  const result: ImageMetadata = {
    camera: null,
    iso: null,
    shutterSpeed: null,
    aperture: null,
    focalLength: null,
    imageWidth: null,
    imageHeight: null,
  };

  try {
    if (typeof window.dcraw !== 'function') return result;

    const text = window.dcraw(new Uint8Array(buffer), {
      identify: true,
      verbose: true,
    });

    // dcraw with identify+verbose returns a string
    const output = typeof text === 'string' ? text : new TextDecoder().decode(text as unknown as Uint8Array);
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('Camera:')) {
        result.camera = trimmed.slice('Camera:'.length).trim() || null;
      } else if (trimmed.startsWith('ISO speed:')) {
        const val = parseFloat(trimmed.slice('ISO speed:'.length).trim());
        if (!isNaN(val)) result.iso = val;
      } else if (trimmed.startsWith('Shutter:')) {
        const raw = trimmed.slice('Shutter:'.length).trim();
        // dcraw outputs "1/250.0 sec" or "0.5 sec" — clean it up
        const sec = raw.replace(/\s*sec.*/, '');
        if (sec) {
          const num = parseFloat(sec);
          if (!isNaN(num) && num > 0 && num < 1 && !sec.includes('/')) {
            // Convert decimal like 0.004 to fraction 1/250
            result.shutterSpeed = `1/${Math.round(1 / num)}`;
          } else {
            result.shutterSpeed = sec;
          }
        }
      } else if (trimmed.startsWith('Aperture:')) {
        const raw = trimmed.slice('Aperture:'.length).trim();
        // dcraw outputs "f/2.8"
        result.aperture = raw || null;
      } else if (trimmed.startsWith('Image size:')) {
        const match = trimmed.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
          result.imageWidth = parseInt(match[1]);
          result.imageHeight = parseInt(match[2]);
        }
      } else if (trimmed.startsWith('Focal length:')) {
        const raw = trimmed.slice('Focal length:'.length).trim();
        // dcraw outputs "50.0 mm"
        const match = raw.match(/([\d.]+)\s*mm/);
        if (match) {
          const val = parseFloat(match[1]);
          result.focalLength = Number.isInteger(val) ? `${val}mm` : `${val}mm`;
        }
      }
    }
  } catch {
    // Never block on metadata failure
  }

  return result;
}
