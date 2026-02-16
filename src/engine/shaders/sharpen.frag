#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform sampler2D uBlurred;
uniform float uAmount;    // 0 to 150
uniform float uDetail;    // masking threshold 0-100

void main() {
  vec3 sharp = texture(uSource, vUv).rgb;
  vec3 blurred = texture(uBlurred, vUv).rgb;
  vec3 diff = sharp - blurred;

  // Edge mask: only sharpen areas with significant detail
  float edgeStrength = length(diff);
  float mask = smoothstep(uDetail * 0.001, uDetail * 0.005, edgeStrength);

  vec3 result = sharp + diff * (uAmount * 0.01) * mask;
  fragColor = vec4(max(result, 0.0), 1.0);
}
