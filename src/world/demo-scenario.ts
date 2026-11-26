import * as THREE from 'three';
import { SeededRNG } from '../utils/seeded-rng.js';
import { ZoneGenerator } from './zone-generator.js';
import type { ZoneData, WorldObjectData } from '../utils/types.js';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const eul = (x: number, y: number, z: number) => new THREE.Euler(x, y, z);

/**
 * Demo Scenario - Creates the controlled route from the specification:
 * 1. Shore (beach with door) -> Sequence puzzle with stones/symbols
 * 2. Corridor (with windows showing different times) -> Shadow/switch puzzle
 * 3. Transition to Field with Stairs to clouds
 */
export class DemoScenario {
  static readonly DEMO_SEED = 'demo2024seed';
  
  static generateDemoZones(rng: SeededRNG): ZoneData[] {
    const zones: ZoneData[] = [];
    
    // Zone 0: Shore - Starting beach
    const shoreZone = this.createShoreZone(rng.fork('shore'), 0);
    zones.push(shoreZone);
    
    // Zone 1: Corridor - The corridor with windows
    const corridorZone = this.createCorridorZone(rng.fork('corridor'), 1);
    zones.push(corridorZone);
    
    // Zone 2: Field/Stairs - Field with stairs to clouds
    const fieldZone = this.createFieldStairsZone(rng.fork('field'), 2);
    zones.push(fieldZone);
    
    return zones;
  }
  
  private static createShoreZone(rng: SeededRNG, index: number): ZoneData {
    const bounds = { min: v3(-100, -10, -100), max: v3(100, 50, 100) };
    
    const objects: WorldObjectData[] = [
      { id: 'ground_shore', type: 'ground', position: v3(0, 0, 0), rotation: eul(0, 0, 0), scale: v3(200, 1, 200), data: { material: 'sand', theme: 'shore' } },
      { id: 'sky_shore', type: 'sky', position: v3(0, 0, 0), rotation: eul(0, 0, 0), scale: v3(500, 250, 500), data: { material: 'sky', lighting: 'dawn', colors: 'shore' } },
      { id: 'fog_shore', type: 'fog', position: v3(0, 10, 0), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { color: { r: 0.48, g: 0.61, b: 0.78 }, near: 30, far: 200, density: 0.002 } },
      { id: 'water_shore', type: 'water', position: v3(0, 0, -80), rotation: eul(0, 0, 0), scale: v3(200, 1, 200), data: { material: 'water', theme: 'shore' } },
      { id: 'key_shore_door', type: 'key_object', position: v3(0, 0, 60), rotation: eul(0, 0, 0), scale: v3(2, 3, 0.5), data: { objectType: 'driftwood_gate', interactive: true, theme: 'shore' } },
      { id: 'stone_1', type: 'stone_pile', position: v3(-8, 0, 40), rotation: eul(0, 0.5, 0), scale: v3(1.2, 1.2, 1.2), data: { theme: 'shore', symbol: '◆', interactable: true, interactionType: 'activate', promptMessage: 'Activate Stone [E]' } },
      { id: 'stone_2', type: 'stone_pile', position: v3(0, 0, 35), rotation: eul(0, 1.2, 0), scale: v3(1, 1.5, 1), data: { theme: 'shore', symbol: '▲', interactable: true, interactionType: 'activate', promptMessage: 'Activate Stone [E]' } },
      { id: 'stone_3', type: 'stone_pile', position: v3(8, 0, 42), rotation: eul(0, -0.3, 0), scale: v3(1.5, 1, 1.5), data: { theme: 'shore', symbol: '●', interactable: true, interactionType: 'activate', promptMessage: 'Activate Stone [E]' } },
      { id: 'symbol_object', type: 'driftwood', position: v3(-15, 0, 30), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore', inspectable: true, interactionType: 'inspect', description: 'A weathered piece of driftwood with three symbols carved: ◆ ▲ ●', promptMessage: 'Inspect [E]' } },
      { id: 'footprints_1', type: 'footprints', position: v3(-5, 0.01, 10), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'footprints_2', type: 'footprints', position: v3(-2, 0.01, 20), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'footprints_3', type: 'footprints', position: v3(0, 0.01, 30), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'footprints_4', type: 'footprints', position: v3(2, 0.01, 40), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'footprints_5', type: 'footprints', position: v3(0, 0.01, 50), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'shells_1', type: 'shell_cluster', position: v3(-20, 0, -20), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'shore' } },
      { id: 'shells_2', type: 'shell_cluster', position: v3(25, 0, -15), rotation: eul(0, 0, 0), scale: v3(1.5, 1.5, 1.5), data: { theme: 'shore' } }
    ];
    
    return {
      id: `zone_${index}_shore`,
      theme: {
        name: 'shore',
        primary: 'shore',
        secondary: 'field',
        lighting: 'dawn',
        scale: 'vast',
        spatialRule: 'euclidean',
        keyObject: 'driftwood_gate',
        transitionType: 'door'
      },
      bounds: { min: bounds.min, max: bounds.max },
      navMesh: { vertices: new Float32Array([]), indices: new Uint32Array([]), polygons: [] },
      objects,
      puzzles: [],
      transitions: [
        { id: 'transition_shore_corridor', fromZoneId: `zone_${index}_shore`, toZoneId: `zone_${index + 1}_corridor`, type: 'door', position: v3(0, 0, 60), rotation: eul(0, 0, 0), trigger: 'puzzle', requiredPuzzleId: 'puzzle_shore_sequence' }
      ],
      seed: rng.nextInt(0, 2147483647)
    };
  }
  
