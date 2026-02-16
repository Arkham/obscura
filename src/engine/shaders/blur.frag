#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uDirection; // (1/width, 0) for horizontal, (0, 1/height) for vertical
uniform float uRadius;   // blur radius in pixels

void main() {
  // 9-tap gaussian approximation, scaled by radius
  float weights[5] = float[5](0.2270, 0.1945, 0.1216, 0.0541, 0.0162);

  vec3 sum = texture(uSource, vUv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * float(i) * uRadius;
    sum += texture(uSource, vUv + offset).rgb * weights[i];
    sum += texture(uSource, vUv - offset).rgb * weights[i];
  }

  fragColor = vec4(sum, 1.0);
}
