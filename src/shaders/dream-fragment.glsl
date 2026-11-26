// Dream Mode Fragment Shader
// Stylized atmospheric shading without Three.js internal light-struct dependencies

uniform vec3 baseColor;
uniform vec3 ambientColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float fogDensity;
uniform float time;
uniform sampler2D baseTexture;
uniform float hasBaseTexture;
uniform float materialType; // 0=default, 1=water, 2=glass, 3=emissive, 4=foliage
uniform vec3 emissiveColor;
uniform float emissiveIntensity;
uniform float metalness;
uniform float roughness;
uniform vec2 resolution;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vWindFactor;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(sunDirection);

  vec3 albedo = baseColor;
  float alpha = 1.0;

  if (materialType < 0.5 && hasBaseTexture > 0.5) {
    vec4 texColor = texture2D(baseTexture, vUv);
    albedo = mix(albedo, texColor.rgb, texColor.a);
    alpha = texColor.a;
  }

  // Water rendering
  if (materialType > 0.5 && materialType < 1.5) {
    float wave1 = sin(vWorldPos.x * 0.3 + time * 0.8) * 0.5;
    float wave2 = sin(vWorldPos.z * 0.3 + time * 0.6) * 0.5;
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 reflectDir = reflect(-sunDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);

    albedo = mix(albedo, sunColor * 0.5, fresnel * 0.5 + 0.05 * (wave1 + wave2));
    albedo += sunColor * spec * 0.8;
    alpha = 0.6 + fresnel * 0.3;
  }

  // Glass
  if (materialType > 1.5 && materialType < 2.5) {
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    albedo = mix(albedo, vec3(1.0), fresnel * 0.3);
    alpha = 0.2 + fresnel * 0.5;
  }

  // Foliage subsurface scattering approximation
  if (materialType > 3.5 && materialType < 4.5) {
    float backlight = max(dot(normal, -sunDir), 0.0);
    albedo += albedo * 0.3 * backlight * (1.0 + vWindFactor);
  }

  // Lighting (two-sided soft wrap so backfaces/sky remain lit)
  float NdotL = max(dot(normal, sunDir), 0.0);
  vec3 diffuse = albedo * (0.25 + 0.75 * NdotL);
  vec3 ambient = albedo * ambientColor * 0.6;

  // Specular
  vec3 halfDir = normalize(sunDir + viewDir);
  float NdotH = max(dot(normal, halfDir), 0.0);
  float specular = pow(NdotH, 32.0 * (1.0 - roughness) + 1.0) * (1.0 - metalness) * 0.35;

  vec3 lighting = diffuse * sunColor + ambient + vec3(specular) * sunColor;

  // Emissive contribution
  if (emissiveIntensity > 0.0) {
    float pulse = (materialType > 2.5 && materialType < 3.5)
      ? (0.5 + 0.5 * sin(time * 2.0 + vWorldPos.y))
      : 1.0;
    lighting += emissiveColor * emissiveIntensity * pulse;
  }

  // Fog
  float dist = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(fogNear, fogFar, dist);
  float expFog = 1.0 - exp(-fogDensity * dist * dist * 0.001);
  fogFactor = clamp(max(fogFactor, expFog * 0.5), 0.0, 1.0);

  vec3 finalColor = mix(lighting, fogColor, fogFactor);

  // Subtle vignette
  vec2 res = max(resolution, vec2(1.0));
  vec2 ndc = gl_FragCoord.xy / res;
  float vignette = 1.0 - 0.15 * length(ndc - 0.5) * 2.0;
  finalColor *= clamp(vignette, 0.7, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}