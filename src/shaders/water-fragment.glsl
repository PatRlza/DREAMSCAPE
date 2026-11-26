// Water fragment shader with reflections, refraction, caustics

uniform vec3 waterColorShallow;
uniform vec3 waterColorDeep;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float time;
uniform sampler2D noiseTexture;
uniform float clarity; // 0 = murky, 1 = clear

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>

float noise(vec2 uv) {
  return texture2D(noiseTexture, uv).r;
}

float fbm(vec2 uv, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(uv * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  
  // Depth-based color
  float depth = vWorldPos.y; // Assuming water at y=0, negative = deeper
  float depthFactor = smoothstep(-10.0, 0.0, depth);
  vec3 baseColor = mix(waterColorDeep, waterColorShallow, depthFactor);
  
  // Fresnel
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  
  // Reflection (skybox approximation)
  vec3 reflectDir = reflect(-viewDir, normal);
  float skyIntensity = max(reflectDir.y, 0.0);
  vec3 reflection = mix(fogColor, sunColor * 0.8, skyIntensity);
  
  // Specular highlight
  vec3 halfDir = normalize(sunDirection + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 128.0);
  vec3 specular = sunColor * spec * fresnel * 2.0;
  
  // Subsurface scattering for shallow water
  float scatter = 1.0 - depthFactor;
  vec3 subsurface = waterColorShallow * 0.3 * scatter * max(dot(normal, sunDirection), 0.0);
  
  // Caustics
  vec2 causticUv = vWorldPos.xz * 0.2 + time * 0.05;
  float caustics = fbm(causticUv, 4) * 0.5 + 0.5;
  caustics = smoothstep(0.5, 1.0, caustics) * scatter * 0.3;
  
  // Foam at edges/shallow
  float foam = fresnel * (1.0 - depthFactor) * 0.5;
  foam = smoothstep(0.3, 0.8, foam);
  
  // Combine
  vec3 color = baseColor * (1.0 - fresnel * 0.5) * clarity;
  color += reflection * fresnel * 0.7;
  color += specular;
  color += subsurface;
  color += vec3(caustics) * sunColor * 0.5;
  color += vec3(foam) * vec3(1.0, 0.95, 0.9);
  
  // Underwater fog
  float dist = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(fogNear, fogFar, dist);
  color = mix(color, fogColor, fogFactor * (1.0 - clarity * 0.5));
  
  // Alpha based on clarity and depth
  float alpha = clarity * (0.4 + 0.4 * depthFactor) + foam * 0.6;
  
  // Gamma
  color = pow(color, vec3(1.0 / 2.2));
  
  gl_FragColor = vec4(color, alpha);
  
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
}