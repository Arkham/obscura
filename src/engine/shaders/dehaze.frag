#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uDehaze;     // -100 to +100
uniform vec2 uTexelSize;   // 1/width, 1/height

void main() {
  if (abs(uDehaze) < 0.5) {
    fragColor = texture(uSource, vUv);
    return;
  }

  vec3 rgb = texture(uSource, vUv).rgb;

  // Estimate atmospheric light from local minimum (simplified dark channel prior)
  float localMin = 1.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec3 s = texture(uSource, vUv + vec2(float(x), float(y)) * uTexelSize * 4.0).rgb;
      localMin = min(localMin, min(s.r, min(s.g, s.b)));
    }
  }

  float amount = uDehaze * 0.01;
  float transmission = 1.0 - amount * localMin;
  transmission = max(transmission, 0.1);

  vec3 atmosphere = vec3(localMin);
  rgb = (rgb - atmosphere * amount) / transmission;

  fragColor = vec4(max(rgb, 0.0), 1.0);
}
