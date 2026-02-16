import type { EditState } from '../types/edits';
import { createFramebuffer } from './texture-utils';
import { bakeCurveLut, uploadLutTexture } from './lut';
import passthroughVert from './shaders/passthrough.vert';
import passthroughFrag from './shaders/passthrough.frag';
import mainFrag from './shaders/main.frag';
import blurFrag from './shaders/blur.frag';
import dehazeFrag from './shaders/dehaze.frag';
import clarityFrag from './shaders/clarity.frag';
import sharpenFrag from './shaders/sharpen.frag';
import denoiseFrag from './shaders/denoise.frag';
import vignetteFrag from './shaders/vignette.frag';

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
  private dehazeProgram: WebGLProgram;
  private clarityProgram: WebGLProgram;
  private sharpenProgram: WebGLProgram;
  private denoiseProgram: WebGLProgram;
  private vignetteProgram: WebGLProgram;
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
    this.dehazeProgram = createProgram(gl, passthroughVert, dehazeFrag);
    this.clarityProgram = createProgram(gl, passthroughVert, clarityFrag);
    this.sharpenProgram = createProgram(gl, passthroughVert, sharpenFrag);
    this.denoiseProgram = createProgram(gl, passthroughVert, denoiseFrag);
    this.vignetteProgram = createProgram(gl, passthroughVert, vignetteFrag);

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

  private dehazePass(source: WebGLTexture, target: { framebuffer: WebGLFramebuffer }, edits: EditState) {
    if (Math.abs(edits.dehaze) < 0.5) return false;
    const { gl } = this;
    const prog = this.dehazeProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'uDehaze'), edits.dehaze);
    gl.uniform2f(gl.getUniformLocation(prog, 'uTexelSize'), 1.0 / this.imageWidth, 1.0 / this.imageHeight);
    this.drawFullscreen();
    return true;
  }

  private clarityPass(source: WebGLTexture, blurred: WebGLTexture, target: { framebuffer: WebGLFramebuffer }, edits: EditState) {
    if (Math.abs(edits.clarity) < 0.5 && Math.abs(edits.texture) < 0.5) return false;
    const { gl } = this;
    const prog = this.clarityProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurred);
    gl.uniform1i(gl.getUniformLocation(prog, 'uBlurred'), 1);
    gl.uniform1f(gl.getUniformLocation(prog, 'uClarity'), edits.clarity);
    gl.uniform1f(gl.getUniformLocation(prog, 'uTexture'), edits.texture);
    this.drawFullscreen();
    return true;
  }

  private sharpenPass(source: WebGLTexture, blurred: WebGLTexture, target: { framebuffer: WebGLFramebuffer }, edits: EditState) {
    if (edits.sharpening.amount < 0.5) return false;
    const { gl } = this;
    const prog = this.sharpenProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurred);
    gl.uniform1i(gl.getUniformLocation(prog, 'uBlurred'), 1);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAmount'), edits.sharpening.amount);
    gl.uniform1f(gl.getUniformLocation(prog, 'uDetail'), edits.sharpening.detail);
    this.drawFullscreen();
    return true;
  }

  private denoisePass(source: WebGLTexture, target: { framebuffer: WebGLFramebuffer }, edits: EditState) {
    if (edits.noiseReduction.luminance < 0.5 && edits.noiseReduction.color < 0.5) return false;
    const { gl } = this;
    const prog = this.denoiseProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'uLuminanceNR'), edits.noiseReduction.luminance);
    gl.uniform1f(gl.getUniformLocation(prog, 'uColorNR'), edits.noiseReduction.color);
    gl.uniform2f(gl.getUniformLocation(prog, 'uTexelSize'), 1.0 / this.imageWidth, 1.0 / this.imageHeight);
    this.drawFullscreen();
    return true;
  }

  private vignettePass(source: WebGLTexture, target: WebGLFramebuffer | null, width: number, height: number, edits: EditState) {
    if (Math.abs(edits.vignette.amount) < 0.5) return false;
    const { gl } = this;
    const prog = this.vignetteProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSource'), 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAmount'), edits.vignette.amount);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMidpoint'), edits.vignette.midpoint);
    gl.uniform1f(gl.getUniformLocation(prog, 'uRoundness'), edits.vignette.roundness);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFeather'), edits.vignette.feather);
    // Crop rect: use full image if no crop
    const crop = edits.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    gl.uniform4f(gl.getUniformLocation(prog, 'uCropRect'), crop.x, crop.y, crop.width, crop.height);
    this.drawFullscreen();
    return true;
  }

  render(edits: EditState) {
    const { gl } = this;
    if (!this.sourceTexture || !this.fbA || !this.fbB) return;

    this.updateCurveLuts(edits);

    // Track which FB has the current result: start writing to fbA
    let current = this.fbA;
    let alternate = this.fbB;

    // 1. Main adjustment pass: source → current (fbA)
    gl.bindFramebuffer(gl.FRAMEBUFFER, current.framebuffer);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    gl.useProgram(this.mainProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.mainProgram, 'uSource'), 0);
    this.setMainUniforms(edits);
    this.drawFullscreen();

    // 2. Dehaze: current → alternate
    if (this.dehazePass(current.texture, alternate, edits)) {
      [current, alternate] = [alternate, current];
    }

    // 3. Clarity/Texture: blur current at large radius, then apply
    if (Math.abs(edits.clarity) >= 0.5 || Math.abs(edits.texture) >= 0.5) {
      this.blurPass(current.texture, alternate, this.imageWidth, this.imageHeight, 8.0);
      const blurredTex = alternate.texture;
      // Write clarity result to alternate (need a swap)
      if (this.clarityPass(current.texture, blurredTex, alternate, edits)) {
        [current, alternate] = [alternate, current];
      }
    }

    // 4. Sharpening: blur current at sharpen radius, then apply
    if (edits.sharpening.amount >= 0.5) {
      this.blurPass(current.texture, alternate, this.imageWidth, this.imageHeight, edits.sharpening.radius);
      const blurredTex = alternate.texture;
      if (this.sharpenPass(current.texture, blurredTex, alternate, edits)) {
        [current, alternate] = [alternate, current];
      }
    }

    // 5. Denoise: current → alternate
    if (this.denoisePass(current.texture, alternate, edits)) {
      [current, alternate] = [alternate, current];
    }

    // 6. Vignette → screen
    if (!this.vignettePass(current.texture, null, gl.canvas.width, gl.canvas.height, edits)) {
      // No vignette — passthrough to screen
      this.passthroughPass(current.texture, null, gl.canvas.width, gl.canvas.height);
    }
  }

  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.passthroughProgram);
    gl.deleteProgram(this.mainProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.dehazeProgram);
    gl.deleteProgram(this.clarityProgram);
    gl.deleteProgram(this.sharpenProgram);
    gl.deleteProgram(this.denoiseProgram);
    gl.deleteProgram(this.vignetteProgram);
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
