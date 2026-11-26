import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import type { InteractionPrompt, JournalEntry, WorldObjectData } from '../utils/types.js';
import { WorldManager } from '../world/world-manager.js';
import { PlayerController } from '../player/player-controller.js';
import { PuzzleManager } from '../puzzles/puzzle-manager.js';
import { GAME_CONFIG } from '../core/constants.js';

interface InteractableObject {
  mesh: THREE.Mesh | THREE.Group;
  objectId: string;
  data: any;
  interactionType: 'interact' | 'inspect' | 'use' | 'read' | 'activate' | 'rotate' | 'switch';
  promptMessage: string;
  distance: number;
  lastInteraction: number;
}

export class InteractionManager extends EventEmitter {
  private world: WorldManager;
  private player: PlayerController;
  private puzzles: PuzzleManager;
  private raycaster: THREE.Raycaster;
  private interactables: Map<string, InteractableObject> = new Map();
  private currentPrompt: InteractionPrompt | null = null;
  private promptHideTimer: number | null = null;
  private journalEntries: JournalEntry[] = [];
  private discoveredEntries: Set<string> = new Set();
  
  // Interaction cooldown
  private lastInteractionTime = 0;
  private interactionCooldown = 500;
  
  constructor(world: WorldManager, player: PlayerController, puzzles: PuzzleManager) {
    super();
    this.world = world;
    this.player = player;
    this.puzzles = puzzles;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 5;
    this.raycaster.near = 0.1;
  }
  
  reset(): void {
    this.interactables.clear();
    this.currentPrompt = null;
    if (this.promptHideTimer) {
      clearTimeout(this.promptHideTimer);
      this.promptHideTimer = null;
    }
    this.journalEntries = [];
    this.discoveredEntries.clear();
  }
  
  onZoneChange(zoneId: string): void {
    // Rebuild interactables for new zone
    this.rebuildInteractables(zoneId);
  }
  
