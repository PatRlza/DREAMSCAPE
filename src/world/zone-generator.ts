import * as THREE from 'three';
import { SeededRNG } from '../utils/seeded-rng.js';
import { PALETTE, ZONE_THEME_COLORS, type ZoneTheme } from '../utils/colors.js';
import type { ZoneData, ZoneTheme as ZoneThemeType, WorldObjectData, TransitionData, NavMeshData } from '../utils/types.js';
import { ZONE_THEMES, TRANSITION_TYPES, SPATIAL_RULES, LIGHTING_PRESETS, SCALE_PRESETS } from '../core/constants.js';

interface GenerationContext {
  rng: SeededRNG;
  zoneIndex: number;
  previousTheme?: ZoneTheme;
  visitedThemes: string[];
  gameMode: 'journey' | 'infinite';
}

export class ZoneGenerator {
  private static readonly THEME_WEIGHTS: Record<ZoneTheme, number> = {
    shore: 1.0, forest: 1.0, corridor: 1.0, city: 0.8,
    field: 1.0, stairs: 0.7, room: 0.9, garden: 0.8,
    station: 0.6, bridge: 0.7
  };
  
  private static readonly THEME_TRANSITIONS: Record<ZoneTheme, ZoneTheme[]> = {
    shore: ['forest', 'field', 'bridge', 'stairs'],
    forest: ['shore', 'corridor', 'city', 'garden', 'room'],
    corridor: ['forest', 'city', 'room', 'station', 'stairs'],
    city: ['forest', 'corridor', 'station', 'bridge', 'garden'],
    field: ['shore', 'forest', 'stairs', 'garden', 'room'],
    stairs: ['shore', 'corridor', 'field', 'city', 'bridge'],
    room: ['forest', 'corridor', 'city', 'field', 'garden'],
    garden: ['forest', 'city', 'field', 'room', 'station'],
    station: ['corridor', 'city', 'garden', 'bridge', 'stairs'],
    bridge: ['shore', 'city', 'station', 'stairs', 'field']
  };
  
  generate(context: GenerationContext): ZoneData {
    const theme = this.selectTheme(context);
    const zoneTheme = this.buildZoneTheme(context, theme);
    const bounds = this.calculateBounds(context, zoneTheme);
    const navMesh = this.generateNavMesh(context, zoneTheme, bounds);
    const objects = this.generateObjects(context, zoneTheme, bounds, navMesh);
    const transitions = this.generateTransitions(context, zoneTheme, bounds);
    const puzzles = []; // Will be filled by puzzle generator
    
    return {
      id: `zone_${context.zoneIndex}_${theme}`,
      theme: zoneTheme,
      bounds,
      navMesh,
      objects,
      puzzles,
      transitions,
      seed: context.rng.nextInt(0, 2147483647)
    };
  }
  
  private selectTheme(context: GenerationContext): ZoneTheme {
    const themes = ZONE_THEMES;
    let weights = themes.map(t => ZoneGenerator.THEME_WEIGHTS[t]);
    
    // Reduce weight of recently visited themes
    for (const visited of context.visitedThemes.slice(-3)) {
      const idx = themes.indexOf(visited as ZoneTheme);
      if (idx >= 0) weights[idx] *= 0.2;
    }
    
    // Boost compatible transitions from previous theme
    if (context.previousTheme) {
      const compatible = ZoneGenerator.THEME_TRANSITIONS[context.previousTheme] || [];
      for (const compat of compatible) {
        const idx = themes.indexOf(compat);
        if (idx >= 0) weights[idx] *= 1.5;
      }
    }
    
    // Normalize
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / sum);
    
