// The phone (Tab): Map + fast travel, Goals, Collection, Camera (photo mode),
// Wardrobe, Settings. Like GTA, you keep walking while it's out: WASD
// moves the player, the mouse taps the phone (the cursor is freed while it's
// open), arrow keys + Enter also drive it (spatial focus between anything
// actionable), Backspace goes back, Tab / Esc put it away.

import type { PhonePose } from '../game/PhonePose';
import type { Game } from '../game/Game';
import type { Progress } from '../game/Progress';
import { OUTFITS, outfitById } from '../game/outfits';
import { renderCityMap } from './Minimap';
import { LOTS, facingRotation } from '../world/layout';
import type { CityLevel } from '../world/City';

const CSS = `
.ph { position: fixed; right: 5vw; bottom: 0; width: 360px; height: 720px; max-height: 92vh; transform: translateY(105%); transition: transform .38s cubic-bezier(.2,.9,.25,1);
  z-index: 32; pointer-events: auto; border-radius: 44px 44px 0 0; padding: 14px 14px 0; background: #0b0c10;
  box-shadow: 0 0 0 2px #2a2d35, 0 30px 90px rgba(0,0,0,.6); font-family: var(--ui-font); color: var(--ui-ink); }
.ph.on { transform: translateY(6%); }
.ph-screen { position: relative; height: 100%; border-radius: 32px 32px 0 0; overflow: hidden;
  background: radial-gradient(500px 400px at 30% 0%, #2a3350, #11131b 60%); }
.ph-status { display: flex; justify-content: space-between; padding: 12px 22px 6px; font: 600 13px var(--ui-font); color: rgba(255,255,255,.85); }
.ph-home { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px 10px; padding: 26px 18px; }
.ph-app { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; border-radius: 18px; padding: 6px 0; outline: none; }
.ph-app .ic { width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 30px; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
.ph-app span { font-size: 12px; color: rgba(255,255,255,.85); }
.ph-app.sel .ic, .ph-app:hover .ic { transform: scale(1.08); box-shadow: 0 0 0 3px #fff, 0 6px 18px rgba(0,0,0,.35); }
.ph-view { position: absolute; inset: 40px 0 0; overflow-y: auto; padding: 8px 18px 40px; }
.ph-view h3 { margin: 6px 0 14px; font: 800 26px var(--ui-display); letter-spacing: .04em; text-transform: uppercase; }
.ph-back { font: 600 13px var(--ui-font); color: var(--ui-accent); cursor: pointer; background: none; border: 0; padding: 0; }
.ph-goal { background: rgba(255,255,255,.06); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
.ph-goal b { font: 700 15px var(--ui-font); }
.ph-goal p { margin: 4px 0 8px; font-size: 12px; color: var(--ui-dim); line-height: 1.4; }
.ph-bar { height: 5px; border-radius: 5px; background: rgba(255,255,255,.1); overflow: hidden; }
.ph-bar i { display: block; height: 100%; background: var(--ui-accent); }
.ph-goal.done { box-shadow: inset 0 0 0 1px rgba(94,224,143,.5); }
.ph-goal.done .ph-bar i { background: var(--ui-good); }
.ph-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
.ph-tile { background: rgba(255,255,255,.06); border-radius: 14px; padding: 12px; }
.ph-tile b { display: block; font: 800 26px var(--ui-display); }
.ph-tile span { font-size: 11px; color: var(--ui-dim); text-transform: uppercase; letter-spacing: .1em; }
.ph-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.ph-cards img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px; }
.ph-map { position: relative; width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; background: #1b1e25; }
.ph-map canvas { width: 100%; height: 100%; display: block; }
.ph-places { margin-top: 12px; display: grid; gap: 6px; }
.ph-place { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.06); cursor: pointer; font-size: 14px; }
.ph-place:hover { background: rgba(255,255,255,.12); }
.ph-place i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 10px; }
.ph-outfits { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.ph-outfit { border-radius: 16px; padding: 12px; background: rgba(255,255,255,.06); cursor: pointer; text-align: center; }
.ph-outfit .sw { height: 70px; border-radius: 12px; margin-bottom: 8px; }
.ph-outfit.sel { box-shadow: inset 0 0 0 2px var(--ui-accent); }
.ph-outfit.locked { opacity: .45; cursor: default; }
.ph [data-nav].focus { box-shadow: 0 0 0 2px #fff !important; }
.ph-back.focus { text-decoration: underline; }
.ph-hint { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 11px; color: rgba(255,255,255,.4); }
`;

type AppId = 'map' | 'goals' | 'collection' | 'camera' | 'wardrobe' | 'settings';
const APPS: Array<{ id: AppId; name: string; icon: string; bg: string }> = [
  { id: 'map', name: 'Map', icon: '🗺', bg: 'linear-gradient(135deg,#3fb27f,#1f7a5a)' },
  { id: 'goals', name: 'Goals', icon: '🏆', bg: 'linear-gradient(135deg,#ffb547,#e07a1f)' },
  { id: 'collection', name: 'Collection', icon: '💿', bg: 'linear-gradient(135deg,#c77dff,#7b3fe0)' },
  { id: 'camera', name: 'Camera', icon: '📷', bg: 'linear-gradient(135deg,#5a6372,#2c313a)' },
  { id: 'wardrobe', name: 'Wardrobe', icon: '👕', bg: 'linear-gradient(135deg,#ff7ab8,#d6407f)' },
  { id: 'settings', name: 'Settings', icon: '⚙', bg: 'linear-gradient(135deg,#8a94a6,#4a5262)' },
];

