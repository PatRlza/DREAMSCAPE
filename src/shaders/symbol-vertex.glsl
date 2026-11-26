// Symbol Mode Vertex Shader
// Renders world as dense glyph field using instanced quads

attribute vec3 instancePosition;
attribute vec3 instanceNormal;
attribute vec2 instanceUV;
attribute float instanceMaterial;
attribute float instanceDepth;

uniform float symbolSize;
uniform float density;
uniform float time;

varying vec2 vGlyphUV;
varying vec2 vQuadUV;
varying float vMaterialID;
varying float vDepth;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFogFactor;

const float GLYPH_GRID = 16.0;
const float GLYPH_SIZE = 1.0 / GLYPH_GRID;

vec2 getGlyphUV(float glyphIndex) {
  float idx = mod(glyphIndex, 256.0);
  float col = mod(idx, GLYPH_GRID);
  float row = floor(idx / GLYPH_GRID);
  return vec2(col, row) * GLYPH_SIZE;
}

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= p + 17.0;
  return fract(p.x * p.y * p.z * 137.0);
}

void main() {
  vWorldPos = (modelMatrix * vec4(instancePosition, 1.0)).xyz;
  vNormal = normalize((modelMatrix * vec4(instanceNormal, 0.0)).xyz);
  vQuadUV = uv;

  vec4 viewPos = viewMatrix * vec4(vWorldPos, 1.0);
  vDepth = -viewPos.z + instanceDepth;

  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vFogFactor = smoothstep(50.0, 200.0, dist);

  float materialHash = hash(vec3(instanceMaterial, instancePosition.x * 0.01, instancePosition.z * 0.01));
  float glyphVariant = floor(materialHash * 4.0 + sin(time * 0.5 + instancePosition.y * 0.1) * 0.5);
  float baseGlyph = floor(instanceMaterial * 16.0) + glyphVariant;

  vGlyphUV = getGlyphUV(baseGlyph);
  vMaterialID = instanceMaterial;

  // Safe billboard to camera
  vec3 forward = dist > 0.001 ? (toCam / dist) : vec3(0.0, 0.0, 1.0);
  vec3 worldUp = abs(forward.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(worldUp, forward));
  vec3 up = normalize(cross(forward, right));

  vec3 localPos = position.xyz * symbolSize;
  vec3 worldOffset = right * localPos.x + up * localPos.y;

  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos + worldOffset, 1.0);
}