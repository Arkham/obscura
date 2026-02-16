#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec4 uCropRect; // x, y, width, height (0-1); default (0,0,1,1) = full image

void main() {
  vec2 uv = uCropRect.xy + vUv * uCropRect.zw;
  fragColor = texture(uTexture, uv);
}