  private static createCorridorZone(rng: SeededRNG, index: number): ZoneData {
    const bounds = { min: v3(-10, -5, -10), max: v3(10, 15, 100) };
    
    const objects: WorldObjectData[] = [
      { id: 'floor_corridor', type: 'ground', position: v3(0, 0, 45), rotation: eul(0, 0, 0), scale: v3(20, 1, 100), data: { material: 'stone', theme: 'corridor' } },
      { id: 'ceiling_corridor', type: 'ground', position: v3(0, 10, 45), rotation: eul(Math.PI, 0, 0), scale: v3(20, 1, 100), data: { material: 'stone', theme: 'corridor' } },
      { id: 'wall_left', type: 'ground', position: v3(-10, 5, 45), rotation: eul(0, -Math.PI/2, 0), scale: v3(100, 10, 1), data: { material: 'stone', theme: 'corridor', windows: true } },
      { id: 'wall_right', type: 'ground', position: v3(10, 5, 45), rotation: eul(0, Math.PI/2, 0), scale: v3(100, 10, 1), data: { material: 'stone', theme: 'corridor', doors: true } },
      { id: 'sky_corridor', type: 'sky', position: v3(0, 0, 0), rotation: eul(0, 0, 0), scale: v3(500, 250, 500), data: { material: 'sky', lighting: 'overcast', colors: 'corridor' } },
      { id: 'fog_corridor', type: 'fog', position: v3(0, 5, 45), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { color: { r: 0.6, g: 0.63, b: 0.66 }, near: 10, far: 80, density: 0.005 } },
      { id: 'key_corridor_mechanism', type: 'key_object', position: v3(0, 1.5, 85), rotation: eul(0, 0, 0), scale: v3(2, 1, 1), data: { objectType: 'clock_mechanism', interactive: true, theme: 'corridor', switches: 3 } },
      { id: 'window_dawn', type: 'window_frame', position: v3(-9.5, 5, 20), rotation: eul(0, Math.PI/2, 0), scale: v3(2, 3, 0.1), data: { theme: 'corridor', timeOfDay: 'dawn', inspectable: true, interactionType: 'inspect', description: 'A window showing a courtyard at dawn. Long shadows point northwest.' } },
      { id: 'window_noon', type: 'window_frame', position: v3(-9.5, 5, 45), rotation: eul(0, Math.PI/2, 0), scale: v3(2, 3, 0.1), data: { theme: 'corridor', timeOfDay: 'noon', inspectable: true, interactionType: 'inspect', description: 'A window showing the same courtyard at noon. Short shadows point north.' } },
      { id: 'window_dusk', type: 'window_frame', position: v3(-9.5, 5, 70), rotation: eul(0, Math.PI/2, 0), scale: v3(2, 3, 0.1), data: { theme: 'corridor', timeOfDay: 'dusk', inspectable: true, interactionType: 'inspect', description: 'A window showing the courtyard at dusk. Long shadows point northeast.' } },
      { id: 'shadow_painting', type: 'picture_frame', position: v3(9.5, 5, 45), rotation: eul(0, -Math.PI/2, 0), scale: v3(2, 1.5, 0.1), data: { theme: 'corridor', inspectable: true, interactionType: 'inspect', description: 'A painting depicting the same courtyard with three shadows at different angles. The shadows correspond to dawn, noon, and dusk.' } },
      { id: 'switch_1', type: 'switch', position: v3(-1, 1.5, 85), rotation: eul(0, 0, 0), scale: v3(0.5, 0.5, 0.5), data: { theme: 'corridor', switchIndex: 0, interactable: true, interactionType: 'switch', promptMessage: 'Toggle Switch [E]' } },
      { id: 'switch_2', type: 'switch', position: v3(0, 1.5, 85), rotation: eul(0, 0, 0), scale: v3(0.5, 0.5, 0.5), data: { theme: 'corridor', switchIndex: 1, interactable: true, interactionType: 'switch', promptMessage: 'Toggle Switch [E]' } },
      { id: 'switch_3', type: 'switch', position: v3(1, 1.5, 85), rotation: eul(0, 0, 0), scale: v3(0.5, 0.5, 0.5), data: { theme: 'corridor', switchIndex: 2, interactable: true, interactionType: 'switch', promptMessage: 'Toggle Switch [E]' } },
      { id: 'lamp_1', type: 'lamp', position: v3(-8, 1, 10), rotation: eul(0, 0, 0), scale: v3(1, 2, 1), data: { theme: 'corridor', emissive: true } },
      { id: 'lamp_2', type: 'lamp', position: v3(8, 1, 35), rotation: eul(0, 0, 0), scale: v3(1, 2, 1), data: { theme: 'corridor', emissive: true } },
      { id: 'lamp_3', type: 'lamp', position: v3(-8, 1, 60), rotation: eul(0, 0, 0), scale: v3(1, 2, 1), data: { theme: 'corridor', emissive: true } }
    ];
    
    return {
      id: `zone_${index}_corridor`,
      theme: {
        name: 'corridor',
        primary: 'corridor',
        secondary: 'room',
        lighting: 'overcast',
        scale: 'intimate',
        spatialRule: 'euclidean',
        keyObject: 'clock_mechanism',
        transitionType: 'door'
      },
      bounds: { min: bounds.min, max: bounds.max },
      navMesh: { vertices: new Float32Array([]), indices: new Uint32Array([]), polygons: [] },
      objects,
      puzzles: [],
      transitions: [
        { id: 'transition_corridor_field', fromZoneId: `zone_${index}_corridor`, toZoneId: `zone_${index + 1}_field`, type: 'door', position: v3(0, 0, 95), rotation: eul(0, 0, 0), trigger: 'puzzle', requiredPuzzleId: 'puzzle_corridor_shadows' }
      ],
      seed: rng.nextInt(0, 2147483647)
    };
  }
  
