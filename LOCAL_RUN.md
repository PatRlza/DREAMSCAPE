# DREAMSCAPE — Local Run Instructions

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+ (comes with Node.js)
- Modern browser with WebGL2 support

## Quick Start

```bash
# Clone/download the project
cd dreamscape

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open at `http://localhost:3000`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Development Workflow

### Hot Module Replacement
- Changes to TypeScript/GLSL/HTML/CSS trigger instant reload
- Game state preserved during HMR for most changes
- Shaders recompile on save

### Debugging
Open DevTools (F12):
- **Console**: Game logs, errors
- **Sources**: TypeScript source maps enabled
- **Network**: Asset loading
- **Application**: localStorage, service worker

### Useful Console Commands
```javascript
// Access game instance
game.getSeed()           // Current world seed
game.getMode()           // 'journey' or 'infinite'
game.getRenderMode()     // 'dream' or 'symbols'

// Teleport (dev only)
game.player.position.set(0, 1.7, 100)

// Toggle render mode
game.toggleRenderMode()

// Save/load
game.saveGame()
// Reload page to test load
```

## Project Structure

```
dreamscape/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite + PWA config
├── README.md               # This file
├── DEPLOYMENT.md           # Deployment guide
├── TECHNICAL_SUMMARY.md    # Architecture docs
├── public/                 # Static assets
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   ├── pwa-*.png
│   └── textures/
│       └── noise.png       # Procedural noise texture
└── src/
    ├── main.ts             # Entry point
    ├── core/
    │   ├── constants.ts    # Game constants
    │   ├── game.ts         # Main game class
    │   └── ...
    ├── rendering/
    │   ├── renderer.ts     # Dual-mode renderer
    │   └── shaders/        # GLSL shaders
    ├── world/
    │   ├── world-manager.ts    # Zone streaming
    │   ├── zone-generator.ts   # Procedural generation
    │   └── demo-scenario.ts    # Curated demo zones
    ├── player/
    │   ├── player-controller.ts  # Movement, camera
    │   └── input-manager.ts      # Keyboard/mouse/touch
    ├── puzzles/
    │   ├── puzzle-manager.ts     # Puzzle lifecycle
    │   └── puzzle-templates.ts   # 7 puzzle types
    ├── interaction/
    │   └── interaction-manager.ts  # Interactables, journal
    ├── audio/
    │   └── audio-manager.ts      # Tone.js audio
    ├── ui/
    │   └── ui-manager.ts         # Menus, HUD, settings
    ├── save/
    │   └── save-manager.ts       # localStorage/IndexedDB
    └── utils/
        ├── seeded-rng.ts     # Deterministic RNG
        ├── math.ts           # Math helpers
        ├── colors.ts         # Palettes, theme colors
        ├── types.ts          # TypeScript interfaces
        └── event-emitter.ts  # Pub/sub
```

## Configuration

### Quality Presets
| Preset | Symbol Density | Shadow Map | Post-Process | Target |
|--------|----------------|------------|--------------|--------|
| Auto   | Detects device | Adaptive   | Adaptive     | Best balance |
| Low    | 0.5×           | Off        | Off          | Old phones |
| Medium | 0.75×          | 512        | On           | Typical |
| High   | 1.5×           | 2048       | On           | Desktop |

### Settings Persistence
All settings saved to `localStorage` key `dreamscape_settings`:
- Render mode, quality
- Volume sliders (0-1)
- Sensitivity, invert Y
- Accessibility options
- Language (EN/RU)

## Troubleshooting

### "Failed to initialize" Error
1. Check browser console for details
2. Verify WebGL2 support: https://webglreport.com
3. Try `?quality=low` in URL
4. Update graphics drivers

### Black Screen / White Screen
- Wait for shader compilation (first load ~3-5s)
- Check for shader compilation errors in console
- Try refreshing page

### Audio Not Playing
- Browser requires user gesture first
- Click anywhere on canvas to unlock audio
- Check browser autoplay policy

### Save Not Working
- Private/incognito mode blocks localStorage
- Check available storage: `navigator.storage.estimate()`
- Try clearing site data and reloading

### Mobile Issues
- **iOS Safari**: Requires user gesture for audio, fullscreen via "Add to Home Screen"
- **Android Chrome**: Works best, install as PWA for fullscreen
- **Orientation**: Game locks to landscape; rotate device

### Performance
| Issue | Fix |
|-------|-----|
| Low FPS | Lower quality in settings |
| Stutter | Close other tabs, reduce symbol density |
| Overheating | Enable "Reduced Motion", lower quality |
| Crashes | Reduce quality, close other apps |

## Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90 | Full support |
| Firefox | 88 | Full support |
| Safari | 14 | WebGL2, some shader limits |
| Edge | 90 | Full support |
| Samsung Internet | 13 | Full support |

### Required Features
- WebGL2 (fallback to WebGL1 with reduced features)
- Web Audio API (silent fallback if unavailable)
- localStorage / IndexedDB
- PointerLock API (desktop mouse look)
- requestAnimationFrame

## Testing the Demo Scenario

The "Journey" mode includes a curated 3-zone sequence:

1. **Shore** (zone_0_shore)
   - Spawn on beach, door in distance
   - Find driftwood with 3 symbols (◆ ▲ ●)
   - Three stones matching symbols
   - Activate in correct order → door opens

2. **Corridor** (zone_1_corridor)
   - Three windows showing dawn/noon/dusk
   - Painting with three shadows
   - Three switches at end
   - Match shadow directions → door opens

3. **Field/Stairs** (zone_2_field)
   - Golden field, massive staircase to clouds
   - Walking up reveals cloud platforms
   - Transition to next zone

**Test Checklist:**
- [ ] Movement (WASD + mouse / touch)
- [ ] Camera follow, no clipping
- [ ] Interaction prompts appear
- [ ] Driftwood inspection → journal entry
- [ ] Stone activation sequence puzzle
- [ ] Door opens, transition triggers
- [ ] Corridor windows inspectable
- [ ] Shadow painting → hint
- [ ] Switch puzzle solves
- [ ] V key toggles Dream/Symbols
- [ ] J key opens journal
- [ ] Esc opens pause menu
- [ ] Settings persist after reload
- [ ] Save/load works

## Extending the Game

### Add a Zone Theme
1. Add to `ZONE_THEMES` in `core/constants.ts`
2. Add colors to `ZONE_THEME_COLORS` in `utils/colors.ts`
3. Add props in `getPropTypesForTheme` in `world/zone-generator.ts`
4. Add key objects in `getKeyObjectsForTheme`
5. Create materials in `Renderer.createDreamMaterial`

### Add a Puzzle Type
1. Create template in `puzzles/puzzle-templates.ts`
2. Implement `generate`, `validate`, `solve`
3. Register in `PUZZLE_TEMPLATES` array
4. Add hint text templates

### Add Symbol Palette
1. Add to `SYMBOL_PALETTES` in `utils/colors.ts`
2. Define bg, fg, dim, accent, accent2, accent3
3. Register in `SYMBOL_PALETTES` object

## License

MIT License — see LICENSE file.