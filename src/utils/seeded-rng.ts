import SeedRandom from 'seedrandom';

export class SeededRNG {
  private rng: any;
  private stateCache: string = '';

  constructor(seed: string) {
    this.rng = SeedRandom(seed, { global: false });
    // Cache initial state
    try {
      this.stateCache = this.rng.state ? this.rng.state() : seed;
    } catch {
      this.stateCache = seed;
    }
  }

  next(): number {
    return this.rng();
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.rng() * (max - min) + min;
  }

  nextBool(probability = 0.5): boolean {
    return this.rng() < probability;
  }

  choose<T>(array: T[]): T {
    return array[Math.floor(this.rng() * array.length)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  getState(): string {
    try {
      if (this.rng.state && typeof this.rng.state === 'function') {
        return this.rng.state();
      }
    } catch {}
    // Fallback: use cached state with a hash of call count
    return this.stateCache;
  }

  setState(state: string): void {
    try {
      if (this.rng.state && typeof this.rng.state === 'function') {
        this.rng.state(state);
        this.stateCache = state;
      } else {
        this.stateCache = state;
      }
    } catch {
      this.stateCache = state;
    }
  }

  fork(suffix: string): SeededRNG {
    return new SeededRNG(this.getState() + '|' + suffix);
  }
}

export function createRNG(seed: string): SeededRNG {
  return new SeededRNG(seed);
}