import type { EditState } from '../types/edits';
import { createFramebuffer } from './texture-utils';
import { bakeCurveLut, uploadLutTexture } from './lut';
import passthroughVert from './shaders/passthrough.vert';
import passthroughFrag from './shaders/passthrough.frag';
import mainFrag from './shaders/main.frag';
import blurFrag from './shaders/blur.frag';

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
  private mainProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private sourceTexture: WebGLTexture | null = null;
  private imageWidth = 0;
  private imageHeight = 0;

  // LUT textures for tone curves
  private curveRGB: WebGLTexture;
  private curveR: WebGLTexture;
  private curveG: WebGLTexture;
  private curveB: WebGLTexture;

  // Intermediate framebuffers for multi-pass
  private fbA: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  private fbB: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  private fbTemp: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;

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
    this.mainProgram = createProgram(gl, passthroughVert, mainFrag);
    this.blurProgram = createProgram(gl, passthroughVert, blurFrag);

    // Empty VAO for attribute-less rendering (fullscreen triangle)
    this.vao = gl.createVertexArray()!;

    // Create identity LUT textures
    const identityLut = bakeCurveLut([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    this.curveRGB = uploadLutTexture(gl, identityLut);
    this.curveR = uploadLutTexture(gl, identityLut);
    this.curveG = uploadLutTexture(gl, identityLut);
    this.curveB = uploadLutTexture(gl, identityLut);
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

    // Recreate framebuffers at image resolution
    const { gl } = this;
    if (this.fbA) {
      gl.deleteFramebuffer(this.fbA.framebuffer);
      gl.deleteTexture(this.fbA.texture);
    }
    if (this.fbB) {
      gl.deleteFramebuffer(this.fbB.framebuffer);
      gl.deleteTexture(this.fbB.texture);
    }
    if (this.fbTemp) {
      gl.deleteFramebuffer(this.fbTemp.framebuffer);
      gl.deleteTexture(this.fbTemp.texture);
    }
    this.fbA = createFramebuffer(gl, width, height);
    this.fbB = createFramebuffer(gl, width, height);
    this.fbTemp = createFramebuffer(gl, width, height);
  }

  private updateCurveLuts(edits: EditState) {
    const { gl } = this;
    const update = (tex: WebGLTexture, lut: Float32Array) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, lut.length, 1, 0, gl.RED, gl.FLOAT, lut);
    };
    update(this.curveRGB, bakeCurveLut(edits.toneCurve.rgb));
    update(this.curveR, bakeCurveLut(edits.toneCurve.red));
    update(this.curveG, bakeCurveLut(edits.toneCurve.green));
    update(this.curveB, bakeCurveLut(edits.toneCurve.blue));
  }

  private setMainUniforms(edits: EditState) {
    const { gl } = this;
    const prog = this.mainProgram;
    const loc = (name: string) => gl.getUniformLocation(prog, name);

    // White balance: convert from Kelvin to RGB multiplier (simplified)
    const wbKelvin = edits.whiteBalance;
    const wbTemp = (wbKelvin - 5500) / 5500; // normalized deviation from D55
    const wbR = 1.0 + wbTemp * 0.3;
    const wbB = 1.0 - wbTemp * 0.3;
    const tintFactor = edits.tint / 150;
    const wbG = 1.0 - tintFactor * 0.1;
    gl.uniform3f(loc('uWhiteBalance'), wbR, wbG, wbB);

    gl.uniform1f(loc('uExposure'), edits.exposure);
    gl.uniform1f(loc('uContrast'), edits.contrast);
    gl.uniform1f(loc('uHighlights'), edits.highlights);
    gl.uniform1f(loc('uShadows'), edits.shadows);
    gl.uniform1f(loc('uWhites'), edits.whites);
    gl.uniform1f(loc('uBlacks'), edits.blacks);
    gl.uniform1f(loc('uVibrance'), edits.vibrance);
    gl.uniform1f(loc('uSaturation'), edits.saturation);

    // HSL arrays
    gl.uniform1fv(loc('uHslHue[0]'), edits.hsl.hue);
    gl.uniform1fv(loc('uHslSat[0]'), edits.hsl.saturation);
    gl.uniform1fv(loc('uHslLum[0]'), edits.hsl.luminance);

    // Color grading
    const cg = edits.colorGrading;
    gl.uniform3f(loc('uGradeShadowColor'), cg.shadows.hue, cg.shadows.saturation, cg.shadows.luminance);
    gl.uniform3f(loc('uGradeMidtoneColor'), cg.midtones.hue, cg.midtones.saturation, cg.midtones.luminance);
    gl.uniform3f(loc('uGradeHighlightColor'), cg.highlights.hue, cg.highlights.saturation, cg.highlights.luminance);
    gl.uniform3f(loc('uGradeGlobalColor'), cg.global.hue, cg.global.saturation, cg.global.luminance);

    // Curve LUTs — bind to texture units 1-4
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveRGB);
    gl.uniform1i(loc('uCurveRGB'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.curveR);
    gl.uniform1i(loc('uCurveR'), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.curveG);
    gl.uniform1i(loc('uCurveG'), 3);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.curveB);
    gl.uniform1i(loc('uCurveB'), 4);
  }

  /** Draw a fullscreen triangle with the currently bound program */
  drawFullscreen() {
    const { gl } = this;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Run a passthrough pass from source to a target framebuffer (or screen if null) */
  passthroughPass(source: WebGLTexture, target: WebGLFramebuffer | null, width: number, height: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.passthroughProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(this.passthroughProgram, 'uTexture'), 0);
    this.drawFullscreen();
  }

  /**
   * Two-pass separable gaussian blur.
   * Blurs `source` texture at the given radius, writing result to `target`.
   * Uses fbTemp internally for the intermediate horizontal pass.
   */
  blurPass(
    source: WebGLTexture,
    target: { framebuffer: WebGLFramebuffer; texture: WebGLTexture },
    width: number,
    height: number,
    radius: number
  ) {
    const { gl } = this;
    if (!this.fbTemp) return;

    const prog = this.blurProgram;
    gl.useProgram(prog);

    const locSource = gl.getUniformLocation(prog, 'uSource');
    const locDirection = gl.getUniformLocation(prog, 'uDirection');
    const locRadius = gl.getUniformLocation(prog, 'uRadius');

    // Horizontal pass: source → fbTemp
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbTemp.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(locSource, 0);
    gl.uniform2f(locDirection, 1.0 / width, 0.0);
    gl.uniform1f(locRadius, radius);
    this.drawFullscreen();

    // Vertical pass: fbTemp → target
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.fbTemp.texture);
    gl.uniform2f(locDirection, 0.0, 1.0 / height);
    this.drawFullscreen();
  }

  render(edits: EditState) {
    const { gl } = this;
    if (!this.sourceTexture || !this.fbA) return;

    // Update curve LUTs
    this.updateCurveLuts(edits);

    // Main adjustment pass: source → fbA
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(this.mainProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.mainProgram, 'uSource'), 0);

    this.setMainUniforms(edits);
    this.drawFullscreen();

    // Final output to screen: fbA → screen
    this.passthroughPass(this.fbA.texture, null, gl.canvas.width, gl.canvas.height);
  }

  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.passthroughProgram);
    gl.deleteProgram(this.mainProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.curveRGB);
    gl.deleteTexture(this.curveR);
    gl.deleteTexture(this.curveG);
    gl.deleteTexture(this.curveB);
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    if (this.fbA) {
      gl.deleteFramebuffer(this.fbA.framebuffer);
      gl.deleteTexture(this.fbA.texture);
    }
    if (this.fbB) {
      gl.deleteFramebuffer(this.fbB.framebuffer);
      gl.deleteTexture(this.fbB.texture);
    }
    if (this.fbTemp) {
      gl.deleteFramebuffer(this.fbTemp.framebuffer);
      gl.deleteTexture(this.fbTemp.texture);
    }
  }
}
