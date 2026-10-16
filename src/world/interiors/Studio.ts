// STUDIO — the workshop: project wall, Euler sticky-note board, an
// architecture whiteboard and desks whose monitors show the site's real
// nightly build log.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room, type Placed } from './Room';
import { sit } from '../game/Activity';
import { boxGeo } from '../world/geo';
import { cardTexture, cardURL } from './cards';
import type { BrowserItem } from '../ui/Browser';

const W = 16;
const D = 18;
const H = 4.6;

function buildLog(game: Game): THREE.CanvasTexture {
  const d = game.data;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c0f14';
  g.fillRect(0, 0, 1024, 640);
  g.fillStyle = '#1b2230';
  g.fillRect(0, 0, 1024, 44);
  for (const [i, col] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { g.fillStyle = col; g.beginPath(); g.arc(28 + i * 26, 22, 8, 0, 7); g.fill(); }
  g.fillStyle = '#8fa1b8';
  g.font = '600 20px "SF Mono", Menlo, monospace';
  g.fillText('cloud build · nightly 02:00 PT', 120, 29);
  const lines: Array<[string, string]> = [
    ['$', 'node scripts/refresh-tokens.cjs'],
    ['✓', 'tokens fresh · stale secret versions destroyed'],
    ['$', 'astro build'],
    ['✓', `letterboxd    ${d.movies?.length ?? 0} films`],
    ['✓', `tmdb          ${d.tv?.length ?? 0} shows`],
    ['✓', `spotify       ${d.music?.length ?? 0} albums`],
    ['✓', `steam/igdb    ${d.games?.length ?? 0} games`],
    ['✓', `goodreads     ${d.books?.length ?? 0} books`],
    ['✓', `myanimelist   ${d.anime?.length ?? 0} series`],
    ['✓', `kaya          ${d.climbStats?.totalSends ?? 0} sends`],
    ['$', 'node scripts/build-world-data.cjs'],
    ['✓', 'the block: art self-hosted, world-data.json'],
    ['$', 'firebase deploy --only hosting'],
    ['✓', 'released · cdn purged'],
  ];
  g.font = '500 24px "SF Mono", Menlo, monospace';
  lines.forEach(([p, t], i) => {
    g.fillStyle = p === '$' ? '#7dd3fc' : '#86efac';
    g.fillText(p, 28, 92 + i * 38);
    g.fillStyle = p === '$' ? '#e5e7eb' : '#cbd5e1';
    g.fillText(t, 60, 92 + i * 38);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function whiteboard(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f7f7f4';
  g.fillRect(0, 0, 2048, 1024);
  const marker = (col: string, w = 6) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; };
  const boxT = (x: number, y: number, w: number, h: number, label: string, col: string) => {
    marker(col);
    g.strokeRect(x, y, w, h);
    g.font = '600 40px "Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
    g.textAlign = 'center';
    g.fillText(label, x + w / 2, y + h / 2 + 14);
  };
  const arrow = (x1: number, y1: number, x2: number, y2: number, col: string) => {
    marker(col, 5);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 24 * Math.cos(a - 0.4), y2 - 24 * Math.sin(a - 0.4)); g.lineTo(x2 - 24 * Math.cos(a + 0.4), y2 - 24 * Math.sin(a + 0.4)); g.closePath(); g.fill();
  };
  g.font = '700 64px "Marker Felt", "Chalkboard SE", cursive';
  marker('#1d4ed8');
  g.textAlign = 'left';
  g.fillText('how atyansh.com works', 80, 110);
  boxT(80, 200, 380, 140, '11 data APIs', '#dc2626');
  boxT(620, 200, 420, 140, 'nightly build', '#1d4ed8');
  boxT(1200, 200, 380, 140, 'Astro site', '#15803d');
  boxT(1700, 200, 280, 140, 'Firebase', '#ea580c');
  arrow(460, 270, 610, 270, '#111');
  arrow(1040, 270, 1190, 270, '#111');
  arrow(1580, 270, 1690, 270, '#111');
  boxT(620, 470, 420, 140, 'world-data.json', '#7c3aed');
  arrow(830, 340, 830, 460, '#111');
  boxT(1200, 470, 560, 140, 'THE BLOCK (you are here)', '#db2777');
  arrow(1040, 540, 1190, 540, '#111');
  marker('#374151');
  g.font = '500 34px "Marker Felt", "Chalkboard SE", cursive';
  g.textAlign = 'left';
  ['three.js · Rapier physics · glTF props (CC0)', 'retargeted Quaternius animation · HDRI skies', 'every poster / cover / record = real data'].forEach((l, i) => g.fillText(`• ${l}`, 1200, 700 + i * 56));
  g.fillText('token refresh → secrets destroyed (not disabled!)', 80, 760);
  g.fillText('snapshots: append-only, UTC per build', 80, 816);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildStudio(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const projects = game.data.projects ?? [];
  const euler = game.data.euler ?? [];
  room.shell({ floor: 'brushed_concrete', floorScale: 3, floorTint: 0xd6d2ca, wall: '', wallColor: 0xd6d4ce, ceiling: 0xcfcdc8, baseboard: 0xd8d8d4, surface: 'concrete' });

  // exposed ducts
  const duct = room.paint(0xb8bcc2, 0.35, 0.85);
  for (const x of [-4, 4]) {
    const g = new THREE.CylinderGeometry(0.28, 0.28, D - 1, 20);
    g.rotateX(Math.PI / 2);
    g.translate(x, H - 0.45, 0);
    room.B.add(duct, g);
  }

  // ---- project wall (left) ----
  const projCards: BrowserItem[] = projects.map((p) => {
    const spec = { kicker: p.featured ? 'Featured project' : 'Project', title: p.title, body: p.description, chips: p.tech, footer: p.start ? `since ${p.start.slice(0, 4)}` : '', accent: '#9fb6ff' };
    return { title: p.title, art: cardURL(spec), badge: p.featured ? 'Featured' : 'Project', lines: [p.tech.slice(0, 4).join(' · '), p.start ? `Started ${p.start.slice(0, 7)}` : ''], blurb: p.description };
  });
  const openProjects = (start: number) => game.browse({ heading: 'Projects', accent: '#9fb6ff', items: projCards, start, aspect: 1.33 });
  const projPlaced: Placed[] = [];
  projects.forEach((p, i) => {
    const z = -D / 2 + 2.2 + i * 2.4;
    const tex = cardTexture({ kicker: p.featured ? 'Featured project' : 'Project', title: p.title, body: p.description, chips: p.tech, accent: '#9fb6ff' });
    const pm = room.art(tex, 1.5, 2.0, -W / 2 + 0.05, 2.0, z, Math.PI / 2, { frame: 0x22252a, glow: 0.18 });
    room.spot(-W / 2 + 2.2, H - 0.2, z, -W / 2, 2, z, 0xfff4e4, 10, 0.4);
    projPlaced.push({ index: i, pos: room.v(-W / 2 + 0.05, 2, z), mesh: pm });
  });

  room.aimBrowse(projPlaced, (i) => projects[i]?.title ?? '', openProjects, 'Read about');

  // ---- whiteboard (back wall) ----
  room.box(room.paint(0xc8ccd2, 0.3, 0.8), 0, 1.1, -D / 2 + 0.06, 5.2, 2.7, 0.06, false);
  room.art(whiteboard(), 5.0, 2.5, 0, 2.45, -D / 2 + 0.1, 0, { glow: 0.12 });
  room.box(room.paint(0xc8ccd2, 0.3, 0.8), 0, 1.05, -D / 2 + 0.16, 5.0, 0.04, 0.12, false);
  room.interactables.push({
    id: 'whiteboard', position: room.v(0, 1, -D / 2 + 1.6), radius: 2.2, verb: 'Study', label: 'the architecture',
    onInteract: () => game.ui.toast('How the site works', '11 APIs → nightly build → Astro + Firebase. The Block is built from the same data.', '✎'),
  });

  // ---- Euler board (right wall): one sticky note per solved problem ----
  const eulerItems: BrowserItem[] = euler.map((e) => ({
    title: e.title, art: cardURL({ kicker: 'Project Euler', big: `#${e.n}`, title: e.title, accent: '#fde047', bg: '#1a1a12', footer: e.difficulty ? `difficulty ${e.difficulty}%` : '' }),
    badge: `Problem ${e.n}`, lines: [e.difficulty ? `Difficulty rating ${e.difficulty}%` : '', 'Solved'],
  }));
  const openEuler = (start: number) => game.browse({ heading: `Project Euler · ${euler.length} solved`, accent: '#fde047', items: eulerItems, start, aspect: 1.33 });
  {
    const cols = 12;
    const rows = Math.ceil(euler.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * 128;
    c.height = rows * 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8a6a48';
    g.fillRect(0, 0, c.width, c.height);
    const notes = ['#fde047', '#fdba74', '#86efac', '#93c5fd', '#f9a8d4'];
    euler.forEach((e, i) => {
      const x = (i % cols) * 128 + 10 + Math.random() * 6;
      const y = Math.floor(i / cols) * 128 + 10 + Math.random() * 6;
      g.save();
      g.translate(x + 54, y + 54);
      g.rotate((Math.random() - 0.5) * 0.12);
      g.fillStyle = notes[i % notes.length];
      g.fillRect(-54, -54, 108, 108);
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.font = '800 40px "Avenir Next Condensed", sans-serif';
      g.textAlign = 'center';
      g.fillText(`#${e.n}`, 0, 0);
      g.font = '500 13px "Avenir Next", sans-serif';
      let t = e.title;
      while (g.measureText(t).width > 96 && t.length > 3) t = `${t.slice(0, -2)}…`;
      g.fillText(t, 0, 30);
      g.restore();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 6.0;
    const bh = (bw * c.height) / c.width;
    room.art(tex, bw, bh, W / 2 - 0.06, 0.9 + bh / 2, -1, -Math.PI / 2, { frame: 0x3a2a1c, frameW: 0.08, glow: 0.12 });
    const hdr = cardTexture({ kicker: 'Project Euler', title: `${euler.length} problems solved`, accent: '#fde047' }, 600, 200);
    room.art(hdr, 2.4, 0.8, W / 2 - 0.06, 1.3 + bh, -1, -Math.PI / 2, { glow: 0.2 });
    room.interactables.push({ id: 'euler', position: room.v(W / 2 - 1.4, 1, -1), radius: 2.4, verb: 'Browse', label: 'Project Euler', onInteract: () => openEuler(0) });
  }

  // ---- desks ----
  const monitorTex = buildLog(game);
  const deskSpots = [{ x: -2.0, z: 1.6, ry: Math.PI }, { x: 2.0, z: 1.6, ry: Math.PI }, { x: -2.0, z: 3.2, ry: 0 }, { x: 2.0, z: 3.2, ry: 0 }];
  for (const [i, s] of deskSpots.entries()) {
    room.prop('metal_office_desk', s.x, s.z, s.ry, { scale: 0.9 }, 'bounds', 0, 'metal');
    const fwd = new THREE.Vector3(Math.sin(s.ry), 0, Math.cos(s.ry));
    // monitor
    const mon = new THREE.Group();
    const bez = new THREE.Mesh(boxGeo(0.9, 0.55, 0.04), room.paint(0x111214, 0.3, 0.5));
    mon.add(bez);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.51), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: monitorTex, emissiveIntensity: 0.9 }));
    scr.position.z = 0.021;
    mon.add(scr);
    const stand = new THREE.Mesh(boxGeo(0.06, 0.3, 0.06), bez.material);
    stand.position.y = -0.42;
    mon.add(stand);
    mon.position.set(s.x - fwd.x * 0.25, 0.71 + 0.58, s.z - fwd.z * 0.25);
    mon.rotation.y = s.ry; // screen faces the chair (+fwd)
    room.group.add(mon);
    if (i % 2 === 0) room.prop('desk_lamp_arm_01', s.x + 0.7, s.z - fwd.z * 0.2, s.ry + 2.4, { scale: 0.8 }, 'none', 0.71);
    else room.prop('classic_laptop', s.x + 0.45, s.z, s.ry + Math.PI + 0.3, { scale: 0.7 }, 'none', 0.71);
    const chairPos = new THREE.Vector3(s.x + fwd.x * 0.75, 0, s.z + fwd.z * 0.75);
    room.prop('modern_arm_chair_01', chairPos.x, chairPos.z, s.ry + Math.PI, { scale: 0.85 }, 'none');
    room.aabb(chairPos.x - 0.35, 0, chairPos.z - 0.35, chairPos.x + 0.35, 0.9, chairPos.z + 0.35, 'wood');
    if (i === 0 || i === 3) {
      room.interactables.push({
        id: `desk:${i}`, position: room.v(chairPos.x + fwd.x * 0.7, 1, chairPos.z + fwd.z * 0.7), radius: 1.2, verb: 'Sit', label: 'at the desk',
        onInteract: () => sit(game, {
          hip: room.v(chairPos.x, 0.45, chairPos.z), facing: s.ry + Math.PI, firstPerson: true,
          shot: { position: room.v(chairPos.x + fwd.x * 0.9, 1.45, chairPos.z + fwd.z * 0.9), target: mon.getWorldPosition(new THREE.Vector3()), fov: 45 },
        }),
      });
    }
  }

  // ---- lounge corner ----
  room.prop('sofa_02', W / 2 - 2.5, D / 2 - 2.0, Math.PI, {}, 'bounds');
  room.prop('potted_plant_01', W / 2 - 0.8, D / 2 - 0.9, 0.2);
  room.prop('potted_plant_02', -W / 2 + 0.8, D / 2 - 0.9, 1.4);
  room.prop('ceiling_fan', 0, 2.4, 0, { castShadow: false }, 'none', H - 0.05);
  room.prop('boombox', W / 2 - 2.5, D / 2 - 0.5, Math.PI, { scale: 0.7 }, 'none', 0);

  for (const [x, z] of [[-4, -5], [4, -5], [-4, 2.5], [4, 2.5], [0, 6]]) room.rect(x, H - 0.05, z, 2.6, 0.6, 0xf4f6ff, 2.0);

  room.exitTo('studio');
  return room.finish({ id: 'studio', name: 'Studio', music: 'work', ambience: 'interior', envIntensity: 0.28 });
}
