import { describe, it, expect } from 'vitest';
import { createProgram } from '../pipeline';

function createMockGL2() {
  const shaders: Map<object, { source: string; type: number; compiled: boolean }> = new Map();
  const programs: Map<object, { linked: boolean; shaders: object[] }> = new Map();

  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    createShader: (type: number) => {
      const s = {};
      shaders.set(s, { source: '', type, compiled: false });
      return s;
    },
    shaderSource: (s: object, source: string) => {
      shaders.get(s)!.source = source;
    },
    compileShader: (s: object) => {
      shaders.get(s)!.compiled = true;
    },
    getShaderParameter: (s: object, _pname: number) => {
      return shaders.get(s)!.compiled;
    },
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => {
      const p = {};
      programs.set(p, { linked: false, shaders: [] });
      return p;
    },
    attachShader: (p: object, s: object) => {
      programs.get(p)!.shaders.push(s);
    },
    linkProgram: (p: object) => {
      programs.get(p)!.linked = true;
    },
    getProgramParameter: (p: object, _pname: number) => {
      return programs.get(p)!.linked;
    },
    getProgramInfoLog: () => '',
  } as unknown as WebGL2RenderingContext;
}

describe('createProgram', () => {
  it('compiles and links a shader program', () => {
    const gl = createMockGL2();
    const program = createProgram(gl, 'vertex src', 'fragment src');
    expect(program).toBeTruthy();
  });

  it('throws on shader compile failure', () => {
    const gl = createMockGL2();
    // Override getShaderParameter to return false (compile fail)
    gl.getShaderParameter = () => false;
    gl.getShaderInfoLog = () => 'syntax error';
    expect(() => createProgram(gl, 'bad', 'bad')).toThrow(/Shader compile error/);
  });

  it('throws on program link failure', () => {
    const gl = createMockGL2();
    gl.getProgramParameter = () => false;
    gl.getProgramInfoLog = () => 'link error';
    expect(() => createProgram(gl, 'ok', 'ok')).toThrow(/Program link error/);
  });
});
