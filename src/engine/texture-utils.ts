export function createFloatTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data: Float32Array
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createRgbFloatTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data: Float32Array
): WebGLTexture {
  // Convert RGB float data to RGBA float, flipping Y axis.
  // Image data (PPM, Canvas) is top-to-bottom; WebGL textures are bottom-to-top.
  const rgba = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcRow + x) * 3;
      const dstIdx = (dstRow + x) * 4;
      rgba[dstIdx] = data[srcIdx];
      rgba[dstIdx + 1] = data[srcIdx + 1];
      rgba[dstIdx + 2] = data[srcIdx + 2];
      rgba[dstIdx + 3] = 1.0;
    }
  }
  return createFloatTexture(gl, width, height, rgba);
}

export function createFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer: fb, texture: tex };
}
