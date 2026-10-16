// Collection browser: full-screen inspect view for real site data —
// big cover, title, metadata, blurb, progress, and a thumbnail carousel.
// Opened by interacting with shelves, crates, poster walls, cabinets…
// Keyboard (A/D, arrows, Esc/E), mouse (click thumbs/arrows) and gamepad.

import type { Game } from '../game/Game';

export interface BrowserItem {
  title: string;
  art?: string;
  lines?: string[];
  blurb?: string;
  /** 0..1 progress bar (episodes watched, etc.) */
  progress?: number;
  progressLabel?: string;
  badge?: string;
}

export interface BrowserOptions {
  heading: string;
  accent: string;
  items: BrowserItem[];
  start?: number;
  /** aspect of covers: 1 = square (albums), 1.5 = posters */
  aspect?: number;
  onClose?: () => void;
  onIndex?: (i: number) => void;
}

const CSS = `
.wb { position: fixed; inset: 0; z-index: 35; display: grid; grid-template-rows: auto 1fr auto; padding: 4vh 6vw 3vh;
  background: radial-gradient(1200px 800px at 30% 40%, rgba(20,22,30,.86), rgba(5,6,10,.95)); opacity: 0; transition: opacity .25s ease; pointer-events: auto; }
.wb.on { opacity: 1; }
.wb-head { display: flex; align-items: baseline; justify-content: space-between; }
.wb-head h3 { margin: 0; font-family: var(--ui-display); font-weight: 800; letter-spacing: .14em; text-transform: uppercase; font-size: 15px; color: var(--wb-accent); }
.wb-count { font: 600 13px var(--ui-font); color: var(--ui-dim); letter-spacing: .1em; }
.wb-main { display: grid; grid-template-columns: minmax(240px, 34vw) 1fr; gap: 5vw; align-items: center; min-height: 0; }
.wb-cover { position: relative; justify-self: end; height: min(58vh, 640px); aspect-ratio: var(--wb-aspect); border-radius: 10px; overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); background: #1a1c22; transform-origin: center; }
.wb-cover img { width: 100%; height: 100%; object-fit: cover; display: block; animation: wbIn .35s cubic-bezier(.2,.9,.3,1); }
@keyframes wbIn { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: none; } }
.wb-info { max-width: 620px; }
.wb-badge { display: inline-block; font: 700 11px var(--ui-font); letter-spacing: .16em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--wb-accent) 22%, transparent); color: var(--wb-accent); margin-bottom: 14px; }
.wb-title { font-family: var(--ui-display); font-weight: 800; font-size: clamp(32px, 4.4vw, 64px); line-height: 1.02; letter-spacing: .01em; margin: 0 0 14px; }
.wb-lines { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--ui-dim); font-size: 15px; margin-bottom: 18px; }
.wb-lines span::before { content: "•"; margin-right: 8px; color: var(--wb-accent); }
.wb-lines span:first-child::before { content: none; margin: 0; }
.wb-blurb { color: rgba(244,241,234,.82); font-size: 15px; line-height: 1.6; max-height: 9.6em; overflow: hidden; }
.wb-prog { margin-top: 18px; max-width: 360px; }
.wb-prog .bar { height: 6px; border-radius: 6px; background: rgba(255,255,255,.1); overflow: hidden; }
.wb-prog .bar i { display: block; height: 100%; background: var(--wb-accent); }
.wb-prog .lbl { font-size: 12px; color: var(--ui-dim); margin-top: 6px; }
.wb-strip { display: flex; gap: 10px; justify-content: center; align-items: flex-end; margin-top: 2vh; height: 104px; }
.wb-thumb { height: 76px; aspect-ratio: var(--wb-aspect); border-radius: 6px; overflow: hidden; opacity: .45; cursor: pointer; transition: all .2s; flex: none; background: #222; }
.wb-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wb-thumb.cur { height: 100px; opacity: 1; box-shadow: 0 0 0 2px var(--wb-accent); }
.wb-thumb:hover { opacity: .85; }
.wb-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 54px; height: 54px; border-radius: 50%; border: 1px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.04); color: var(--ui-ink); font-size: 22px; cursor: pointer; }
.wb-nav:hover { background: rgba(255,255,255,.12); }
.wb-hint { position: absolute; right: 6vw; bottom: 3vh; font-size: 12px; color: var(--ui-faint); }
`;

let injected = false;

