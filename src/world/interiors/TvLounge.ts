// TV LOUNGE — cosy den: big TV you can channel-surf from the sofa (static
// between channels, on-screen overlay), a wall of glowing CRTs, and every
// tracked show around the room.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room } from './Room';
import { sit } from '../game/Activity';
import { showItems } from './items';
import { boxGeo } from '../world/geo';

const W = 12;
const D = 15;
const H = 3.7;

export function buildTvLounge(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const shows = game.data.tv ?? [];
  room.shell({ floor: 'wood_floor', floorScale: 1.4, floorTint: 0xe0c0a0, wall: 'painted_plaster_wall', wallScale: 3, wallTint: 0xa9b7c6, ceiling: 0xf0eeea, baseboard: 0xf2f2ee, crown: true, surface: 'wood' });
  const walnut = assets.pbr('wood_floor', { scale: 1.1, tint: 0x6a4630 });
  const open = (start: number) => game.browse({ heading: 'Watching · TMDB', accent: '#4db8f0', items: showItems(game.data), start, aspect: 1.5 });

  // ---- show posters round the room ----
  const pw = 0.6;
  const ph = 0.9;
  const placed = room.wallOfArt(shows, [
    { x0: -W / 2 + 0.03, z0: D / 2 - 1.0, x1: -W / 2 + 0.03, z1: -D / 2 + 0.8, facing: Math.PI / 2, y0: 0.5, rows: 3, w: pw, h: ph, gap: 0.24, rowGap: 0.18 },
    { x0: W / 2 - 0.03, z0: -D / 2 + 3.2, x1: W / 2 - 0.03, z1: D / 2 - 1.0, facing: -Math.PI / 2, y0: 0.5, rows: 3, w: pw, h: ph, gap: 0.24, rowGap: 0.18 },
    { x0: -W / 2 + 1.0, z0: D / 2 - 0.03, x1: -1.6, z1: D / 2 - 0.03, facing: Math.PI, y0: 0.5, rows: 3, w: pw, h: ph, gap: 0.24, rowGap: 0.18 },
    { x0: 1.6, z0: D / 2 - 0.03, x1: W / 2 - 1.0, z1: D / 2 - 0.03, facing: Math.PI, y0: 0.5, rows: 3, w: pw, h: ph, gap: 0.24, rowGap: 0.18 },
  ], 0x1d2026, 0.12);
  room.aimBrowse(placed, (i) => shows[i]?.title ?? '', open);

  // ---- media wall: console + big TV ----
  const tvZ = -D / 2 + 0.35;
  room.box(walnut, 0, 0, tvZ + 0.1, 3.4, 0.55, 0.5, true, 'wood');
  room.box(room.paint(0x111214, 0.4, 0.3), 0, 0.56, tvZ + 0.15, 1.1, 0.07, 0.12, false);
  const tvW = 2.6;
  const tvH = tvW * 9 / 16;
  const tvY = 1.0;
  room.box(room.paint(0x0c0c0e, 0.3, 0.5), 0, tvY, tvZ - 0.05, tvW + 0.06, tvH + 0.06, 0.05, false);
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.2 }));
  screen.position.set(0, tvY + tvH / 2 + 0.03, tvZ - 0.02);
  room.group.add(screen);
  const glow = room.rect(0, tvY + tvH / 2, tvZ + 0.05, tvW, tvH, 0xffffff, 2.4, new THREE.Vector3(0, 0.8, 3));

  let channel = 0;
  let staticT = 0;
  let autoT = 0;
  const imgs = new Map<number, HTMLImageElement>();
  const avg = new THREE.Color(1, 1, 1);
  const paint = () => {
    const s = shows[channel];
    g.fillStyle = '#06070a';
    g.fillRect(0, 0, 1280, 720);
    if (!s) return;
    let img = imgs.get(channel);
    if (!img) {
      img = new Image();
      img.src = s.art;
      img.onload = () => { if (staticT <= 0) paint(); };
      imgs.set(channel, img);
    }
    if (img.complete && img.naturalWidth) {
      g.save();
      g.filter = 'blur(26px) brightness(0.5)';
      g.drawImage(img, -60, -200, 1400, 1120);
      g.restore();
      g.drawImage(img, 80, 60, 400, 600);
      const t = document.createElement('canvas');
      t.width = t.height = 1;
      const tc = t.getContext('2d')!;
      tc.drawImage(img, 0, 0, 1, 1);
      const d = tc.getImageData(0, 0, 1, 1).data;
      avg.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace).lerp(new THREE.Color(1, 1, 1), 0.4);
    }
    g.fillStyle = '#ffffff';
    g.font = '800 72px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    let title = s.title;
    while (g.measureText(title).width > 680 && title.length > 4) title = `${title.slice(0, -2)}…`;
    g.fillText(title, 540, 330);
    g.fillStyle = '#4db8f0';
    g.font = '700 40px "Avenir Next", system-ui, sans-serif';
    if (s.year) g.fillText(`First aired ${s.year}`, 540, 400);
    // OSD
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(1040, 40, 200, 80);
    g.fillStyle = '#7dff9a';
    g.font = '700 52px "Courier New", monospace';
    g.fillText(`CH ${String(channel + 1).padStart(2, '0')}`, 1056, 98);
    tex.needsUpdate = true;
  };
  const noise = () => {
    const id = g.createImageData(320, 180);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    const tc = document.createElement('canvas');
    tc.width = 320; tc.height = 180;
    tc.getContext('2d')!.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(tc, 0, 0, 1280, 720);
    g.imageSmoothingEnabled = true;
    tex.needsUpdate = true;
  };
  const zap = (d: number) => {
    if (!shows.length) return;
    channel = (channel + d + shows.length) % shows.length;
    staticT = 0.3;
    autoT = 0;
    game.events.emit('sfx', { name: 'static' });
  };
  paint();
  room.updates.push((dt) => {
    autoT += dt;
    if (autoT > 9) zap(1);
    if (staticT > 0) {
      staticT -= dt;
      noise();
      if (staticT <= 0) paint();
    }
    glow.color.lerp(staticT > 0 ? new THREE.Color(0.8, 0.8, 0.8) : avg, 1 - Math.exp(-dt * 4));
  });

  // ---- CRT wall flanking the TV ----
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 6 * 256;
  crtCanvas.height = 192;
  const cg = crtCanvas.getContext('2d')!;
  const crtTex = new THREE.CanvasTexture(crtCanvas);
  crtTex.colorSpace = THREE.SRGBColorSpace;
  shows.slice(1, 7).forEach((s, i) => {
    const im = new Image();
    im.onload = () => { cg.drawImage(im, i * 256, 0, 256, 192); crtTex.needsUpdate = true; };
    im.src = s.art;
  });
  const crtMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: crtTex, emissiveIntensity: 0.9 });
  let k = 0;
  for (const side of [-1, 1]) {
    // shelf unit
    const sx = side * 2.6;
    room.box(walnut, sx, 0, tvZ, 1.3, 2.6, 0.5, true, 'wood');
    for (const lvl of [0, 1, 2]) {
      const y = 0.25 + lvl * 0.85;
      const id = lvl % 2 === 0 ? 'Television_01' : 'television_02';
      room.prop(id, sx, tvZ + 0.05, 0, { scale: 1.1 }, 'none', y);
      const sp = new THREE.PlaneGeometry(0.4, 0.3);
      const uv = sp.attributes.uv as THREE.BufferAttribute;
      for (let q = 0; q < uv.count; q++) uv.setX(q, (k + uv.getX(q)) / 6);
      sp.translate(sx - 0.05, y + 0.27, tvZ + 0.33);
      room.group.add(new THREE.Mesh(sp, crtMat));
      k++;
    }
  }

  // ---- sofa pit ----
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), room.paint(0xd8cfc0, 0.98));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, -1.2);
  rug.receiveShadow = true;
  room.group.add(rug);
  const sofaZ = 0.6;
  room.prop('sofa_03', 0, sofaZ, Math.PI, {}, 'bounds');
  room.prop('ArmChair_01', -2.6, -1.4, Math.PI / 2 + 0.4, {}, 'bounds');
  room.prop('CoffeeTable_01', 0, -1.4, 0, { scale: 0.85 }, 'bounds');
  room.prop('potted_plant_02', W / 2 - 0.8, -D / 2 + 1.2, 0.5);
  room.prop('potted_plant_01', -W / 2 + 0.8, -D / 2 + 1.2, 1.5);
  // arc floor lamp
  const arc = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.6, 0, 1.4), new THREE.Vector3(2.5, 1.8, 1.2), new THREE.Vector3(1.6, 2.3, 0.4), new THREE.Vector3(0.9, 2.1, -0.2)]), 20, 0.025, 8);
  room.B.add(room.paint(0xc8a050, 0.3, 0.9), arc);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf6efe2, emissive: 0xffd9a0, emissiveIntensity: 0.8, side: THREE.DoubleSide }));
  shade.rotation.x = Math.PI;
  shade.position.set(0.9, 2.1, -0.2);
  room.group.add(shade);
  room.box(room.paint(0x222222, 0.5, 0.6), 2.6, 0, 1.4, 0.36, 0.04, 0.36, true, 'wood');
  room.point(0.9, 1.9, -0.2, 0xffcf96, 2.2, 6);

  // sit on the sofa → watch
  for (const sx of [-0.8, 0, 0.8]) {
    room.interactables.push({
      id: `sofa:${sx}`, position: room.v(sx, 1, sofaZ - 0.9), radius: 1.1, verb: 'Watch', label: 'TV',
      onInteract: () => sit(game, {
        hip: room.v(sx, 0.48, sofaZ - 0.05), facing: Math.PI,
        hint: 'E  Stand up · A/D  Channel',
        shot: { position: room.v(sx * 0.4, 2.05, sofaZ + 1.5), target: room.v(0, tvY + tvH / 2 - 0.1, tvZ), fov: 46 },
        onUpdate: () => {
          if (game.input.pressed('next')) zap(1);
          if (game.input.pressed('prev')) zap(-1);
        },
      }),
    });
  }

  room.rect(0, H - 0.05, 2.5, 3, 1, 0xfff2e2, 3.0);
  room.point(-3, H - 0.6, 4, 0xffe2c0, 2.5, 7);
  room.point(3, H - 0.6, 4, 0xffe2c0, 2.5, 7);

  room.exitTo('tv');
  return room.finish({ id: 'tv', name: 'TV Lounge', music: 'tv', ambience: 'interior', envIntensity: 0.26 });
}
