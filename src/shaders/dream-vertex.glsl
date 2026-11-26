// Dream Mode Vertex Shader
// Stylized PBR with vertex displacement for grass/foliage

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec3 color;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float windStrength;
uniform vec3 windDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vColor;
varying float vWindFactor;

void main() {
  vUv = uv;
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vColor = color;
  
  vec3 displacedPos = position;
  
  // Wind displacement for vegetation (detected by vertex color green channel)
  if (color.g > 0.5) {
    float windPhase = vWorldPos.x * 0.1 + vWorldPos.z * 0.1 + time * windStrength;
    float windAmount = sin(windPhase) * 0.05 * windStrength * color.g;
    displacedPos += vec3(windDirection.x, 0.0, windDirection.z) * windAmount * (1.0 + vWorldPos.y * 0.5);
    vWindFactor = windAmount;
  } else {
    vWindFactor = 0.0;
  }
  
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(displacedPos, 1.0);
}