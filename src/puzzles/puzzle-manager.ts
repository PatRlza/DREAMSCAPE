import { EventEmitter } from '../utils/event-emitter.js';
import { SeededRNG } from '../utils/seeded-rng.js';
import { PUZZLE_TEMPLATES, getPuzzleTemplate, getRandomPuzzleType } from './puzzle-templates.js';
import type { PuzzleData, PuzzleType, PuzzleState, HintData, WorldObjectData } from '../utils/types.js';
import { WorldManager } from '../world/world-manager.js';
import { PlayerController } from '../player/player-controller.js';

interface ActivePuzzle {
  puzzle: PuzzleData;
  playerProgress: Record<string, any>;
  hintTimers: Map<number, number>;
  currentHintTier: number;
}

export class PuzzleManager extends EventEmitter {
  private world: WorldManager;
  private player: PlayerController;
  private puzzles: Map<string, PuzzleData> = new Map();
  private activePuzzles: Map<string, ActivePuzzle> = new Map();
  private solvedPuzzles: Set<string> = new Set();
  private objectStates: Map<string, any> = new Map();
  private currentZoneId: string | null = null;
  private rng: SeededRNG;
  
  constructor(world: WorldManager, player: PlayerController) {
    super();
    this.world = world;
    this.player = player;
    this.rng = new SeededRNG('');
  }
  
  reset(): void {
    this.puzzles.clear();
    this.activePuzzles.clear();
    this.solvedPuzzles.clear();
    this.objectStates.clear();
    this.currentZoneId = null;
  }
  
  generatePuzzlesForZone(zoneId: string, rng: SeededRNG): void {
    const zoneData = this.world.getZoneData(zoneId);
    if (!zoneData) return;
    
    this.currentZoneId = zoneId;
    const zoneTheme = zoneData.theme.primary;
    const objects = zoneData.objects;
    
    // Determine number of puzzles based on zone and progression
    const puzzleCount = this.getPuzzleCountForZone(zoneId);
    const usedTypes: PuzzleType[] = [];
    
    for (let i = 0; i < puzzleCount; i++) {
      const type = getRandomPuzzleType(rng, usedTypes);
      usedTypes.push(type);
      
      const template = getPuzzleTemplate(type);
      if (!template) continue;
      
      const puzzle = template.generate(rng, zoneTheme as any, objects);
      puzzle.zoneId = zoneId;
      
      // Validate puzzle
      if (template.validate(puzzle, objects)) {
        this.puzzles.set(puzzle.id, puzzle);
        this.activatePuzzle(puzzle.id);
      } else {
        // Try fallback
        const fallbackTemplate = getPuzzleTemplate('sequence');
        if (fallbackTemplate) {
          const fallback = fallbackTemplate.generate(rng, zoneTheme as any, objects);
          fallback.zoneId = zoneId;
          this.puzzles.set(fallback.id, fallback);
          this.activatePuzzle(fallback.id);
        }
      }
    }
  }
  
  private getPuzzleCountForZone(zoneId: string): number {
    const zoneIndex = this.world.getVisitedZones().indexOf(zoneId);
    if (zoneIndex < 0) return 1;
    
    // Journey mode: progressive complexity
    // Zone 0: 1 simple puzzle
    // Zone 1-2: 1-2 puzzles
    // Zone 3-5: 2 puzzles with combined hints
    // Zone 6+: 2-3 puzzles
    if (zoneIndex === 0) return 1;
    if (zoneIndex <= 2) return Math.min(2, zoneIndex);
    if (zoneIndex <= 5) return 2;
    return 2; // Could be 3 for later zones
  }
  
  private activatePuzzle(puzzleId: string): void {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) return;
    
    puzzle.state = 'active';
    this.activePuzzles.set(puzzleId, {
      puzzle,
      playerProgress: {},
      hintTimers: new Map(),
      currentHintTier: 0
    });
    
