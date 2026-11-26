import { SeededRNG } from '../utils/seeded-rng.js';
import type { PuzzleData, PuzzleType, HintData, PuzzleSolution, PuzzleState, WorldObjectData } from '../utils/types.js';
import { ZONE_THEME_COLORS, type ZoneTheme } from '../utils/colors.js';

export interface PuzzleTemplate {
  type: PuzzleType;
  generate: (rng: SeededRNG, zoneTheme: ZoneTheme, objects: WorldObjectData[]) => PuzzleData;
  validate: (puzzle: PuzzleData, objects: WorldObjectData[]) => boolean;
  solve: (puzzle: PuzzleData, playerAction: any) => boolean;
}

export const PUZZLE_TEMPLATES: PuzzleTemplate[] = [
  {
    type: 'sequence',
    generate: (rng, zoneTheme, objects) => {
      // Find interactive objects that can be activated in sequence
      const interactives = objects.filter(o => o.data?.interactable).slice(0, 5);
      if (interactives.length < 3) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const count = rng.nextInt(3, Math.min(5, interactives.length));
      const sequence = rng.shuffle(interactives.map((_, i) => i)).slice(0, count);
      const solution = [...sequence].sort((a, b) => a - b); // Correct order is sorted by some property
      
      // Create hints based on environment
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'Symbols glow in a pattern...', targetObjectId: interactives[sequence[0]].id, revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'The order matches the shadows...', targetObjectId: interactives[sequence[1]].id, revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Activate them from smallest to largest', targetObjectId: interactives[sequence[2]].id, revealed: false }
      ];
      
      return {
        id: `puzzle_seq_${rng.nextInt(1000, 9999)}`,
        type: 'sequence',
        zoneId: '',
        requiredObjects: interactives.slice(0, count).map(o => o.id),
        hints,
        solution: { validator: 'checkSequence', params: { correctOrder: solution } },
        difficulty: count * 0.2,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 3,
    solve: (puzzle, action) => {
      // action = { objectId, index }
      return true; // Simplified
    }
  },
  {
    type: 'reflection',
    generate: (rng, zoneTheme, objects) => {
      // Water reflection puzzle - match object rotations to reflections
      const waterObjects = objects.filter(o => o.type.includes('water') || o.data?.material === 'water');
      const reflectables = objects.filter(o => o.data?.reflectable).slice(0, 3);
      
      if (waterObjects.length === 0 || reflectables.length < 2) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const targetRotations = reflectables.map(() => rng.nextFloat(0, Math.PI * 2));
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'The water shows a different truth...', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'Align the objects with their reflections', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Rotate each until the reflection matches', revealed: false }
      ];
      
      return {
        id: `puzzle_refl_${rng.nextInt(1000, 9999)}`,
        type: 'reflection',
        zoneId: '',
        requiredObjects: [...waterObjects.map(o => o.id), ...reflectables.map(o => o.id)],
        hints,
        solution: { validator: 'checkReflection', params: { targetRotations } },
        difficulty: 0.4,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 3,
    solve: (puzzle, action) => true
  },
  {
    type: 'sound',
    generate: (rng, zoneTheme, objects) => {
      // Sound sequence puzzle
      const soundObjects = objects.filter(o => o.data?.sound).slice(0, 4);
      if (soundObjects.length < 2) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const sequence = rng.shuffle([...Array(soundObjects.length).keys()]);
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'Listen to the wind... it carries a melody', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'The journal records the order of tones', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Play them back: low, high, medium, low', revealed: false }
      ];
      
      return {
        id: `puzzle_sound_${rng.nextInt(1000, 9999)}`,
        type: 'sound',
        zoneId: '',
        requiredObjects: soundObjects.map(o => o.id),
        hints,
        solution: { validator: 'checkSoundSequence', params: { correctSequence: sequence } },
        difficulty: 0.3,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 2,
    solve: (puzzle, action) => true
  },
  {
    type: 'pattern',
    generate: (rng, zoneTheme, objects) => {
      // Pattern matching - symbols on objects match environmental patterns
      const patternObjects = objects.filter(o => o.data?.symbol).slice(0, 4);
      if (patternObjects.length < 2) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const pattern = rng.shuffle(['⬢', '⬣', '◆', '◇', '●', '▲']).slice(0, patternObjects.length);
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'Symbols repeat across the zone...', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'The pattern on the wall matches the stones', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Match each symbol to its pair', revealed: false }
      ];
      
      return {
        id: `puzzle_pat_${rng.nextInt(1000, 9999)}`,
        type: 'pattern',
        zoneId: '',
        requiredObjects: patternObjects.map(o => o.id),
        hints,
        solution: { validator: 'checkPattern', params: { correctPattern: pattern } },
        difficulty: 0.35,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 2,
    solve: (puzzle, action) => true
  },
  {
    type: 'orientation',
    generate: (rng, zoneTheme, objects) => {
      // Rotate objects to face specific directions
      const rotatable = objects.filter(o => o.data?.rotatable).slice(0, 4);
      if (rotatable.length < 2) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const targetAngles = rotatable.map(() => rng.choose([0, Math.PI/2, Math.PI, 3*Math.PI/2]));
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'The statues gaze toward something...', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'They all face the central landmark', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Turn each to face the tower', revealed: false }
      ];
      
      return {
        id: `puzzle_orient_${rng.nextInt(1000, 9999)}`,
        type: 'orientation',
        zoneId: '',
        requiredObjects: rotatable.map(o => o.id),
        hints,
        solution: { validator: 'checkOrientation', params: { targetAngles } },
        difficulty: 0.3,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 2,
    solve: (puzzle, action) => true
  },
  {
    type: 'switches',
    generate: (rng, zoneTheme, objects) => {
      // Multi-switch puzzle with logic
      const switches = objects.filter(o => o.data?.switch).slice(0, 4);
      if (switches.length < 2) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      // Generate a valid combination
      const correctState = switches.map(() => rng.nextBool(0.5));
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'The mechanism hums with potential...', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'The engravings show: down, up, down, up', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Set switches to match the pattern', revealed: false }
      ];
      
      return {
        id: `puzzle_sw_${rng.nextInt(1000, 9999)}`,
        type: 'switches',
        zoneId: '',
        requiredObjects: switches.map(o => o.id),
        hints,
        solution: { validator: 'checkSwitches', params: { correctState } },
        difficulty: 0.4,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 2,
    solve: (puzzle, action) => true
  },
  {
    type: 'placement',
    generate: (rng, zoneTheme, objects) => {
      // Place objects in correct positions
      const placeables = objects.filter(o => o.data?.placeable).slice(0, 3);
      const slots = objects.filter(o => o.data?.slot).slice(0, 3);
      if (placeables.length < 1 || slots.length < 1) return createFallbackPuzzle(rng, zoneTheme, objects);
      
      const correctPlacement = placeables.map((_, i) => i % slots.length);
      
      const hints: HintData[] = [
        { id: 'hint1', tier: 1, trigger: 'proximity', content: 'Empty pedestals await their burden...', revealed: false },
        { id: 'hint2', tier: 2, trigger: 'time', content: 'The shape of each base matches a stone', revealed: false },
        { id: 'hint3', tier: 3, trigger: 'interaction', content: 'Place the round stone in the round base', revealed: false }
      ];
      
      return {
        id: `puzzle_place_${rng.nextInt(1000, 9999)}`,
        type: 'placement',
        zoneId: '',
        requiredObjects: [...placeables.map(o => o.id), ...slots.map(o => o.id)],
        hints,
        solution: { validator: 'checkPlacement', params: { correctPlacement } },
        difficulty: 0.35,
        state: 'inactive'
      };
    },
    validate: (puzzle) => puzzle.requiredObjects.length >= 2,
    solve: (puzzle, action) => true
  }
];

function createFallbackPuzzle(rng: SeededRNG, zoneTheme: ZoneTheme, objects: WorldObjectData[]): PuzzleData {
  const interactives = objects.filter(o => o.data?.interactable).slice(0, 2);
  return {
    id: `puzzle_fallback_${rng.nextInt(1000, 9999)}`,
    type: 'sequence',
    zoneId: '',
    requiredObjects: interactives.map(o => o.id),
    hints: [
      { id: 'hint1', tier: 1, trigger: 'proximity', content: 'Interact with the highlighted objects', revealed: false },
      { id: 'hint2', tier: 2, trigger: 'time', content: 'Try them in different orders', revealed: false },
      { id: 'hint3', tier: 3, trigger: 'interaction', content: 'The solution is simple', revealed: false }
    ],
    solution: { validator: 'checkSequence', params: { correctOrder: [0, 1] } },
    difficulty: 0.1,
    state: 'inactive'
  };
}

export function getPuzzleTemplate(type: PuzzleType): PuzzleTemplate | undefined {
  return PUZZLE_TEMPLATES.find(t => t.type === type);
}

export function getRandomPuzzleType(rng: SeededRNG, exclude: PuzzleType[] = []): PuzzleType {
  const types: PuzzleType[] = ['sequence', 'reflection', 'sound', 'pattern', 'orientation', 'switches', 'placement'];
  const available = types.filter(t => !exclude.includes(t));
  return rng.choose(available);
}