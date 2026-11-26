# DREAMSCAPE — Technical Implementation Summary

## Overview

This document summarizes the technical architecture and implementation decisions for DREAMSCAPE, a browser-based surreal exploration game with dual rendering modes.

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript | Type safety for complex game systems |
| **3D Engine** | Three.js r160+ | Mature WebGL abstraction, excellent mobile support |
| **Build Tool** | Vite 5 | Fast HMR, optimized production builds, PWA plugin |
| **Animation** | GSAP 3 | Performant UI transitions, small footprint |
| **Audio** | Tone.js 15 | Web Audio API wrapper, synthesis + sampling |
| **RNG** | seedrandom | Deterministic seeded generation |
| **State** | Custom EventEmitter | Zero dependencies, full serialization control |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Game (core/game.ts)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Renderer │ │  World   │ │  Player  │ │    Puzzles     │  │
│  │ (dual)   │ │ Manager  │ │Controller│ │   Manager     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │            │            │                │           │
│  ┌────▼────────────▼────────────▼────────────────▼────────┐  │
│  │              EventEmitter (decoupled systems)           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │Interact  │ │  Audio   │ │    UI    │ │     Save       │  │
│  │ Manager  │ │ Manager  │ │ Manager  │ │   Manager      │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Rendering System

### Dual Mode Architecture

**Mode A: "Dream" (Stylized 3D)**
- Custom shader materials with Three.js ShaderMaterial
- Volumetric fog via shader (not Three.js Fog)
- Screen-space effects: subtle bloom, vignette, color grading
- Water shader with Gerstner waves, reflections, caustics
- Instanced grass/foliage with wind animation
- Dynamic time-of-day lighting per zone

**Mode B: "Symbols" (Glyph Field)**
- Single `InstancedMesh` (500k quads) covering view frustum
- Vertex shader: world position → glyph UV + depth sorting
- Fragment shader: samples glyph atlas, applies material palette
- GPU-driven parameters: density, size, contrast, palette, flicker
- Preserves depth, silhouette, perspective — no CPU text rendering
- 4 built-in palettes: Monochrome, Terminal, Neon, Dreamscape

**Seamless Switching**
- Both modes share same scene graph, camera, physics
- Symbol instances generated from mesh bounding boxes
- Toggle is instant with brief cross-fade
- State (puzzles, position, progress) fully preserved

### Shader Pipeline

```
Dream Mode:
  Scene → RenderTarget → Bloom Extract → Blur H → Blur V → Composite → Screen

Symbols Mode:
  SymbolScene (InstancedMesh) → Screen (direct)
```

## Procedural World Generation

### Zone Structure
```typescript
ZoneTheme {
  primary: string;          // shore, forest, corridor, city, field, stairs, room, garden, station, bridge
  secondary: string;        // complementary theme
  lighting: string;         // dawn, day, dusk, night, overcast, golden, bluehour
  scale: string;            // intimate, normal, vast, towering
  spatialRule: string;      // euclidean, looped, folded, mirrored, impossible
  keyObject: string;        // landmark for navigation
  transitionType: string;   // door, stairs, bridge, tunnel, fog, window, lift, rift
}
```

### Generation Pipeline
1. **Theme Selection** — Weighted RNG, avoids recent themes, favors compatible transitions
2. **Spatial Layout** — Bounds, navmesh (grid-based), spatial rule application
3. **Object Placement** — Ground, sky, fog, key object, props, transition triggers
4. **Puzzle Injection** — Template-based, validated for solvability
5. **Validation Pass** — Pathfinding, hint reachability, puzzle solvability
6. **Mesh Construction** — Three.js objects with symbol data attached
7. **Streaming** — Preload next zone, unload old zones (max 3 loaded)

### Determinism
- `seedrandom` with zone-index forking
- Same seed + generator version = identical world
- Save includes seed, version, zone index

## Puzzle System

### Template-Based Design
```typescript
PuzzleTemplate {
  type: PuzzleType;
  generate(rng, theme, objects) → PuzzleData;
  validate(puzzle, objects) → boolean;
  solve(puzzle, action) → boolean;
}
```

### 7 Puzzle Types
| Type | Description | Example |
|------|-------------|---------|
| sequence | Activate objects in order | Stones with symbols |
| reflection | Match objects to water reflections | Rotate to align |
| sound | Replay tone sequence | Wind chimes |
| pattern | Match symbols across zone | Wall carvings ↔ stones |
| orientation | Rotate to face landmark | Statues facing tower |
| switches | Toggle to target pattern | Lever positions |
| placement | Put objects in slots | Shapes in pedestals |

### Validation Guarantees
- Generator creates puzzle + solution together
- Validator runs solver algorithm before commit
- Hint reachability checked (A* on navmesh)
- Auto-regeneration on failure (max 3 attempts)
- Fallback to simple sequence puzzle

