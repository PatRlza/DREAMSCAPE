// Dream Mode Fragment Shader
// Stylized PBR with atmospheric effects

uniform vec3 ambientColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float fogDensity;
uniform float time;
uniform sampler2D baseTexture;
uniform sampler2D normalTexture;
uniform sampler2D roughnessTexture;
uniform float materialType; // 0=default, 1=water, 2=glass, 3=emissive, 4=foliage
uniform vec3 emissiveColor;
uniform float emissiveIntensity;
uniform float metalness;
uniform float roughness;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vColor;
varying float vWindFactor;

#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  
  // Base color from texture or vertex color
  vec3 baseColor = vColor;
  float alpha = 1.0;
  
  if (materialType < 0.5) { // Default textured
    vec4 texColor = texture2D(baseTexture, vUv);
    baseColor = mix(baseColor, texColor.rgb, texColor.a);
    alpha = texColor.a;
  }
  
  // Water rendering
  if (materialType > 0.5 && materialType < 1.5) {
    // Procedural water
    float wave1 = sin(vWorldPos.x * 0.3 + time * 0.8) * 0.5;
    float wave2 = sin(vWorldPos.z * 0.3 + time * 0.6) * 0.5;
    float wave3 = sin((vWorldPos.x + vWorldPos.z) * 0.15 + time * 0.4) * 0.3;
    float waterNormal = wave1 + wave2 + wave3;
    
    // Fresnel
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    
    // Reflection approximation
    vec3 reflectDir = reflect(-sunDirection, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
    
    baseColor = mix(baseColor, sunColor * 0.5, fresnel * 0.5);
    baseColor += sunColor * spec * 0.8;
    
    // Transparency
    alpha = 0.6 + fresnel * 0.3;
  }
  
  // Glass
  if (materialType > 1.5 && materialType < 2.5) {
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    baseColor = mix(baseColor, vec3(1.0), fresnel * 0.3);
    alpha = 0.2 + fresnel * 0.5;
  }
  
  // Emissive
  if (materialType > 2.5 && materialType < 3.5) {
    baseColor += emissiveColor * emissiveIntensity * (0.5 + 0.5 * sin(time * 2.0 + vWorldPos.y));
  }
  
  // Foliage subsurface scattering approximation
  if (materialType > 3.5 && materialType < 4.5) {
    float backlight = max(dot(normal, -sunDirection), 0.0);
    baseColor += baseColor * 0.3 * backlight * vWindFactor;
  }
  
  // Lighting
  vec3 diffuse = baseColor * max(dot(normal, sunDirection), 0.0);
  vec3 ambient = baseColor * ambientColor * 0.5;
  
  // Specular (simplified GGX)
  vec3 halfDir = normalize(sunDirection + viewDir);
  float NdotH = max(dot(normal, halfDir), 0.0);
  float specular = pow(NdotH, 32.0 * (1.0 - roughness) + 1.0) * (1.0 - metalness) * 0.5;
  
  vec3 lighting = diffuse * sunColor + ambient + vec3(specular) * sunColor;
  
  // Fog
  float dist = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(fogNear, fogFar, dist);
  // Exponential fog for more atmosphere
  float expFog = 1.0 - exp(-fogDensity * dist * dist * 0.001);
  fogFactor = max(fogFactor, expFog * 0.5);
  
  vec3 finalColor = mix(lighting, fogColor, fogFactor);
  
  // Vignette
  vec2 ndc = gl_FragCoord.xy / vec2(1920.0, 1080.0); // Will be overridden by uniform
  float vignette = 1.0 - 0.3 * length(ndc - 0.5) * 2.0;
  finalColor *= vignette;
  
  // Gamma
  finalColor = pow(finalColor, vec3(1.0 / 2.2));
  
  gl_FragColor = vec4(finalColor, alpha);
  
  // Include Three.js lighting
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
}