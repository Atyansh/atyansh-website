// Focus: who owns Escape and the mouse.
//
// UI that sits on top of the game (pause menu, settings, phone, collection
// browser…) registers as a *layer*. Escape always closes the topmost layer;
// with no layers it goes to the game (leave the current activity, or pause).
// Pointer lock follows one rule: gameplay wants it unless a layer needs the
// cursor. Nothing else in the game calls lock/unlock or listens for Escape.
//
// Browsers complicate this:
//  - When the mouse is captured, the browser itself eats Escape to release
//    it. We only see the lost lock, so an unexpected loss counts as an
//    Escape press (a loss from alt-tab / blur pauses instead).
//  - After the *user* released the lock that way, the browser refuses to
//    re-capture without a click, so we show "click to resume" instead of
//    retrying (retrying is what used to flash the pause menu). When the game
//    released it itself (opening the phone or a menu), re-capturing straight
//    away is allowed and the mouse comes back with no click.

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
  /** the last release came from the browser (Escape), not from us */
  private userUnlocked = false;
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
    // Any click or key other than Escape is a user gesture: the browser lets
    // us capture the mouse again, so "click to resume" also means "press any key"
    const gesture = (e: Event) => {
      if (e instanceof KeyboardEvent && e.code === 'Escape') return;
      this.userUnlocked = false;
      if (this.wantsPointer() && !this.stack.some((l) => l.cursor) && !this.input.pointerLocked) this.input.lock();
    };
    window.addEventListener('mousedown', gesture, true);
    window.addEventListener('keydown', gesture, true);
    input.onLockChange = (locked) => this.lockChanged(locked);
    document.addEventListener('pointerlockerror', () => this.needClick());
    input.onLockError = () => this.needClick();
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
    this.sync();
  }

  /** Apply the pointer rule (capture or release the mouse as gameplay wants) */
  sync(): void {
    const want = this.wantsPointer() && !this.stack.some((l) => l.cursor);
    if (want && !this.input.pointerLocked) {
      if (this.userUnlocked) this.needClick();
      else this.input.lock();
    } else if (!want && this.input.pointerLocked) {
      this.expectUnlock = true;
      this.userUnlocked = false;
      this.input.unlock();
    }
    if (!want || this.input.pointerLocked) this.onHint(null);
  }

  private needClick(): void {
    if (this.wantsPointer() && !this.stack.some((l) => l.cursor) && !this.input.pointerLocked) this.onHint('Click or press any key to resume');
  }

  private lockChanged(locked: boolean): void {
    if (locked) { this.expectUnlock = false; this.userUnlocked = false; this.onHint(null); return; }
    if (this.expectUnlock) { this.expectUnlock = false; return; }
    this.userUnlocked = true;
    if (!this.wantsPointer()) return;
    if (document.hidden || !document.hasFocus()) { this.onBlur(); this.sync(); return; }
    // the browser swallowed an Escape to release the pointer
    if (performance.now() - this.lastEsc < ESC_DEDUPE_MS) this.sync();
    else this.escape();
  }
}
