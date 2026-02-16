import type { EditState } from '../types/edits';
import passthroughVert from './shaders/passthrough.vert';
import passthroughFrag from './shaders/passthrough.frag';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export class RenderPipeline {
  private gl: WebGL2RenderingContext;
  private passthroughProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private sourceTexture: WebGLTexture | null = null;
  private imageWidth = 0;
  private imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })!;
    if (!gl) throw new Error('WebGL2 not available');

    // Enable float texture support
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not available');
    gl.getExtension('OES_texture_float_linear');

    this.gl = gl;
    this.passthroughProgram = createProgram(gl, passthroughVert, passthroughFrag);

    // Empty VAO for attribute-less rendering (fullscreen triangle)
    this.vao = gl.createVertexArray()!;
  }

  getGL(): WebGL2RenderingContext {
    return this.gl;
  }

  getImageDimensions(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight };
  }

  setSourceTexture(texture: WebGLTexture, width: number, height: number) {
    this.sourceTexture = texture;
    this.imageWidth = width;
    this.imageHeight = height;
  }

  render(_edits: EditState) {
    const { gl } = this;
    if (!this.sourceTexture) return;

    // For now, just passthrough. Later tasks will add adjustment passes.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.passthroughProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.passthroughProgram, 'uTexture'), 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.passthroughProgram);
    gl.deleteVertexArray(this.vao);
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
  }
}
