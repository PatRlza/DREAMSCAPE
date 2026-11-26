import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import { ZoneGenerator } from './zone-generator.js';
import { DemoScenario } from './demo-scenario.js';
import type { ZoneData, ZoneTheme, WorldObjectData, TransitionData, GameMode } from '../utils/types.js';
import { Renderer } from '../rendering/renderer.js';
import { PALETTE, ZONE_THEME_COLORS, getZoneThemeColors, type ZoneTheme as ZoneThemeName } from '../utils/colors.js';

interface LoadedZone {
  data: ZoneData;
  meshes: THREE.Mesh[];
  transitionTriggers: THREE.Mesh[];
}

export class WorldManager extends EventEmitter {
  private renderer: Renderer;
  public scene: THREE.Scene;
  
  private zones: Map<string, LoadedZone> = new Map();
  private currentZoneId: string | null = null;
  private previousZoneId: string | null = null;
  private visitedZones: string[] = [];
  private zoneGenerator: ZoneGenerator;
  private rng: SeededRNG;
  private gameMode: GameMode = 'journey';
  private zoneIndex = 0;
  private seed: string;
  private generatorVersion = 1;
  
  // Streaming
  private preloadQueue: string[] = [];
  private maxLoadedZones = 3;
  
  // Theme tracking for variety
  private recentThemes: ZoneThemeName[] = [];
  private recentPuzzleTypes: string[] = [];
  private recentTransitions: string[] = [];
  
  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.zoneGenerator = new ZoneGenerator();
    this.rng = new SeededRNG('');
  }
  
  async generate(rng: SeededRNG, mode: GameMode, startZoneId?: string): Promise<void> {
    this.rng = rng;
    this.gameMode = mode;
    this.seed = rng.getState();
    this.zoneIndex = 0;
    this.visitedZones = [];
    this.recentThemes = [];
    this.recentPuzzleTypes = [];
    this.recentTransitions = [];
    
    // Clear existing
    this.clearScene();
    
    // For journey mode, use demo scenario for first zones
    if (mode === 'journey' && !startZoneId) {
      await this.generateDemoZones(rng);
    } else {
      // Generate first zone normally
      const firstZone = await this.generateZone(0);
      this.currentZoneId = firstZone.data.id;
      this.enterZone(firstZone.data.id);
      
      // Preload next zone
      this.preloadNextZone();
    }
  }
  
  private async generateDemoZones(rng: SeededRNG): Promise<void> {
    const demoZones = DemoScenario.generateDemoZones(rng);
    
    for (let i = 0; i < demoZones.length; i++) {
      const zoneData = demoZones[i];
      
      // Track theme variety
      this.recentThemes.push(zoneData.theme.primary as ZoneThemeName);
      if (this.recentThemes.length > 5) this.recentThemes.shift();
      
      // Build meshes
      const meshes = await this.buildZoneMeshes(zoneData);
      const transitionTriggers = this.buildTransitionTriggers(zoneData);
      
      const loadedZone: LoadedZone = {
        data: zoneData,
        meshes,
        transitionTriggers
      };
      
      this.zones.set(zoneData.id, loadedZone);
      this.zoneIndex = i;
    }
    
    // Enter first zone
    this.currentZoneId = demoZones[0].id;
    this.enterZone(demoZones[0].id);
    
    // Preload next zone (will be procedurally generated)
    this.preloadNextZone();
  }
  
  private async generateZone(index: number): Promise<LoadedZone> {
    const contextRng = this.rng.fork(`zone_${index}`);
    
    const context = {
      rng: contextRng,
      zoneIndex: index,
      previousTheme: this.recentThemes[this.recentThemes.length - 1],
      visitedThemes: [...this.recentThemes],
      gameMode: this.gameMode
    };
    
    const zoneData = this.zoneGenerator.generate(context);
    
    // Track theme variety
    this.recentThemes.push(zoneData.theme.primary as ZoneThemeName);
    if (this.recentThemes.length > 5) this.recentThemes.shift();
    
    // Build meshes
    const meshes = await this.buildZoneMeshes(zoneData);
    const transitionTriggers = this.buildTransitionTriggers(zoneData);
    
    const loadedZone: LoadedZone = {
      data: zoneData,
      meshes,
      transitionTriggers
    };
    
    this.zones.set(zoneData.id, loadedZone);
    return loadedZone;
  }
  
  private async buildZoneMeshes(zoneData: ZoneData): Promise<THREE.Mesh[]> {
    const meshes: THREE.Mesh[] = [];
    const themeColors = getZoneThemeColors(zoneData.theme.primary as ZoneThemeName);
    
    // Apply zone atmosphere
    this.applyZoneAtmosphere(zoneData.theme, themeColors);
    
    for (const objData of zoneData.objects) {
      const mesh = await this.createObjectMesh(objData, themeColors, zoneData.theme);
      if (mesh instanceof THREE.Mesh) {
        this.scene.add(mesh);
        meshes.push(mesh);
      }
    }
    
    return meshes;
  }
  
  private applyZoneAtmosphere(theme: ZoneTheme, colors: any): void {
    // Fog
    this.scene.fog = new THREE.FogExp2(colors.fog, 0.002);
    
    // Lighting will be set up by renderer based on theme
    this.emit('atmosphereChange', { theme, colors });
  }
  
  private async createObjectMesh(
    objData: WorldObjectData, 
    themeColors: any, 
    zoneTheme: ZoneTheme
  ): Promise<THREE.Object3D | null> {
    const { type, position, rotation, scale, data } = objData;
    
    switch (type) {
      case 'ground':
        return this.createGround(objData, themeColors);
      case 'sky':
        return this.createSky(objData, themeColors);
      case 'fog':
        return this.createFogVolume(objData);
      case 'key_object':
        return this.createKeyObject(objData, themeColors);
      default:
        return this.createProp(objData, themeColors);
    }
  }
  
  private createGround(objData: WorldObjectData, themeColors: any): THREE.Mesh {
    const { scale } = objData;
    const geometry = new THREE.PlaneGeometry(scale.x, scale.z);
    const material = this.renderer.createDreamMaterial({
      color: themeColors.ground,
      roughness: 0.9,
      metalness: 0.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(objData.position);
    mesh.receiveShadow = true;
    mesh.userData = { ...objData.data, objectId: objData.id };
    return mesh;
  }
  
  private createSky(objData: WorldObjectData, themeColors: any): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(-1, 1, 1); // Invert for inside view
    
    // Gradient sky material
    const material = this.renderer.createDreamMaterial({
      color: themeColors.sky[0],
      roughness: 1,
      metalness: 0,
      emissive: themeColors.sky[1],
      emissiveIntensity: 0.3
    });
    material.side = THREE.BackSide;
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 100;
    mesh.userData = { ...objData.data, objectId: objData.id };
    return mesh;
  }
  
  private createFogVolume(objData: WorldObjectData): THREE.Object3D {
    // Fog is handled by scene.fog, but we can add volumetric particles
    const group = new THREE.Group();
    group.position.copy(objData.position);
    group.userData = { ...objData.data, objectId: objData.id };
    return group;
  }
  
  private createKeyObject(objData: WorldObjectData, themeColors: any): THREE.Mesh {
    const { objectType } = objData.data as any;
    
    // Create geometry based on object type
    let geometry: THREE.BufferGeometry;
    const material = this.renderer.createDreamMaterial({
      color: themeColors.accent,
      roughness: 0.3,
      metalness: 0.2,
      emissive: themeColors.accent,
      emissiveIntensity: 0.2
    });
    
    switch (objectType) {
      case 'lighthouse':
        geometry = new THREE.CylinderGeometry(1, 2, 15, 8);
        break;
      case 'ancient_tree':
        geometry = new THREE.ConeGeometry(3, 12, 8);
        break;
      case 'painted_door':
        geometry = new THREE.BoxGeometry(1, 3, 0.1);
        break;
      case 'clocktower':
        geometry = new THREE.BoxGeometry(4, 20, 4);
        break;
      case 'standing_stone':
        geometry = new THREE.BoxGeometry(1, 4, 0.3);
        break;
      case 'cloud_platform':
        geometry = new THREE.BoxGeometry(5, 0.5, 5);
        break;
      case 'floating_window':
        geometry = new THREE.BoxGeometry(2, 1.5, 0.1);
        break;
      case 'moon_pool':
        geometry = new THREE.CylinderGeometry(3, 3, 0.5, 16);
        break;
      case 'departure_board':
        geometry = new THREE.BoxGeometry(3, 2, 0.2);
        break;
      case 'cable_anchor':
        geometry = new THREE.CylinderGeometry(0.5, 1, 3, 8);
        break;
      default:
        geometry = new THREE.BoxGeometry(2, 3, 2);
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(objData.position);
    mesh.rotation.copy(objData.rotation);
    mesh.scale.copy(objData.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { 
      ...objData.data, 
      objectId: objData.id, 
      interactable: true,
      interactionType: 'inspect'
    };
    
    // Add symbol data for symbol mode
    this.addSymbolData(mesh, objData);
    
    return mesh;
  }
  
  private createProp(objData: WorldObjectData, themeColors: any): THREE.Mesh | THREE.Group {
    const { type } = objData;
    let mesh: THREE.Mesh | THREE.Group;
    
    const baseMaterial = this.renderer.createDreamMaterial({
      color: themeColors.ground.clone().lerp(themeColors.fog, 0.3),
      roughness: 0.8,
      metalness: 0.1
    });
    
    switch (type) {
      case 'driftwood':
      case 'fallen_log':
        mesh = this.createDriftwood(objData, baseMaterial);
        break;
      case 'tree_thin':
      case 'tree_thick':
        mesh = this.createTree(objData, baseMaterial, type === 'tree_thick');
        break;
      case 'shell_cluster':
      case 'stone_pile':
      case 'moss_rock':
      case 'stone_marker':
        mesh = this.createRockCluster(objData, baseMaterial);
        break;
      case 'door_frame':
      case 'window_frame':
      case 'picture_frame':
        mesh = this.createFrame(objData, baseMaterial);
        break;
      case 'building_facade':
        mesh = this.createBuildingFacade(objData, baseMaterial);
        break;
      case 'tall_grass_patch':
      case 'wildflower':
      case 'reed_cluster':
        mesh = this.createFoliage(objData, baseMaterial, type);
        break;
      case 'stair_segment':
        mesh = this.createStairSegment(objData, baseMaterial);
        break;
      case 'chair':
      case 'table':
        mesh = this.createFurniture(objData, baseMaterial, type);
        break;
      case 'hedge':
        mesh = this.createHedge(objData, baseMaterial);
        break;
      case 'platform':
        mesh = this.createPlatform(objData, baseMaterial);
        break;
      case 'plank':
      case 'cable':
        mesh = this.createBridgeElement(objData, baseMaterial, type);
        break;
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), baseMaterial);
    }
    
    if (mesh instanceof THREE.Mesh) {
      mesh.position.copy(objData.position);
      mesh.rotation.copy(objData.rotation);
      mesh.scale.copy(objData.scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { ...objData.data, objectId: objData.id };
      this.addSymbolData(mesh, objData);
    } else if (mesh instanceof THREE.Group) {
      mesh.position.copy(objData.position);
      mesh.rotation.copy(objData.rotation);
      mesh.scale.copy(objData.scale);
      mesh.userData = { ...objData.data, objectId: objData.id };
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData = { ...objData.data, objectId: objData.id };
          this.addSymbolData(child, objData);
        }
      });
    }
    
    return mesh;
  }
  
  private createDriftwood(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.2, 0.4, 3, 6);
    return new THREE.Mesh(geometry, material);
  }
  
  private createTree(objData: WorldObjectData, material: THREE.Material, thick: boolean): THREE.Group {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(thick ? 0.5 : 0.2, thick ? 0.8 : 0.3, 8, 8);
    const trunk = new THREE.Mesh(trunkGeo, material);
    trunk.position.y = 4;
    group.add(trunk);
    
    const canopyGeo = new THREE.ConeGeometry(thick ? 4 : 2, thick ? 8 : 5, 8);
    const canopy = new THREE.Mesh(canopyGeo, material);
    canopy.position.y = 10;
    group.add(canopy);
    
    return group;
  }
  
  private createRockCluster(objData: WorldObjectData, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 1, 0);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 2
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(mesh);
    }
    return group;
  }
  
  private createFrame(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1.5, 2, 0.1);
    return new THREE.Mesh(geometry, material);
  }
  
  private createBuildingFacade(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(8, 12, 0.5);
    return new THREE.Mesh(geometry, material);
  }
  
  private createFoliage(objData: WorldObjectData, material: THREE.Material, type: string): THREE.Group {
    const group = new THREE.Group();
    const count = type === 'tall_grass_patch' ? 20 : 10;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.1, 0.5 + Math.random() * 0.5);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(
        (Math.random() - 0.5) * 1,
        0.25,
        (Math.random() - 0.5) * 1
      );
      mesh.rotation.y = Math.random() * Math.PI * 2;
      group.add(mesh);
    }
    return group;
  }
  
  private createStairSegment(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(3, 0.3, 1);
    return new THREE.Mesh(geometry, material);
  }
  
  private createFurniture(objData: WorldObjectData, material: THREE.Material, type: string): THREE.Mesh {
    if (type === 'chair') {
      return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), material);
    }
    return new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), material);
  }
  
  private createHedge(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(2, 1.5, 1);
    return new THREE.Mesh(geometry, material);
  }
  
  private createPlatform(objData: WorldObjectData, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(10, 0.3, 4);
    return new THREE.Mesh(geometry, material);
  }
  
  private createBridgeElement(objData: WorldObjectData, material: THREE.Material, type: string): THREE.Mesh {
    if (type === 'cable') {
      return new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 10, 6), material);
    }
    return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 2), material);
  }
  
  private addSymbolData(mesh: THREE.Mesh, objData: WorldObjectData): void {
    // Generate symbol instances for this object
    const symbolData = this.generateSymbolDataForObject(mesh, objData);
    mesh.userData.symbolData = symbolData;
  }
  
  private generateSymbolDataForObject(mesh: THREE.Mesh, objData: WorldObjectData): any {
    // Create a set of symbol instances that represent this object
    // This is a simplified version - in practice would voxelize the mesh
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    // Material ID mapping
    const materialMap: Record<string, number> = {
      ground: 11, sky: 15, fog: 8, vegetation: 1, water: 2,
      stone: 3, wood: 4, glass: 5, light: 6, metal: 8,
      fabric: 9, sand: 11, organic: 11, interactive: 12,
      player: 13, accent: 14
    };
    
    const theme = (objData.data as any)?.theme || 'default';
    const materialId = materialMap[theme] || 3;
    
    // Generate positions within bounding box
    const density = 0.02;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const materials: number[] = [];
    const depths: number[] = [];
    
    const stepsX = Math.max(1, Math.floor(size.x * density * 10));
    const stepsY = Math.max(1, Math.floor(size.y * density * 10));
    const stepsZ = Math.max(1, Math.floor(size.z * density * 10));
    
    for (let ix = 0; ix < stepsX; ix++) {
      for (let iy = 0; iy < stepsY; iy++) {
        for (let iz = 0; iz < stepsZ; iz++) {
          const x = bbox.min.x + (ix + 0.5) * size.x / stepsX;
          const y = bbox.min.y + (iy + 0.5) * size.y / stepsY;
          const z = bbox.min.z + (iz + 0.5) * size.z / stepsZ;
          
          positions.push(x, y, z);
          normals.push(0, 1, 0); // Will be overridden by shader
          uvs.push(0, 0); // Glyph UV set in shader
          materials.push(materialId);
          depths.push(y); // Sort by height
        }
      }
    }
    
    return { positions, normals, uvs, materials, depth: depths };
  }
  
  private buildTransitionTriggers(zoneData: ZoneData): THREE.Mesh[] {
    const triggers: THREE.Mesh[] = [];
    const geometry = new THREE.BoxGeometry(3, 4, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffb84d, 
      transparent: true, 
      opacity: 0.1,
      visible: false // Invisible trigger
    });
    
    for (const transition of zoneData.transitions) {
      const trigger = new THREE.Mesh(geometry, material);
      trigger.position.copy(transition.position);
      trigger.rotation.copy(transition.rotation);
      trigger.userData = { 
        transitionId: transition.id,
        toZoneId: transition.toZoneId,
        type: transition.type,
        trigger: transition.trigger,
        requiredPuzzleId: transition.requiredPuzzleId
      };
      this.scene.add(trigger);
      triggers.push(trigger);
    }
    
    return triggers;
  }
  
  private enterZone(zoneId: string): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;
    
    this.currentZoneId = zoneId;
    if (!this.visitedZones.includes(zoneId)) {
      this.visitedZones.push(zoneId);
    }
    
    // Make zone visible
    for (const mesh of zone.meshes) {
      mesh.visible = true;
    }
    for (const trigger of zone.transitionTriggers) {
      trigger.visible = true;
    }
    
    // Update symbol instances
    this.updateSymbolInstances();
    
    this.emit('zoneChanged', zoneId);
  }
  
  private exitZone(zoneId: string): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;
    
    for (const mesh of zone.meshes) {
      mesh.visible = false;
    }
    for (const trigger of zone.transitionTriggers) {
      trigger.visible = false;
    }
  }
  
  async transitionToZone(transition: TransitionData): Promise<void> {
    if (this.currentZoneId) {
      this.exitZone(this.currentZoneId);
      this.previousZoneId = this.currentZoneId;
    }
    
    // Generate next zone if needed
    let nextZone = this.zones.get(transition.toZoneId);
    if (!nextZone) {
      this.zoneIndex++;
      nextZone = await this.generateZone(this.zoneIndex);
      // Update transition target
      transition.toZoneId = nextZone.data.id;
    }
    
    this.currentZoneId = nextZone.data.id;
    this.enterZone(nextZone.data.id);
    
    // Preload another zone
    this.preloadNextZone();
    
    // Cleanup old zones if too many
    this.cleanupOldZones();
    
    this.emit('transitionTriggered', { 
      toZoneId: nextZone.data.id, 
      type: transition.type 
    });
  }
  
  private preloadNextZone(): void {
    if (this.zoneIndex + 1 < (this.gameMode === 'journey' ? 10 : 100)) {
      this.zoneIndex++;
      this.generateZone(this.zoneIndex).catch(console.error);
    }
  }
  
  private cleanupOldZones(): void {
    if (this.zones.size <= this.maxLoadedZones) return;
    
    // Remove oldest non-current, non-previous zones
    const toRemove: string[] = [];
    for (const [id, zone] of this.zones) {
      if (id !== this.currentZoneId && id !== this.previousZoneId) {
        toRemove.push(id);
        if (this.zones.size - toRemove.length <= this.maxLoadedZones) break;
      }
    }
    
    for (const id of toRemove) {
      const zone = this.zones.get(id);
      if (zone) {
        for (const mesh of zone.meshes) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
          } else if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          }
        }
        for (const trigger of zone.transitionTriggers) {
          this.scene.remove(trigger);
          trigger.geometry.dispose();
          if (trigger.material instanceof THREE.Material) trigger.material.dispose();
        }
        this.zones.delete(id);
      }
    }
  }
  
  private updateSymbolInstances(): void {
    const allSymbolData: any[] = [];
    
    for (const zone of this.zones.values()) {
      for (const mesh of zone.meshes) {
        if (mesh.userData.symbolData) {
          allSymbolData.push(mesh.userData.symbolData);
        }
      }
    }
    
    this.renderer.updateSymbolInstances(allSymbolData);
  }
  
  update(dt: number, playerPosition: THREE.Vector3): void {
    // Check transition triggers
    if (this.currentZoneId) {
      const zone = this.zones.get(this.currentZoneId);
      if (zone) {
        for (const trigger of zone.transitionTriggers) {
          const dist = playerPosition.distanceTo(trigger.position);
          if (dist < 2.5) {
            // Check if puzzle required
            if (trigger.userData.requiredPuzzleId) {
              // Will be checked by puzzle manager
              this.emit('transitionAvailable', trigger.userData);
            } else {
              this.transitionToZone(trigger.userData as any);
            }
            break;
          }
        }
      }
    }
  }
  
  getCurrentZoneId(): string | null {
    return this.currentZoneId;
  }
  
  getVisitedZones(): string[] {
    return [...this.visitedZones];
  }
  
  getStartPosition(): THREE.Vector3 {
    if (this.currentZoneId) {
      const zone = this.zones.get(this.currentZoneId);
      if (zone && zone.data.objects.length > 0) {
        // Find a good spawn point
        return new THREE.Vector3(0, 1.7, 10);
      }
    }
    return new THREE.Vector3(0, 1.7, 0);
  }
  
  getCurrentZoneTheme(): ZoneThemeName {
    if (this.currentZoneId) {
      const zone = this.zones.get(this.currentZoneId);
      if (zone) return zone.data.theme.primary as ZoneThemeName;
    }
    return 'shore';
  }
  
  getZoneData(zoneId: string): ZoneData | undefined {
    return this.zones.get(zoneId)?.data;
  }
  
  setObjectState(objectId: string, state: any): void {
    for (const zone of this.zones.values()) {
      for (const mesh of zone.meshes) {
        if (mesh.userData.objectId === objectId) {
          Object.assign(mesh.userData, state);
        }
      }
    }
  }
  
  getSeed(): string {
    return this.seed;
  }
  
  getGeneratorVersion(): number {
    return this.generatorVersion;
  }
  
  private clearScene(): void {
    // Dispose all zones
    for (const [, zone] of this.zones) {
      for (const mesh of zone.meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        } else if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        }
      }
      for (const trigger of zone.transitionTriggers) {
        this.scene.remove(trigger);
        trigger.geometry.dispose();
        if (trigger.material instanceof THREE.Material) trigger.material.dispose();
      }
    }
    this.zones.clear();
    this.currentZoneId = null;
    this.previousZoneId = null;
    this.visitedZones = [];
    this.zoneIndex = 0;
  }
  
  dispose(): void {
    this.clearScene();
    this.scene.clear();
  }
}