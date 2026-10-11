// ANIME CAFÉ — every series on the wall as mounted prints, paper lanterns,
// espresso counter + pastry case, bistro seating, a blossom tree, and a
// gacha capsule machine that pulls cards from the real watch list.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import type { ArtItem } from '../data';
import { Room } from './Room';
import { sit } from '../game/Activity';
import { animeItems } from './items';
import { boxGeo } from '../world/geo';
import { menuTexture } from '../world/Signage';

const W = 14;
const D = 16;
const H = 4.2;

type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export function rarityOf(a: ArtItem): Rarity {
  const e = a.watched ?? a.episodes ?? 0;
  return e >= 100 ? 'SSR' : e >= 50 ? 'SR' : e >= 24 ? 'R' : 'N';
}

const CARD_CSS = `
.gc-wrap { position: fixed; inset: 0; z-index: 36; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 22px;
  background: radial-gradient(900px 600px at 50% 45%, rgba(40,10,40,.75), rgba(5,4,10,.92)); pointer-events: auto; opacity: 0; transition: opacity .3s; }
.gc-wrap.on { opacity: 1; }
.gc-card { width: 300px; height: 450px; border-radius: 18px; position: relative; overflow: hidden; transform-style: preserve-3d;
  animation: gcFlip 1.1s cubic-bezier(.2,.9,.25,1.15) both; box-shadow: 0 0 0 3px var(--gc), 0 30px 90px rgba(0,0,0,.6), 0 0 60px var(--gc); }
.gc-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gc-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 45%, transparent 60%);
  mix-blend-mode: overlay; animation: gcShine 2.4s ease-in-out .9s infinite; }
.gc-rar { position: absolute; top: 12px; left: 12px; font: 900 22px var(--ui-display); letter-spacing: .08em; padding: 4px 12px; border-radius: 8px; background: var(--gc); color: #111; }
.gc-meta { text-align: center; max-width: 520px; animation: gcUp .6s ease .6s both; }
.gc-meta .t { font: 800 30px var(--ui-display); letter-spacing: .02em; }
.gc-meta .s { color: var(--ui-dim); font-size: 14px; margin-top: 6px; }
.gc-meta .k { margin-top: 14px; font-size: 12px; color: var(--ui-faint); }
@keyframes gcFlip { 0% { transform: rotateY(180deg) scale(.4); opacity: 0; } 60% { opacity: 1; } 100% { transform: rotateY(0) scale(1); } }
@keyframes gcShine { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@keyframes gcUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`;
let cssIn = false;
const RAR_COL: Record<Rarity, string> = { N: '#c8ccd6', R: '#5ec8ff', SR: '#c77dff', SSR: '#ffd23f' };

