// Bloom extraction and blur shaders

// Brightness extraction
uniform sampler2D tDiffuse;
uniform float threshold;
uniform float knee;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  
  // Soft knee threshold
  vec3 bright = max(vec3(0.0), color - threshold) / max(vec3(0.001), color + knee);
  bright = color * bright * bright;
  
  gl_FragColor = vec4(bright, 1.0);
}

// Horizontal blur
uniform sampler2D tDiffuse;
uniform float hBlurSize;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
  vec4 sum = vec4(0.0);
  float totalWeight = 0.0;
  
  for (int i = -4; i <= 4; i++) {
    float x = float(i);
    float weight = exp(-x * x / 8.0);
    vec2 offset = vec2(x * hBlurSize * texelSize.x, 0.0);
    sum += texture2D(tDiffuse, vUv + offset) * weight;
    totalWeight += weight;
  }
  
  gl_FragColor = sum / totalWeight;
}

// Vertical blur
uniform sampler2D tDiffuse;
uniform float vBlurSize;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
  vec4 sum = vec4(0.0);
  float totalWeight = 0.0;
  
  for (int i = -4; i <= 4; i++) {
    float y = float(i);
    float weight = exp(-y * y / 8.0);
    vec2 offset = vec2(0.0, y * vBlurSize * texelSize.y);
    sum += texture2D(tDiffuse, vUv + offset) * weight;
    totalWeight += weight;
  }
  
  gl_FragColor = sum / totalWeight;
}