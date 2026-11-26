import * as Tone from 'tone';
import { EventEmitter } from '../utils/event-emitter.js';
import type { AudioConfig } from '../utils/types.js';
import { GAME_CONFIG } from '../core/constants.js';

interface AudioSource {
  node: any;
  volume: any;
  playing: boolean;
  type: 'music' | 'ambient' | 'sfx';
}

export class AudioManager extends EventEmitter {
  private masterVolume: any;
  private musicVolume: any;
  private ambientVolume: any;
  private sfxVolume: any;
  
  private musicSources: Map<string, AudioSource> = new Map();
  private ambientSources: Map<string, AudioSource> = new Map();
  private sfxBuffers: Map<string, any> = new Map();
  
  private currentAmbient: string | null = null;
  private currentMusic: string | null = null;
  private isInitialized = false;
  private audioContextUnlocked = false;
  
  constructor() {
    super();
    this.setupAudioGraph();
  }
  
  private setupAudioGraph(): void {
    try {
      // Master volume
      this.masterVolume = new Tone.Volume(GAME_CONFIG.defaultMasterVolume).toDestination();
      
      // Category volumes
      this.musicVolume = new Tone.Volume(GAME_CONFIG.defaultMusicVolume).connect(this.masterVolume);
      this.ambientVolume = new Tone.Volume(GAME_CONFIG.defaultAmbientVolume).connect(this.masterVolume);
      this.sfxVolume = new Tone.Volume(GAME_CONFIG.defaultSfxVolume).connect(this.masterVolume);
    } catch (e) {
      console.warn('Audio graph setup failed:', e);
    }
  }
  
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Generate sounds immediately (synchronous, no Tone.start needed)
      this.generateProceduralSounds();
      await this.loadAudioFiles();
      this.isInitialized = true;
      console.log('[Audio] Initialized (deferred Tone.start)');
    } catch (error) {
      console.warn('Audio initialization failed:', error);
      this.isInitialized = true; // Never block game init
    }
  }
  
  private generateProceduralSounds(): void {
    try {
      this.sfxBuffers.set('interact', this.createSimpleBuffer(800, 0.1));
      this.sfxBuffers.set('activate_on', this.createSimpleBuffer(400, 0.3));
      this.sfxBuffers.set('activate_off', this.createSimpleBuffer(300, 0.3));
      this.sfxBuffers.set('rotate', this.createSimpleBuffer(500, 0.2));
      this.sfxBuffers.set('switch', this.createSimpleBuffer(600, 0.15));
      this.sfxBuffers.set('puzzle_solved', this.createSimpleBuffer(523, 0.5));
      this.sfxBuffers.set('transition', this.createSimpleBuffer(200, 1.0));
      this.sfxBuffers.set('footstep_grass', this.createSimpleBuffer(200, 0.1));
      this.sfxBuffers.set('footstep_stone', this.createSimpleBuffer(400, 0.1));
      this.sfxBuffers.set('footstep_wood', this.createSimpleBuffer(300, 0.1));
      this.sfxBuffers.set('footstep_sand', this.createSimpleBuffer(150, 0.1));
    } catch (e) {
      console.warn('Sound creation failed:', e);
    }
  }
  
  private createSimpleBuffer(freq: number, duration: number): any {
    try {
      const ctx = Tone.getContext();
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(duration * sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.3;
      }
      
      return new Tone.ToneAudioBuffer(buffer);
    } catch (e) {
      return null;
    }
  }
  
  async loadAudioFiles(): Promise<void> {
    // Placeholder for external audio files
  }
  
  async unlockAudioContext(): Promise<void> {
    if (this.audioContextUnlocked) return;
    try {
      await Tone.start();
      this.audioContextUnlocked = true;
      console.log('[Audio] Context unlocked');
    } catch (e) {
      console.warn('Audio context unlock failed:', e);
    }
  }
  
  playAmbient(theme: string): void {
    if (this.currentAmbient === theme) return;
    
    if (this.currentAmbient) {
      const current = this.ambientSources.get(this.currentAmbient);
      if (current?.volume) {
        current.volume.volume.value = -60;
      }
    }
    
    const next = this.ambientSources.get(theme);
    if (next?.volume) {
      next.volume.volume.value = -20;
      this.currentAmbient = theme;
    }
  }
  
  playMusic(track: string): void {
    this.currentMusic = track;
  }
  
  playSFX(name: string, position?: any): void {
    const buffer = this.sfxBuffers.get(name);
    if (!buffer) return;
    
    try {
      const player = new Tone.Player(buffer).connect(this.sfxVolume);
      player.start();
      player.onstop = () => player.dispose();
    } catch (e) {
      console.warn('SFX play failed:', e);
    }
  }
  
  update(listenerPosition: any): void {
    try {
      Tone.Listener.positionX.value = listenerPosition.x;
      Tone.Listener.positionY.value = listenerPosition.y;
      Tone.Listener.positionZ.value = listenerPosition.z;
    } catch (e) {}
  }
  
  setMasterVolume(volume: number): void {
    try { this.masterVolume.volume.rampTo(this.gainToDb(volume), 0.1); } catch (e) {}
  }
  
  setMusicVolume(volume: number): void {
    try { this.musicVolume.volume.rampTo(this.gainToDb(volume), 0.1); } catch (e) {}
  }
  
  setAmbientVolume(volume: number): void {
    try { this.ambientVolume.volume.rampTo(this.gainToDb(volume), 0.1); } catch (e) {}
  }
  
  setSfxVolume(volume: number): void {
    try { this.sfxVolume.volume.rampTo(this.gainToDb(volume), 0.1); } catch (e) {}
  }
  
  getMasterVolume(): number { return this.dbToGain(this.masterVolume?.volume?.value || 0); }
  getMusicVolume(): number { return this.dbToGain(this.musicVolume?.volume?.value || 0); }
  getAmbientVolume(): number { return this.dbToGain(this.ambientVolume?.volume?.value || 0); }
  getSfxVolume(): number { return this.dbToGain(this.sfxVolume?.volume?.value || 0); }
  
  private gainToDb(gain: number): number {
    return Math.log10(Math.max(gain, 0.0001)) * 20;
  }
  
  private dbToGain(db: number): number {
    return Math.pow(10, db / 20);
  }
  
  pauseAll(): void {
    try { Tone.Transport.pause(); } catch (e) {}
    for (const source of this.ambientSources.values()) {
      if (source.playing && source.node?.mute !== undefined) source.node.mute = true;
    }
  }
  
  resumeAll(): void {
    try { Tone.Transport.start(); } catch (e) {}
    for (const source of this.ambientSources.values()) {
      if (source.playing && source.node?.mute !== undefined) source.node.mute = false;
    }
  }
  
  stopAll(): void {
    try { Tone.Transport.stop(); } catch (e) {}
    for (const source of this.ambientSources.values()) {
      source.node?.dispose?.();
      source.playing = false;
    }
    for (const source of this.musicSources.values()) {
      source.node?.dispose?.();
      source.playing = false;
    }
  }
  
  dispose(): void {
    this.stopAll();
    this.masterVolume?.dispose?.();
    this.musicVolume?.dispose?.();
    this.ambientVolume?.dispose?.();
    this.sfxVolume?.dispose?.();
    for (const buffer of this.sfxBuffers.values()) {
      buffer?.dispose?.();
    }
  }
}