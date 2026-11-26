# DREAMSCAPE — Technology Stack & Architecture Decisions

## Core Technologies

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript | Type safety for complex game systems, excellent IDE support, compiles to clean JS |
| **3D Engine** | Three.js (r160+) | Mature WebGL abstraction, excellent mobile performance, huge ecosystem, shader support |
| **Build Tool** | Vite | Fast HMR, optimized production builds, native ES modules, easy static deployment |
| **Animation** | GSAP | Performant UI transitions, timeline control, small footprint |
| **Audio** | Tone.js | Web Audio API wrapper, synthesis + sampling, scheduling, mobile-friendly |
| **RNG** | seedrandom | Deterministic seeded generation, lightweight, no dependencies |
| **State** | Custom minimal store | Avoids overhead, full control over serialization for saves |

## Architecture Overview

```
src/
├── core/           # Engine bootstrap, game loop, asset loading
├── world/          # Procedural generation, zone management, transitions
├── rendering/      # Dual-mode renderer (Dream/Symbols), shaders, post-processing
├── player/         # Controller, camera, input (keyboard/touch)
├── puzzles/        # Puzzle definitions, generator, validator, hint system
├── interaction/    # Interactables, journal, hints
├── audio/          # Ambient, SFX, music management
├── ui/             # Menus, HUD, settings, save/load
├── save/           # Serialization, localStorage/IndexedDB
└── utils/          # Math, seeded RNG, helpers
```

## Rendering Modes Implementation

### Mode A: "Dream" (Standard 3D)
- PBR materials with custom shader chunks for stylized look
- Volumetric fog via shader (not Three.js Fog)
- Screen-space effects: subtle bloom, vignette, color grading
- Instanced grass/foliage, water shader with reflections
- Dynamic time-of-day lighting per zone

### Mode B: "Symbols" (Glyph Field)
- **Single InstancedMesh** covering view frustum with glyph atlas texture
- Custom vertex shader: projects world position → glyph UV + depth sorting
- Fragment shader: samples glyph atlas, applies material-based palette, distance fade
- GPU-driven: symbol density, size, contrast, palette, flicker via uniforms
- Preserves depth, silhouette, perspective — no CPU-side text rendering
- 4 built-in palettes: Monochrome, Terminal, Neon, Dreamscape

## Procedural Generation

- **Zone Graph**: Each zone = theme + secondary theme + lighting + scale + spatial rule + key object + transition type
- **Seeded RNG**: `seedrandom` with zone index + global seed → deterministic
- **Validation Pass**: Before commit, run pathfinding (A* on navmesh), puzzle solvability check, hint reachability
- **Streaming**: Preload next zone during current zone exploration

## Puzzle System

- **Puzzle Template**: Type + parameterized logic + required hints + validation function
- **Generator**: Fills template with zone-specific objects, ensures solution exists
- **Validator**: Runs solver algorithm; if unsolvable → regenerate or fallback template
- **Hints**: 3-tier (attention → connection → direct), unlocked by time/proximity

## Mobile Considerations

- Touch: Virtual joystick (left) + interaction button (right) + swipe area for camera
- Quality presets: Auto/Low/Medium/High adjust symbol density, shadow maps, post-processing
- `prefers-reduced-motion`, `prefers-contrast` respected
- Wake lock API for long sessions
- Viewport handling for notches, address bar hide/show

## Deployment

- `npm run build` → `dist/` static files
- Deploy to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages)
- Service Worker for offline play (Workbox via Vite PWA plugin)
- No server required