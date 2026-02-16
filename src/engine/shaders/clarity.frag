#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;    // original (after main pass)
uniform sampler2D uBlurred;   // gaussian-blurred version
uniform float uClarity;       // -100 to +100
uniform float uTexture;       // -100 to +100

void main() {
  vec3 sharp = texture(uSource, vUv).rgb;
  vec3 blurred = texture(uBlurred, vUv).rgb;
  vec3 detail = sharp - blurred;

  // Clarity = larger-radius local contrast
  // Texture = finer detail enhancement
  // Both use the same blurred reference but at different radii
  // (The pipeline runs this pass twice with different blur radii)
  float amount = (uClarity + uTexture) * 0.01;
  vec3 result = sharp + detail * amount;

  fragColor = vec4(max(result, 0.0), 1.0);
}
