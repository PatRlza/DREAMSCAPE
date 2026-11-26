import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import type { PlayerInput, Vector3Data, QuaternionData } from '../utils/types.js';
import { GAME_CONFIG } from '../core/constants.js';
import { clamp, lerp, degToRad } from '../utils/math.js';

export class PlayerController extends EventEmitter {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3;
  public rotation: THREE.Quaternion;
  public velocity: THREE.Vector3;
  
  private input: PlayerInput = { move: new THREE.Vector2(), look: new THREE.Vector2(), interact: false, jump: false, menu: false, renderModeToggle: false, journalToggle: false };
  private yaw = 0;
  private pitch = 0;
  private isGrounded = true;
  private cameraOffset: THREE.Vector3;
  private targetCameraPosition: THREE.Vector3;
  
  constructor(camera: THREE.PerspectiveCamera) {
    super();
    this.camera = camera;
    this.position = new THREE.Vector3(0, GAME_CONFIG.playerHeight, 0);
    this.rotation = new THREE.Quaternion();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.cameraOffset = new THREE.Vector3(0, 1.5, 0);
    this.targetCameraPosition = new THREE.Vector3();
    
    this.updateCamera();
  }
  
  setInput(input: PlayerInput): void {
    this.input = input;
  }
  
  update(dt: number): void {
    this.handleRotation(dt);
    this.handleMovement(dt);
    this.updateCamera();
  }
  
  private handleRotation(dt: number): void {
    // Yaw (horizontal rotation)
    this.yaw -= this.input.look.x;
    
    // Pitch (vertical rotation)
    this.pitch -= this.input.look.y;
    this.pitch = clamp(this.pitch, -GAME_CONFIG.maxPitch, GAME_CONFIG.maxPitch);
    
    // Update rotation quaternion
    this.rotation.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
  
  private handleMovement(dt: number): void {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rotation);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rotation);
    right.y = 0;
    right.normalize();
    
    // Calculate desired velocity
    const desiredVelocity = new THREE.Vector3();
    desiredVelocity.addScaledVector(forward, -this.input.move.y);
    desiredVelocity.addScaledVector(right, this.input.move.x);
    
    if (desiredVelocity.length() > 1) desiredVelocity.normalize();
    
    const speed = GAME_CONFIG.playerSpeed;
    desiredVelocity.multiplyScalar(speed);
    
    // Smooth acceleration/deceleration
    const accel = this.input.move.length() > 0 ? GAME_CONFIG.playerAcceleration : GAME_CONFIG.playerDeceleration;
    this.velocity.lerp(desiredVelocity, 1 - Math.exp(-accel * dt));
    
    // Apply velocity to position
    this.position.addScaledVector(this.velocity, dt);
    
    // Keep player at ground level (simple)
    this.position.y = GAME_CONFIG.playerHeight;
  }
  
  private updateCamera(): void {
    // Calculate camera target position (behind and above player)
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.rotation);
    this.targetCameraPosition.copy(this.position).add(this.cameraOffset).addScaledVector(back, GAME_CONFIG.cameraDistance);
    
    // Smooth camera follow
    this.camera.position.lerp(this.targetCameraPosition, GAME_CONFIG.cameraLerp);
    this.camera.lookAt(this.position.x, this.position.y + this.cameraOffset.y, this.position.z);
  }
  
  reset(position: THREE.Vector3): void {
    this.position.copy(position);
    this.position.y = GAME_CONFIG.playerHeight;
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.rotation.setFromEuler(new THREE.Euler(0, 0, 0));
    this.updateCamera();
  }
  
  restore(posData: Vector3Data, rotData: QuaternionData): void {
    this.position.set(posData.x, posData.y, posData.z);
    this.rotation.set(rotData.x, rotData.y, rotData.z, rotData.w);
    
    // Extract yaw/pitch from quaternion
    const euler = new THREE.Euler().setFromQuaternion(this.rotation, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
    
    this.velocity.set(0, 0, 0);
    this.updateCamera();
  }
  
  getForward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.rotation);
  }
  
  getRight(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.rotation);
  }
  
  getYaw(): number { return this.yaw; }
  getPitch(): number { return this.pitch; }
  
  setYaw(yaw: number): void { this.yaw = yaw; }
  setPitch(pitch: number): void { this.pitch = clamp(pitch, -GAME_CONFIG.maxPitch, GAME_CONFIG.maxPitch); }
  
  getInput() { return this.input; }
}