  private rebuildInteractables(zoneId: string): void {
    this.interactables.clear();
    
    const zoneData = this.world.getZoneData(zoneId);
    if (!zoneData) return;
    
    // Scan scene for interactable objects
    this.world.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
        const userData = obj.userData;
        if (userData.interactable || userData.interactionType) {
          const interactable: InteractableObject = {
            mesh: obj,
            objectId: userData.objectId || obj.uuid,
            data: userData,
            interactionType: userData.interactionType || 'interact',
            promptMessage: this.getPromptMessage(userData),
            distance: userData.interactionDistance || 3,
            lastInteraction: 0
          };
          this.interactables.set(interactable.objectId, interactable);
        }
      }
    });
  }
  
  private getPromptMessage(userData: any): string {
    const type = userData.interactionType || 'interact';
    const customPrompt = userData.promptMessage;
    
    if (customPrompt) return customPrompt;
    
    switch (type) {
      case 'inspect': return 'Inspect [E]';
      case 'read': return 'Read [E]';
      case 'use': return 'Use [E]';
      case 'activate': return 'Activate [E]';
      case 'rotate': return 'Rotate [E]';
      case 'switch': return 'Toggle [E]';
      default: return 'Interact [E]';
    }
  }
  
  update(dt: number): void {
    // Cast ray from camera center
    const camera = this.player.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    const meshes: THREE.Object3D[] = [];
    this.interactables.forEach(interactable => {
      meshes.push(interactable.mesh);
    });
    
    const intersects = this.raycaster.intersectObjects(meshes, true);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const objectId = this.findInteractableId(hit.object);
      
      if (objectId) {
        const interactable = this.interactables.get(objectId);
        if (interactable) {
          const dist = hit.distance;
          if (dist <= interactable.distance) {
            this.showPrompt(interactable, dist);
            
            // Handle interaction input
            if (this.player.getInput().interact && this.canInteract()) {
              this.interact(interactable);
            }
            return;
          }
        }
      }
    }
    
    // No valid interaction
    this.hidePrompt();
  }
  
  private findInteractableId(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.objectId && this.interactables.has(current.userData.objectId)) {
        return current.userData.objectId;
      }
      current = current.parent;
    }
    return null;
  }
  
  private showPrompt(interactable: InteractableObject, distance: number): void {
    if (this.currentPrompt?.objectId === interactable.objectId) return;
    
    this.currentPrompt = {
      objectId: interactable.objectId,
      type: interactable.interactionType,
      message: interactable.promptMessage,
      distance
    };
    
    // Delayed show to avoid flickering
    if (this.promptHideTimer) {
      clearTimeout(this.promptHideTimer);
      this.promptHideTimer = null;
    }
    
    this.promptHideTimer = window.setTimeout(() => {
      this.emit('promptShow', this.currentPrompt);
    }, GAME_CONFIG.interactionPromptDelay);
  }
  
  private hidePrompt(): void {
    if (this.currentPrompt) {
      this.currentPrompt = null;
      this.emit('promptHide');
    }
    if (this.promptHideTimer) {
      clearTimeout(this.promptHideTimer);
      this.promptHideTimer = null;
    }
  }
  
  private canInteract(): boolean {
    const now = Date.now();
    if (now - this.lastInteractionTime < this.interactionCooldown) return false;
    this.lastInteractionTime = now;
    return true;
  }
  
  private interact(interactable: InteractableObject): void {
    const { objectId, data, interactionType } = interactable;
    
    // Emit interaction event
    this.emit('interaction', { objectId, type: interactionType, data });
    
    // Handle based on type
    switch (interactionType) {
      case 'inspect':
        this.handleInspect(interactable);
        break;
      case 'read':
        this.handleRead(interactable);
        break;
      case 'use':
      case 'activate':
        this.handleActivate(interactable);
        break;
      case 'rotate':
        this.handleRotate(interactable);
        break;
      case 'switch':
        this.handleSwitch(interactable);
        break;
      default:
        this.handleGeneric(interactable);
    }
    
    // Notify puzzle manager
    this.puzzles.onPlayerAction(objectId, { objectId, type: interactionType, data });
  }
  
  private handleInspect(interactable: InteractableObject): void {
    const entryId = `inspect_${interactable.objectId}`;
    if (!this.discoveredEntries.has(entryId)) {
      const pos = interactable.mesh.position;
      this.addJournalEntry({
        id: entryId,
        zoneId: this.world.getCurrentZoneId() || '',
        type: 'observation',
        content: `Examined ${interactable.data.objectType || 'object'}: ${interactable.data.description || 'An unusual object.'}`,
        timestamp: Date.now(),
        position: { x: pos.x, y: pos.y, z: pos.z }
      });
    }
  }
  
  private handleRead(interactable: InteractableObject): void {
    const entryId = `read_${interactable.objectId}`;
    if (!this.discoveredEntries.has(entryId)) {
      const pos = interactable.mesh.position;
      this.addJournalEntry({
        id: entryId,
        zoneId: this.world.getCurrentZoneId() || '',
        type: 'phrase',
        content: interactable.data.text || 'The text is faded and unreadable.',
        timestamp: Date.now(),
        position: { x: pos.x, y: pos.y, z: pos.z }
      });
    }
  }
  
  private handleActivate(interactable: InteractableObject): void {
    // Toggle state
    const newState = !interactable.data.active;
    interactable.data.active = newState;
    this.world.setObjectState(interactable.objectId, { active: newState });
    
    // Visual feedback
    if (interactable.mesh instanceof THREE.Mesh) {
      const material = interactable.mesh.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        material.emissiveIntensity = newState ? 1 : 0;
      }
    }
    
    // Sound feedback
    const pos = interactable.mesh.position;
    this.emit('sfx', { type: newState ? 'activate_on' : 'activate_off', position: { x: pos.x, y: pos.y, z: pos.z } });
  }
  
  private handleRotate(interactable: InteractableObject): void {
    const currentRotation = interactable.mesh.rotation.y;
    const newRotation = currentRotation + Math.PI / 2;
    interactable.mesh.rotation.y = newRotation;
    this.world.setObjectState(interactable.objectId, { rotation: newRotation });
    
    const pos = interactable.mesh.position;
    this.emit('sfx', { type: 'rotate', position: { x: pos.x, y: pos.y, z: pos.z } });
  }
  
  private handleSwitch(interactable: InteractableObject): void {
    const newState = !interactable.data.switchState;
    interactable.data.switchState = newState;
    this.world.setObjectState(interactable.objectId, { switchState: newState });
    
    // Visual
    if (interactable.mesh instanceof THREE.Mesh) {
      const material = interactable.mesh.material as THREE.MeshStandardMaterial;
      if (material.color) {
        material.color.setHex(newState ? 0x8ba4b8 : 0x4a5a6a);
      }
    }
    
    this.emit('sfx', { type: 'switch', position: interactable.mesh.position });
  }
  
  private handleGeneric(interactable: InteractableObject): void {
    // Default interaction
    this.emit('sfx', { type: 'interact', position: interactable.mesh.position });
  }
  
  addJournalEntry(entry: JournalEntry): void {
    if (this.discoveredEntries.has(entry.id)) return;
    
    this.discoveredEntries.add(entry.id);
    this.journalEntries.push(entry);
    this.emit('journalEntry', entry);
  }
  
  getJournalEntries(): JournalEntry[] {
    return [...this.journalEntries].sort((a, b) => b.timestamp - a.timestamp);
  }
  
  getEntriesByZone(zoneId: string): JournalEntry[] {
    return this.journalEntries.filter(e => e.zoneId === zoneId);
  }
  
  getEntriesByType(type: JournalEntry['type']): JournalEntry[] {
    return this.journalEntries.filter(e => e.type === type);
  }
  
  restore(entries: JournalEntry[]): void {
    this.journalEntries = entries;
    this.discoveredEntries = new Set(entries.map(e => e.id));
  }
  
  dispose(): void {
    this.interactables.clear();
    this.hidePrompt();
    if (this.promptHideTimer) {
      clearTimeout(this.promptHideTimer);
    }
  }
}