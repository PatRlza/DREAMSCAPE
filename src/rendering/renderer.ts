import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import type { RenderMode, QualityPreset, QualitySettings } from '../utils/types.js';
import { QUALITY_PRESETS } from '../utils/types.js';
import { getSymbolPalette, type SymbolPaletteName } from '../utils/colors.js';
import symbolVertexShader from '../shaders/symbol-vertex.glsl?raw';
import symbolFragmentShader from '../shaders/symbol-fragment.glsl?raw';
import dreamVertexShader from '../shaders/dream-vertex.glsl?raw';
import dreamFragmentShader from '../shaders/dream-fragment.glsl?raw';
import postVertexShader from '../shaders/post-vertex.glsl?raw';
import postFragmentShader from '../shaders/post-fragment.glsl?raw';
import waterVertexShader from '../shaders/water-vertex.glsl?raw';
import waterFragmentShader from '../shaders/water-fragment.glsl?raw';

const BLOOM_EXTRACT_FRAGMENT = `
uniform sampler2D tDiffuse;
uniform float threshold;
uniform float knee;
varying vec2 vUv;

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  vec3 bright = max(vec3(0.0), color - threshold) / max(vec3(0.001), color + knee);
  bright = color * bright * bright;
  gl_FragColor = vec4(bright, 1.0);
}
`;

const BLUR_HORIZONTAL_FRAGMENT = `
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
`;

const BLUR_VERTICAL_FRAGMENT = `
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
`;

export class Renderer extends EventEmitter {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;
  public scene: THREE.Scene;
  public symbolScene: THREE.Scene;

  private renderMode: RenderMode = 'dream';
  private quality: QualityPreset = 'auto';
  private qualitySettings: QualitySettings;

  // Dream mode
  private dreamMaterials: Map<string, THREE.Material> = new Map();
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private renderTarget: THREE.WebGLRenderTarget;
  private bloomTarget: THREE.WebGLRenderTarget;
  private pingPongTarget: THREE.WebGLRenderTarget;
  private bloomExtractMaterial: THREE.ShaderMaterial;
  private blurHorizontalMaterial: THREE.ShaderMaterial;
  private blurVerticalMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  private quad: THREE.Mesh;

  // Symbol mode
  private symbolMaterial: THREE.ShaderMaterial;
  private glyphAtlas: THREE.Texture;
  private symbolMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 500000;
  private currentPalette: SymbolPaletteName = 'dreamscape';

  // Water
  private waterMaterial: THREE.ShaderMaterial;
  private waterUniforms: any;
  private noiseTexture: THREE.Texture;

