#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec4 uCropRect; // x, y, width, height (0-1); default (0,0,1,1) = full image
uniform vec4 uViewRect; // x, y, width, height in image space; default (0,0,1,1) = full view

void main() {
  // Map viewport UV to image-space UV, then apply crop
  vec2 imageUv = uViewRect.xy + vUv * uViewRect.zw;
  vec2 uv = uCropRect.xy + imageUv * uCropRect.zw;
  fragColor = texture(uTexture, uv);
}