### Hint System
- Tier 1 (8s): "Symbols glow in a pattern..."
- Tier 2 (15s): "The order matches the shadows..."
- Tier 3 (30s): "Activate from smallest to largest"
- Manual hint request available

## Input System

### Desktop
- PointerLock API for mouse look
- WASD/Arrows + E for interaction
- Configurable sensitivity, invert Y

### Mobile
- Virtual joystick (left half)
- Drag-to-look (right half)
- Large touch targets (44px minimum)
- Haptic feedback on interaction (where supported)
- Orientation lock to landscape

### Accessibility
- Reduced motion setting disables transitions
- High contrast mode
- Keyboard navigation for menus
- Screen reader friendly (ARIA labels)

## Audio System

### Procedural Generation (Tone.js)
- Ambient per zone (10 themes × unique textures)
- SFX synthesized at runtime (no assets needed)
- 3D positioning via Panner3D
- Category volumes: Master, Music, Ambient, SFX

### Implementation
```typescript
// Ambient: NoiseSynth + FeedbackDelay + Filter
// SFX: ToneAudioBuffer from procedural Float32Array
// Music: PolySynth loops (optional external tracks)
```

## Save System

### Storage
- Primary: localStorage (sync, simple)
- Fallback: IndexedDB (async, larger quota)
- Automatic migration between storage backends

### Save Data Structure
```json
{
  "version": 1,
  "timestamp": 1234567890,
  "gameMode": "journey",
  "seed": "abc123def456",
  "generatorVersion": 1,
  "currentZoneId": "zone_1_corridor",
  "playerPosition": { "x": 0, "y": 1.7, "z": 45 },
  "playerRotation": { "x": 0, "y": 0.5, "z": 0, "w": 0.87 },
  "visitedZones": ["zone_0_shore", "zone_1_corridor"],
  "objectStates": { "switch_1": { "active": true } },
  "solvedPuzzles": ["puzzle_shore_sequence"],
  "journalEntries": [...],
  "settings": { ... }
}
```

## UI System

### Components
- **Main Menu**: Continue, New Journey, Infinite Dream, Settings, About
- **Pause Menu**: Resume, Settings, Restart, Quit
- **HUD**: Render mode toggle, Journal button, Interaction prompt, Hint display
- **Journal**: Tabbed (Symbols, Phrases, Patterns, Hints, Observations)
- **Settings**: All game options with live preview
- **Transitions**: Full-screen overlay with type-specific text

### Design Principles
- Minimal HUD (diegetic where possible)
- Large touch targets
- Smooth GSAP animations (respect reduced-motion)
- High contrast mode support
- Bilingual (EN/RU)

## Performance Optimization

### Rendering
- InstancedMesh for grass, symbols, particles
- Frustum culling (Three.js built-in)
- Shadow map quality per preset
- Post-processing optional (disabled on Low)
- Symbol density scales with quality preset

### Memory
- Zone streaming (max 3 zones loaded)
- Geometry/material reuse
- Texture atlases (glyph atlas 1024×1024)
- Disposal on zone unload

### Mobile
- Auto quality detection
- Reduced symbol density (0.5×)
- No shadows on Low
- Simplified shaders
- Touch event passive listeners

## Known Limitations

1. **Navmesh**: Simplified grid-based, not full Recast/Detour
2. **Puzzles**: Template-based, not fully emergent
3. **Physics**: No rigid body simulation (raycast movement only)
4. **Audio**: Procedural only, no streaming music
5. **Multiplayer**: Single-player only
6. **VR/AR**: Not supported
7. **Save size**: localStorage 5MB limit (IndexedDB fallback)

## Future Extensibility

### Adding New Zones
1. Add theme to `ZONE_THEMES` and `ZONE_THEME_COLORS`
2. Define props in `getPropTypesForTheme`
3. Add key objects in `getKeyObjectsForTheme`
4. Create materials in `Renderer.createDreamMaterial`

### Adding Puzzle Types
1. Create `PuzzleTemplate` in `puzzle-templates.ts`
2. Register in `PUZZLE_TEMPLATES` array
3. Add validation/solving logic
4. Create hint text templates

### Adding Symbol Palettes
1. Add palette to `SYMBOL_PALETTES` in `colors.ts`
2. Define bg, fg, dim, accent, accent2, accent3
3. Register in `SYMBOL_PALETTES` object

## Testing

### Demo Scenario Validation
The "Journey" mode includes a curated 3-zone sequence that exercises:
- Basic movement and camera
- Interaction system (inspect, activate, switch)
- Puzzle solving (sequence, reflection)
- Mode switching (Dream ↔ Symbols)
- Zone transitions
- Journal entries
- Save/load

### Automated Checks (TODO)
- Seed determinism test
- Puzzle solvability verification
- Zone transition reachability
- Performance benchmarks

## License

MIT License — see LICENSE file.