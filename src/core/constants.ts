import * as THREE from 'three';

export const GAME_CONFIG = {
  title: 'DREAMSCAPE',
  version: '1.0.0',
  generatorVersion: 1,
  saveKey: 'dreamscape_save',
  settingsKey: 'dreamscape_settings',
  
  // Player
  playerHeight: 1.7,
  playerSpeed: 3.5,
  playerRunMultiplier: 1.6,
  playerAcceleration: 25,
  playerDeceleration: 20,
  mouseSensitivity: 0.002,
  touchSensitivity: 0.003,
  maxPitch: Math.PI / 2 - 0.01,
  
  // Camera
  cameraOffset: new THREE.Vector3(0, 1.5, 0),
  cameraDistance: 4,
  cameraMinDistance: 1.5,
  cameraMaxDistance: 8,
  cameraLerp: 0.15,
  
  // World
  zoneSize: { min: 80, max: 200 },
  transitionDistance: 5,
  preloadDistance: 1,
  
  // Rendering
  symbolBaseDensity: 0.008,
  symbolBaseSize: 0.15,
  symbolMaxInstances: 500000,
  
  // Puzzles
  hintTierDelay: [8000, 15000, 30000], // ms
  maxActivePuzzles: 3,
  
  // Audio
  defaultMasterVolume: 0.7,
  defaultMusicVolume: 0.5,
  defaultAmbientVolume: 0.6,
  defaultSfxVolume: 0.8,
  
  // UI
  interactionPromptDelay: 300,
  journalEntryDuration: 4000
} as const;

export const ZONE_THEMES = [
  'shore', 'forest', 'corridor', 'city', 'field', 
  'stairs', 'room', 'garden', 'station', 'bridge'
] as const;

export const PUZZLE_TYPES = [
  'sequence', 'reflection', 'sound', 'pattern', 
  'orientation', 'switches', 'placement'
] as const;

export const SYMBOL_PALETTES = ['mono', 'terminal', 'neon', 'dreamscape'] as const;

export const TRANSITION_TYPES = [
  'door', 'stairs', 'bridge', 'tunnel', 'fog', 'window', 'lift', 'rift'
] as const;

export const SPATIAL_RULES = [
  'euclidean', 'looped', 'folded', 'mirrored', 'impossible'
] as const;

export const LIGHTING_PRESETS = [
  'dawn', 'day', 'dusk', 'night', 'overcast', 'golden', 'bluehour'
] as const;

export const SCALE_PRESETS = [
  'intimate', 'normal', 'vast', 'towering'
] as const;