  private static createFieldStairsZone(rng: SeededRNG, index: number): ZoneData {
    const bounds = { min: v3(-100, -10, -10), max: v3(100, 100, 100) };
    
    const objects: WorldObjectData[] = [
      { id: 'ground_field', type: 'ground', position: v3(0, 0, 0), rotation: eul(0, 0, 0), scale: v3(200, 1, 200), data: { material: 'grass', theme: 'field' } },
      { id: 'sky_field', type: 'sky', position: v3(0, 0, 0), rotation: eul(0, 0, 0), scale: v3(500, 250, 500), data: { material: 'sky', lighting: 'golden', colors: 'field' } },
      { id: 'fog_field', type: 'fog', position: v3(0, 10, 0), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { color: { r: 0.83, g: 0.8, b: 0.91 }, near: 50, far: 300, density: 0.001 } },
      { id: 'grass_1', type: 'tall_grass_patch', position: v3(-30, 0, -20), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'field' } },
      { id: 'grass_2', type: 'tall_grass_patch', position: v3(25, 0, -15), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'field' } },
      { id: 'key_stairs', type: 'key_object', position: v3(0, 0, 50), rotation: eul(0, 0, 0), scale: v3(10, 50, 5), data: { objectType: 'cloud_platform', interactive: true, theme: 'stairs' } },
      { id: 'stair_1', type: 'stair_segment', position: v3(0, 2, 40), rotation: eul(0, 0, 0), scale: v3(8, 0.5, 3), data: { theme: 'stairs' } },
      { id: 'stair_2', type: 'stair_segment', position: v3(0, 6, 45), rotation: eul(0, 0, 0), scale: v3(7, 0.5, 3), data: { theme: 'stairs' } },
      { id: 'stair_3', type: 'stair_segment', position: v3(0, 10, 50), rotation: eul(0, 0, 0), scale: v3(6, 0.5, 3), data: { theme: 'stairs' } },
      { id: 'cloud_1', type: 'cloud_platform', position: v3(-10, 20, 60), rotation: eul(0, 0, 0), scale: v3(5, 1, 5), data: { theme: 'stairs', emissive: true } },
      { id: 'cloud_2', type: 'cloud_platform', position: v3(10, 30, 70), rotation: eul(0, 0, 0), scale: v3(5, 1, 5), data: { theme: 'stairs', emissive: true } },
      { id: 'flowers_1', type: 'wildflower', position: v3(-20, 0, 10), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'field' } },
      { id: 'flowers_2', type: 'wildflower', position: v3(15, 0, 20), rotation: eul(0, 0, 0), scale: v3(1, 1, 1), data: { theme: 'field' } },
      { id: 'standing_stone', type: 'stone_marker', position: v3(-40, 0, 30), rotation: eul(0, 0, 0), scale: v3(1, 4, 0.3), data: { theme: 'field', inspectable: true, interactionType: 'inspect', description: 'An ancient stone marker. Symbols glow faintly.' } }
    ];
    
    return {
      id: `zone_${index}_field`,
      theme: {
        name: 'field',
        primary: 'field',
        secondary: 'stairs',
        lighting: 'golden',
        scale: 'vast',
        spatialRule: 'impossible',
        keyObject: 'cloud_platform',
        transitionType: 'stairs'
      },
      bounds: { min: bounds.min, max: bounds.max },
      navMesh: { vertices: new Float32Array([]), indices: new Uint32Array([]), polygons: [] },
      objects,
      puzzles: [],
      transitions: [
        { id: 'transition_field_next', fromZoneId: `zone_${index}_field`, toZoneId: `zone_${index + 1}_next`, type: 'stairs', position: v3(0, 50, 80), rotation: eul(0, 0, 0), trigger: 'proximity' }
      ],
      seed: rng.nextInt(0, 2147483647)
    };
  }
}