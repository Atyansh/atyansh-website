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

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    // Any click on the page is a valid gesture to (re)acquire the lock.
    document.addEventListener('click', () => {
      if (this.pointerLocked) return;
      try {
        const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
        p?.catch?.((err) => console.warn('pointer lock refused:', err));
      } catch (err) {
        console.warn('pointer lock unavailable:', err);
      }
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
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }
}
