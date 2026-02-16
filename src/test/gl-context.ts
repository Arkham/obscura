import createContext from 'gl';

/**
 * Creates a headless WebGL context for testing.
 * headless-gl provides WebGL1. For WebGL2 features (GLSL 300 es),
 * use Vitest browser mode for shader pipeline tests.
 */
export function createTestGLContext(width = 64, height = 64) {
  const gl = createContext(width, height);
  if (!gl) throw new Error('Failed to create headless GL context');
  return gl;
}

export function readPixels(
  gl: WebGLRenderingContext,
  x: number, y: number,
  width: number, height: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

export function readPixelAt(
  gl: WebGLRenderingContext,
  x: number, y: number
): [number, number, number, number] {
  const pixel = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return [pixel[0], pixel[1], pixel[2], pixel[3]];
}
