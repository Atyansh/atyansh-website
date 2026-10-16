// UI shell: loading, title, HUD, fades, pause/settings/controls.
// Phone and inspect browser plug in via `phone` / `inspect`.

import './ui.css';
import type { Game } from '../game/Game';
import type { Resolved } from '../game/Interaction';
import type { TimeOfDay } from '../world/Sky';

const TIPS = [
  'Every poster, cover and album in the block is real — pulled from the site’s data every night.',
  'BaoBao is shy. Walk — don’t run — and crouch (C) when you get close.',
  'Chance loves fetch. Find his ball in the park.',
  'Hold Space against a ledge to climb up onto it.',
  'Open the phone (Tab) for the map, goals and photo mode.',
  'Golden records are hidden all over the block — check the rooftops.',
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export interface PhoneLike { open(): void; close(): void; isOpen: boolean; update?(dt: number): void }

export class UI {
  readonly root = el('div', 'wui');
  private fadeEl = el('div', 'wui-fade');
  private loading = el('div', 'wui-loading');
  private bar = el('i');
  private tip = el('div', 'wui-tip');
  private title = el('div', 'wui-title');
  private prompt = el('div', 'wui-prompt');
  private toasts = el('div', 'wui-toasts');
  private banner = el('div', 'wui-banner');
  private goal = el('div', 'wui-goal');
  readonly minimapCanvas = el('canvas');
  private minimap = el('div', 'wui-minimap');
  private hint = el('div', 'wui-hint');
  private fps = el('div', 'wui-fps');
  private activityHint = el('div', 'wui-activity');
  private resumeHint = el('div', 'wui-resume');
  private pauseModal = el('div', 'wui-modal');
  private settingsModal = el('div', 'wui-modal');
  private controlsModal = el('div', 'wui-modal');
  private hud: HTMLElement[] = [];
  private lastPromptKey = '';
  private bannerTimer = 0;
  private tipTimer = 0;
  private tipIdx = 0;
  private fpsAcc = { t: 0, n: 0 };
  phone: PhoneLike | null = null;
  game!: Game;
  onStart: ((fresh: boolean) => void) | null = null;

  constructor(container: HTMLElement) {
    container.appendChild(this.root);
    this.root.append(this.fadeEl);

    // Loading
    const lb = el('div', 'wui-bar');
    lb.append(this.bar);
    this.loading.append(el('div', 'wui-logo', 'The Block'), el('div', 'wui-sub', 'atyansh.com'), lb, this.tip);
    this.tip.textContent = TIPS[0];
    this.root.append(this.loading);

    // HUD
    this.minimap.append(this.minimapCanvas);
    this.minimapCanvas.width = this.minimapCanvas.height = 380;
    this.hint.innerHTML = '<div><span class="wui-key">Tab</span>Phone</div><div><span class="wui-key">Esc</span>Pause</div>';
    this.goal.innerHTML = '<div class="h">Goal</div><div class="g"></div><div class="p"></div>';
    this.hud = [this.prompt, this.toasts, this.goal, this.minimap, this.hint, this.banner];
    this.root.append(...this.hud, this.fps, this.activityHint, this.resumeHint);
    this.setHudVisible(false);
    this.setGoal(null);
    this.fps.style.display = 'none';

    this.root.append(this.title, this.pauseModal, this.settingsModal, this.controlsModal);
  }

  // ---------------- loading / title ----------------

  setProgress(p: number): void {
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  }

  hideLoading(): void {
    this.loading.classList.add('done');
    setTimeout(() => this.loading.remove(), 900);
  }

  showTitle(hasSave: boolean): void {
    this.title.innerHTML = '';
    const logo = el('div', 'wui-logo', 'The Block');
    const sub = el('div', 'wui-sub', 'A playable atyansh.com');
    const menu = el('div', 'wui-menu');
    const add = (label: string, fn: () => void, primary = false) => {
      const b = el('button', `wui-btn${primary ? ' primary' : ''}`, label);
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      menu.append(b);
    };
    if (hasSave) {
      add('Continue', () => this.onStart?.(false), true);
      add('New game', () => this.onStart?.(true));
    } else {
      add('Play', () => this.onStart?.(true), true);
    }
    add('Settings', () => this.showSettings(true));
    add('Controls', () => this.showControls(true));
    const foot = el('div', 'wui-foot',
      'WASD move · Mouse look · Space jump · Shift sprint · E interact<br>Every poster, record and book here is real site data');
    this.title.append(logo, sub, menu, foot);
    this.title.classList.add('on');
  }

  hideTitle(): void {
    this.title.classList.remove('on');
  }

  // ---------------- HUD ----------------

  setHudVisible(v: boolean): void {
    for (const h of this.hud) h.classList.toggle('wui-hidden', !v);
  }

  setPrompt(r: Resolved | null): void {
    const key = r ? `${r.it.id}|${r.verb}|${r.label}` : '';
    if (key === this.lastPromptKey) return;
    this.lastPromptKey = key;
    if (!r) {
      this.prompt.classList.remove('on');
      return;
    }
    const pad = this.game?.input.lastDevice === 'pad';
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    this.prompt.innerHTML = `<span class="wui-key">${pad ? 'X' : 'E'}</span><b>${esc(r.verb)}</b><span class="lbl">${esc(r.label)}</span>`;
    this.prompt.classList.add('on');
  }

  toast(title: string, body = '', icon = '★', kind: 'goal' | 'collect' | 'info' | 'reward' = 'info'): void {
    const t = el('div', `wui-toast ${kind}`, `<div class="ic">${icon}</div><div><div class="t">${title}</div>${body ? `<div class="b">${body}</div>` : ''}</div>`);
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'info' ? 3800 : 5200);
  }

  showBanner(name: string, sub = ''): void {
    this.banner.innerHTML = `<div class="n">${name}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
    this.banner.classList.add('on');
    this.bannerTimer = 2.6;
  }

  setGoal(text: string | null, progress = ''): void {
    if (!text) {
      this.goal.style.opacity = '0';
      return;
    }
    this.goal.style.opacity = '1';
    (this.goal.querySelector('.g') as HTMLElement).textContent = text;
    (this.goal.querySelector('.p') as HTMLElement).textContent = progress;
  }

  /** Bottom-centre hint while an activity runs: "E  Stand up · A/D  Channel" */
  setActivityHint(text: string | null): void {
    if (!text) {
      this.activityHint.classList.remove('on');
      return;
    }
    this.activityHint.innerHTML = text.split(' · ').map((part) => {
      const [k, ...rest] = part.split('  ');
      return rest.length ? `<span><span class="wui-key">${k}</span>${rest.join(' ')}</span>` : `<span>${part}</span>`;
    }).join('');
    this.activityHint.classList.add('on');
  }

  /** "Click to resume" after Escape released the mouse (see engine/Focus.ts) */
  setResumeHint(text: string | null): void {
    this.resumeHint.textContent = text ? text.replace('  ', ' ') : '';
    this.resumeHint.classList.toggle('on', !!text);
  }

  setFpsVisible(v: boolean): void {
    this.fps.style.display = v ? 'block' : 'none';
  }

  /** Fade to/from black; resolves when the transition finishes */
  fade(on: boolean): Promise<void> {
    this.fadeEl.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, 360));
  }

  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('on');
    }
    if (this.loading.isConnected) {
      this.tipTimer += dt;
      if (this.tipTimer > 4.5) {
        this.tipTimer = 0;
        this.tipIdx = (this.tipIdx + 1) % TIPS.length;
        this.tip.textContent = TIPS[this.tipIdx];
      }
    }
    if (this.fps.style.display !== 'none') {
      this.fpsAcc.t += dt;
      this.fpsAcc.n++;
      if (this.fpsAcc.t > 0.5) {
        this.fps.textContent = `${Math.round(this.fpsAcc.n / this.fpsAcc.t)} fps`;
        this.fpsAcc = { t: 0, n: 0 };
      }
    }
    this.phone?.update?.(dt);
  }

  // ---------------- phone hooks ----------------

  openPhone(): void {
    if (!this.phone || !this.game || this.phone.isOpen) return;
    this.phone.open();
  }

  togglePhone(): void {
    if (this.phone?.isOpen) this.phone.close();
    else this.openPhone();
  }

  closePhone(): void {
    if (this.phone?.isOpen) this.phone.close();
  }

  // ---------------- pause / settings / controls ----------------

  showPause(on: boolean): void {
    if (on) {
      this.pauseModal.innerHTML = '';
      const p = el('div', 'wui-panel');
      p.append(el('h2', '', 'Paused'));
      const menu = el('div', 'wui-menu');
      menu.style.marginTop = '0';
      const add = (label: string, fn: () => void) => {
        const b = el('button', 'wui-btn', label);
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        menu.append(b);
      };
      add('Resume', () => this.game.resume());
      add('Phone', () => { this.showPause(false); this.openPhone(); });
      add('Settings', () => this.showSettings(true));
      add('Controls', () => this.showControls(true));
      p.append(menu);
      this.pauseModal.append(p);
    }
    this.pauseModal.classList.toggle('on', on);
    this.setHudVisible(!on);
  }

  showSettings(on: boolean): void {
    this.settingsModal.classList.toggle('on', on);
    if (!on) { this.game?.focus?.remove('settings'); return; }
    this.game?.focus?.push({ id: 'settings', cursor: true, close: () => this.showSettings(false) });
    const g = this.game;
    const s = g.save.settings;
    this.settingsModal.innerHTML = '';
    const p = el('div', 'wui-panel');
    p.append(el('h2', '', 'Settings'));
    const row = (label: string, ctl: HTMLElement) => {
      const r = el('div', 'wui-row');
      r.append(el('span', '', label), ctl);
      p.append(r);
    };
    const slider = (min: number, max: number, step: number, val: number, fn: (v: number) => void) => {
      const i = el('input') as HTMLInputElement;
      Object.assign(i, { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val) });
      i.addEventListener('input', () => { fn(parseFloat(i.value)); g.applySettings(); g.save.write(); });
      return i;
    };
    const seg = <T extends string>(opts: Array<[T, string]>, val: T, fn: (v: T) => void) => {
      const w = el('div', 'wui-seg');
      for (const [v, label] of opts) {
        const b = el('button', v === val ? 'sel' : '', label);
        b.addEventListener('click', () => {
          w.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
          b.classList.add('sel');
          fn(v);
          g.save.write();
        });
        w.append(b);
      }
      return w;
    };
    row('Mouse sensitivity', slider(0.3, 2.5, 0.05, s.sensitivity, (v) => { s.sensitivity = v; }));
    row('Invert Y', seg([['off', 'Off'], ['on', 'On']], s.invertY ? 'on' : 'off', (v) => { s.invertY = v === 'on'; g.applySettings(); }));
    row('Field of view', slider(50, 80, 1, s.fov, (v) => { s.fov = v; }));
    row('Music', slider(0, 1, 0.05, s.music, (v) => { s.music = v; g.events.emit('sfx', { name: 'settings' }); }));
    row('Effects', slider(0, 1, 0.05, s.sfx, (v) => { s.sfx = v; g.events.emit('sfx', { name: 'settings' }); }));
    row('Ambience', slider(0, 1, 0.05, s.ambience, (v) => { s.ambience = v; g.events.emit('sfx', { name: 'settings' }); }));
    row('Time of day', seg<TimeOfDay>([['day', 'Day'], ['sunset', 'Sunset'], ['dusk', 'Dusk'], ['night', 'Night']], s.timeOfDay,
      (v) => { void g.setTimeOfDay(v); }));
    row('Show FPS', seg([['off', 'Off'], ['on', 'On']], s.showFps ? 'on' : 'off', (v) => { s.showFps = v === 'on'; this.setFpsVisible(s.showFps); }));
    const close = el('button', 'wui-btn', 'Done');
    close.addEventListener('click', () => this.showSettings(false));
    p.append(close);
    this.settingsModal.append(p);
  }

  showControls(on: boolean): void {
    this.controlsModal.classList.toggle('on', on);
    if (!on) { this.game?.focus?.remove('controls'); return; }
    this.game?.focus?.push({ id: 'controls', cursor: true, close: () => this.showControls(false) });
    this.controlsModal.innerHTML = '';
    const p = el('div', 'wui-panel');
    p.append(el('h2', '', 'Controls'));
    const grid = el('div', 'wui-controls');
    const rows: Array<[string, string]> = [
      ['W A S D', 'Move (camera relative)'], ['Mouse', 'Look'], ['Shift', 'Sprint'], ['Alt', 'Walk'], ['C', 'Crouch / sneak'],
      ['Space', 'Jump · hold at a ledge to climb up'], ['E', 'Interact'], ['F / Click', 'Throw (when holding the ball)'],
      ['Tab', 'Phone: map, goals, collection, camera'], ['N', 'Sound on / off'], ['Esc', 'Pause'], ['Gamepad', 'Fully supported'],
    ];
    for (const [k, v] of rows) grid.append(el('span', 'wui-key', k), el('span', '', v));
    p.append(grid);
    const close = el('button', 'wui-btn', 'Done');
    close.style.marginTop = '16px';
    close.addEventListener('click', () => this.showControls(false));
    p.append(close);
    this.controlsModal.append(p);
  }
}
