#version 300 es
precision highp float;

// Fullscreen triangle (no vertex buffer needed)
// Vertices: (-1,-1), (3,-1), (-1,3) — covers entire clip space
out vec2 vUv;

void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  vUv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
