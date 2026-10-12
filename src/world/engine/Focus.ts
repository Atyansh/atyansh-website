// Focus: who owns Escape and the mouse.
//
// UI that sits on top of the game (pause menu, settings, phone, collection
// browser…) registers as a *layer*. Escape always closes the topmost layer;
// with no layers it goes to the game (leave the current activity, or pause).
// Pointer lock follows one rule: gameplay wants it unless a layer needs the
// cursor. Nothing else in the game calls lock/unlock or listens for Escape.
//
// Browsers complicate this in two ways, both handled here:
//  - In a window, the browser itself eats Escape to release pointer lock. We
//    see only the lost lock, so an unexpected loss counts as an Escape press
//    (a lost lock from alt-tab / blur pauses instead).
//  - A lock can't be re-acquired from an Escape key press (it isn't a user
//    gesture), so after Escape we ask for a click instead of retrying.
// In fullscreen with the Keyboard Lock API (Chromium), Escape arrives as a
// normal key and the pointer stays locked: the seamless case.

import type { Input } from './Input';

export interface Layer {
  id: string;
  /** needs the mouse cursor (clickable DOM UI) */
  cursor: boolean;
  /** close the layer (it must call `focus.remove(id)`, directly or via its own close) */
  close(): void;
}

const ESC_DEDUPE_MS = 300;

export class Focus {
  private stack: Layer[] = [];
  private lastEsc = -1e9;
  private expectUnlock = false;
  /** Escape with no layers open: end the activity or pause */
  onEscape: () => void = () => {};
  /** Pointer lock lost while the window lost focus */
  onBlur: () => void = () => {};
  /** Gameplay wants mouse-look right now (playing, not in a cursor UI) */
  wantsPointer: () => boolean = () => false;
  /** Show / clear the "click to resume" hint */
  onHint: (text: string | null) => void = () => {};

  constructor(private input: Input) {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) this.escape();
    }, true);
    input.onLockChange = (locked) => this.lockChanged(locked);
    // Without Keyboard Lock (Firefox, Safari), Escape leaving fullscreen is
    // never delivered as a key either: treat the exit as the press
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.wantsPointer()) this.escape();
    });
    document.addEventListener('pointerlockerror', () => this.needClick());
  }

  get top(): Layer | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  has(id: string): boolean {
    return this.stack.some((l) => l.id === id);
  }

  push(layer: Layer): void {
    this.stack = this.stack.filter((l) => l.id !== layer.id);
    this.stack.push(layer);
    this.sync();
  }

  remove(id: string): void {
    const n = this.stack.length;
    this.stack = this.stack.filter((l) => l.id !== id);
    if (this.stack.length !== n) this.sync();
  }

  /** Escape / gamepad Start / browser-eaten Escape: close the top thing */
  escape(): void {
    const now = performance.now();
    if (now - this.lastEsc < ESC_DEDUPE_MS) return;
    this.lastEsc = now;
    const top = this.top;
    if (top) top.close();
    else this.onEscape();
    this.sync(true);
  }

  /**
   * Apply the pointer rule. `fromEscape`: the triggering input can't grant a
   * pointer lock, so ask for a click rather than trying.
   */
  sync(fromEscape = false): void {
    const want = this.wantsPointer() && !this.stack.some((l) => l.cursor);
    if (want && !this.input.pointerLocked) {
      // windowed: an Escape-triggered relock would be refused (or flash and
      // drop), so ask for a click. Fullscreen may allow it; errors → hint.
      const escRecent = fromEscape || performance.now() - this.lastEsc < ESC_DEDUPE_MS;
      if (escRecent && !document.fullscreenElement) this.needClick();
      else this.input.lock();
    } else if (!want && this.input.pointerLocked) {
      this.expectUnlock = true;
      this.input.unlock();
    }
    if (!want || this.input.pointerLocked) this.onHint(null);
  }

  /** A click on the game view: take the pointer back if gameplay wants it */
  click(): void {
    if (this.wantsPointer() && !this.stack.some((l) => l.cursor)) this.input.lock();
  }

  private needClick(): void {
    if (this.wantsPointer() && !this.stack.some((l) => l.cursor) && !this.input.pointerLocked) this.onHint('Click  to resume control');
  }

  private lockChanged(locked: boolean): void {
    if (locked) { this.expectUnlock = false; this.onHint(null); return; }
    if (this.expectUnlock) { this.expectUnlock = false; return; }
    if (!this.wantsPointer()) return;
    if (document.hidden || !document.hasFocus()) { this.onBlur(); this.sync(); return; }
    // the browser swallowed an Escape to release the pointer
    if (performance.now() - this.lastEsc < ESC_DEDUPE_MS) this.sync(true);
    else this.escape();
  }
}

/**
 * Fullscreen + Keyboard Lock: Escape then reaches the game as a normal key
 * instead of the browser releasing the mouse (Chromium; elsewhere this is
 * plain fullscreen and Focus falls back to click-to-resume).
 */
export async function enterFullscreen(el: HTMLElement): Promise<void> {
  try {
    if (!document.fullscreenElement) await el.requestFullscreen({ navigationUI: 'hide' });
    const kb = (navigator as unknown as { keyboard?: { lock(keys: string[]): Promise<void> } }).keyboard;
    await kb?.lock(['Escape']);
  } catch { /* not allowed here (iframe, Safari…) */ }
}
