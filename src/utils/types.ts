import * as THREE from 'three';

export type GameMode = 'journey' | 'infinite';
export type RenderMode = 'dream' | 'symbols';
export type QualityPreset = 'auto' | 'low' | 'medium' | 'high';

export interface Vector3Data { x: number; y: number; z: number }
export interface QuaternionData { x: number; y: number; z: number; w: number }

export interface SaveData {
  version: number;
  timestamp: number;
  gameMode: GameMode;
  seed: string;
  generatorVersion: number;
  currentZoneId: string;
  playerPosition: Vector3Data;
  playerRotation: QuaternionData;
  visitedZones: string[];
  objectStates: Record<string, unknown>;
  solvedPuzzles: string[];
  journalEntries: JournalEntry[];
  settings: SettingsData;
}

export interface JournalEntry {
  id: string;
  zoneId: string;
  type: 'symbol' | 'phrase' | 'pattern' | 'hint' | 'observation';
  content: string;
  timestamp: number;
  position?: Vector3Data;
}

export interface SettingsData {
  renderMode: RenderMode;
  quality: QualityPreset;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
  masterVolume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  language: 'en' | 'ru';
}

export interface ZoneTheme {
  name: string;
  primary: string;
  secondary?: string;
  lighting: 'dawn' | 'day' | 'dusk' | 'night' | 'overcast' | 'golden' | 'bluehour';
  scale: 'intimate' | 'normal' | 'vast' | 'towering';
  spatialRule: 'euclidean' | 'looped' | 'folded' | 'mirrored' | 'impossible';
  keyObject: string;
  transitionType: 'door' | 'stairs' | 'bridge' | 'tunnel' | 'fog' | 'window' | 'lift' | 'rift';
}

export interface ZoneData {
  id: string;
  theme: ZoneTheme;
  bounds: { min: THREE.Vector3; max: THREE.Vector3 };
  navMesh: NavMeshData;
  objects: WorldObjectData[];
  puzzles: PuzzleData[];
  transitions: TransitionData[];
  seed: number;
}

export interface NavMeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  polygons: number[][];
}

export interface WorldObjectData {
  id: string;
  type: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  data?: Record<string, unknown>;
}

export interface PuzzleData {
  id: string;
  type: PuzzleType;
  zoneId: string;
  requiredObjects: string[];
  hints: HintData[];
  solution: PuzzleSolution;
  difficulty: number;
  state: PuzzleState;
}

export type PuzzleType = 
  | 'sequence' 
  | 'reflection' 
  | 'sound' 
  | 'pattern' 
  | 'orientation' 
  | 'switches' 
  | 'placement';

export interface HintData {
  id: string;
  tier: 1 | 2 | 3;
  trigger: 'proximity' | 'time' | 'interaction' | 'journal';
  content: string;
  targetObjectId?: string;
  revealed: boolean;
}

export interface PuzzleSolution {
  validator: string; // Function name or serialized logic
  params: Record<string, unknown>;
}

export type PuzzleState = 'inactive' | 'active' | 'solved' | 'broken';

export interface TransitionData {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  type: ZoneTheme['transitionType'];
  position: THREE.Vector3;
  rotation: THREE.Euler;
  trigger: 'interaction' | 'proximity' | 'puzzle' | 'automatic';
  requiredPuzzleId?: string;
}

export interface PlayerInput {
  move: THREE.Vector2;
  look: THREE.Vector2;
  interact: boolean;
  jump: boolean;
  menu: boolean;
  renderModeToggle: boolean;
  journalToggle: boolean;
}

export interface InteractionPrompt {
  objectId: string;
  type: 'interact' | 'inspect' | 'use' | 'read' | 'activate' | 'rotate' | 'switch';
  message: string;
  distance: number;
}

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
}

export interface QualitySettings {
  symbolDensity: number;
  symbolSize: number;
  shadowMapSize: number;
  enablePostProcessing: boolean;
  enableShadows: boolean;
  enableFog: boolean;
  maxFPS: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySettings> = {
  auto: { symbolDensity: 1.0, symbolSize: 1.0, shadowMapSize: 1024, enablePostProcessing: true, enableShadows: true, enableFog: true, maxFPS: 60 },
  low: { symbolDensity: 0.5, symbolSize: 1.5, shadowMapSize: 256, enablePostProcessing: false, enableShadows: false, enableFog: true, maxFPS: 30 },
  medium: { symbolDensity: 0.75, symbolSize: 1.2, shadowMapSize: 512, enablePostProcessing: true, enableShadows: true, enableFog: true, maxFPS: 60 },
  high: { symbolDensity: 1.5, symbolSize: 0.8, shadowMapSize: 2048, enablePostProcessing: true, enableShadows: true, enableFog: true, maxFPS: 120 }
};

export interface GeneratorConfig {
  seed: string;
  version: number;
  maxZones: number;
  themeWeights: Record<string, number>;
  puzzleWeights: Record<PuzzleType, number>;
  minZoneSize: number;
  maxZoneSize: number;
}