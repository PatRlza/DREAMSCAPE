import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import type { RenderMode, QualityPreset, QualitySettings } from '../utils/types.js';
import { QUALITY_PRESETS } from '../utils/types.js';
import { PALETTE, getSymbolPalette, type SymbolPaletteName } from '../utils/colors.js';
import symbolVertexShader from '../shaders/symbol-vertex.glsl?raw';
import symbolFragmentShader from '../shaders/symbol-fragment.glsl?raw';
import dreamVertexShader from '../shaders/dream-vertex.glsl?raw';
import dreamFragmentShader from '../shaders/dream-fragment.glsl?raw';
import postVertexShader from '../shaders/post-vertex.glsl?raw';
import postFragmentShader from '../shaders/post-fragment.glsl?raw';
import bloomFragmentShader from '../shaders/bloom-fragment.glsl?raw';
import waterVertexShader from '../shaders/water-vertex.glsl?raw';
import waterFragmentShader from '../shaders/water-fragment.glsl?raw';

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
  private bloomExtractMaterial: THREE.ShaderMaterial;
  private blurHorizontalMaterial: THREE.ShaderMaterial;
  private blurVerticalMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  
  // Symbol mode
  private symbolMaterial: THREE.ShaderMaterial;
  private glyphAtlas: THREE.Texture;
  private symbolMesh: THREE.InstancedMesh | null = null;
  private symbolInstanceCount = 0;
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
    
    // Main renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // physicallyCorrectLights deprecated in r155+
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    
    // Scenes
    this.scene = new THREE.Scene();
    this.symbolScene = new THREE.Scene();
    
    this.initMaterials();
    this.initPostProcessing();
    this.initSymbolMode();
    this.initWater();
    this.initGlyphAtlas();
  }
  
  async init(): Promise<void> {
    // Load textures
    await this.loadTextures();
    this.buildGlyphAtlas();
  }
  
  private async loadTextures(): Promise<void> {
    const loader = new THREE.TextureLoader();
    
    // Noise texture for water/symbols
    this.noiseTexture = loader.load('/textures/noise.png');
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    
    // Create procedural noise if file doesn't exist
    this.createProceduralNoiseTexture();
  }
  
  private createProceduralNoiseTexture(): void {
    const size = 512;
    const data = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
      data[i] = Math.random() * 255;
    }
    this.noiseTexture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    this.noiseTexture.needsUpdate = true;
  }
  
  private initMaterials(): void {
    // Dream mode custom shader material
    this.dreamMaterials.set('default', new THREE.ShaderMaterial({
      vertexShader: dreamVertexShader,
      fragmentShader: dreamFragmentShader,
      uniforms: {
        ambientColor: { value: new THREE.Color(0x3a4a5a) },
        sunColor: { value: new THREE.Color(0xfff0d8) },
        sunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        fogColor: { value: new THREE.Color(0x7a9cc6) },
        fogNear: { value: 30 },
        fogFar: { value: 200 },
        fogDensity: { value: 0.002 },
        time: { value: 0 },
        baseTexture: { value: null },
        normalTexture: { value: null },
        roughnessTexture: { value: null },
        materialType: { value: 0 },
        emissiveColor: { value: new THREE.Color(0xffb84d) },
        emissiveIntensity: { value: 0 },
        metalness: { value: 0 },
        roughness: { value: 0.8 }
      },
      lights: true,
      fog: false // We handle fog in shader
    }));
    
    // Standard materials for fallback
    this.dreamMaterials.set('standard', new THREE.MeshStandardMaterial({
      color: 0x8ba4b8,
      roughness: 0.8,
      metalness: 0.1
    }));
  }
  
  private initPostProcessing(): void {
    // Render targets
    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false
    };
    
    this.renderTarget = new THREE.WebGLRenderTarget(
      this.canvas.width, this.canvas.height, rtOptions
    );
    this.bloomTarget = new THREE.WebGLRenderTarget(
      this.canvas.width / 2, this.canvas.height / 2, rtOptions
    );
    
    // Post quad
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial()
    );
    this.postScene.add(this.quad);
    
    // Bloom extraction
    this.bloomExtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.85 },
        knee: { value: 0.1 }
      },
      vertexShader: postVertexShader,
      fragmentShader: bloomFragmentShader.split('// Horizontal blur')[0]
    });
    
    // Blur materials
    this.blurHorizontalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        hBlurSize: { value: 1.0 },
        texelSize: { value: new THREE.Vector2(1/512, 1/512) }
      },
      vertexShader: postVertexShader,
      fragmentShader: bloomFragmentShader.split('// Horizontal blur')[1].split('// Vertical blur')[0]
    });
    
    this.blurVerticalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        vBlurSize: { value: 1.0 },
        texelSize: { value: new THREE.Vector2(1/512, 1/512) }
      },
      vertexShader: postVertexShader,
      fragmentShader: bloomFragmentShader.split('// Vertical blur')[1]
    });
    
    // Composite
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
        cameraPosition: { value: new THREE.Vector3() },
        symbolSize: { value: 0.15 },
        projectionMatrix: { value: new THREE.Matrix4() },
        viewMatrix: { value: new THREE.Matrix4() },
        modelMatrix: { value: new THREE.Matrix4() }
      },
      transparent: true,
      depthWrite: true,
      depthTest: true
    });
    
    // Create instanced mesh for symbols
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
      lights: true
    });
    this.waterUniforms = this.waterMaterial.uniforms;
  }
  
  private initGlyphAtlas(): void {
    // Create a procedural glyph atlas (16x16 glyphs)
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
    // Already done in initGlyphAtlas
  }
  
  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderTarget.setSize(width, height);
    this.bloomTarget.setSize(width / 2, height / 2);
    this.blurHorizontalMaterial.uniforms.texelSize.value.set(2/width, 2/height);
    this.blurVerticalMaterial.uniforms.texelSize.value.set(2/width, 2/height);
  }
  
  setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;
    if (mode === 'symbols') {
      this.updateSymbolPalette(this.currentPalette);
    }
  }
  
  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    this.qualitySettings = QUALITY_PRESETS[quality];
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
    
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const materials: number[] = [];
    const depths: number[] = [];
    
    for (const obj of worldObjects) {
      if (!obj.symbolData) continue;
      
      const { positions: pos, normals: nor, uvs: uv, material, depth } = obj.symbolData;
      positions.push(...pos);
      normals.push(...nor);
      uvs.push(...uv);
      materials.push(...material);
      depths.push(...depth);
    }
    
    const count = positions.length / 3;
    this.symbolMesh.count = Math.min(count, this.maxInstances);
    
    // Update instance attributes
    const geom = this.symbolMesh.geometry as THREE.InstancedBufferGeometry;
    
    if (!geom.attributes.instancePosition || geom.attributes.instancePosition.count < count) {
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
    
    posAttr.array.set(positions);
    norAttr.array.set(normals);
    uvAttr.array.set(uvs);
    matAttr.array.set(materials);
    depAttr.array.set(depths);
    
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    matAttr.needsUpdate = true;
    depAttr.needsUpdate = true;
  }
  
  render(camera: THREE.Camera, scene: THREE.Scene, mode: RenderMode): void {
    this.time += 1/60;
    
    // Update time uniforms
    this.updateTimeUniforms();
    
    if (mode === 'dream') {
      this.renderDreamMode(camera, scene);
    } else {
      this.renderSymbolMode(camera, scene);
    }
  }
  
  private updateTimeUniforms(): void {
    const t = this.time;
    
    // Dream materials
    for (const mat of this.dreamMaterials.values()) {
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms.time) {
        mat.uniforms.time.value = t;
      }
    }
    
    // Water
    this.waterUniforms.time.value = t;
    
    // Symbol
    this.symbolMaterial.uniforms.time.value = t;
    this.symbolMaterial.uniforms.cameraPosition.value.copy(this.camera.position);
    
    // Post
    this.compositeMaterial.uniforms.time.value = t;
  }
  
  private renderDreamMode(camera: THREE.Camera, scene: THREE.Scene): void {
    if (this.qualitySettings.enablePostProcessing) {
      // Render to target
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(scene, camera);
      
      // Bloom extraction
      this.renderer.setRenderTarget(this.bloomTarget);
      this.quad.material = this.bloomExtractMaterial;
      this.bloomExtractMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
      this.renderer.render(this.postScene, this.postCamera);
      
      // Horizontal blur
      const pingPongTarget = new THREE.WebGLRenderTarget(
        this.bloomTarget.width, this.bloomTarget.height
      );
      this.quad.material = this.blurHorizontalMaterial;
      this.blurHorizontalMaterial.uniforms.tDiffuse.value = this.bloomTarget.texture;
      this.renderer.setRenderTarget(pingPongTarget);
      this.renderer.render(this.postScene, this.postCamera);
      
      // Vertical blur
      this.quad.material = this.blurVerticalMaterial;
      this.blurVerticalMaterial.uniforms.tDiffuse.value = pingPongTarget.texture;
      this.renderer.setRenderTarget(this.bloomTarget);
      this.renderer.render(this.postScene, this.postCamera);
      
      // Composite
      this.renderer.setRenderTarget(null);
      this.quad.material = this.compositeMaterial;
      this.compositeMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
      this.compositeMaterial.uniforms.tBloom.value = this.bloomTarget.texture;
      this.renderer.render(this.postScene, this.postCamera);
      
      pingPongTarget.dispose();
    } else {
      // Direct render
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
    }
  }
  
  private renderSymbolMode(camera: THREE.Camera, scene: THREE.Scene): void {
    // Update symbol mesh matrices
    this.symbolMaterial.uniforms.projectionMatrix.value.copy(camera.projectionMatrix);
    this.symbolMaterial.uniforms.viewMatrix.value.copy(camera.matrixWorldInverse);
    this.symbolMaterial.uniforms.modelMatrix.value.identity();
    
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
      if (mat.uniforms[key]) mat.uniforms[key].value = value;
    });
    return mat;
  }
  
  dispose(): void {
    this.renderer.dispose();
    this.renderTarget.dispose();
    this.bloomTarget.dispose();
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