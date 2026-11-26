// Post-processing fragment shader
// Bloom, color grading, vignette, film grain

uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float temperature; // -1 to 1 (cool to warm)
uniform float tint; // -1 to 1 (green to magenta)
uniform float vignetteAmount;
uniform float grainAmount;
uniform float time;
uniform bool enableBloom;
uniform bool enableColorGrading;
uniform bool enableVignette;
uniform bool enableGrain;

varying vec2 vUv;

vec3 rgbToHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsvToRgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  
  // Exposure
  color *= exposure;
  
  // Bloom
  if (enableBloom) {
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    color += bloom * 0.3;
  }
  
  // Color grading
  if (enableColorGrading) {
    // Contrast
    color = (color - 0.5) * contrast + 0.5;
    
    // Saturation
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, saturation);
    
    // Temperature (cool/warm)
    if (temperature != 0.0) {
      color.r += temperature * 0.1;
      color.b -= temperature * 0.1;
    }
    
    // Tint (green/magenta)
    if (tint != 0.0) {
      color.g -= tint * 0.05;
      color.r += tint * 0.025;
      color.b += tint * 0.025;
    }
    
    // Lift/gamma/gain (simple version)
    color = pow(color, vec3(1.0 / contrast));
  }
  
  // Vignette
  if (enableVignette) {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 1.4;
    float vig = smoothstep(0.5, 1.0, dist) * vignetteAmount;
    color *= 1.0 - vig;
  }
  
  // Film grain
  if (enableGrain && grainAmount > 0.0) {
    float grain = (rand(vUv * 1000.0 + time * 10.0) - 0.5) * grainAmount;
    color += grain;
  }
  
  // Final gamma
  color = pow(color, vec3(1.0 / 2.2));
  
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}