export class Browser {
  private root: HTMLDivElement | null = null;
  private opts: BrowserOptions | null = null;
  private idx = 0;
  isOpen = false;

  constructor(private game: Game) {
    if (!injected) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      injected = true;
    }
  }

  open(o: BrowserOptions): void {
    this.close(true);
    this.opts = o;
    this.idx = Math.max(0, Math.min(o.items.length - 1, o.start ?? 0));
    const root = document.createElement('div');
    root.className = 'wb';
    root.style.setProperty('--wb-accent', o.accent);
    root.style.setProperty('--wb-aspect', String(1 / (o.aspect ?? 1.5)));
    root.innerHTML = `
      <div class="wb-head"><h3>${o.heading}</h3><div class="wb-count"></div></div>
      <div class="wb-main"><div class="wb-cover"></div><div class="wb-info"></div></div>
      <div class="wb-strip"></div>
      <button class="wb-nav" style="left:2vw">‹</button><button class="wb-nav" style="right:2vw">›</button>
      <div class="wb-hint">A / D browse · E or Esc close</div>`;
    const navs = root.querySelectorAll('.wb-nav');
    navs[0].addEventListener('click', () => this.step(-1));
    navs[1].addEventListener('click', () => this.step(1));
    root.addEventListener('wheel', (e) => this.step(Math.sign((e as WheelEvent).deltaY)), { passive: true });
    this.game.ui.root.appendChild(root);
    this.root = root;
    this.isOpen = true;
    this.game.focus.push({ id: 'browser', cursor: true, close: () => this.close() });
    this.game.ui.setHudVisible(false);
    this.render();
    requestAnimationFrame(() => root.classList.add('on'));
  }

  close(silent = false): void {
    if (!this.root) return;
    const r = this.root;
    r.classList.remove('on');
    setTimeout(() => r.remove(), 260);
    this.root = null;
    this.isOpen = false;
    this.game.focus.remove('browser');
    if (!silent) {
      this.game.ui.setHudVisible(true);
      const cb = this.opts?.onClose;
      this.opts = null;
      cb?.();
    }
  }

  step(d: number): void {
    if (!this.opts) return;
    const n = this.opts.items.length;
    this.idx = (this.idx + d + n) % n;
    this.game.events.emit('sfx', { name: 'tick' });
    this.render();
  }

  /** Per-frame input while open (called by the activity) */
  update(): void {
    if (!this.isOpen) return;
    const i = this.game.input;
    if (i.pressed('next')) this.step(1);
    if (i.pressed('prev')) this.step(-1);
    if (i.pressed('back') || i.pressed('interact')) this.close();
  }

  private render(): void {
    if (!this.root || !this.opts) return;
    const o = this.opts;
    const it = o.items[this.idx];
    (this.root.querySelector('.wb-count') as HTMLElement).textContent = `${this.idx + 1} / ${o.items.length}`;
    (this.root.querySelector('.wb-cover') as HTMLElement).innerHTML = it.art ? `<img src="${it.art}" alt="">` : '';
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    (this.root.querySelector('.wb-info') as HTMLElement).innerHTML = `
      ${it.badge ? `<div class="wb-badge">${esc(it.badge)}</div>` : ''}
      <h1 class="wb-title">${esc(it.title)}</h1>
      ${it.lines?.length ? `<div class="wb-lines">${it.lines.filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}</div>` : ''}
      ${it.blurb ? `<div class="wb-blurb">${esc(it.blurb)}</div>` : ''}
      ${it.progress !== undefined ? `<div class="wb-prog"><div class="bar"><i style="width:${Math.round(it.progress * 100)}%"></i></div><div class="lbl">${esc(it.progressLabel ?? '')}</div></div>` : ''}`;
    const strip = this.root.querySelector('.wb-strip') as HTMLElement;
    strip.innerHTML = '';
    const n = o.items.length;
    for (let d = -5; d <= 5; d++) {
      if (n < 11 && Math.abs(d) > Math.floor(n / 2)) continue;
      const k = (this.idx + d + n) % n;
      const t = document.createElement('div');
      t.className = `wb-thumb${d === 0 ? ' cur' : ''}`;
      t.innerHTML = o.items[k].art ? `<img src="${o.items[k].art}" alt="" loading="lazy">` : '';
      t.addEventListener('click', () => { this.idx = k; this.render(); });
      strip.appendChild(t);
    }
    o.onIndex?.(this.idx);
  }
}
