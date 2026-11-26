// Symbol Mode Vertex Shader
// Renders world as dense glyph field using instanced quads

#define MAX_INSTANCES 500000

attribute vec3 instancePosition;
attribute vec3 instanceNormal;
attribute vec2 instanceUV;      // Glyph atlas UV
attribute float instanceMaterial; // Material ID
attribute float instanceDepth;   // Depth sorting key

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform vec3 cameraPosition;
uniform float symbolSize;
uniform float density;
uniform float time;

varying vec2 vGlyphUV;
varying float vMaterialID;
varying float vDepth;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFogFactor;

// Glyph atlas: 16x16 grid = 256 glyphs
const float GLYPH_GRID = 16.0;
const float GLYPH_SIZE = 1.0 / GLYPH_GRID;

vec2 getGlyphUV(float glyphIndex) {
  float col = mod(glyphIndex, GLYPH_GRID);
  float row = floor(glyphIndex / GLYPH_GRID);
  return vec2(col, row) * GLYPH_SIZE;
}

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= p + 17.0;
  return fract(p.x * p.y * p.z * 137.0);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec3(1,0,0));
  float c = hash(i + vec3(0,1,0));
  float d = hash(i + vec3(1,1,0));
  float e = hash(i + vec3(0,0,1));
  float f1 = hash(i + vec3(1,0,1));
  float g = hash(i + vec3(0,1,1));
  float h = hash(i + vec3(1,1,1));
  
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
             mix(mix(e,f1,f.x), mix(g,h,f.x), f.y), f.z);
}

void main() {
  vWorldPos = (modelMatrix * vec4(instancePosition, 1.0)).xyz;
  vNormal = normalize((modelMatrix * vec4(instanceNormal, 0.0)).xyz);
  
  // Depth for sorting
  vec4 viewPos = viewMatrix * vec4(vWorldPos, 1.0);
  vDepth = -viewPos.z + instanceDepth;
  
  // Distance fog
  float dist = length(vWorldPos - cameraPosition);
  vFogFactor = smoothstep(50.0, 200.0, dist);
  
  // Material-based glyph selection with variation
  float materialHash = hash(vec3(instanceMaterial, instancePosition.x * 0.01, instancePosition.z * 0.01));
  
  // Animate glyph selection subtly
  float glyphVariant = floor(materialHash * 4.0 + sin(time * 0.5 + instancePosition.y * 0.1) * 0.5);
  float baseGlyph = floor(instanceMaterial * 16.0) + glyphVariant;
  
  vGlyphUV = getGlyphUV(baseGlyph);
  vMaterialID = instanceMaterial;
  
  // Billboard to camera
  vec3 right = normalize(cross(vec3(0,1,0), normalize(cameraPosition - vWorldPos)));
  vec3 up = normalize(cross(normalize(cameraPosition - vWorldPos), right));
  
  vec3 localPos = position.xyz * symbolSize;
  vec3 worldOffset = right * localPos.x + up * localPos.y + normalize(cameraPosition - vWorldPos) * localPos.z * 0.1;
  
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos + worldOffset, 1.0);
  
  // Frustum culling via point size
  gl_PointSize = symbolSize * (100.0 / max(dist, 1.0));
}