    // Schedule hint reveals
    this.scheduleHints(puzzleId);
  }
  
  private scheduleHints(puzzleId: string): void {
    const active = this.activePuzzles.get(puzzleId);
    if (!active) return;
    
    const hintDelays = [8000, 15000, 30000]; // Tier 1, 2, 3
    
    active.puzzle.hints.forEach((hint, index) => {
      if (hint.tier <= 3) {
        const timer = window.setTimeout(() => {
          this.revealHint(puzzleId, hint.id);
        }, hintDelays[hint.tier - 1]);
        active.hintTimers.set(hint.tier, timer);
      }
    });
  }
  
  private revealHint(puzzleId: string, hintId: string): void {
    const active = this.activePuzzles.get(puzzleId);
    if (!active) return;
    
    const hint = active.puzzle.hints.find(h => h.id === hintId);
    if (hint && !hint.revealed) {
      hint.revealed = true;
      active.currentHintTier = Math.max(active.currentHintTier, hint.tier);
      this.emit('hintRevealed', hint);
    }
  }
  
  update(dt: number): void {
    // Update active puzzles, check for solutions
    for (const [puzzleId, active] of this.activePuzzles) {
      if (active.puzzle.state === 'solved') continue;
      
      // Check if puzzle is solved based on object states
      if (this.checkPuzzleSolution(puzzleId)) {
        this.solvePuzzle(puzzleId);
      }
    }
  }
  
  private checkPuzzleSolution(puzzleId: string): boolean {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) return false;
    
    const template = getPuzzleTemplate(puzzle.type);
    if (!template) return false;
    
    const zoneData = this.world.getZoneData(this.currentZoneId!);
    if (!zoneData) return false;
    
    // Get current object states
    const objects = zoneData.objects.filter(o => puzzle.requiredObjects.includes(o.id));
    
    // Delegate to template solver
    // In a real implementation, this would check actual game state
    return false; // Placeholder - actual solving happens via interaction
  }
  
  onPlayerAction(puzzleId: string, action: any): void {
    const active = this.activePuzzles.get(puzzleId);
    if (!active || active.puzzle.state !== 'active') return;
    
    const template = getPuzzleTemplate(active.puzzle.type);
    if (!template) return;
    
    // Update player progress
    active.playerProgress[action.objectId] = action;
    
    // Check solution
    if (template.solve(active.puzzle, action)) {
      this.solvePuzzle(puzzleId);
    }
  }
  
  private solvePuzzle(puzzleId: string): void {
    const active = this.activePuzzles.get(puzzleId);
    if (!active) return;
    
    active.puzzle.state = 'solved';
    this.solvedPuzzles.add(puzzleId);
    
    // Clear hint timers
    for (const timer of active.hintTimers.values()) {
      clearTimeout(timer);
    }
    active.hintTimers.clear();
    
    this.emit('puzzleSolved', puzzleId);
    
    // Check for zone completion
    this.checkZoneCompletion();
  }
  
  private checkZoneCompletion(): void {
    if (!this.currentZoneId) return;
    
    const zonePuzzles = Array.from(this.puzzles.values()).filter(p => p.zoneId === this.currentZoneId);
    const allSolved = zonePuzzles.every(p => p.state === 'solved');
    
    if (allSolved && zonePuzzles.length > 0) {
      // Enable transitions that require puzzle completion
      this.emit('zoneCompleted', this.currentZoneId);
    }
  }
  
  onZoneChange(zoneId: string): void {
    // Deactivate puzzles from previous zone
    for (const [, active] of this.activePuzzles) {
      if (active.puzzle.zoneId !== zoneId) {
        for (const timer of active.hintTimers.values()) {
          clearTimeout(timer);
        }
      }
    }
  }
  
  restore(solvedPuzzleIds: string[], objectStates: Record<string, any>): void {
    this.solvedPuzzles = new Set(solvedPuzzleIds);
    this.objectStates = new Map(Object.entries(objectStates));
    
    // Restore puzzle states
    for (const [id, puzzle] of this.puzzles) {
      if (this.solvedPuzzles.has(id)) {
        puzzle.state = 'solved';
      }
    }
  }
  
  getObjectStates(): Record<string, any> {
    return Object.fromEntries(this.objectStates);
  }
  
  getSolvedPuzzles(): string[] {
    return Array.from(this.solvedPuzzles);
  }
  
  setObjectState(objectId: string, state: any): void {
    this.objectStates.set(objectId, state);
    
    // Check if this affects any active puzzle
    for (const [puzzleId, active] of this.activePuzzles) {
      if (active.puzzle.requiredObjects.includes(objectId)) {
        this.onPlayerAction(puzzleId, { objectId, state });
      }
    }
  }
  
  getPuzzle(puzzleId: string): PuzzleData | undefined {
    return this.puzzles.get(puzzleId);
  }
  
  getActivePuzzles(): PuzzleData[] {
    return Array.from(this.activePuzzles.values())
      .filter(a => a.puzzle.state === 'active')
      .map(a => a.puzzle);
  }
  
  getHintsForPuzzle(puzzleId: string): HintData[] {
    const active = this.activePuzzles.get(puzzleId);
    return active ? active.puzzle.hints.filter(h => h.revealed) : [];
  }
  
  // Request hint manually (for hint button)
  requestHint(puzzleId: string): void {
    const active = this.activePuzzles.get(puzzleId);
    if (!active) return;
    
    const nextHint = active.puzzle.hints
      .filter(h => !h.revealed)
      .sort((a, b) => a.tier - b.tier)[0];
    
    if (nextHint) {
      this.revealHint(puzzleId, nextHint.id);
    }
  }
  
  dispose(): void {
    for (const active of this.activePuzzles.values()) {
      for (const timer of active.hintTimers.values()) {
        clearTimeout(timer);
      }
    }
    this.activePuzzles.clear();
    this.puzzles.clear();
  }
}