import * as THREE from 'three';

export const PALETTE = {
  // Base muted tones
  mistBlue: new THREE.Color(0x7a9cc6),
  paleBlue: new THREE.Color(0xa8c0d8),
  sand: new THREE.Color(0xd4c4a8),
  warmSand: new THREE.Color(0xe8dcc8),
  milk: new THREE.Color(0xf0ebe0),
  mutedGreen: new THREE.Color(0x8fae9e),
  sageGreen: new THREE.Color(0xa4c4a8),
  lavender: new THREE.Color(0xb8a8d0),
  paleLavender: new THREE.Color(0xd4cce8),
  cream: new THREE.Color(0xf5f0e0),
  stone: new THREE.Color(0x9aa0a8),
  darkStone: new THREE.Color(0x5a6068),
  charcoal: new THREE.Color(0x3a3d44),
  
  // Accents
  amber: new THREE.Color(0xffb84d),
  coral: new THREE.Color(0xe86c5a),
  skyBlue: new THREE.Color(0x6cb4e8),
  goldLight: new THREE.Color(0xffd87a),
  roseGlow: new THREE.Color(0xf0a0a8),
  
  // Symbol mode palettes
  mono: {
    bg: new THREE.Color(0x0d0d0d),
    fg: new THREE.Color(0xe8e8e8),
    dim: new THREE.Color(0x888888),
    accent: new THREE.Color(0xffffff)
  },
  terminal: {
    bg: new THREE.Color(0x0a1a0a),
    fg: new THREE.Color(0x4aff4a),
    dim: new THREE.Color(0x2a8a2a),
    accent: new THREE.Color(0x8aff8a)
  },
  neon: {
    bg: new THREE.Color(0x0d0a1a),
    fg: new THREE.Color(0xfc4aff),
    dim: new THREE.Color(0x8a2aff),
    accent: new THREE.Color(0x4afffc),
    accent2: new THREE.Color(0xfffc4a)
  },
  dreamscape: {
    bg: new THREE.Color(0x14101a),
    fg: new THREE.Color(0xe8d0f0),
    dim: new THREE.Color(0x8a70a0),
    accent: new THREE.Color(0xffb8e8),
    accent2: new THREE.Color(0xb8e8ff),
    accent3: new THREE.Color(0xe8ffb8)
  }
} as const;

export type SymbolPaletteName = keyof typeof SYMBOL_PALETTES;

export const SYMBOL_PALETTES = {
  mono: PALETTE.mono,
  terminal: PALETTE.terminal,
  neon: PALETTE.neon,
  dreamscape: PALETTE.dreamscape
} as const;

export function getSymbolPalette(name: SymbolPaletteName) {
  return SYMBOL_PALETTES[name];
}

export function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return a.clone().lerp(b, t);
}

export function colorToVec3(c: THREE.Color): THREE.Vector3 {
  return new THREE.Vector3(c.r, c.g, c.b);
}

export function hexToColor(hex: number | string): THREE.Color {
  return new THREE.Color(hex);
}

export const ZONE_THEME_COLORS = {
  shore: {
    sky: [PALETTE.paleBlue, PALETTE.milk],
    fog: PALETTE.mistBlue,
    ground: PALETTE.sand,
    water: PALETTE.mistBlue,
    accent: PALETTE.amber
  },
  forest: {
    sky: [PALETTE.mutedGreen, PALETTE.paleLavender],
    fog: PALETTE.sageGreen,
    ground: PALETTE.darkStone,
    water: PALETTE.mutedGreen,
    accent: PALETTE.skyBlue
  },
  corridor: {
    sky: [PALETTE.charcoal, PALETTE.darkStone],
    fog: PALETTE.stone,
    ground: PALETTE.stone,
    water: PALETTE.charcoal,
    accent: PALETTE.coral
  },
  city: {
    sky: [PALETTE.paleBlue, PALETTE.lavender],
    fog: PALETTE.mistBlue,
    ground: PALETTE.stone,
    water: PALETTE.mistBlue,
    accent: PALETTE.goldLight
  },
  field: {
    sky: [PALETTE.milk, PALETTE.paleBlue],
    fog: PALETTE.paleLavender,
    ground: PALETTE.mutedGreen,
    water: PALETTE.sageGreen,
    accent: PALETTE.amber
  },
  stairs: {
    sky: [PALETTE.lavender, PALETTE.paleBlue],
    fog: PALETTE.mistBlue,
    ground: PALETTE.stone,
    water: PALETTE.charcoal,
    accent: PALETTE.skyBlue
  },
  room: {
    sky: [PALETTE.cream, PALETTE.paleLavender],
    fog: PALETTE.paleLavender,
    ground: PALETTE.warmSand,
    water: PALETTE.milk,
    accent: PALETTE.roseGlow
  },
  garden: {
    sky: [PALETTE.mutedGreen, PALETTE.paleBlue],
    fog: PALETTE.sageGreen,
    ground: PALETTE.mutedGreen,
    water: PALETTE.sageGreen,
    accent: PALETTE.goldLight
  },
  station: {
    sky: [PALETTE.darkStone, PALETTE.charcoal],
    fog: PALETTE.stone,
    ground: PALETTE.stone,
    water: PALETTE.charcoal,
    accent: PALETTE.coral
  },
  bridge: {
    sky: [PALETTE.mistBlue, PALETTE.paleBlue],
    fog: PALETTE.mistBlue,
    ground: PALETTE.stone,
    water: PALETTE.mistBlue,
    accent: PALETTE.skyBlue
  }
} as const;

export type ZoneTheme = keyof typeof ZONE_THEME_COLORS;

export function getZoneThemeColors(theme: ZoneTheme) {
  return ZONE_THEME_COLORS[theme];
}