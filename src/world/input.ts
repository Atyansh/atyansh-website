// Keyboard + pointer-lock mouse input for The Block

export class Input {
  private keys = new Set<string>();
  /** Accumulated mouse deltas since last consume */
  dx = 0;
  dy = 0;
  pointerLocked = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => {
    // Locked: raw deltas. Unlocked fallback: drag-look with the left button
    // held, so the camera works even where pointer lock fails.
    if (this.pointerLocked || (e.buttons & 1) !== 0) {
      this.dx += e.movementX;
      this.dy += e.movementY;
    }
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.el;
    if (!this.pointerLocked) this.keys.clear();
  };
  // Belt-and-suspenders: release capture and clear input state whenever the
  // page is hidden, unloaded, or loses focus — the world must never hold the
  // pointer or phantom keys beyond its own visible lifetime.
  private releaseAll = () => {
    this.keys.clear();
    this.dx = 0;
    this.dy = 0;
    if (document.pointerLockElement) document.exitPointerLock();
  };
  private onVisibility = () => {
    if (document.hidden) this.releaseAll();
  };

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.releaseAll);
    window.addEventListener('blur', this.releaseAll);
    // Back/forward-cache restore: reset to a clean unlocked state so the
    // click-to-walk gate is accurate and the next click re-locks cleanly.
    window.addEventListener('pageshow', this.releaseAll);
    // Any click on the page is a valid gesture to (re)acquire the lock.
    const tryLock = (retry: boolean) => {
      try {
        const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
        p?.catch?.((err) => {
          // Chrome transiently refuses relocks right after exits/restores;
          // one delayed retry covers it.
          if (retry) setTimeout(() => tryLock(false), 150);
          else console.warn('pointer lock refused:', err);
        });
      } catch (err) {
        if (retry) setTimeout(() => tryLock(false), 150);
        else console.warn('pointer lock unavailable:', err);
      }
    };
    document.addEventListener('click', () => {
      if (!this.pointerLocked) tryLock(true);
    });
  }

  /** Movement vector in input space: x = strafe (right+), y = forward (+) */
  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  get sprinting(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  /** Read and clear accumulated mouse deltas */
  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.releaseAll);
    window.removeEventListener('blur', this.releaseAll);
  }
}