  // Time
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    super();
    this.canvas = canvas;
    this.qualitySettings = QUALITY_PRESETS[this.quality];

    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 500);

    this.scene = new THREE.Scene();
    this.symbolScene = new THREE.Scene();

    this.initMaterials();
    this.initPostProcessing(width, height);
    this.initSymbolMode();
    this.initWater();
    this.initGlyphAtlas();
  }

  async init(): Promise<void> {
    await this.loadTextures();
    if (this.waterUniforms) {
      this.waterUniforms.noiseTexture.value = this.noiseTexture;
    }
    this.buildGlyphAtlas();
  }

  private async loadTextures(): Promise<void> {
    const loader = new THREE.TextureLoader();
    const baseUrl = import.meta.env.BASE_URL || '/';
    const noiseUrl = `${baseUrl}textures/noise.png`;

    try {
      this.noiseTexture = await new Promise<THREE.Texture>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Texture load timeout')), 3000);
        loader.load(
          noiseUrl,
          (texture) => {
            clearTimeout(timer);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            resolve(texture);
          },
          undefined,
          (error) => {
            clearTimeout(timer);
            reject(error);
          }
        );
      });
    } catch {
      console.warn('[Renderer] Failed to load noise texture, using procedural');
      this.createProceduralNoiseTexture();
    }

    if (!this.noiseTexture) {
      this.createProceduralNoiseTexture();
    }
  }

  private createProceduralNoiseTexture(): void {
    const size = 256;
    const data = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
      data[i] = Math.floor(Math.random() * 255);
    }
    this.noiseTexture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    this.noiseTexture.needsUpdate = true;
  }

  private initMaterials(): void {
    this.dreamMaterials.set('default', new THREE.ShaderMaterial({
      vertexShader: dreamVertexShader,
      fragmentShader: dreamFragmentShader,
      uniforms: {
        baseColor: { value: new THREE.Color(0x8ba4b8) },
        ambientColor: { value: new THREE.Color(0x4a5d70) },
        sunColor: { value: new THREE.Color(0xfff0d8) },
        sunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        fogColor: { value: new THREE.Color(0x7a9cc6) },
        fogNear: { value: 30 },
        fogFar: { value: 220 },
        fogDensity: { value: 0.002 },
        time: { value: 0 },
        windStrength: { value: 1.0 },
        windDirection: { value: new THREE.Vector3(1, 0, 0.5).normalize() },
        baseTexture: { value: null },
        hasBaseTexture: { value: 0.0 },
        materialType: { value: 0 },
        emissiveColor: { value: new THREE.Color(0xffb84d) },
        emissiveIntensity: { value: 0 },
        metalness: { value: 0 },
        roughness: { value: 0.8 },
        resolution: { value: new THREE.Vector2(window.innerWidth || 1280, window.innerHeight || 720) }
      },
      lights: false,
      fog: false
    }));

    this.dreamMaterials.set('standard', new THREE.MeshStandardMaterial({
      color: 0x8ba4b8,
      roughness: 0.8,
      metalness: 0.1
    }));
  }

  private initPostProcessing(width: number, height: number): void {
    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false
    };

    const halfW = Math.max(1, Math.floor(width / 2));
    const halfH = Math.max(1, Math.floor(height / 2));

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.bloomTarget = new THREE.WebGLRenderTarget(halfW, halfH, rtOptions);
    this.pingPongTarget = new THREE.WebGLRenderTarget(halfW, halfH, rtOptions);

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial()
    );
    this.postScene.add(this.quad);

    this.bloomExtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.85 },
        knee: { value: 0.1 }
      },
      vertexShader: postVertexShader,
      fragmentShader: BLOOM_EXTRACT_FRAGMENT
    });

    this.blurHorizontalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        hBlurSize: { value: 1.0 },
        texelSize: { value: new THREE.Vector2(1 / halfW, 1 / halfH) }
      },
      vertexShader: postVertexShader,
      fragmentShader: BLUR_HORIZONTAL_FRAGMENT
    });

    this.blurVerticalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        vBlurSize: { value: 1.0 },
        texelSize: { value: new THREE.Vector2(1 / halfW, 1 / halfH) }
      },
      vertexShader: postVertexShader,
      fragmentShader: BLUR_VERTICAL_FRAGMENT
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        tBloom: { value: this.bloomTarget.texture },
        exposure: { value: 1.0 },
        contrast: { value: 1.05 },
        saturation: { value: 1.0 },
        temperature: { value: 0.05 },
        tint: { value: 0.0 },
        vignetteAmount: { value: 0.3 },
        grainAmount: { value: 0.01 },
        time: { value: 0 },
        enableBloom: { value: true },
        enableColorGrading: { value: true },
        enableVignette: { value: true },
        enableGrain: { value: true }
      },
      vertexShader: postVertexShader,
      fragmentShader: postFragmentShader
    });

    this.quad.material = this.compositeMaterial;
  }

  private initSymbolMode(): void {
    this.symbolMaterial = new THREE.ShaderMaterial({
      vertexShader: symbolVertexShader,
      fragmentShader: symbolFragmentShader,
      uniforms: {
        glyphAtlas: { value: null },
        paletteBG: { value: new THREE.Color(0x14101a) },
        paletteFG: { value: new THREE.Color(0xe8d0f0) },
        paletteDim: { value: new THREE.Color(0x8a70a0) },
        paletteAccent: { value: new THREE.Color(0xffb8e8) },
        paletteAccent2: { value: new THREE.Color(0xb8e8ff) },
        paletteAccent3: { value: new THREE.Color(0xe8ffb8) },
        contrast: { value: 1.2 },
        glowIntensity: { value: 0.1 },
        flickerSpeed: { value: 0.3 },
        time: { value: 0 },
        density: { value: 1.0 },
        enableFog: { value: true },
        fogColor: { value: new THREE.Color(0x14101a) },
        fogNear: { value: 50 },
        fogFar: { value: 200 },
        symbolSize: { value: 0.15 }
      },
      transparent: true,
      depthWrite: true,
      depthTest: true
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    const instanceGeometry = new THREE.InstancedBufferGeometry();
    instanceGeometry.index = geometry.index;
    instanceGeometry.attributes.position = geometry.attributes.position;
    instanceGeometry.attributes.uv = geometry.attributes.uv;
    instanceGeometry.attributes.normal = geometry.attributes.normal;

    this.symbolMesh = new THREE.InstancedMesh(
      instanceGeometry,
      this.symbolMaterial,
      this.maxInstances
    );
    this.symbolMesh.frustumCulled = false;
    this.symbolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.symbolMesh.count = 0;
    this.symbolScene.add(this.symbolMesh);
  }

  private initWater(): void {
    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        waterColorShallow: { value: new THREE.Color(0x4a8cc6) },
        waterColorDeep: { value: new THREE.Color(0x2a5a8c) },
        sunColor: { value: new THREE.Color(0xfff0d8) },
        sunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        fogColor: { value: new THREE.Color(0x7a9cc6) },
        fogNear: { value: 30 },
        fogFar: { value: 200 },
        time: { value: 0 },
        noiseTexture: { value: this.noiseTexture },
        clarity: { value: 0.7 }
      },
      transparent: true,
      depthWrite: false,
      lights: false
    });
    this.waterUniforms = this.waterMaterial.uniforms;
  }

  private initGlyphAtlas(): void {
    const atlasSize = 1024;
    const glyphSize = atlasSize / 16;
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, atlasSize, atlasSize);
    ctx.fillStyle = '#fff';
    ctx.font = `${glyphSize * 0.7}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const glyphs = [
      '█', '▓', '▒', '░', '▄', '▀', '▌', '▐', '▀', '▄', '■', '□', '◆', '◇', '●', '○',
      '▲', '▼', '◄', '►', '◆', '◇', '◈', '⬦', '⬢', '⬡', '⬣', '⬠', '⬟', '⬢', '⬡', '⬣',
      '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '╬', '╭', '╮', '╯', '╰', '━',
      '┃', '┏', '┓', '┗', '┛', '┣', '┫', '┳', '┻', '╋', '━', '┃', '━', '┃', '━', '┃',
      '·', '•', '◦', '∘', '⋆', '⋇', '⋈', '⋉', '⋊', '⋋', '⋌', '⋍', '⋎', '⋏', '⋐', '⋑',
      '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁', ' ',
      '⠁', '⠂', '⠃', '⠄', '⠅', '⠆', '⠇', '⠈', '⠉', '⠊', '⠋', '⠌', '⠍', '⠎', '⠏', '⠐',
      '⠑', '⠒', '⠓', '⠔', '⠕', '⠖', '⠗', '⠘', '⠙', '⠚', '⠛', '⠜', '⠝', '⠞', '⠟', '⠠',
      '⠡', '⠢', '⠣', '⠤', '⠥', '⠦', '⠧', '⠨', '⠩', '⠪', '⠫', '⠬', '⠭', '⠮', '⠯', '⠰',
      '⠱', '⠲', '⠳', '⠴', '⠵', '⠶', '⠷', '⠸', '⠹', '⠺', '⠻', '⠼', '⠽', '⠾', '⠿', ' ',
      '▢', '▣', '▤', '▥', '▦', '▧', '▨', '▩', '▪', '▫', '▬', '▭', '▮', '▯', '▰', '▱',
      '⬜', '⬛', '◼', '◻', '◾', '◽', '▪', '▫', '■', '□', '▣', '▢', '▤', '▥', '▦', '▧',
      '╌', '╍', '╎', '╏', '═', '║', '╒', '╓', '╕', '╖', '╘', '╙', '╛', '╜', '╞', '╟',
      '╠', '╡', '╢', '╣', '╤', '╥', '╦', '╧', '╨', '╩', '╪', '╫', '╬', '╭', '╮', '╯',
      '╰', '╱', '╲', '╳', '╴', '╵', '╶', '╷', '╸', '╹', '╺', '╻', '╼', '╽', '╾', '╿'
    ];

    for (let i = 0; i < 256; i++) {
      const col = i % 16;
      const row = Math.floor(i / 16);
      const x = col * glyphSize + glyphSize / 2;
      const y = row * glyphSize + glyphSize / 2;
      const glyph = glyphs[i % glyphs.length];
      ctx.fillText(glyph, x, y);
    }

    this.glyphAtlas = new THREE.CanvasTexture(canvas);
    this.glyphAtlas.wrapS = THREE.ClampToEdgeWrapping;
    this.glyphAtlas.wrapT = THREE.ClampToEdgeWrapping;
    this.glyphAtlas.minFilter = THREE.LinearFilter;
    this.glyphAtlas.magFilter = THREE.LinearFilter;
    this.glyphAtlas.needsUpdate = true;

    this.symbolMaterial.uniforms.glyphAtlas.value = this.glyphAtlas;
  }

  private buildGlyphAtlas(): void {
    // Already built in initGlyphAtlas
  }

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const halfW = Math.max(1, Math.floor(width / 2));
    const halfH = Math.max(1, Math.floor(height / 2));

    this.renderTarget.setSize(width, height);
    this.bloomTarget.setSize(halfW, halfH);
    this.pingPongTarget.setSize(halfW, halfH);
    this.blurHorizontalMaterial.uniforms.texelSize.value.set(1 / halfW, 1 / halfH);
    this.blurVerticalMaterial.uniforms.texelSize.value.set(1 / halfW, 1 / halfH);

    const defaultMat = this.dreamMaterials.get('default');
    if (defaultMat instanceof THREE.ShaderMaterial && defaultMat.uniforms.resolution) {
      defaultMat.uniforms.resolution.value.set(width, height);
    }
  }

  setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;
    if (mode === 'symbols') {
      this.updateSymbolPalette(this.currentPalette);
    }
  }

  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    this.qualitySettings = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
    this.renderer.shadowMap.enabled = this.qualitySettings.enableShadows;

    if (this.symbolMaterial) {
      this.symbolMaterial.uniforms.density.value = this.qualitySettings.symbolDensity;
      this.symbolMaterial.uniforms.symbolSize.value = 0.15 * this.qualitySettings.symbolSize;
    }

    if (this.compositeMaterial) {
      this.compositeMaterial.uniforms.enableBloom.value = this.qualitySettings.enablePostProcessing;
      this.compositeMaterial.uniforms.enableColorGrading.value = this.qualitySettings.enablePostProcessing;
    }
  }

  setSymbolPalette(name: SymbolPaletteName): void {
    this.currentPalette = name;
    this.updateSymbolPalette(name);
  }

  private updateSymbolPalette(name: SymbolPaletteName): void {
    const palette: any = getSymbolPalette(name);
    this.symbolMaterial.uniforms.paletteBG.value = palette.bg;
    this.symbolMaterial.uniforms.paletteFG.value = palette.fg;
    this.symbolMaterial.uniforms.paletteDim.value = palette.dim;
    this.symbolMaterial.uniforms.paletteAccent.value = palette.accent;
    this.symbolMaterial.uniforms.paletteAccent2.value = palette.accent2 || palette.accent;
    this.symbolMaterial.uniforms.paletteAccent3.value = palette.accent3 || palette.accent;
    this.symbolMaterial.uniforms.fogColor.value = palette.bg;
  }

  updateSymbolInstances(worldObjects: any[]): void {
    if (!this.symbolMesh) return;

    const geom = this.symbolMesh.geometry as THREE.InstancedBufferGeometry;

    if (!geom.attributes.instancePosition) {
      geom.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances * 3), 3));
      geom.setAttribute('instanceNormal', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances * 3), 3));
      geom.setAttribute('instanceUV', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances * 2), 2));
      geom.setAttribute('instanceMaterial', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances), 1));
      geom.setAttribute('instanceDepth', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances), 1));
    }

    const posAttr = geom.attributes.instancePosition as THREE.InstancedBufferAttribute;
    const norAttr = geom.attributes.instanceNormal as THREE.InstancedBufferAttribute;
    const uvAttr = geom.attributes.instanceUV as THREE.InstancedBufferAttribute;
    const matAttr = geom.attributes.instanceMaterial as THREE.InstancedBufferAttribute;
    const depAttr = geom.attributes.instanceDepth as THREE.InstancedBufferAttribute;

    const posArr = posAttr.array as Float32Array;
    const norArr = norAttr.array as Float32Array;
    const uvArr = uvAttr.array as Float32Array;
    const matArr = matAttr.array as Float32Array;
    const depArr = depAttr.array as Float32Array;

    let instanceCursor = 0;

    for (const item of worldObjects) {
      const data = item?.symbolData || item;
      if (!data || !Array.isArray(data.positions)) continue;

      const pos: number[] = data.positions;
      const nor: number[] = data.normals || [];
      const uv: number[] = data.uvs || [];
      const matIds: number[] = data.materials || data.material || [];
      const depth: number[] = data.depth || [];

      const objCount = Math.floor(pos.length / 3);
      for (let i = 0; i < objCount && instanceCursor < this.maxInstances; i++) {
        const i3 = i * 3;
        const i2 = i * 2;
        const c3 = instanceCursor * 3;
        const c2 = instanceCursor * 2;

        posArr[c3] = pos[i3] ?? 0;
        posArr[c3 + 1] = pos[i3 + 1] ?? 0;
        posArr[c3 + 2] = pos[i3 + 2] ?? 0;

        norArr[c3] = nor[i3] ?? 0;
        norArr[c3 + 1] = nor[i3 + 1] ?? 1;
        norArr[c3 + 2] = nor[i3 + 2] ?? 0;

        uvArr[c2] = uv[i2] ?? 0;
        uvArr[c2 + 1] = uv[i2 + 1] ?? 0;

        matArr[instanceCursor] = matIds[i] ?? 3;
        depArr[instanceCursor] = depth[i] ?? 0;

        instanceCursor++;
      }

      if (instanceCursor >= this.maxInstances) break;
    }

    this.symbolMesh.count = instanceCursor;
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    matAttr.needsUpdate = true;
    depAttr.needsUpdate = true;
  }

  render(camera: THREE.Camera, scene: THREE.Scene, mode: RenderMode): void {
    this.time += 1 / 60;
    this.updateTimeUniforms();

    if (mode === 'dream') {
      this.renderDreamMode(camera, scene);
    } else {
      this.renderSymbolMode(camera, scene);
    }
  }

  private updateTimeUniforms(): void {
    const t = this.time;

    for (const mat of this.dreamMaterials.values()) {
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms.time) {
        mat.uniforms.time.value = t;
      }
    }

    if (this.waterUniforms?.time) {
      this.waterUniforms.time.value = t;
    }

    this.symbolMaterial.uniforms.time.value = t;
    this.compositeMaterial.uniforms.time.value = t;
  }

  private renderDreamMode(camera: THREE.Camera, scene: THREE.Scene): void {
    if (this.qualitySettings.enablePostProcessing) {
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(scene, camera);

      this.renderer.setRenderTarget(this.bloomTarget);
      this.quad.material = this.bloomExtractMaterial;
      this.bloomExtractMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
      this.renderer.render(this.postScene, this.postCamera);

      this.quad.material = this.blurHorizontalMaterial;
      this.blurHorizontalMaterial.uniforms.tDiffuse.value = this.bloomTarget.texture;
      this.renderer.setRenderTarget(this.pingPongTarget);
      this.renderer.render(this.postScene, this.postCamera);

      this.quad.material = this.blurVerticalMaterial;
      this.blurVerticalMaterial.uniforms.tDiffuse.value = this.pingPongTarget.texture;
      this.renderer.setRenderTarget(this.bloomTarget);
      this.renderer.render(this.postScene, this.postCamera);

      this.renderer.setRenderTarget(null);
      this.quad.material = this.compositeMaterial;
      this.compositeMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
      this.compositeMaterial.uniforms.tBloom.value = this.bloomTarget.texture;
      this.renderer.render(this.postScene, this.postCamera);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
    }
  }

  private renderSymbolMode(camera: THREE.Camera, _scene: THREE.Scene): void {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.symbolScene, camera);
  }

  getWaterMaterial(): THREE.ShaderMaterial {
    return this.waterMaterial;
  }

  getDreamMaterial(name: string): THREE.Material | undefined {
    return this.dreamMaterials.get(name);
  }

  createDreamMaterial(params: Record<string, any>): THREE.ShaderMaterial {
    const baseMat = this.dreamMaterials.get('default') as THREE.ShaderMaterial;
    const mat = baseMat.clone();
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'color' && mat.uniforms.baseColor) {
        mat.uniforms.baseColor.value = value instanceof THREE.Color ? value.clone() : new THREE.Color(value);
      } else if (key === 'emissive' && mat.uniforms.emissiveColor) {
        mat.uniforms.emissiveColor.value = value instanceof THREE.Color ? value.clone() : new THREE.Color(value);
      } else if (key === 'baseTexture' && value) {
        mat.uniforms.baseTexture.value = value;
        mat.uniforms.hasBaseTexture.value = 1.0;
      } else if (mat.uniforms[key]) {
        mat.uniforms[key].value = value;
      }
    });
    return mat;
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderTarget.dispose();
    this.bloomTarget.dispose();
    this.pingPongTarget.dispose();
    this.glyphAtlas.dispose();
    this.noiseTexture.dispose();

    for (const mat of this.dreamMaterials.values()) {
      mat.dispose();
    }
    this.symbolMaterial.dispose();
    this.waterMaterial.dispose();
    this.bloomExtractMaterial.dispose();
    this.blurHorizontalMaterial.dispose();
    this.blurVerticalMaterial.dispose();
    this.compositeMaterial.dispose();

    if (this.symbolMesh) {
      this.symbolMesh.geometry.dispose();
    }
  }
}