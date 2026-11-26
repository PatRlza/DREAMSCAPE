import type { SaveData, SettingsData, JournalEntry, Vector3Data, QuaternionData } from '../utils/types.js';
import { GAME_CONFIG } from '../core/constants.js';

const SAVE_KEY = GAME_CONFIG.saveKey;
const SETTINGS_KEY = GAME_CONFIG.settingsKey;
const SAVE_VERSION = 1;

export class SaveManager {
  private useIndexedDB = false;
  private db: IDBDatabase | null = null;
  
  constructor() {
    this.checkIndexedDBAvailability();
  }
  
  private async checkIndexedDBAvailability(): Promise<void> {
    if ('indexedDB' in window) {
      try {
        this.useIndexedDB = true;
        await this.initIndexedDB();
      } catch {
        this.useIndexedDB = false;
      }
    }
  }
  
  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DREAMSCAPE', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
    });
  }
  
  save(data: SaveData): void {
    // Validate save data
    if (!this.validateSaveData(data)) {
      console.error('Invalid save data');
      return;
    }
    
    data.version = SAVE_VERSION;
    data.timestamp = Date.now();
    
    const serialized = JSON.stringify(data);
    
    if (this.useIndexedDB && this.db) {
      this.saveToIndexedDB(data);
    } else {
      try {
        localStorage.setItem(SAVE_KEY, serialized);
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
        // Try to clear old saves and retry
        this.clearOldSaves();
        try {
          localStorage.setItem(SAVE_KEY, serialized);
        } catch {
          console.error('Save failed completely');
        }
      }
    }
  }
  
  private async saveToIndexedDB(data: SaveData): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['saves'], 'readwrite');
    const store = transaction.objectStore('saves');
    await store.put({ id: 'main', ...data });
  }
  
  load(): SaveData | null {
    if (this.useIndexedDB && this.db) {
      return this.loadFromIndexedDB();
    } else {
      return this.loadFromLocalStorage();
    }
  }
  
  private loadFromIndexedDB(): SaveData | null {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['saves'], 'readonly');
    const store = transaction.objectStore('saves');
    const request = store.get('main');
    
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { id, ...data } = result;
        return this.validateSaveData(data) ? data : null;
      }
      return null;
    };
    
    // Synchronous fallback for now
    return this.loadFromLocalStorage();
  }
  
  private loadFromLocalStorage(): SaveData | null {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return null;
      
      const data = JSON.parse(saved) as SaveData;
      return this.validateSaveData(data) ? data : null;
    } catch (e) {
      console.warn('Failed to load save:', e);
      return null;
    }
  }
  
  private validateSaveData(data: any): data is SaveData {
    if (!data || typeof data !== 'object') return false;
    if (data.version !== SAVE_VERSION) return false;
    if (!data.seed || typeof data.seed !== 'string') return false;
    if (!data.gameMode || !['journey', 'infinite'].includes(data.gameMode)) return false;
    if (!data.playerPosition || !data.playerRotation) return false;
    if (!Array.isArray(data.visitedZones)) return false;
    if (!Array.isArray(data.solvedPuzzles)) return false;
    if (!Array.isArray(data.journalEntries)) return false;
    if (!data.settings || typeof data.settings !== 'object') return false;
    
    return true;
  }
  
  saveSettings(settings: SettingsData): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }
  
  loadSettings(): SettingsData | null {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (!saved) return null;
      return JSON.parse(saved) as SettingsData;
    } catch {
      return null;
    }
  }
  
  hasSave(): boolean {
    if (this.useIndexedDB && this.db) {
      // Would need async check
      return true;
    }
    return !!localStorage.getItem(SAVE_KEY);
  }
  
  deleteSave(): void {
    if (this.useIndexedDB && this.db) {
      const transaction = this.db.transaction(['saves'], 'readwrite');
      const store = transaction.objectStore('saves');
      store.delete('main');
    }
    localStorage.removeItem(SAVE_KEY);
  }
  
  private clearOldSaves(): void {
    // Remove any non-essential localStorage items
    const keysToKeep = [SAVE_KEY, SETTINGS_KEY];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.includes(key as typeof SAVE_KEY)) {
        localStorage.removeItem(key);
      }
    }
  }
  
  // Export/import for backup
  exportSave(): string | null {
    const save = this.load();
    if (!save) return null;
    return JSON.stringify(save, null, 2);
  }
  
  importSave(json: string): boolean {
    try {
      const data = JSON.parse(json) as SaveData;
      if (this.validateSaveData(data)) {
        this.save(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  // Create a save data object from game state
  static createSaveData(params: {
    gameMode: 'journey' | 'infinite';
    seed: string;
    generatorVersion: number;
    currentZoneId: string;
    playerPosition: THREE.Vector3;
    playerRotation: THREE.Quaternion;
    visitedZones: string[];
    objectStates: Record<string, any>;
    solvedPuzzles: string[];
    journalEntries: JournalEntry[];
    settings: SettingsData;
  }): SaveData {
    return {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      gameMode: params.gameMode,
      seed: params.seed,
      generatorVersion: params.generatorVersion,
      currentZoneId: params.currentZoneId,
      playerPosition: { x: params.playerPosition.x, y: params.playerPosition.y, z: params.playerPosition.z } as Vector3Data,
      playerRotation: { x: params.playerRotation.x, y: params.playerRotation.y, z: params.playerRotation.z, w: params.playerRotation.w } as QuaternionData,
      visitedZones: params.visitedZones,
      objectStates: params.objectStates,
      solvedPuzzles: params.solvedPuzzles,
      journalEntries: params.journalEntries,
      settings: params.settings
    };
  }
}

// THREE namespace for type references
declare const THREE: any;