// BLOCK BREAKER — the arcade's playable cabinet. A complete neon breakout
// rendered to a canvas that lives on the cabinet's screen: attract mode,
// lives, levels, gold bricks (multiball), particles, saved high score.

import * as THREE from 'three';

interface Ball { x: number; y: number; vx: number; vy: number; stuck: boolean }
interface Brick { x: number; y: number; w: number; h: number; hp: number; gold: boolean; color: string }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

const CW = 600;
const CH = 800;
const ROW_COLS = ['#ff4f8b', '#ff8a3d', '#ffd23f', '#5ee08f', '#3fd0ff', '#8f7bff', '#ff5ad1', '#5ee0d0'];

export class BlockBreaker {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  state: 'attract' | 'play' | 'over' = 'attract';
  score = 0;
  best: number;
  lives = 3;
  level = 1;
  private paddle = { x: CW / 2, w: 110 };
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private sparks: Spark[] = [];
  private t = 0;
  private flash = 0;
  onScore: ((score: number) => void) | null = null;
  onSfx: ((name: string) => void) | null = null;

  constructor(best: number) {
    this.best = best;
    this.canvas.width = CW;
    this.canvas.height = CH;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.reset();
  }

  private reset(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.buildLevel();
    this.serve();
  }

  private buildLevel(): void {
    this.bricks = [];
    const cols = 10;
    const rows = Math.min(8, 4 + this.level);
    const bw = (CW - 40) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.level > 1 && (r + c + this.level) % 7 === 0) continue;
        const gold = Math.random() < 0.05;
        this.bricks.push({ x: 20 + c * bw + 2, y: 110 + r * 30, w: bw - 4, h: 24, hp: r < this.level - 1 ? 2 : 1, gold, color: ROW_COLS[r % ROW_COLS.length] });
      }
    }
  }

  private serve(): void {
    this.balls = [{ x: this.paddle.x, y: CH - 72, vx: 0, vy: 0, stuck: true }];
  }

  private speed(): number {
    return 430 + this.level * 45;
  }

  /** dir: -1..1 from keys/stick; dx: mouse movement */
  update(dt: number, input: { dir: number; dx: number; launch: boolean }): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.state !== 'play') {
      if (input.launch) {
        this.state = 'play';
        this.reset();
        this.onSfx?.('coin');
      }
      // attract demo: paddle tracks the ball
      if (this.balls[0]) this.paddle.x += (this.balls[0].x - this.paddle.x) * Math.min(1, dt * 6);
      this.step(dt, true);
      this.draw();
      return;
    }
    this.paddle.x += input.dir * 620 * dt + input.dx * 1.1;
    this.paddle.x = Math.max(this.paddle.w / 2 + 8, Math.min(CW - this.paddle.w / 2 - 8, this.paddle.x));
    if (input.launch) {
      for (const b of this.balls) {
        if (b.stuck) {
          b.stuck = false;
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          b.vx = Math.cos(a) * this.speed();
          b.vy = Math.sin(a) * this.speed();
          this.onSfx?.('launch');
        }
      }
    }
    this.step(dt, false);
    this.draw();
  }

  private step(dt: number, demo: boolean): void {
    if (demo && this.balls[0]?.stuck) {
      const b = this.balls[0];
      b.stuck = false;
      b.vx = 260;
      b.vy = -380;
    }
    const sub = 4;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      for (const b of this.balls) {
        if (b.stuck) {
          b.x = this.paddle.x;
          b.y = CH - 72;
          continue;
        }
        b.x += b.vx * h;
        b.y += b.vy * h;
        if (b.x < 14) { b.x = 14; b.vx = Math.abs(b.vx); }
        if (b.x > CW - 14) { b.x = CW - 14; b.vx = -Math.abs(b.vx); }
        if (b.y < 74) { b.y = 74; b.vy = Math.abs(b.vy); }
        // paddle
        const py = CH - 60;
        if (b.vy > 0 && b.y > py - 12 && b.y < py + 6 && Math.abs(b.x - this.paddle.x) < this.paddle.w / 2 + 8) {
          const off = (b.x - this.paddle.x) / (this.paddle.w / 2);
          const sp = Math.hypot(b.vx, b.vy);
          const a = -Math.PI / 2 + off * 1.05;
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
          b.y = py - 12;
          if (!demo) this.onSfx?.('paddle');
        }
        // bricks
        for (const k of this.bricks) {
          if (k.hp <= 0) continue;
          if (b.x > k.x - 8 && b.x < k.x + k.w + 8 && b.y > k.y - 8 && b.y < k.y + k.h + 8) {
            const ox = Math.min(b.x - (k.x - 8), k.x + k.w + 8 - b.x);
            const oy = Math.min(b.y - (k.y - 8), k.y + k.h + 8 - b.y);
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            k.hp--;
            if (!demo) {
              this.score += k.gold ? 50 : 10 * this.level;
              this.onSfx?.(k.hp <= 0 ? 'break' : 'hit');
            }
            if (k.hp <= 0) {
              this.burst(k.x + k.w / 2, k.y + k.h / 2, k.gold ? '#ffe27a' : k.color, k.gold ? 26 : 12);
              if (k.gold && !demo) {
                // multiball
                const sp = Math.hypot(b.vx, b.vy);
                this.balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: -Math.abs(b.vy), stuck: false });
                this.balls.push({ x: b.x, y: b.y, vx: sp * 0.3, vy: -sp * 0.95, stuck: false });
              }
            }
            break;
          }
        }
      }
      // lost balls
      const before = this.balls.length;
      this.balls = this.balls.filter((b) => b.y < CH + 20);
      if (this.balls.length === 0 && before > 0) {
        if (demo) { this.serve(); continue; }
        this.lives--;
        this.flash = 1;
        this.onSfx?.('lose');
        if (this.lives <= 0) {
          this.state = 'over';
          if (this.score > this.best) this.best = this.score;
          this.onScore?.(this.score);
          this.buildLevel();
          this.serve();
          return;
        }
        this.serve();
      }
    }
    if (!this.bricks.some((k) => k.hp > 0)) {
      if (!demo) {
        this.level++;
        this.score += 250;
        this.onSfx?.('level');
      }
      this.buildLevel();
      this.serve();
    }
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 260;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.4 + Math.random() * 0.5, color });
    }
  }

  private draw(): void {
    const g = this.g;
    g.fillStyle = '#07060f';
    g.fillRect(0, 0, CW, CH);
    // grid
    g.strokeStyle = 'rgba(120,80,255,0.12)';
    g.lineWidth = 1;
    for (let x = 0; x < CW; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x, CH); g.stroke(); }
    for (let y = 64; y < CH; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
    // HUD
    g.font = '700 26px "Courier New", monospace';
    g.fillStyle = '#5ef0ff';
    g.textAlign = 'left';
    g.fillText(`SCORE ${String(this.score).padStart(5, '0')}`, 18, 40);
    g.textAlign = 'right';
    g.fillStyle = '#ff5ad1';
    g.fillText(`HI ${String(Math.max(this.best, this.score)).padStart(5, '0')}`, CW - 18, 40);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23f';
    g.fillText('♥'.repeat(Math.max(0, this.lives)), CW / 2, 40);
    g.fillStyle = 'rgba(94,240,255,0.5)';
    g.fillRect(0, 60, CW, 2);
    // bricks
    for (const k of this.bricks) {
      if (k.hp <= 0) continue;
      g.shadowColor = k.gold ? '#ffe27a' : k.color;
      g.shadowBlur = 14;
      g.fillStyle = k.gold ? (Math.sin(this.t * 8) > 0 ? '#ffe27a' : '#ffbf3a') : k.color;
      g.globalAlpha = k.hp > 1 ? 1 : 0.85;
      g.fillRect(k.x, k.y, k.w, k.h);
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(k.x + 3, k.y + 3, k.w - 6, 4);
      if (k.hp > 1) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(k.x + 2, k.y + 2, k.w - 4, k.h - 4); }
    }
    // paddle
    g.shadowColor = '#5ef0ff';
    g.shadowBlur = 20;
    g.fillStyle = '#5ef0ff';
    g.fillRect(this.paddle.x - this.paddle.w / 2, CH - 60, this.paddle.w, 14);
    // balls
    g.shadowColor = '#ffffff';
    for (const b of this.balls) {
      g.beginPath();
      g.arc(b.x, b.y, 8, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
    }
    g.shadowBlur = 0;
    for (const p of this.sparks) {
      g.globalAlpha = Math.max(0, p.life * 1.6);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    g.globalAlpha = 1;
    // overlays
    if (this.state !== 'play') {
      g.fillStyle = 'rgba(5,4,12,0.62)';
      g.fillRect(0, 64, CW, CH - 64);
      g.textAlign = 'center';
      g.shadowColor = '#ff5ad1';
      g.shadowBlur = 24;
      g.fillStyle = '#ffffff';
      g.font = '900 64px "Avenir Next Condensed", "Arial Narrow", sans-serif';
      g.fillText(this.state === 'over' ? 'GAME OVER' : 'BLOCK', CW / 2, 300);
      if (this.state !== 'over') g.fillText('BREAKER', CW / 2, 366);
      g.shadowBlur = 0;
      g.font = '700 26px "Courier New", monospace';
      if (this.state === 'over') {
        g.fillStyle = '#ffd23f';
        g.fillText(`SCORE ${this.score}`, CW / 2, 380);
        g.fillStyle = '#5ef0ff';
        g.fillText(`BEST ${this.best}`, CW / 2, 420);
      }
      if (Math.sin(this.t * 5) > -0.2) {
        g.fillStyle = '#5ef0ff';
        g.fillText('PRESS SPACE TO PLAY', CW / 2, 520);
      }
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = '600 20px "Courier New", monospace';
      g.fillText('A/D or MOUSE · SPACE LAUNCH · E EXIT', CW / 2, 570);
    }
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,60,90,${this.flash * 0.35})`;
      g.fillRect(0, 0, CW, CH);
    }
    this.texture.needsUpdate = true;
  }
}
