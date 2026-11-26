// Water vertex shader with Gerstner waves

attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float waveScale;
uniform float waveSpeed;
uniform vec2 waveDirection;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

#define PI 3.14159265359
#define WAVE_COUNT 4

struct GerstnerWave {
  float amplitude;
  float wavelength;
  float speed;
  vec2 direction;
};

GerstnerWave waves[WAVE_COUNT];

vec3 gerstnerWave(vec3 pos, GerstnerWave wave, float t) {
  float k = 2.0 * PI / wave.wavelength;
  float c = sqrt(9.81 / k); // phase speed
  float f = k * dot(wave.direction, pos.xz) - wave.speed * t;
  
  float cosF = cos(f);
  float sinF = sin(f);
  
  // Displacement
  vec3 displacement = vec3(
    wave.direction.x * wave.amplitude * sinF,
    wave.amplitude * cosF,
    wave.direction.y * wave.amplitude * sinF
  );
  
  // Normal
  vec3 normal = vec3(
    -wave.direction.x * k * wave.amplitude * cosF,
    1.0,
    -wave.direction.y * k * wave.amplitude * cosF
  );
  
  return vec3(displacement, 0.0) + vec3(0.0, 0.0, 0.0); // Return displacement, normal handled separately
}

void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  
  // Initialize waves
  waves[0] = GerstnerWave(0.15, 4.0, 1.0, normalize(vec2(1.0, 0.3)));
  waves[1] = GerstnerWave(0.08, 2.0, 1.5, normalize(vec2(0.5, 1.0)));
  waves[2] = GerstnerWave(0.04, 1.0, 2.0, normalize(vec2(-0.3, 1.0)));
  waves[3] = GerstnerWave(0.02, 0.5, 3.0, normalize(vec2(1.0, -0.5)));
  
  vec3 totalDisplacement = vec3(0.0);
  vec3 totalNormal = vec3(0.0, 1.0, 0.0);
  
  for (int i = 0; i < WAVE_COUNT; i++) {
    float k = 2.0 * PI / waves[i].wavelength;
    float f = k * dot(waves[i].direction, vWorldPos.xz) - waves[i].speed * time;
    
    float cosF = cos(f);
    float sinF = sin(f);
    
    totalDisplacement.x += waves[i].direction.x * waves[i].amplitude * sinF;
    totalDisplacement.y += waves[i].amplitude * cosF;
    totalDisplacement.z += waves[i].direction.y * waves[i].amplitude * sinF;
    
    totalNormal.x += -waves[i].direction.x * k * waves[i].amplitude * cosF;
    totalNormal.z += -waves[i].direction.y * k * waves[i].amplitude * cosF;
  }
  
  totalNormal = normalize(totalNormal);
  
  vec3 displacedPos = position + totalDisplacement;
  vWorldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
  vNormal = normalize((modelMatrix * vec4(totalNormal, 0.0)).xyz);
  
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
}