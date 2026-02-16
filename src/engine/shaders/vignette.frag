#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uAmount;      // -100 to +100
uniform float uMidpoint;    // 0-100
uniform float uRoundness;   // -100 to +100
uniform float uFeather;     // 0-100
uniform vec4 uCropRect;     // x, y, width, height (0-1 normalized)
uniform vec4 uViewRect;     // x, y, width, height in image space; default (0,0,1,1)

void main() {
  // Map viewport UV to image-space UV, then to texture UV
  vec2 imageUv = uViewRect.xy + vUv * uViewRect.zw;
  vec2 texUv = uCropRect.xy + imageUv * uCropRect.zw;
  vec3 rgb = texture(uSource, texUv).rgb;

  if (abs(uAmount) < 0.5) {
    fragColor = vec4(rgb, 1.0);
    return;
  }

  // Vignette computed in crop space using image-space coordinates
  vec2 cropCenter = uCropRect.xy + uCropRect.zw * 0.5;
  vec2 cropSize = uCropRect.zw;
  vec2 uv = (texUv - cropCenter) / (cropSize * 0.5);

  // Roundness: 0 = oval matching crop aspect, +100 = circle, -100 = more elongated
  float aspect = cropSize.x / cropSize.y;
  float roundFactor = mix(aspect, 1.0, (uRoundness + 100.0) / 200.0);
  uv.x *= roundFactor;

  float dist = length(uv);
  float mid = uMidpoint * 0.01;
  float feath = max(uFeather * 0.01, 0.01);
  float vign = smoothstep(mid - feath, mid + feath, dist);

  float amount = uAmount * -0.01; // negative amount = darken edges
  rgb *= 1.0 + amount * vign;

  fragColor = vec4(max(rgb, 0.0), 1.0);
}
