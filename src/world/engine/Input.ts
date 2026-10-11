// Unified input: keyboard + mouse (pointer lock) + gamepad, exposed as
// actions. Edge-triggered queries (`pressed`) are valid for one frame; call
// `endFrame()` after the game update.

import { clamp } from './math';

export type Action =
  | 'jump' | 'sprint' | 'crouch' | 'walk' | 'interact' | 'phone' | 'pause'
  | 'throw' | 'map' | 'photo' | 'next' | 'prev' | 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right';

const BINDINGS: Record<Action, string[]> = {
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  walk: ['AltLeft', 'AltRight', 'CapsLock'],
  interact: ['KeyE', 'Enter', 'NumpadEnter'],
  phone: ['Tab', 'KeyP'],
  pause: ['Escape'],
  throw: ['KeyF', 'Mouse0'],
  map: ['KeyM'],
  photo: ['KeyO'],
  next: ['KeyD', 'ArrowRight', 'KeyX'],
  prev: ['KeyA', 'ArrowLeft', 'KeyZ'],
  confirm: ['Enter', 'Space', 'KeyE'],
  back: ['Escape', 'Backspace', 'KeyQ'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

// Standard gamepad mapping indices
const PAD: Partial<Record<Action, number[]>> = {
  jump: [0], interact: [2], back: [1], confirm: [0], sprint: [10, 7], crouch: [11],
  phone: [8], pause: [9], throw: [5], next: [5, 15], prev: [4, 14], up: [12], down: [13],
  left: [14], right: [15], map: [3],
};

export class Input {
  private down = new Set<string>();
  private justDown = new Set<string>();
  private justUp = new Set<string>();
  private padDown = new Set<Action>();
  private padJust = new Set<Action>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  pointerLocked = false;
  /** When false, keys are ignored (e.g. typing in a menu text field) */
  enabled = true;
  lastDevice: 'kbm' | 'pad' = 'kbm';
  padLook = { x: 0, y: 0 };
  padMove = { x: 0, y: 0 };
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      // Keep the browser from eating game keys
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.down.add(e.code);
        this.justDown.add(e.code);
      }
      this.lastDevice = 'kbm';
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.justUp.add(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        // Guard against the occasional giant delta browsers emit on lock
        this.mouseDX += clamp(e.movementX, -300, 300);
        this.mouseDY += clamp(e.movementY, -300, 300);
      }
    });
    window.addEventListener('mousedown', (e) => {
      const code = `Mouse${e.button}`;
      this.down.add(code);
      this.justDown.add(code);
      this.lastDevice = 'kbm';
    });
    window.addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) this.down.clear();
      this.onLockChange?.(this.pointerLocked);
    });
    const release = () => {
      this.down.clear();
      this.mouseDX = this.mouseDY = 0;
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  }

  /** Request pointer lock; must be called from a user gesture */
  lock(): void {
    if (this.pointerLocked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true } as never) as unknown as Promise<void> | undefined;
      p?.catch?.(() => {
        // unadjustedMovement unsupported (e.g. some Linux/Firefox) — plain lock
        try { (this.canvas.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* ignore */ }
      });
    } catch {
      try { this.canvas.requestPointerLock(); } catch { /* ignore */ }
    }
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(a: Action): boolean {
    return BINDINGS[a].some((c) => this.down.has(c)) || this.padDown.has(a);
  }

  pressed(a: Action): boolean {
    return BINDINGS[a].some((c) => this.justDown.has(c)) || this.padJust.has(a);
  }

  released(a: Action): boolean {
    return BINDINGS[a].some((c) => this.justUp.has(c));
  }

  /** Movement intent: x = strafe right, y = forward. Magnitude ≤ 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y += 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y -= 1;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    if (x === 0 && y === 0 && (this.padMove.x || this.padMove.y)) return { ...this.padMove };
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Poll gamepads — call once per frame before reading actions */
  pollGamepad(): void {
    this.padJust.clear();
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (!pad) {
      this.padMove = { x: 0, y: 0 };
      this.padLook = { x: 0, y: 0 };
      this.padDown.clear();
      return;
    }
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    this.padMove = { x: dz(pad.axes[0] ?? 0), y: -dz(pad.axes[1] ?? 0) };
    this.padLook = { x: dz(pad.axes[2] ?? 0), y: dz(pad.axes[3] ?? 0) };
    if (Math.hypot(this.padMove.x, this.padMove.y) > 0 || Math.hypot(this.padLook.x, this.padLook.y) > 0) this.lastDevice = 'pad';
    for (const [action, idxs] of Object.entries(PAD) as Array<[Action, number[]]>) {
      const now = idxs.some((i) => pad.buttons[i]?.pressed);
      if (now && !this.padDown.has(action)) {
        this.padJust.add(action);
        this.lastDevice = 'pad';
      }
      if (now) this.padDown.add(action);
      else this.padDown.delete(action);
    }
  }

  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  endFrame(): void {
    this.justDown.clear();
    this.justUp.clear();
    this.wheel = 0;
  }

  /** Any keyboard/mouse/pad activity this frame (for idle throttling) */
  active(): boolean {
    return this.down.size > 0 || this.padDown.size > 0 || this.mouseDX !== 0 || this.mouseDY !== 0
      || Math.hypot(this.padMove.x, this.padMove.y, this.padLook.x, this.padLook.y) > 0;
  }

  /** Release all held state (menus opening, level transitions) */
  reset(): void {
    this.down.clear();
    this.justDown.clear();
    this.mouseDX = this.mouseDY = 0;
  }
}
