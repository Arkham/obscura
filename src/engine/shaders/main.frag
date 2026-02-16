#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;

// Basic adjustments
uniform vec3 uWhiteBalance;   // RGB multipliers
uniform float uExposure;       // EV stops (-5 to +5)
uniform float uContrast;       // -100 to +100
uniform float uHighlights;     // -100 to +100
uniform float uShadows;        // -100 to +100
uniform float uWhites;         // -100 to +100
uniform float uBlacks;         // -100 to +100
uniform float uVibrance;       // -100 to +100
uniform float uSaturation;     // -100 to +100

// Tone curve LUTs
uniform sampler2D uCurveRGB;
uniform sampler2D uCurveR;
uniform sampler2D uCurveG;
uniform sampler2D uCurveB;

// HSL adjustments (8 hue ranges)
uniform float uHslHue[8];
uniform float uHslSat[8];
uniform float uHslLum[8];

// Color grading
uniform vec3 uGradeShadowColor;    // hue, saturation, luminance
uniform vec3 uGradeMidtoneColor;
uniform vec3 uGradeHighlightColor;
uniform vec3 uGradeGlobalColor;

// --- Helper functions ---

vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float d = maxC - minC;
  float s = 0.0;
  float h = 0.0;

  if (d > 0.001) {
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s < 0.001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// sRGB gamma
vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
  return mix(lo, hi, step(0.0031308, c));
}

// --- Tone mapping zones ---
vec3 applyToneZones(vec3 rgb, float highlights, float shadows, float whites, float blacks) {
  float lum = luminance(rgb);

  float shadowW = 1.0 - smoothstep(0.0, 0.5, lum);
  float highlightW = smoothstep(0.5, 1.0, lum);
  float blackW = 1.0 - smoothstep(0.0, 0.25, lum);
  float whiteW = smoothstep(0.75, 1.0, lum);

  float adj = 1.0;
  adj += shadows * 0.01 * shadowW;
  adj += highlights * 0.01 * highlightW;
  adj += blacks * 0.01 * blackW;
  adj += whites * 0.01 * whiteW;

  return rgb * max(adj, 0.0);
}

// --- Contrast (S-curve) ---
vec3 applyContrast(vec3 rgb, float contrast) {
  float c = contrast * 0.01;
  float midpoint = 0.5;
  rgb = (rgb - midpoint) * (1.0 + c) + midpoint;
  return rgb;
}

// --- HSL adjustments ---
vec3 applyHsl(vec3 rgb, float hueAdj[8], float satAdj[8], float lumAdj[8]) {
  vec3 hsl = rgb2hsl(rgb);
  float h = hsl.x;

  // 8 hue centers: Red=0, Orange=30, Yellow=60, Green=120, Aqua=180, Blue=240, Purple=270, Magenta=330
  float centers[8] = float[8](0.0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.75, 0.9167);

  for (int i = 0; i < 8; i++) {
    float dist = abs(h - centers[i]);
    dist = min(dist, 1.0 - dist); // wrap around
    float weight = 1.0 - smoothstep(0.0, 0.0833, dist);

    hsl.x += hueAdj[i] / 360.0 * weight;
    hsl.y += hsl.y * satAdj[i] * 0.01 * weight;
    hsl.z += hsl.z * lumAdj[i] * 0.01 * weight;
  }

  hsl.x = fract(hsl.x);
  hsl.y = clamp(hsl.y, 0.0, 1.0);
  hsl.z = clamp(hsl.z, 0.0, 1.0);

  return hsl2rgb(hsl);
}

// --- Color grading helper ---
vec3 gradeToTint(vec3 g) {
  if (g.y < 0.001) return vec3(0.0);
  float h = g.x / 360.0;
  float s = g.y * 0.01;
  vec3 tintColor = hsl2rgb(vec3(h, 1.0, 0.5));
  return (tintColor - 0.5) * s;
}

// --- Color Grading (3-way + global) ---
vec3 applyColorGrading(vec3 rgb, vec3 shadowGrade, vec3 midtoneGrade, vec3 highlightGrade, vec3 globalGrade) {
  float lum = luminance(rgb);

  float shadowW = 1.0 - smoothstep(0.0, 0.5, lum);
  float highlightW = smoothstep(0.5, 1.0, lum);
  float midtoneW = max(1.0 - shadowW - highlightW, 0.0);

  vec3 tint = vec3(0.0);
  tint += gradeToTint(shadowGrade) * shadowW;
  tint += gradeToTint(midtoneGrade) * midtoneW;
  tint += gradeToTint(highlightGrade) * highlightW;
  tint += gradeToTint(globalGrade);

  rgb += tint;

  rgb *= 1.0 + (shadowGrade.z * 0.01 * shadowW);
  rgb *= 1.0 + (midtoneGrade.z * 0.01 * midtoneW);
  rgb *= 1.0 + (highlightGrade.z * 0.01 * highlightW);
  rgb *= 1.0 + (globalGrade.z * 0.01);

  return rgb;
}

// --- Vibrance ---
vec3 applyVibrance(vec3 rgb, float vibrance) {
  float v = vibrance * 0.01;
  float sat = length(rgb - vec3(luminance(rgb)));
  float weight = 1.0 - sat; // boost less-saturated colors more
  float boost = 1.0 + v * weight;
  float lum = luminance(rgb);
  return mix(vec3(lum), rgb, boost);
}

// --- Main ---
void main() {
  vec3 rgb = texture(uSource, vUv).rgb;

  // 1. White balance
  rgb *= uWhiteBalance;

  // 2. Exposure
  rgb *= pow(2.0, uExposure);

  // 3. Tone zones (highlights, shadows, whites, blacks)
  rgb = applyToneZones(rgb, uHighlights, uShadows, uWhites, uBlacks);

  // 4. Contrast — apply in perceptual space
  rgb = max(rgb, 0.0);
  vec3 srgbIsh = pow(rgb, vec3(1.0/2.2));
  srgbIsh = applyContrast(srgbIsh, uContrast);
  rgb = pow(max(srgbIsh, 0.0), vec3(2.2));

  // 5. Tone curves (applied in gamma space via LUT)
  vec3 curved = linearToSrgb(max(rgb, 0.0));
  curved.r = texture(uCurveRGB, vec2(curved.r, 0.5)).r;
  curved.g = texture(uCurveRGB, vec2(curved.g, 0.5)).r;
  curved.b = texture(uCurveRGB, vec2(curved.b, 0.5)).r;
  curved.r = texture(uCurveR, vec2(curved.r, 0.5)).r;
  curved.g = texture(uCurveG, vec2(curved.g, 0.5)).r;
  curved.b = texture(uCurveB, vec2(curved.b, 0.5)).r;
  // Stay in gamma space from here (HSL, vibrance, saturation operate perceptually)
  rgb = curved;

  // 6. HSL adjustments
  rgb = applyHsl(rgb, uHslHue, uHslSat, uHslLum);

  // 7. Color grading
  rgb = applyColorGrading(rgb, uGradeShadowColor, uGradeMidtoneColor, uGradeHighlightColor, uGradeGlobalColor);

  // 8. Vibrance
  rgb = applyVibrance(rgb, uVibrance);

  // 9. Saturation
  float lum = luminance(rgb);
  rgb = mix(vec3(lum), rgb, 1.0 + uSaturation * 0.01);

  rgb = clamp(rgb, 0.0, 1.0);
  fragColor = vec4(rgb, 1.0);
}