export function buildAnimeCafe(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const anime = game.data.anime ?? [];
  room.shell({ floor: 'floor_tiles_06', floorScale: 1.6, wall: 'painted_plaster_wall', wallScale: 3, wallTint: 0xf6dfe2, ceiling: 0xfaf4f0, baseboard: 0xc9a27a, crown: true, surface: 'tile' });
  const lightWood = assets.pbr('wood_floor', { scale: 1.2, tint: 0xe2c49a });
  const open = (start: number) => game.browse({ heading: 'Watch List · MyAnimeList', accent: '#ff7ab8', items: animeItems(game.data), start, aspect: 1.45 });

  // wainscot
  for (const [x, z, len, ry] of [[0, -D / 2 + 0.02, W, 0], [-W / 2 + 0.02, 0, D, Math.PI / 2], [W / 2 - 0.02, 0, D, -Math.PI / 2]] as Array<[number, number, number, number]>) {
    const g = boxGeo(len, 0.95, 0.04);
    g.rotateY(ry);
    g.translate(x, 0.475, z);
    room.B.add(lightWood, g, undefined, false);
  }

  // ---- every series as a mounted print ----
  const pw = 0.5;
  const ph = 0.72;
  const runs = [
    { x0: -W / 2 + 0.03, z0: D / 2 - 1.2, x1: -W / 2 + 0.03, z1: -D / 2 + 0.8, facing: Math.PI / 2, y0: 1.05, rows: 3, w: pw, h: ph, gap: 0.2, rowGap: 0.22 },
    { x0: -W / 2 + 1.0, z0: -D / 2 + 0.03, x1: W / 2 - 4.6, z1: -D / 2 + 0.03, facing: 0, y0: 1.05, rows: 3, w: pw, h: ph, gap: 0.2, rowGap: 0.22 },
    { x0: W / 2 - 0.03, z0: -D / 2 + 4.6, x1: W / 2 - 0.03, z1: D / 2 - 1.2, facing: -Math.PI / 2, y0: 1.05, rows: 3, w: pw, h: ph, gap: 0.2, rowGap: 0.22 },
    { x0: -W / 2 + 1.2, z0: D / 2 - 0.03, x1: -1.6, z1: D / 2 - 0.03, facing: Math.PI, y0: 1.05, rows: 3, w: pw, h: ph, gap: 0.2, rowGap: 0.22 },
    { x0: 1.6, z0: D / 2 - 0.03, x1: W / 2 - 1.2, z1: D / 2 - 0.03, facing: Math.PI, y0: 1.05, rows: 3, w: pw, h: ph, gap: 0.2, rowGap: 0.22 },
  ];
  const placed = room.wallOfArt(anime, runs, 0xf4ecdc, 0.1);
  room.browseSpots(placed, 8, 'the series wall', open);

  // ---- counter (back right) ----
  const cx = W / 2 - 2.3;
  const cz = -D / 2 + 2.6;
  room.box(lightWood, cx, 0, cz, 3.8, 1.05, 0.9, true, 'wood');
  room.box(lightWood, W / 2 - 0.85, 0, cz - 1.6, 0.9, 1.05, 2.4, true, 'wood');
  room.box(room.paint(0xfaf6f0, 0.25, 0.05), cx, 1.05, cz, 3.9, 0.05, 1.0, false);
  room.prop('CoffeeCart_01', W / 2 - 1.3, -D / 2 + 0.9, Math.PI, { scale: 0.85 }, 'bounds');
  room.prop('CashRegister_01', cx - 1.2, cz, 0, { scale: 0.8 }, 'none', 1.1);
  // pastry case
  room.box(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05 }), cx + 0.6, 1.1, cz, 1.4, 0.45, 0.7, false, 'wood', false);
  const pastry = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 24);
  const pc = new THREE.Color();
  for (let i = 0; i < 24; i++) {
    pastry.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(cx + 0.05 + (i % 8) * 0.16, 1.18 + Math.floor(i / 8) * 0.0, cz - 0.2 + Math.floor(i / 8) * 0.2), new THREE.Quaternion(), new THREE.Vector3(1, 0.6, 1)));
    pastry.setColorAt(i, pc.set([0xf3b4c8, 0xc89a5a, 0x9fd88a, 0xf8e3a4, 0x8a5a3a][i % 5]));
  }
  room.group.add(pastry);
  room.art(menuTexture('MENU', ['matcha latte  5', 'melon soda  4', 'taiyaki  3', 'onigiri  4', 'mochi  3']), 1.2, 1.8, cx, 2.6, -D / 2 + 0.06, 0, { frame: 0x8a5a3a, glow: 0.3 });
  for (let i = 0; i < 3; i++) room.prop('bar_chair_round_01', cx - 1.2 + i * 1.1, cz + 0.95, 0, { scale: 0.95 }, 'bounds');
  room.spot(cx, H - 0.1, cz + 0.4, cx, 1, cz, 0xffe2c8, 14, 0.7);

  // ---- bistro seating ----
  const sets = [{ x: -3.6, z: -2.6 }, { x: -3.6, z: 2.0 }, { x: 0.2, z: 0.2 }, { x: 3.2, z: 3.4 }];
  for (const s of sets) {
    room.prop('outdoor_table_chair_set_01', s.x, s.z, 0, {}, 'none');
    room.aabb(s.x - 0.4, 0, s.z - 0.92, s.x + 0.4, 0.75, s.z + 0.92, 'wood');
    for (const side of [-1, 1]) {
      const chairZ = s.z + side * 0.62;
      room.interactables.push({
        id: `bistro:${s.x}:${s.z}:${side}`, position: room.v(s.x + 0.7, 1, chairZ), radius: 1.1, verb: 'Sit', label: 'at the table',
        onInteract: () => sit(game, {
          hip: room.v(s.x, 0.46, chairZ + side * 0.08), facing: side > 0 ? Math.PI : 0,
          shot: { position: room.v(s.x + 2.2, 1.7, s.z + side * 1.2), target: room.v(s.x, 0.8, s.z), fov: 50 },
        }),
      });
    }
  }

  // ---- paper lanterns ----
  const lanternMat = [room.glow(0xff5a5a, 1.1), room.glow(0xfff0e0, 1.2)];
  const capMat = room.paint(0x1a1a1a, 0.6);
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 2 + (i % 3) * ((W - 4) / 2);
    const z = -D / 2 + 3 + Math.floor(i / 3) * ((D - 6) / 2);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), lanternMat[i % 2]);
    l.scale.set(1, 1.25, 1);
    l.position.set(x, H - 0.85, z);
    room.group.add(l);
    for (const dy of [-0.36, 0.36]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), capMat);
      c.position.set(x, H - 0.85 + dy, z);
      room.group.add(c);
    }
    const cord = boxGeo(0.01, 0.5, 0.01);
    cord.translate(x, H - 0.25, z);
    room.B.add(capMat, cord, undefined, false);
    if (i % 2 === 0) room.point(x, H - 1.0, z, i % 4 === 0 ? 0xff9a8a : 0xffe2c4, 2.6, 6);
  }
  room.rect(0, H - 0.05, 0, 4, 1.2, 0xfff1e8, 3.2);

  // ---- blossom tree in a planter (front left) ----
  {
    const tx = -W / 2 + 1.3;
    const tz = D / 2 - 1.6;
    room.box(room.paint(0x3a3a3a, 0.7), tx, 0, tz, 0.9, 0.55, 0.9, true, 'concrete');
    const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(tx, 0.5, tz), new THREE.Vector3(tx + 0.15, 1.6, tz - 0.1), new THREE.Vector3(tx - 0.05, 2.6, tz + 0.1)]), 10, 0.07, 8);
    room.B.add(assets.pbr('bark_brown_01', { scale: 1 }), trunk);
    const bloom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshStandardMaterial({ color: 0xffb7cf, roughness: 0.8, emissive: 0xff8fb5, emissiveIntensity: 0.12 }), 70);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * 1.0;
      bloom.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(tx + Math.cos(a) * rr, 2.4 + Math.random() * 0.9, tz + Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.6 + Math.random() * 0.8)));
    }
    bloom.castShadow = true;
    room.group.add(bloom);
  }
  room.prop('potted_plant_04', W / 2 - 0.8, D / 2 - 1.0, 0.4, { scale: 2.5 });

  // ---- gacha machine ----
  if (!cssIn) {
    const st = document.createElement('style');
    st.textContent = CARD_CSS;
    document.head.appendChild(st);
    cssIn = true;
  }
  const gx = -W / 2 + 1.1;
  const gz = -1.0;
  const gacha = new THREE.Group();
  const pink = room.paint(0xff6fa8, 0.35, 0.3);
  const base = new THREE.Mesh(boxGeo(0.8, 1.0, 0.7), pink);
  base.position.y = 0.5;
  gacha.add(base);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.03, envMapIntensity: 2 }));
  globe.position.y = 1.42;
  gacha.add(globe);
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.35 }), 36);
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.random() * 0.3;
    caps.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * rr, 1.12 + Math.random() * 0.28 + (rr < 0.15 ? 0.1 : 0), Math.sin(a) * rr));
    caps.setColorAt(i, pc.set([0xff5a7a, 0x5ac8ff, 0xffd23f, 0x7dff9a, 0xc77dff][i % 5]));
  }
  gacha.add(caps);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.12, 20), pink);
  capTop.position.y = 1.86;
  gacha.add(capTop);
  const knob = new THREE.Group();
  const knobRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20), room.paint(0xffffff, 0.3, 0.6));
  knob.add(knobRing);
  const knobBar = new THREE.Mesh(boxGeo(0.2, 0.04, 0.04), room.paint(0xffffff, 0.3, 0.6));
  knob.add(knobBar);
  knob.position.set(0, 0.68, 0.36);
  gacha.add(knob);
  const chute = new THREE.Mesh(boxGeo(0.22, 0.16, 0.06), room.paint(0x111111, 0.6));
  chute.position.set(0, 0.22, 0.34);
  gacha.add(chute);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveMap: (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d')!; g.fillStyle = '#ff6fa8'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#fff'; g.font = '900 72px "Avenir Next Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ガチャ GACHA', 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })() }));
  sign.position.set(0, 0.86, 0.352);
  gacha.add(sign);
  const pop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), room.paint(0xffd23f, 0.35));
  pop.visible = false;
  gacha.add(pop);
  gacha.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  gacha.position.set(gx, 0, gz);
  gacha.rotation.y = Math.PI / 2;
  room.group.add(gacha);
  room.aabb(gx - 0.36, 0, gz - 0.42, gx + 0.36, 1.9, gz + 0.42, 'metal');
  room.point(gx + 0.6, 2.2, gz, 0xff9ac8, 2, 4);

  const pull = () => {
    if (!anime.length) return;
    const pick = Math.floor(Math.random() * anime.length);
    const a = anime[pick];
    const rar = rarityOf(a);
    const have = game.save.data.gachaCards;
    const dupes = have.filter((h) => h === a.title).length;
    have.push(a.title);
    game.save.write();
    const unique = new Set(have).size;
    game.events.emit('progress', { key: 'gacha' });
    game.events.emit('sfx', { name: 'gacha' });
    let t = 0;
    let shown = false;
    let wrap: HTMLDivElement | null = null;
    game.uiOwnsPointer = true;
    game.input.unlock();
    game.beginActivity({
      name: 'gacha',
      shot: { position: room.v(gx + 1.6, 1.4, gz + 0.4), target: room.v(gx, 0.9, gz), fov: 42, blend: 0.5 },
      hint: 'E  Collect',
      update: (dt) => {
        t += dt;
        knob.rotation.z = -Math.min(1, t / 0.8) * Math.PI * 2;
        if (t > 0.8 && t < 1.4) {
          pop.visible = true;
          const k = (t - 0.8) / 0.6;
          pop.position.set(0, 0.22 - k * 0.1, 0.36 + k * 0.25);
          (pop.material as THREE.MeshStandardMaterial).color.set(RAR_COL[rar]);
        }
        if (t > 1.3 && !shown) {
          shown = true;
          wrap = document.createElement('div');
          wrap.className = 'gc-wrap';
          wrap.style.setProperty('--gc', RAR_COL[rar]);
          wrap.innerHTML = `<div class="gc-card"><img src="${a.art}" alt=""><div class="gc-rar">${rar}</div></div>
            <div class="gc-meta"><div class="t">${a.title.replace(/</g, '&lt;')}</div>
            <div class="s">${dupes ? `Duplicate ×${dupes + 1}` : 'NEW CARD'} · ${a.watched ?? 0} episodes watched · collection ${unique}/${anime.length}</div>
            <div class="k">E to collect</div></div>`;
          game.ui.root.appendChild(wrap);
          requestAnimationFrame(() => wrap!.classList.add('on'));
          game.ui.setHudVisible(false);
        }
        if (shown && t > 1.8 && (game.input.pressed('interact') || game.input.pressed('back') || game.input.pressed('confirm'))) game.endActivity();
      },
      end: () => {
        pop.visible = false;
        knob.rotation.z = 0;
        if (wrap) { const w = wrap; w.classList.remove('on'); setTimeout(() => w.remove(), 300); }
        game.ui.setHudVisible(true);
        if (!dupes) game.ui.toast(`${rar} · ${a.title}`, `Card ${unique} of ${anime.length} collected`, '🎴', 'collect');
      },
    });
  };
  room.interactables.push({ id: 'gacha', position: room.v(gx + 0.8, 1, gz), radius: 1.4, verb: 'Pull', label: 'the gacha machine', priority: 2, onInteract: pull });

  room.exitTo('anime');
  return room.finish({ id: 'anime', name: 'Anime Café', music: 'anime', ambience: 'cafe', envIntensity: 0.32 });
}
