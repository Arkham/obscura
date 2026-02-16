#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uLuminanceNR;  // 0-100
uniform float uColorNR;       // 0-100
uniform vec2 uTexelSize;

void main() {
  if (uLuminanceNR < 0.5 && uColorNR < 0.5) {
    fragColor = texture(uSource, vUv);
    return;
  }

  vec3 center = texture(uSource, vUv).rgb;
  float centerLum = dot(center, vec3(0.2126, 0.7152, 0.0722));

  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;

  float sigmaSpace = 3.0;
  float sigmaLum = max(uLuminanceNR * 0.003, 0.001);
  float sigmaColor = max(uColorNR * 0.003, 0.001);

  int radius = 4;
  for (int x = -radius; x <= radius; x++) {
    for (int y = -radius; y <= radius; y++) {
      vec2 offset = vec2(float(x), float(y)) * uTexelSize;
      vec3 sample_color = texture(uSource, vUv + offset).rgb;
      float sampleLum = dot(sample_color, vec3(0.2126, 0.7152, 0.0722));

      float spatialW = exp(-float(x*x + y*y) / (2.0 * sigmaSpace * sigmaSpace));
      float lumW = exp(-(centerLum - sampleLum) * (centerLum - sampleLum) / (2.0 * sigmaLum * sigmaLum));
      float colorW = exp(-dot(center - sample_color, center - sample_color) / (2.0 * sigmaColor * sigmaColor));

      float w = spatialW * lumW * colorW;
      sumColor += sample_color * w;
      sumWeight += w;
    }
  }

  fragColor = vec4(sumColor / sumWeight, 1.0);
}