export class Phone {
  private el: HTMLDivElement;
  private screen: HTMLDivElement;
  isOpen = false;
  private sel = 0;
  private view: AppId | null = null;
  private mapImg = renderCityMap();
  progress!: Progress;
  onCamera: (() => void) | null = null;
  pose: PhonePose | null = null;

  constructor(private game: Game) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    this.el = document.createElement('div');
    this.el.className = 'ph';
    this.screen = document.createElement('div');
    this.screen.className = 'ph-screen';
    this.el.appendChild(this.screen);
    game.ui.root.appendChild(this.el);
  }

  open(): void {
    const g = this.game;
    if (g.activity || g.player.state !== 'move') {
      g.ui.toast('Hands full', 'Finish what you\'re doing first.', '📱', 'info');
      return;
    }
    this.isOpen = true;
    this.view = null;
    this.render();
    this.el.classList.add('on');
    g.input.arrowsForUi = true;
    // the mouse is for tapping the phone; WASD still walks you around
    g.focus.push({ id: 'phone', cursor: true, close: () => this.close() });
    g.events.emit('sfx', { name: 'phone' });
    this.pose?.show(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('on');
    this.game.input.arrowsForUi = false;
    this.pose?.show(false);
    this.game.focus.remove('phone');
  }

  update(): void {
    if (!this.isOpen) return;
    const g = this.game;
    // anything that needs both hands puts the phone away
    if (g.activity || g.player.state !== 'move') { this.close(); return; }
    const i = g.input;
    if (i.pressedCode('Backspace')) {
      if (this.view) { this.view = null; this.render(); } else this.close();
      return;
    }
    const dir = i.pressedCode('ArrowUp') ? 'up' : i.pressedCode('ArrowDown') ? 'down' : i.pressedCode('ArrowLeft') ? 'left' : i.pressedCode('ArrowRight') ? 'right' : null;
    if (dir) this.moveFocus(dir);
    if (i.pressedCode('Enter') || i.pressedCode('NumpadEnter')) this.focused()?.click();
  }

  /** Actionable elements in the current view, in DOM order */
  private navs(): HTMLElement[] {
    return [...this.screen.querySelectorAll<HTMLElement>('[data-nav]')];
  }

  private focused(): HTMLElement | null {
    return this.screen.querySelector<HTMLElement>('[data-nav].focus');
  }

  private setFocus(n: HTMLElement | null): void {
    this.focused()?.classList.remove('focus');
    if (!n) return;
    n.classList.add('focus');
    n.scrollIntoView({ block: 'nearest' });
    if (n.dataset.app) this.sel = APPS.findIndex((a) => a.id === n.dataset.app);
  }

  /** Spatial navigation: nearest actionable element in the pressed direction */
  private moveFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
    const all = this.navs();
    const cur = this.focused();
    if (!cur) { this.setFocus(all[0] ?? null); return; }
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const n of all) {
      if (n === cur) continue;
      const r = n.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along < 4) continue;
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best) { this.setFocus(best); this.game.events.emit('sfx', { name: 'tick' }); }
  }

  private status(): string {
    const d = new Date();
    return `<div class="ph-status"><span>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span><span>The Block</span><span>●●● 87%</span></div>`;
  }

  private render(): void {
    if (!this.view) {
      this.screen.innerHTML = `${this.status()}<div class="ph-home">${APPS.map((a, k) => `<div class="ph-app${k === this.sel ? ' sel focus' : ''}" data-nav data-app="${a.id}"><div class="ic" style="background:${a.bg}">${a.icon}</div><span>${a.name}</span></div>`).join('')}</div>
        <div class="ph-hint">Arrows · Enter open · Tab put away</div>`;
      this.screen.querySelectorAll<HTMLElement>('.ph-app').forEach((n) => n.addEventListener('click', () => this.openApp(n.dataset.app as AppId)));
      return;
    }
    const back = '<button class="ph-back" data-nav>‹ Home</button>';
    let body = '';
    const s = this.game.save;
    const d = this.game.data;
    if (this.view === 'goals') {
      const pct = Math.round(this.progress.completion() * 100);
      body = `<h3>Goals · ${pct}%</h3>${this.progress.goals.map((g) => {
        const p = Math.min(g.progress(), g.total);
        const done = p >= g.total;
        return `<div class="ph-goal${done ? ' done' : ''}"><b>${done ? '✓ ' : ''}${g.title}</b><p>${g.hint}</p><div class="ph-bar"><i style="width:${(p / g.total) * 100}%"></i></div></div>`;
      }).join('')}`;
    } else if (this.view === 'collection') {
      const tile = (n: number | string, l: string) => `<div class="ph-tile"><b>${n}</b><span>${l}</span></div>`;
      const cards = [...new Set(s.data.gachaCards)];
      const art = (title: string) => d.anime?.find((a) => a.title === title)?.art ?? '';
      body = `<h3>Collection</h3><div class="ph-tiles">
        ${tile(d.movies?.length ?? 0, 'films watched')}${tile(d.tv?.length ?? 0, 'shows')}${tile(d.music?.length ?? 0, 'albums')}
        ${tile(d.games?.length ?? 0, 'games')}${tile(d.books?.length ?? 0, 'books')}${tile(d.anime?.length ?? 0, 'anime')}
        ${tile(d.climbStats?.totalSends ?? 0, 'boulders sent')}${tile(s.data.arcadeBest, 'arcade best')}
        ${tile(`${s.data.collectibles.length}`, 'golden records')}${tile(`${cards.length}`, 'gacha cards')}</div>
        ${cards.length ? `<div class="ph-cards">${cards.map((c) => `<img src="${art(c)}" title="${c.replace(/"/g, '')}">`).join('')}</div>` : '<p style="color:var(--ui-dim);font-size:13px">Pull cards from the gacha machine in the Anime Café.</p>'}`;
    } else if (this.view === 'wardrobe') {
      const cur = s.settings.outfit;
      body = `<h3>Wardrobe</h3><div class="ph-outfits">${OUTFITS.map((o) => {
        const unlocked = !o.unlock || s.data.rewards.includes(o.unlock);
        return `<div class="ph-outfit${o.id === cur ? ' sel' : ''}${unlocked ? '' : ' locked'}" data-nav data-outfit="${o.id}">
          <div class="sw" style="background:linear-gradient(180deg, ${o.swatch[0]} 0 55%, ${o.swatch[1]} 55% 88%, ${o.swatch[2]} 88%)"></div>${unlocked ? o.name : `🔒 ${o.name}`}</div>`;
      }).join('')}</div>`;
    } else if (this.view === 'map') {
      const doors = LOTS.filter((l) => l.enter);
      body = `<h3>Map</h3><div class="ph-map"><canvas width="600" height="600"></canvas></div>
        <div class="ph-places">${doors.map((l) => `<div class="ph-place" data-nav data-go="${l.enter}"><span><i style="background:#${l.accent.toString(16).padStart(6, '0')}"></i>${l.name}</span><span style="color:var(--ui-dim);font-size:12px">Fast travel ›</span></div>`).join('')}</div>`;
    }
    this.screen.innerHTML = `${this.status()}<div class="ph-view">${back}${body}</div>`;
    this.screen.querySelector('.ph-back')?.addEventListener('click', () => { this.view = null; this.render(); });
    this.screen.querySelectorAll<HTMLElement>('[data-outfit]').forEach((n) => n.addEventListener('click', () => {
      const o = outfitById(n.dataset.outfit!);
      if (o.unlock && !s.data.rewards.includes(o.unlock)) return;
      s.settings.outfit = o.id;
      s.write();
      this.game.dressPlayer();
      this.render();
    }));
    this.screen.querySelectorAll<HTMLElement>('[data-go]').forEach((n) => n.addEventListener('click', () => this.travel(n.dataset.go!)));
    const cv = this.screen.querySelector('canvas');
    if (cv) this.drawMap(cv);
    // keyboard focus: the current outfit, else the first item after "Home"
    this.setFocus(this.screen.querySelector<HTMLElement>('.ph-outfit.sel') ?? this.navs()[1] ?? this.navs()[0] ?? null);
  }

  private drawMap(cv: HTMLCanvasElement): void {
    const g = cv.getContext('2d')!;
    const src = this.mapImg;
    // crop to the playable area
    const crop = 0.68;
    const off = (src.width * (1 - crop)) / 2;
    g.drawImage(src, off, off, src.width * crop, src.height * crop, 0, 0, cv.width, cv.height);
    const k = cv.width / (src.width * crop);
    const toC = (x: number, z: number) => [((x + 110) * 4 - off) * k, ((z + 110) * 4 - off) * k];
    if (!this.game.level.interior) {
      const p = this.game.player.position;
      const [px, pz] = toC(p.x, p.z);
      g.fillStyle = '#fff';
      g.strokeStyle = '#111';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px, pz, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  private travel(id: string): void {
    const city = this.game.levels.get('street') as CityLevel;
    const door = city.doors.find((d) => d.lot.enter === id);
    if (!door) return;
    this.close();
    const lot = LOTS.find((l) => l.enter === id)!;
    void this.game.goTo('street', { position: door.position.clone(), facing: facingRotation(lot.facing) + Math.PI });
  }

  private openApp(id: AppId): void {
    this.game.events.emit('sfx', { name: 'tap' });
    if (id === 'settings') { this.game.ui.showSettings(true); return; }
    if (id === 'camera') { this.close(); this.onCamera?.(); return; }
    this.view = id;
    this.render();
  }
}

