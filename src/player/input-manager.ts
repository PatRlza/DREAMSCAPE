import * as THREE from 'three';
import { EventEmitter } from '../utils/event-emitter.js';
import type { PlayerInput } from '../utils/types.js';

export class InputManager extends EventEmitter {
  private canvas: HTMLCanvasElement;
  private keys: Set<string> = new Set();
  private mouseLocked = false;
  private mouseDelta = { x: 0, y: 0 };
  private touchState: {
    joystickActive: boolean;
    joystickStart: { x: number; y: number };
    joystickCurrent: { x: number; y: number };
    lookActive: boolean;
    lookStart: { x: number; y: number };
    lookCurrent: { x: number; y: number };
    interactPressed: boolean;
  } = {
    joystickActive: false,
    joystickStart: { x: 0, y: 0 },
    joystickCurrent: { x: 0, y: 0 },
    lookActive: false,
    lookStart: { x: 0, y: 0 },
    lookCurrent: { x: 0, y: 0 },
    interactPressed: false
  };
  
  private mouseSensitivity = 0.002;
  private touchSensitivity = 0.003;
  private invertY = false;
  
  // Virtual joystick elements
  private joystickEl: HTMLElement | null = null;
  private joystickKnobEl: HTMLElement | null = null;
  private interactBtnEl: HTMLElement | null = null;
  private renderModeBtnEl: HTMLElement | null = null;
  private journalBtnEl: HTMLElement | null = null;
  private menuBtnEl: HTMLElement | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    super();
    this.canvas = canvas;
    this.setupKeyboard();
    this.setupMouse();
    this.setupTouch();
    this.createMobileControls();
  }
  
  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      this.handleKeyAction(e.code, true);
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.handleKeyAction(e.code, false);
    });
    
    // Prevent default for game keys
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
    });
  }
  
  private handleKeyAction(code: string, pressed: boolean): void {
    switch (code) {
      case 'Escape':
        // Handled by UIManager to avoid double-toggling pause menu
        break;
      case 'KeyE':
        // Interaction handled in update loop
        break;
      case 'KeyV':
        if (pressed) this.emit('renderModeToggle');
        break;
      case 'KeyJ':
        if (pressed) this.emit('journalToggle');
        break;
      case 'KeyM':
        if (pressed) this.emit('menuToggle');
        break;
      case 'KeyL':
        if (pressed) this.toggleMouseLock();
        break;
    }
  }
  
  private setupMouse(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.toggleMouseLock(true);
      }
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.mouseLocked) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });
    
    this.canvas.addEventListener('click', (e) => {
      if (this.mouseLocked && e.button === 0) {
        // Interaction click
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === this.canvas;
    });
  }
  
  private setupTouch(): void {
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
  }
  
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const x = touch.clientX;
      const y = touch.clientY;
      const width = this.canvas.width;
      const height = this.canvas.height;
      
      // Left side - movement joystick
      if (x < width / 2) {
        this.touchState.joystickActive = true;
        this.touchState.joystickStart = { x, y };
        this.touchState.joystickCurrent = { x, y };
      }
      // Right side - look/rotation
      else if (x > width / 2) {
        this.touchState.lookActive = true;
        this.touchState.lookStart = { x, y };
        this.touchState.lookCurrent = { x, y };
      }
    }
  }
  
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const x = touch.clientX;
      const y = touch.clientY;
      
      if (this.touchState.joystickActive && x < this.canvas.width / 2) {
        this.touchState.joystickCurrent = { x, y };
      }
      if (this.touchState.lookActive && x > this.canvas.width / 2) {
        this.touchState.lookCurrent = { x, y };
      }
    }
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const x = touch.clientX;
      
      if (this.touchState.joystickActive && x < this.canvas.width / 2) {
        this.touchState.joystickActive = false;
      }
      if (this.touchState.lookActive && x > this.canvas.width / 2) {
        this.touchState.lookActive = false;
      }
    }
  }
  
  private createMobileControls(): void {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    
    // Create virtual joystick
    this.joystickEl = document.createElement('div');
    this.joystickEl.id = 'virtual-joystick';
    this.joystickEl.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; width: 120px; height: 120px;
      background: rgba(255,255,255,0.1); border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);
      pointer-events: none; z-index: 100; touch-action: none;
    `;
    
    this.joystickKnobEl = document.createElement('div');
    this.joystickKnobEl.style.cssText = `
      position: absolute; top: 50%; left: 50%; width: 50px; height: 50px;
      background: rgba(255,255,255,0.5); border-radius: 50%;
      transform: translate(-50%, -50%); transition: transform 0.1s ease-out;
      pointer-events: none;
    `;
    this.joystickEl.appendChild(this.joystickKnobEl);
    document.body.appendChild(this.joystickEl);
    
    // Interaction button
    this.interactBtnEl = document.createElement('button');
    this.interactBtnEl.id = 'interact-btn';
    this.interactBtnEl.textContent = '⬆';
    this.interactBtnEl.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; width: 70px; height: 70px;
      background: rgba(139,164,184,0.8); border: none; border-radius: 50%;
      color: #1a1d24; font-size: 24px; z-index: 100;
      touch-action: manipulation;
    `;
    this.interactBtnEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchState.interactPressed = true;
    });
    this.interactBtnEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touchState.interactPressed = false;
    });
    document.body.appendChild(this.interactBtnEl);
    
    // Render mode toggle
    this.renderModeBtnEl = document.createElement('button');
    this.renderModeBtnEl.id = 'render-mode-btn';
    this.renderModeBtnEl.textContent = '◈';
    this.renderModeBtnEl.style.cssText = `
      position: fixed; bottom: 110px; right: 20px; width: 50px; height: 50px;
      background: rgba(139,164,184,0.8); border: none; border-radius: 50%;
      color: #1a1d24; font-size: 20px; z-index: 100;
      touch-action: manipulation;
    `;
    this.renderModeBtnEl.addEventListener('click', () => this.emit('renderModeToggle'));
    document.body.appendChild(this.renderModeBtnEl);
    
    // Journal button
    this.journalBtnEl = document.createElement('button');
    this.journalBtnEl.id = 'journal-btn';
    this.journalBtnEl.textContent = '📖';
    this.journalBtnEl.style.cssText = `
      position: fixed; bottom: 180px; right: 20px; width: 50px; height: 50px;
      background: rgba(139,164,184,0.8); border: none; border-radius: 50%;
      color: #1a1d24; font-size: 20px; z-index: 100;
      touch-action: manipulation;
    `;
    this.journalBtnEl.addEventListener('click', () => this.emit('journalToggle'));
    document.body.appendChild(this.journalBtnEl);
    
    // Menu button
    this.menuBtnEl = document.createElement('button');
    this.menuBtnEl.id = 'menu-btn';
    this.menuBtnEl.textContent = '≡';
    this.menuBtnEl.style.cssText = `
      position: fixed; top: 20px; right: 20px; width: 50px; height: 50px;
      background: rgba(139,164,184,0.8); border: none; border-radius: 50%;
      color: #1a1d24; font-size: 24px; z-index: 100;
      touch-action: manipulation;
    `;
    this.menuBtnEl.addEventListener('click', () => this.emit('menuToggle'));
    document.body.appendChild(this.menuBtnEl);
  }
  
  private toggleMouseLock(force?: boolean): void {
    if (force === true || (!this.mouseLocked && force !== false)) {
      this.canvas.requestPointerLock();
    } else if (this.mouseLocked) {
      document.exitPointerLock();
    }
  }
  
  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }
  
  setTouchSensitivity(sensitivity: number): void {
    this.touchSensitivity = sensitivity;
  }
  
  setInvertY(invert: boolean): void {
    this.invertY = invert;
  }
  
  getMouseSensitivity(): number { return this.mouseSensitivity; }
  getTouchSensitivity(): number { return this.touchSensitivity; }
  getInvertY(): boolean { return this.invertY; }
  
  isMouseLocked(): boolean { return this.mouseLocked; }
  
  getInput(): PlayerInput {
    const move = new THREE.Vector2(0, 0);
    const look = new THREE.Vector2(0, 0);
    
    // Keyboard movement
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;
    
    // Touch joystick movement
    if (this.touchState.joystickActive) {
      const dx = this.touchState.joystickCurrent.x - this.touchState.joystickStart.x;
      const dy = this.touchState.joystickCurrent.y - this.touchState.joystickStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 50;
      
      if (dist > 5) {
        move.x = Math.max(-1, Math.min(1, dx / maxDist));
        move.y = -Math.max(-1, Math.min(1, dy / maxDist)); // Inverted Y for touch
      }
      
      // Update visual joystick
      if (this.joystickKnobEl) {
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        this.joystickKnobEl.style.transform = `translate(-50%, -50%) translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
      }
    } else if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = 'translate(-50%, -50%)';
    }
    
    // Mouse look
    if (this.mouseLocked) {
      look.x = this.mouseDelta.x * this.mouseSensitivity;
      look.y = this.mouseDelta.y * this.mouseSensitivity * (this.invertY ? -1 : 1);
      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;
    }
    
    // Touch look
    if (this.touchState.lookActive) {
      const dx = this.touchState.lookCurrent.x - this.touchState.lookStart.x;
      const dy = this.touchState.lookCurrent.y - this.touchState.lookStart.y;
      look.x = dx * this.touchSensitivity;
      look.y = dy * this.touchSensitivity * (this.invertY ? -1 : 1);
    }
    
    return {
      move,
      look,
      interact: this.keys.has('KeyE') || this.touchState.interactPressed,
      jump: this.keys.has('Space'),
      menu: this.keys.has('Escape'),
      renderModeToggle: this.keys.has('KeyV'),
      journalToggle: this.keys.has('KeyJ')
    };
  }
  
  dispose(): void {
    window.removeEventListener('keydown', () => {});
    window.removeEventListener('keyup', () => {});
    this.canvas.removeEventListener('mousedown', () => {});
    this.canvas.removeEventListener('mousemove', () => {});
    this.canvas.removeEventListener('touchstart', () => {});
    this.canvas.removeEventListener('touchmove', () => {});
    this.canvas.removeEventListener('touchend', () => {});
    this.canvas.removeEventListener('touchcancel', () => {});
    
    [this.joystickEl, this.interactBtnEl, this.renderModeBtnEl, this.journalBtnEl, this.menuBtnEl].forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }
}