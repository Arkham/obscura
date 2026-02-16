import type { DecodedImage } from './decoder';

/**
 * Decode a RAW file in a Web Worker so the main thread stays responsive.
 * The worker loads dcraw via importScripts and runs the decode + PPM parse off-thread.
 */

const dcrawUrl = new URL('/vendor/dcraw.js', window.location.origin).href;

const workerCode = `
// Shim window so dcraw.js (which sets window.dcraw) works in a worker context
if (typeof window === 'undefined') self.window = self;
importScripts('${dcrawUrl}');

function parsePpm(data) {
  var offset = 0;
  function nextToken() {
    while (offset < data.length) {
      if (data[offset] === 0x23) {
        while (offset < data.length && data[offset] !== 0x0a) offset++;
        offset++;
      } else if (data[offset] <= 0x20) {
        offset++;
      } else {
        break;
      }
    }
    var token = '';
    while (offset < data.length && data[offset] > 0x20) {
      token += String.fromCharCode(data[offset++]);
    }
    return token;
  }
  var magic = nextToken();
  if (magic !== 'P6') throw new Error('Expected P6 PPM, got ' + magic);
  var width = parseInt(nextToken());
  var height = parseInt(nextToken());
  var maxval = parseInt(nextToken());
  offset++;
  var pixelCount = width * height;
  var pixels = new Float32Array(pixelCount * 3);
  var scale = 1.0 / maxval;
  if (maxval > 255) {
    for (var i = 0; i < pixelCount * 3; i++) {
      pixels[i] = ((data[offset] << 8) | data[offset + 1]) * scale;
      offset += 2;
    }
  } else {
    for (var i = 0; i < pixelCount * 3; i++) {
      pixels[i] = data[offset++] * scale;
    }
  }
  return { width: width, height: height, pixels: pixels };
}

self.onmessage = function(e) {
  try {
    var buffer = e.data.buffer;
    var halfSize = e.data.halfSize;
    var options = {
      use16BitLinearMode: true,
      useCameraWhiteBalance: true,
      setInterpolationQuality: '3'
    };
    if (halfSize) options.setHalfSizeMode = true;
    var ppmData = self.dcraw(new Uint8Array(buffer), options);
    if (!ppmData || ppmData.length === 0) throw new Error('dcraw returned no output');
    var result = parsePpm(ppmData);
    self.postMessage(
      { width: result.width, height: result.height, pixels: result.pixels },
      [result.pixels.buffer]
    );
  } catch (err) {
    self.postMessage({ error: err.message || 'Worker decode failed' });
  }
};
`;

let workerUrl: string | null = null;

function getWorkerUrl(): string {
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
  }
  return workerUrl;
}

export function decodeInWorker(buffer: ArrayBuffer, halfSize: boolean): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(getWorkerUrl());

    worker.onmessage = (e: MessageEvent) => {
      worker.terminate();
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve({
          data: e.data.pixels as Float32Array,
          width: e.data.width,
          height: e.data.height,
          whiteBalance: { r: 1, g: 1, b: 1 },
          colorTemp: 5500,
        });
      }
    };

    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };

    // Clone the buffer so the caller can still use it
    const copy = buffer.slice(0);
    worker.postMessage({ buffer: copy, halfSize }, [copy]);
  });
}
