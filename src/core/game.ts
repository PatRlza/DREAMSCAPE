import * as THREE from 'three';
import { GAME_CONFIG } from './constants.js';
import type { GameMode, RenderMode, QualityPreset, SaveData, SettingsData, PlayerInput, Vector3Data, QuaternionData } from '../utils/types.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import { Renderer } from '../rendering/renderer.js';
import { WorldManager } from '../world/world-manager.js';
import { PlayerController } from '../player/player-controller.js';
import { InputManager } from '../player/input-manager.js';
import { PuzzleManager } from '../puzzles/puzzle-manager.js';
import { InteractionManager } from '../interaction/interaction-manager.js';
import { AudioManager } from '../audio/audio-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { SaveManager } from '../save/save-manager.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class Game extends EventEmitter {
  private renderer: Renderer;
  private world: WorldManager;
  private player: PlayerController;
  private input: InputManager;
  private puzzles: PuzzleManager;
  private interaction: InteractionManager;
  private audio: AudioManager;
  private ui: UIManager;
  private saveManager: SaveManager;
  
  private mode: GameMode = 'journey';
  private renderMode: RenderMode = 'dream';
  private quality: QualityPreset = 'auto';
  private isRunning = false;
  private lastTime = 0;
  private frameId: number | null = null;
  
  private seed = '';
  private generatorVersion: number = GAME_CONFIG.generatorVersion;
  
  constructor(private canvas: HTMLCanvasElement) {
    super();
    this.renderer = new Renderer(canvas);
    this.world = new WorldManager(this.renderer);
    this.player = new PlayerController(this.renderer.camera);
    this.input = new InputManager(canvas);
    this.puzzles = new PuzzleManager(this.world, this.player);
    this.interaction = new InteractionManager(this.world, this.player, this.puzzles);
    this.audio = new AudioManager();
    this.ui = new UIManager(this);
    this.saveManager = new SaveManager();
    
    this.setupEventListeners();
    this.loadSettings();
  }
  
  private setupEventListeners(): void {
    this.input.on('input', (input: PlayerInput) => this.handleInput(input));
    this.input.on('renderModeToggle', () => this.toggleRenderMode());
    this.input.on('journalToggle', () => this.ui.toggleJournal());
    this.input.on('menuToggle', () => {
      if (this.ui.isMenuOpen()) this.ui.hidePauseMenu();
      else this.ui.showPauseMenu();
    });
    
    this.world.on('zoneChanged', (zoneId: string) => this.onZoneChanged(zoneId));
    this.world.on('transitionTriggered', (data) => this.onTransition(data));
    
    this.puzzles.on('puzzleSolved', (puzzleId: string) => this.onPuzzleSolved(puzzleId));
    this.puzzles.on('hintRevealed', (hint) => this.ui.showHint(hint));
    
    this.interaction.on('promptShow', (prompt) => this.ui.showInteractionPrompt(prompt));
    this.interaction.on('promptHide', () => this.ui.hideInteractionPrompt());
    this.interaction.on('journalEntry', (entry) => this.ui.addJournalEntry(entry));
    
    this.ui.on('newGame', (mode: GameMode) => this.startNewGame(mode));
    this.ui.on('continueGame', () => this.continueGame());
    this.ui.on('settingsChanged', (settings: Partial<SettingsData>) => this.applySettings(settings));
    this.ui.on('quit', () => this.quit());
    
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('visibilitychange', () => this.onVisibilityChange());
  }
  
  private handleInput(input: PlayerInput): void {
    if (this.ui.isMenuOpen()) return;
    this.player.setInput(input);
  }
  
  async init(): Promise<void> {
    console.log('[Game] Initializing renderer...');
    await this.withTimeout(this.renderer.init(), 5000, 'Renderer init timeout');
    console.log('[Game] Renderer initialized');
    
    console.log('[Game] Initializing audio...');
    await this.withTimeout(this.audio.init(), 5000, 'Audio init timeout');
    console.log('[Game] Audio initialized');
    
    console.log('[Game] Initializing UI...');
    await this.withTimeout(this.ui.init(), 5000, 'UI init timeout');
    console.log('[Game] UI initialized');
    
    this.onResize();
    this.showLoadingComplete();
    console.log('[Game] Initialization complete');
  }
  
  private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(message)), ms)
      )
    ]);
  }
  
  private showLoadingComplete(): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
      setTimeout(() => loading.remove(), 500);
    }
  }
  
  startNewGame(mode: GameMode): void {
    this.mode = mode;
    this.seed = this.generateSeed();
    const rng = new SeededRNG(this.seed);
    
    this.world.generate(rng, mode);
    this.player.reset(this.world.getStartPosition());
    this.puzzles.reset();
    this.interaction.reset();
    this.ui.reset();
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.gameLoop.bind(this));
    
    this.audio.playAmbient(this.world.getCurrentZoneTheme());
    this.ui.hideMainMenu();
    this.saveGame();
  }
  
  async continueGame(): Promise<void> {
    const save = this.saveManager.load();
    if (!save) return;
    
    this.mode = save.gameMode;
    this.seed = save.seed;
    this.generatorVersion = save.generatorVersion;
    this.renderMode = save.settings.renderMode;
    this.quality = save.settings.quality;
    
    const rng = new SeededRNG(this.seed);
    await this.world.generate(rng, this.mode, save.currentZoneId);
    
    this.player.restore(save.playerPosition, save.playerRotation);
    this.puzzles.restore(save.solvedPuzzles, save.objectStates);
    this.interaction.restore(save.journalEntries);
    this.ui.restore(save.settings);
    
    this.applySettings(save.settings);
    this.renderer.setRenderMode(this.renderMode);
    this.renderer.setQuality(this.quality);
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.gameLoop.bind(this));
    
    this.audio.playAmbient(this.world.getCurrentZoneTheme());
    this.ui.hideMainMenu();
  }
  
  private gameLoop(time: number): void {
    if (!this.isRunning) return;
    
    const dt = Math.min((time - this.lastTime) / 1000, 1/30);
    this.lastTime = time;
    
    this.update(dt);
    this.render();
    
    this.frameId = requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  private update(dt: number): void {
    this.player.update(dt);
    this.world.update(dt, this.player.position);
    this.puzzles.update(dt);
    this.interaction.update(dt);
    this.audio.update(this.player.position);
    this.ui.update(dt);
  }
  
  private render(): void {
    this.renderer.render(this.player.camera, this.world.scene, this.renderMode);
  }
  
  private onZoneChanged(zoneId: string): void {
    this.puzzles.onZoneChange(zoneId);
    this.interaction.onZoneChange(zoneId);
    this.audio.playAmbient(this.world.getCurrentZoneTheme());
    this.saveGame();
  }
  
  private onTransition(data: { toZoneId: string; type: string }): void {
    this.ui.showTransition(data.type);
  }
  
  private onPuzzleSolved(puzzleId: string): void {
    this.ui.showPuzzleSolved(puzzleId);
    this.saveGame();
  }
  
  toggleRenderMode(): void {
    this.renderMode = this.renderMode === 'dream' ? 'symbols' : 'dream';
    this.renderer.setRenderMode(this.renderMode);
    this.ui.updateRenderModeButton(this.renderMode);
    this.saveGame();
  }
  
  setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;
    this.renderer.setRenderMode(mode);
    this.ui.updateRenderModeButton(mode);
    this.saveGame();
  }
  
  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    this.renderer.setQuality(quality);
    this.saveGame();
  }
  
  applySettings(settings: Partial<SettingsData>): void {
    if (settings.renderMode) this.setRenderMode(settings.renderMode);
    if (settings.quality) this.setQuality(settings.quality);
    if (settings.masterVolume !== undefined) this.audio.setMasterVolume(settings.masterVolume);
    if (settings.musicVolume !== undefined) this.audio.setMusicVolume(settings.musicVolume);
    if (settings.ambientVolume !== undefined) this.audio.setAmbientVolume(settings.ambientVolume);
    if (settings.sfxVolume !== undefined) this.audio.setSfxVolume(settings.sfxVolume);
    if (settings.mouseSensitivity !== undefined) this.input.setMouseSensitivity(settings.mouseSensitivity);
    if (settings.touchSensitivity !== undefined) this.input.setTouchSensitivity(settings.touchSensitivity);
    if (settings.invertY !== undefined) this.input.setInvertY(settings.invertY);
    if (settings.reducedMotion !== undefined) this.ui.setReducedMotion(settings.reducedMotion);
    if (settings.highContrast !== undefined) this.ui.setHighContrast(settings.highContrast);
    if (settings.language !== undefined) this.ui.setLanguage(settings.language);
  }
  
  private loadSettings(): void {
    const saved = localStorage.getItem(GAME_CONFIG.settingsKey);
    if (saved) {
      try {
        const settings = JSON.parse(saved) as SettingsData;
        this.applySettings(settings);
      } catch {
        // Ignore corrupted settings
      }
    }
    
    // Detect quality preset
    if (this.quality === 'auto') {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const gpuTier = (navigator as any).gpuBenchmark || 1;
      this.quality = isMobile ? 'low' : gpuTier > 2 ? 'high' : 'medium';
      this.renderer.setQuality(this.quality);
    }
  }
  
  saveGame(): void {
    if (!this.isRunning) return;
    
    const save: SaveData = {
      version: 1,
      timestamp: Date.now(),
      gameMode: this.mode,
      seed: this.seed,
      generatorVersion: this.generatorVersion,
      currentZoneId: this.world.getCurrentZoneId() || '',
      playerPosition: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      playerRotation: { x: this.player.rotation.x, y: this.player.rotation.y, z: this.player.rotation.z, w: this.player.rotation.w },
      visitedZones: this.world.getVisitedZones(),
      objectStates: this.puzzles.getObjectStates(),
      solvedPuzzles: this.puzzles.getSolvedPuzzles(),
      journalEntries: this.interaction.getJournalEntries(),
      settings: {
        renderMode: this.renderMode,
        quality: this.quality,
        musicVolume: this.audio.getMusicVolume(),
        ambientVolume: this.audio.getAmbientVolume(),
        sfxVolume: this.audio.getSfxVolume(),
        masterVolume: this.audio.getMasterVolume(),
        mouseSensitivity: this.input.getMouseSensitivity(),
        touchSensitivity: this.input.getTouchSensitivity(),
        invertY: this.input.getInvertY(),
        reducedMotion: this.ui.getReducedMotion(),
        highContrast: this.ui.getHighContrast(),
        language: this.ui.getLanguage()
      }
    };
    
    this.saveManager.save(save);
  }
  
  private generateSeed(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let seed = '';
    for (let i = 0; i < 12; i++) {
      seed += chars[Math.floor(Math.random() * chars.length)];
    }
    return seed;
  }
  
  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.ui.onResize(window.innerWidth, window.innerHeight);
  }
  
  private onVisibilityChange(): void {
    if (document.hidden) {
      this.audio.pauseAll();
      this.saveGame();
    } else {
      this.audio.resumeAll();
      this.lastTime = performance.now();
    }
  }
  
  quit(): void {
    this.isRunning = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.saveGame();
    this.audio.stopAll();
    this.ui.showMainMenu(this.mode);
  }
  
  getSeed(): string { return this.seed; }
  getMode(): GameMode { return this.mode; }
  getRenderMode(): RenderMode { return this.renderMode; }
  getQuality(): QualityPreset { return this.quality; }
  isPaused(): boolean { return this.ui.isMenuOpen(); }
}