    // Weighted random selection
    let r = context.rng.next();
    for (let i = 0; i < themes.length; i++) {
      r -= weights[i];
      if (r <= 0) return themes[i];
    }
    return themes[0];
  }
  
  private buildZoneTheme(context: GenerationContext, theme: ZoneTheme): ZoneThemeType {
    const rng = context.rng.fork(`theme_${theme}`);
    
    // Select secondary theme (different from primary)
    const secondaryOptions = [...ZONE_THEMES].filter(t => t !== theme);
    const secondary = rng.choose(secondaryOptions);
    
    // Lighting based on theme and progression
    const lightingOptions = [...LIGHTING_PRESETS];
    let lighting = rng.choose(lightingOptions);
    // Bias: shore/field -> golden/dawn, corridor/station -> overcast/bluehour, stairs -> dusk/night
    if (['shore', 'field', 'garden'].includes(theme)) {
      lighting = rng.choose(['dawn', 'golden', 'day', 'bluehour']);
    } else if (['corridor', 'station', 'room'].includes(theme)) {
      lighting = rng.choose(['overcast', 'bluehour', 'night', 'dusk']);
    } else if (theme === 'stairs') {
      lighting = rng.choose(['dusk', 'night', 'bluehour']);
    }
    
    // Scale
    const scale = rng.choose([...SCALE_PRESETS]);
    
    // Spatial rule
    let spatialRule = rng.choose([...SPATIAL_RULES]);
    // Intimate spaces more likely euclidean, vast more likely impossible
    if (scale === 'intimate') spatialRule = rng.nextBool(0.8) ? 'euclidean' : 'folded';
    if (scale === 'vast' || scale === 'towering') spatialRule = rng.nextBool(0.6) ? 'impossible' : 'looped';
    
    // Key object
    const keyObjects = this.getKeyObjectsForTheme(theme);
    const keyObject = rng.choose(keyObjects);
    
    // Transition type
    const transitionType = rng.choose([...TRANSITION_TYPES]);
    
    return {
      name: theme,
      primary: theme,
      secondary,
      lighting,
      scale,
      spatialRule,
      keyObject,
      transitionType
    };
  }
  
  private getKeyObjectsForTheme(theme: ZoneTheme): string[] {
    const objects: Record<ZoneTheme, string[]> = {
      shore: ['lighthouse', 'driftwood_gate', 'shell_shrine', 'tide_pool', 'beached_boat'],
      forest: ['ancient_tree', 'window_grove', 'glowing_fungi', 'stone_circle', 'hollow_log'],
      corridor: ['painted_door', 'window_sequence', 'clock_mechanism', 'mirror_wall', 'key_niche'],
      city: ['clocktower', 'fountain', 'archive', 'tram_stop', 'lantern_row'],
      field: ['standing_stone', 'windmill_ruin', 'flower_ring', 'hilltop_tree', 'buried_door'],
      stairs: ['cloud_platform', 'lantern_stair', 'gravity_well', 'memory_fragment', 'observatory'],
      room: ['floating_window', 'wardrobe_portal', 'ceiling_sky', 'fireplace_void', 'mirror_frame'],
      garden: ['moon_pool', 'perfume_archive', 'statue_court', 'hedge_maze_center', 'greenhouse'],
      station: ['departure_board', 'waiting_bench', 'signal_light', 'ticket_machine', 'platform_end'],
      bridge: ['cable_anchor', 'lantern_line', 'viewing_scope', 'knot_shrine', 'bell_buoy']
    };
    return objects[theme];
  }
  
  private calculateBounds(context: GenerationContext, zoneTheme: ZoneThemeType): { min: THREE.Vector3; max: THREE.Vector3 } {
    const rng = context.rng.fork('bounds');
    const scaleMultiplier = { intimate: 0.5, normal: 1.0, vast: 2.0, towering: 1.5 }[zoneTheme.scale];
    const size = 80 + rng.nextFloat(0, 120) * scaleMultiplier;
    const half = size / 2;
    
    // Apply spatial rule offset
    let offsetX = 0, offsetZ = 0;
    if (zoneTheme.spatialRule === 'looped') {
      offsetX = rng.nextFloat(-half * 0.3, half * 0.3);
    } else if (zoneTheme.spatialRule === 'folded') {
      offsetZ = rng.nextFloat(-half * 0.3, half * 0.3);
    }
    
    return {
      min: new THREE.Vector3(-half + offsetX, -10, -half + offsetZ),
      max: new THREE.Vector3(half + offsetX, 50, half + offsetZ)
    };
  }
  
  private generateNavMesh(context: GenerationContext, zoneTheme: ZoneThemeType, bounds: { min: THREE.Vector3; max: THREE.Vector3 }): NavMeshData {
    // Simplified navmesh - grid-based for now
    const cellSize = 4;
    const width = Math.ceil((bounds.max.x - bounds.min.x) / cellSize);
    const depth = Math.ceil((bounds.max.z - bounds.min.z) / cellSize);
    
    const vertices: number[] = [];
    const indices: number[] = [];
    const polygons: number[][] = [];
    
    for (let z = 0; z <= depth; z++) {
      for (let x = 0; x <= width; x++) {
        const wx = bounds.min.x + x * cellSize;
        const wz = bounds.min.z + z * cellSize;
        vertices.push(wx, 0.1, wz);
      }
    }
    
    for (let gz = 0; gz < depth; gz++) {
      for (let gx = 0; gx < width; gx++) {
        const a = gz * (width + 1) + gx;
        const b = a + 1;
        const c = a + width + 1;
        const d = c + 1;
        
        indices.push(a, b, d, a, d, c);
        polygons.push([a, b, d], [a, d, c]);
      }
    }
    
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      polygons
    };
  }
  
  private generateObjects(
    context: GenerationContext, 
    zoneTheme: ZoneThemeType, 
    bounds: { min: THREE.Vector3; max: THREE.Vector3 },
    navMesh: NavMeshData
  ): WorldObjectData[] {
    const rng = context.rng.fork('objects');
    const objects: WorldObjectData[] = [];
    const themeColors = ZONE_THEME_COLORS[zoneTheme.primary as ZoneTheme];
    
    // Ground plane
    objects.push({
      id: `ground_${context.zoneIndex}`,
      type: 'ground',
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(
        bounds.max.x - bounds.min.x, 1, bounds.max.z - bounds.min.z
      ),
      data: { material: 'ground', theme: zoneTheme.primary }
    });
    
    // Sky dome
    objects.push({
      id: `sky_${context.zoneIndex}`,
      type: 'sky',
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(500, 250, 500),
      data: { 
        material: 'sky', 
        lighting: zoneTheme.lighting,
        colors: themeColors 
      }
    });
    
    // Fog volume
    objects.push({
      id: `fog_${context.zoneIndex}`,
      type: 'fog',
      position: new THREE.Vector3(0, 10, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      data: { 
        color: themeColors.fog,
        near: 30,
        far: 200,
        density: 0.002
      }
    });
    
    // Key object
    objects.push({
      id: `key_${context.zoneIndex}`,
      type: 'key_object',
      position: this.getKeyObjectPosition(rng, bounds, zoneTheme),
      rotation: new THREE.Euler(0, rng.nextFloat(0, Math.PI * 2), 0),
      scale: new THREE.Vector3(1, 1, 1),
      data: { 
        objectType: zoneTheme.keyObject,
        interactive: true,
        theme: zoneTheme.primary
      }
    });
    
    // Theme-specific props
    const propCount = rng.nextInt(5, 15);
    for (let i = 0; i < propCount; i++) {
      const prop = this.generateThemeProp(rng, context.zoneIndex, i, bounds, zoneTheme, themeColors);
      if (prop) objects.push(prop);
    }
    
    // Transition markers
    for (let i = 0; i < zoneTheme.transitionType.length; i++) {
      // Will be added by generateTransitions
    }
    
    return objects;
  }
  
  private getKeyObjectPosition(rng: SeededRNG, bounds: { min: THREE.Vector3; max: THREE.Vector3 }, zoneTheme: ZoneThemeType): THREE.Vector3 {
    const margin = 15;
    const x = rng.nextFloat(bounds.min.x + margin, bounds.max.x - margin);
    const z = rng.nextFloat(bounds.min.z + margin, bounds.max.z - margin);
    
    // Place key object at a compositionally interesting spot
    if (zoneTheme.scale === 'vast' || zoneTheme.scale === 'towering') {
      // Near center but offset
      return new THREE.Vector3(x * 0.3, 0, z * 0.3);
    }
    return new THREE.Vector3(x, 0, z);
  }
  
  private generateThemeProp(
    rng: SeededRNG,
    zoneIndex: number,
    propIndex: number,
    bounds: { min: THREE.Vector3; max: THREE.Vector3 },
    zoneTheme: ZoneThemeType,
    themeColors: any
  ): WorldObjectData | null {
    const margin = 10;
    const x = rng.nextFloat(bounds.min.x + margin, bounds.max.x - margin);
    const z = rng.nextFloat(bounds.min.z + margin, bounds.max.z - margin);
    const y = 0;
    
    const propTypes = this.getPropTypesForTheme(zoneTheme.primary as ZoneTheme);
    if (propTypes.length === 0) return null;
    
    const type = rng.choose(propTypes);
    const scale = rng.nextFloat(0.8, 2.5);
    const rotY = rng.nextFloat(0, Math.PI * 2);
    
    return {
      id: `prop_${zoneIndex}_${propIndex}`,
      type,
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, rotY, 0),
      scale: new THREE.Vector3(scale, scale, scale),
      data: { theme: zoneTheme.primary, themeColors }
    };
  }
  
  private getPropTypesForTheme(theme: ZoneTheme): string[] {
    const props: Record<ZoneTheme, string[]> = {
      shore: ['driftwood', 'shell_cluster', 'stone_pile', 'footprints', 'tide_line', 'beached_object'],
      forest: ['tree_thin', 'tree_thick', 'fallen_log', 'moss_rock', 'window_frame', 'glowing_patch'],
      corridor: ['door_frame', 'window_frame', 'picture_frame', 'bench', 'lamp', 'vent'],
      city: ['building_facade', 'streetlamp', 'bench', 'sign', 'fountain_base', 'tram_track'],
      field: ['tall_grass_patch', 'wildflower', 'stone_marker', 'mound', 'reed_cluster', 'dandelion'],
      stairs: ['stair_segment', 'landing', 'balustrade', 'lantern_post', 'cloud_step', 'gravity_marker'],
      room: ['chair', 'table', 'curtain', 'rug', 'picture', 'bookshelf', 'window'],
      garden: ['hedge', 'flower_bed', 'statue', 'bench', 'pergola', 'pond_edge', 'path_stone'],
      station: ['platform', 'bench', 'lamp', 'sign', 'schedule', 'trash_can', 'rail'],
      bridge: ['cable', 'plank', 'lantern', 'railing', 'anchor', 'viewpoint']
    };
    return props[theme] || [];
  }
  
  private generateTransitions(
    context: GenerationContext, 
    zoneTheme: ZoneThemeType, 
    bounds: { min: THREE.Vector3; max: THREE.Vector3 }
  ): TransitionData[] {
    const rng = context.rng.fork('transitions');
    const transitions: TransitionData[] = [];
    
    // Number of transitions based on zone size and game mode
    const transitionCount = context.gameMode === 'infinite' 
      ? rng.nextInt(2, 4) 
      : rng.nextInt(1, 3);
    
    for (let i = 0; i < transitionCount; i++) {
      const edge = rng.nextInt(0, 3); // 0=N, 1=E, 2=S, 3=W
      const offset = rng.nextFloat(0.2, 0.8);
      
      let position: THREE.Vector3;
      let rotation: THREE.Euler;
      
      const width = bounds.max.x - bounds.min.x;
      const depth = bounds.max.z - bounds.min.z;
      
      switch (edge) {
        case 0: // North
          position = new THREE.Vector3(bounds.min.x + width * offset, 0, bounds.min.z + 2);
          rotation = new THREE.Euler(0, Math.PI, 0);
          break;
        case 1: // East
          position = new THREE.Vector3(bounds.max.x - 2, 0, bounds.min.z + depth * offset);
          rotation = new THREE.Euler(0, -Math.PI/2, 0);
          break;
        case 2: // South
          position = new THREE.Vector3(bounds.min.x + width * offset, 0, bounds.max.z - 2);
          rotation = new THREE.Euler(0, 0, 0);
          break;
        case 3: // West
          position = new THREE.Vector3(bounds.min.x + 2, 0, bounds.min.z + depth * offset);
          rotation = new THREE.Euler(0, Math.PI/2, 0);
          break;
      }
      
      transitions.push({
        id: `transition_${context.zoneIndex}_${i}`,
        fromZoneId: `zone_${context.zoneIndex}_${zoneTheme.primary}`,
        toZoneId: `zone_${context.zoneIndex + 1}_unknown`,
        type: zoneTheme.transitionType,
        position,
        rotation,
        trigger: i === 0 ? 'puzzle' : 'interaction',
        requiredPuzzleId: i === 0 ? `puzzle_${context.zoneIndex}_main` : undefined
      });
    }
    
    return transitions;
  }
}