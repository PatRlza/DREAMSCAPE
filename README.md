# DREAMSCAPE

A surreal exploration game with dual rendering modes — "Dream" (3D) and "Symbols" (glyph-based).

## Features

- **Dual Visual Modes**: Switch between "Dream" (stylized 3D with materials, lighting, fog) and "Symbols" (glyph-based rendering where the world is composed of dense text characters)
- **Procedural World Generation**: Zones with themes (shore, forest, corridor, city, field, stairs, room, garden, station, bridge) generated from a seed
- **Two Game Modes**: 
  - **Journey**: Structured progression with increasing puzzle complexity
  - **Infinite Dream**: Endless exploration without pressure
- **Puzzle System**: 7 puzzle types with validation (sequence, reflection, sound, pattern, orientation, switches, placement)
- **Cross-Platform**: Keyboard/mouse on desktop, touch controls on mobile
- **Save System**: Local persistence with seed, progress, and settings
- **Audio**: Procedural ambient sounds and SFX using Tone.js
- **PWA Support**: Installable, works offline

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The game will be available at `http://localhost:3000`

### Production Deployment

The `dist/` folder contains static files that can be deployed to any static hosting:

- **Netlify**: Drag and drop the `dist` folder
- **Vercel**: `vercel deploy dist`
- **GitHub Pages**: Push `dist` contents to `gh-pages` branch
- **Cloudflare Pages**: Connect repository, build command `npm run build`, output `dist`
- **Any static host**: Upload `dist/` contents

## Controls

### Desktop (Keyboard/Mouse)
| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Mouse | Look around |
| E / Click | Interact |
| V | Toggle render mode (Dream ↔ Symbols) |
| J | Toggle journal |
| Esc | Pause menu |
| L | Toggle mouse lock |

### Mobile (Touch)
- **Left side**: Virtual joystick for movement
- **Right side**: Drag to look around
- **⬆ button**: Interact
- **◈ button**: Toggle render mode
- **📖 button**: Journal
- **≡ button**: Menu

## Configuration

Settings are saved to localStorage and include:
- Render mode (Dream / Symbols)
- Quality preset (Auto / Low / Medium / High)
- Volume controls (Master, Music, Ambient, SFX)
- Mouse/Touch sensitivity
- Invert Y axis
- Reduced motion / High contrast
- Language (English / Russian)

## Architecture

```
src/
├── core/           # Game loop, constants, main entry
├── rendering/      # Dual-mode renderer (Dream + Symbols)
├── world/          # Procedural zone generation, streaming
├── player/         # Controller, input (keyboard/mouse/touch)
├── puzzles/        # Puzzle templates, manager, validation
├── interaction/    # Interactables, journal, hints
├── audio/          # Tone.js audio manager
├── ui/             # Menus, HUD, settings, transitions
├── save/           # Save/load system (localStorage + IndexedDB)
├── utils/          # Seeded RNG, math, colors, events
└── shaders/        # GLSL shaders for both render modes
```

## Demo Scenario

The "Journey" mode starts with a curated 3-zone sequence:
1. **Shore** — Beach with driftwood door, stone sequence puzzle
2. **Corridor** — Windows showing different times, shadow/switch puzzle
3. **Field/Stairs** — Golden field with massive staircase to clouds

Press **V** to toggle between Dream and Symbols mode at any time — the same scene renders in both modes.

## Technical Details

### Symbols Mode Implementation
- Single `InstancedMesh` with 500k quads covering view frustum
- Vertex shader: world position → glyph UV + depth sorting
- Fragment shader: samples glyph atlas, applies material palette, distance fade
- GPU-driven: density, size, contrast, palette, flicker via uniforms
- 4 built-in palettes: Monochrome, Terminal, Neon, Dreamscape

### Procedural Generation
- Seeded RNG (seedrandom) for deterministic worlds
- Zone graph: theme + secondary + lighting + scale + spatial rule + key object + transition
- Validation pass: pathfinding, puzzle solvability, hint reachability
- Streaming: preloads next zone during exploration

### Puzzle Validation
- Templates define generation + validation + solving logic
- Generator ensures solution exists before committing
- 3-tier hint system (attention → connection → direct)
- Auto-regeneration on validation failure

## License

MIT