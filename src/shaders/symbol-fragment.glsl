// Symbol Mode Fragment Shader
// Renders glyphs with material-based palettes, depth, fog, and effects

uniform sampler2D glyphAtlas;
uniform vec3 paletteBG;
uniform vec3 paletteFG;
uniform vec3 paletteDim;
uniform vec3 paletteAccent;
uniform vec3 paletteAccent2;
uniform vec3 paletteAccent3;
uniform float contrast;
uniform float glowIntensity;
uniform float flickerSpeed;
uniform float time;
uniform float density;
uniform bool enableFog;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec2 vGlyphUV;
varying vec2 vQuadUV;
varying float vMaterialID;
varying float vDepth;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFogFactor;

const float GLYPH_GRID = 16.0;
const float GLYPH_SIZE = 1.0 / GLYPH_GRID;

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = fract(sin(dot(i, vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float b = fract(sin(dot(i + vec3(1,0,0), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float c = fract(sin(dot(i + vec3(0,1,0), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float d = fract(sin(dot(i + vec3(1,1,0), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float e = fract(sin(dot(i + vec3(0,0,1), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float f1 = fract(sin(dot(i + vec3(1,0,1), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float g = fract(sin(dot(i + vec3(0,1,1), vec3(17.0, 59.0, 13.0))) * 43758.5453);
  float h = fract(sin(dot(i + vec3(1,1,1), vec3(17.0, 59.0, 13.0))) * 43758.5453);

  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
             mix(mix(e,f1,f.x), mix(g,h,f.x), f.y), f.z);
}

vec3 getMaterialColor(float matID, float depth, vec3 normal) {
  float n = normal.y;
  vec3 baseColor;
  float emission = 0.0;

  if (matID < 0.5) {
    discard;
  } else if (matID < 2.5) {
    baseColor = mix(paletteDim, paletteFG, 0.6 + 0.4 * n);
    baseColor = mix(baseColor, paletteAccent2, 0.1 * sin(vWorldPos.y * 2.0 + time));
  } else if (matID < 3.5) {
    float wave = sin(vWorldPos.x * 0.5 + time * 1.5) * 0.5 +
                 sin(vWorldPos.z * 0.5 + time * 1.3) * 0.5;
    baseColor = mix(paletteBG, paletteAccent, 0.3 + 0.4 * wave);
    emission = 0.15 * (1.0 - vFogFactor);
  } else if (matID < 4.5) {
    float grain = sin(vWorldPos.x * 12.0) * sin(vWorldPos.z * 12.0) * 0.05;
    baseColor = mix(paletteDim, paletteFG, 0.4 + 0.3 * n + grain);
  } else if (matID < 5.5) {
    float grain = noise(vWorldPos * 5.0) * 0.1;
    baseColor = mix(paletteDim, paletteFG, 0.5 + 0.2 * n + grain);
  } else if (matID < 6.5) {
    baseColor = mix(paletteFG, paletteAccent, 0.2);
    emission = 0.1;
  } else if (matID < 7.5) {
    baseColor = paletteAccent;
    emission = 1.0;
  } else if (matID < 8.5) {
    baseColor = mix(paletteBG, paletteDim, 0.3);
    emission = 0.05;
  } else if (matID < 9.5) {
    float pattern = sin(vWorldPos.x * 8.0) * sin(vWorldPos.y * 8.0) * sin(vWorldPos.z * 8.0);
    baseColor = mix(paletteDim, paletteFG, 0.5 + 0.3 * pattern);
    emission = 0.05 * (1.0 + sin(time * 2.0 + vWorldPos.y));
  } else if (matID < 10.5) {
    baseColor = mix(paletteDim, paletteFG, 0.4 + 0.3 * n);
  } else if (matID < 11.5) {
    float grain = noise(vWorldPos * 8.0) * 0.15;
    baseColor = mix(paletteDim, paletteFG, 0.45 + grain);
  } else if (matID < 12.5) {
    baseColor = mix(paletteDim, paletteAccent2, 0.3 + 0.4 * n);
  } else if (matID < 13.5) {
    float pulse = 0.5 + 0.5 * sin(time * 3.0);
    baseColor = mix(paletteFG, paletteAccent, 0.5 + 0.3 * pulse);
    emission = 0.3 * pulse;
  } else if (matID < 14.5) {
    baseColor = paletteAccent3;
    emission = 0.2;
  } else if (matID < 15.5) {
    baseColor = paletteAccent;
    emission = 0.25;
  } else {
    baseColor = mix(paletteBG, paletteDim, 0.2);
  }

  baseColor = (baseColor - 0.5) * contrast + 0.5;
  float depthFade = smoothstep(150.0, 50.0, depth);
  baseColor = mix(baseColor, paletteBG, (1.0 - depthFade) * 0.3);

  return baseColor + baseColor * emission;
}

void main() {
  vec2 atlasUV = vGlyphUV + vQuadUV * GLYPH_SIZE;
  float glyphAlpha = texture2D(glyphAtlas, atlasUV).r;

  if (glyphAlpha < 0.1) discard;

  float flicker = 1.0;
  if (flickerSpeed > 0.0) {
    float flickerNoise = noise(vec3(vWorldPos * 0.1, time * flickerSpeed));
    flicker = 0.85 + 0.15 * flickerNoise;
  }

  vec3 color = getMaterialColor(vMaterialID, vDepth, vNormal) * flicker * glyphAlpha;
  float glow = glowIntensity * glyphAlpha;
  color += color * glow;

  if (enableFog) {
    color = mix(color, fogColor, vFogFactor);
  }

  color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, glyphAlpha);
}