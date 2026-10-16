// CINEMA — lobby with every film poster + a stadium-seated screening room
// whose screen runs a "Now Showing" reel of the real watch log.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room } from './Room';
import { sit } from '../game/Activity';
import { movieItems } from './items';
import { boxGeo, floorGeo } from '../world/geo';
import { menuTexture } from '../world/Signage';

const W = 26;
const D = 32;
const H = 8;
const PART_Z = 2; // partition between lobby (z > 2) and theatre (z < 2)

function carpetTexture(base: string, motif: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = motif;
  g.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      g.beginPath();
      g.moveTo(x + 32, y + 8); g.lineTo(x + 56, y + 32); g.lineTo(x + 32, y + 56); g.lineTo(x + 8, y + 32); g.closePath();
      g.stroke();
      g.fillStyle = motif;
      g.fillRect(x + 30, y + 30, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function buildCinema(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const { assets } = game;
  const movies = game.data.movies ?? [];
  room.shell({ floor: 'marble_tiles', floorScale: 2.2, floorTint: 0xf2ece4, wall: 'painted_plaster_wall', wallScale: 3, wallTint: 0x6e2a2c, ceiling: 0x1c1416, baseboard: 0xc9a24a, crown: true, surface: 'tile' });

  const gold = room.paint(0xc9a24a, 0.35, 0.85);
  const velvet = room.paint(0x8e1822, 0.92, 0);
  const darkWood = assets.pbr('wood_floor', { scale: 1.5, tint: 0x6a4030 });

  // ---------------- partition with side-aisle doorways ----------------
  const partMat = assets.pbr('painted_plaster_wall', { scale: 3, tint: 0x6e2a2c });
  const aisle = 3; // doorway width at each side
  room.box(partMat, 0, 0, PART_Z, W - aisle * 2, H, 0.34, true, 'concrete');
  for (const s of [-1, 1]) {
    room.box(partMat, s * (W / 2 - aisle / 2), 3.2, PART_Z, aisle, H - 3.2, 0.34, false);
    room.aabb(s * (W / 2 - aisle) - 0.01 * s, 3.2, PART_Z - 0.17, s * W / 2, H, PART_Z + 0.17, 'concrete');
    // aisle door frames
    room.box(gold, s * (W / 2 - aisle) , 0, PART_Z, 0.12, 3.2, 0.42, false);
  }
  // lobby marquee over the partition
  const marqueeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#120a0b'; g.fillRect(0, 0, 2048, 256);
    g.fillStyle = '#ff5a4e';
    g.font = '800 150px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`EVERY FILM · ${movies.length} WATCHED`, 1024, 134);
    for (let x = 30; x < 2048; x += 64) { g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(x, 18, 9, 0, 7); g.arc(x, 238, 9, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), new THREE.MeshStandardMaterial({ map: marqueeTex, emissive: 0xffffff, emissiveMap: marqueeTex, emissiveIntensity: 1.3 }));
  mq.position.set(0, 7.0, PART_Z + 0.18);
  room.group.add(mq);

  // ---------------- lobby ----------------
  const runner = new THREE.Mesh(floorGeo(3.2, D / 2 - PART_Z - 0.5), new THREE.MeshStandardMaterial({ map: carpetTexture('#8e1a22', '#c9a24a'), roughness: 0.95 }));
  const ruv = runner.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) / 2, ruv.getY(i) / 2);
  runner.position.set(0, 0.006, (D / 2 + PART_Z) / 2);
  runner.receiveShadow = true;
  room.group.add(runner);
  // brass stanchions along the runner
  for (const s of [-1, 1]) {
    for (let z = PART_Z + 2.5; z < D / 2 - 2; z += 2.4) {
      const post = new THREE.CylinderGeometry(0.04, 0.05, 0.95, 10);
      post.translate(s * 2.1, 0.475, z);
      room.B.add(gold, post);
      const base = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16);
      base.translate(s * 2.1, 0.02, z);
      room.B.add(gold, base);
    }
    const rope = new THREE.CylinderGeometry(0.025, 0.025, D / 2 - PART_Z - 4.5, 8);
    rope.rotateX(Math.PI / 2);
    rope.translate(s * 2.1, 0.8, (D / 2 + PART_Z) / 2 - 0.4);
    room.B.add(velvet, rope, undefined, false);
  }

  // concession island
  const cz = PART_Z + 5;
  const cx = 7.5;
  room.box(darkWood, cx, 0, cz, 6.2, 1.05, 1.2, true, 'wood');
  room.box(room.paint(0x1a1012, 0.25, 0.1), cx, 1.05, cz, 6.4, 0.06, 1.35, false);
  room.prop('CashRegister_01', cx - 1.6, cz - 0.1, Math.PI, {}, 'none', 1.11);
  // popcorn machine
  const pop = new THREE.Group();
  const popBody = new THREE.Mesh(boxGeo(0.95, 0.95, 0.75), new THREE.MeshStandardMaterial({ color: 0xa3121a, roughness: 0.4, metalness: 0.3 }));
  popBody.position.y = 0.48;
  pop.add(popBody);
  const popGlass = new THREE.Mesh(boxGeo(0.9, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05 }));
  popGlass.position.y = 1.4;
  pop.add(popGlass);
  const kernels = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd36a, emissiveIntensity: 0.4, roughness: 0.8 }), 420);
  const km = new THREE.Matrix4();
  for (let i = 0; i < 420; i++) {
    km.makeTranslation((Math.random() - 0.5) * 0.8, 0.98 + Math.random() * 0.38 * (1 - Math.abs(Math.random() - 0.5)), (Math.random() - 0.5) * 0.6);
    kernels.setMatrixAt(i, km);
  }
  pop.add(kernels);
  const popTop = new THREE.Mesh(boxGeo(1.0, 0.18, 0.8), new THREE.MeshStandardMaterial({ color: 0xa3121a, roughness: 0.4 }));
  popTop.position.y = 1.94;
  pop.add(popTop);
  pop.position.set(cx + 1.8, 1.11, cz - 0.05);
  room.group.add(pop);
  room.point(cx + 1.8, 2.3, cz, 0xffd99a, 2.2, 5);
  // menu board above
  room.art(menuTexture('CONCESSIONS', ['popcorn  5', 'soda  3', 'nachos  4', 'candy  2']), 1.6, 2.4, cx, 3.6, cz - 0.62, 0, { frame: 0xc9a24a, glow: 0.35 });
  // lounge sofas
  room.prop('sofa_02', -7.5, PART_Z + 6.5, Math.PI / 2, {}, 'bounds');
  room.prop('sofa_02', -7.5, PART_Z + 10.5, Math.PI / 2, {}, 'bounds');
  room.prop('modern_coffee_table_01', -6.2, PART_Z + 8.5, 0, {}, 'bounds');
  room.prop('potted_plant_02', -11.8, D / 2 - 1.2, 0.4);
  room.prop('WetFloorSign_01', 3.4, D / 2 - 3.2, 0.6);
  room.prop('potted_plant_02', 11.8, D / 2 - 1.2, 2.2);

  // lobby lights
  for (const z of [PART_Z + 3.5, PART_Z + 8, D / 2 - 2.5]) room.rect(0, H - 0.05, z, 5, 1.2, 0xffe6c4, 7);

  // ---------------- posters: every film ----------------
  const pw = 0.8;
  const ph = 1.2;
  const runs = [
    { x0: -W / 2 + 0.02, z0: D / 2 - 0.6, x1: -W / 2 + 0.02, z1: PART_Z + 0.6, facing: Math.PI / 2, y0: 0.75, rows: 4, w: pw, h: ph, gap: 0.2, rowGap: 0.28 },
    { x0: W / 2 - 0.02, z0: PART_Z + 0.6, x1: W / 2 - 0.02, z1: D / 2 - 0.6, facing: -Math.PI / 2, y0: 0.75, rows: 4, w: pw, h: ph, gap: 0.2, rowGap: 0.28 },
    { x0: -W / 2 + 0.6, z0: D / 2 - 0.02, x1: -1.6, z1: D / 2 - 0.02, facing: Math.PI, y0: 0.75, rows: 4, w: pw, h: ph, gap: 0.2, rowGap: 0.28 },
    { x0: 1.6, z0: D / 2 - 0.02, x1: W / 2 - 0.6, z1: D / 2 - 0.02, facing: Math.PI, y0: 0.75, rows: 4, w: pw, h: ph, gap: 0.2, rowGap: 0.28 },
    { x0: -(W / 2 - aisle) + 0.4, z0: PART_Z + 0.17, x1: (W / 2 - aisle) - 0.4, z1: PART_Z + 0.17, facing: 0, y0: 0.75, rows: 4, w: pw, h: ph, gap: 0.2, rowGap: 0.28 },
    // spill into the theatre side aisles
    { x0: -W / 2 + 0.02, z0: -D / 2 + 2, x1: -W / 2 + 0.02, z1: PART_Z - 0.5, facing: Math.PI / 2, y0: 1.0, rows: 3, w: pw, h: ph, gap: 0.25, rowGap: 0.3 },
    { x0: W / 2 - 0.02, z0: PART_Z - 0.5, x1: W / 2 - 0.02, z1: -D / 2 + 2, facing: -Math.PI / 2, y0: 1.0, rows: 3, w: pw, h: ph, gap: 0.25, rowGap: 0.3 },
  ];
  const placed = room.wallOfArt(movies, runs, 0xc9a24a, 0.16);
  const open = (start: number) => game.browse({ heading: 'The Watch Log · Letterboxd', accent: '#ff5a4e', items: movieItems(game.data), start, aspect: 1.5 });
  room.aimBrowse(placed, (i) => movies[i]?.title ?? '', open);

  // ---------------- theatre ----------------
  const carpet = new THREE.MeshStandardMaterial({ map: carpetTexture('#3a0d12', '#5a1a20'), roughness: 0.96 });
  (carpet.map as THREE.Texture).repeat.set(0.5, 0.5);
  const tierFront = -6.6;
  const rowPitch = 1.25;
  const rows = 7;
  const step = 0.34;
  const tierW = W - aisle * 2;
  for (let r = 0; r < rows; r++) {
    const z0 = tierFront + r * rowPitch;
    const y = (r + 1) * step;
    const zEnd = r === rows - 1 ? PART_Z - 0.17 : z0 + rowPitch;
    const g = boxGeo(tierW, y, zEnd - z0);
    g.translate(0, y / 2, (z0 + zEnd) / 2);
    room.B.add(carpet, g, undefined, false, true);
    room.aabb(-tierW / 2, 0, z0, tierW / 2, y, zEnd, 'carpet');
    // step nosing light strip
    room.box(room.glow(0xffb36a, 0.9), 0, y - 0.02, z0 + 0.01, tierW, 0.02, 0.03, false, 'carpet', false);
  }
  // theatre floor carpet (aisles + front)
  {
    const g = floorGeo(W, PART_Z + D / 2);
    g.translate(0, 0.004, (PART_Z - D / 2) / 2);
    room.B.add(carpet, g, undefined, false, true);
  }
  // seats (instanced parts)
  const seatXs: number[] = [];
  for (let k = 0; k < 7; k++) seatXs.push(1.0 + k * 0.62, -(1.0 + k * 0.62));
  const seatSpots: Array<{ x: number; y: number; z: number }> = [];
  for (let r = 0; r < rows; r++) for (const x of seatXs) seatSpots.push({ x, y: (r + 1) * step, z: tierFront + r * rowPitch + 0.75 });
  const parts: Array<[THREE.BufferGeometry, THREE.Material]> = [
    [boxGeo(0.54, 0.12, 0.5), velvet],                                              // cushion
    [(() => { const g = boxGeo(0.56, 0.62, 0.12); g.translate(0, 0.42, 0.26); g.rotateX(-0.12); return g; })(), velvet], // back
    [(() => { const g = boxGeo(0.06, 0.18, 0.5); g.translate(0.3, 0.12, 0.02); return g; })(), room.paint(0x221a1a, 0.5, 0.3)],
    [(() => { const g = boxGeo(0.18, 0.42, 0.18); g.translate(0, -0.24, 0.05); return g; })(), room.paint(0x1a1515, 0.5, 0.5)],
  ];
  const m4 = new THREE.Matrix4();
  for (const [geo, mat] of parts) {
    const inst = new THREE.InstancedMesh(geo, mat, seatSpots.length);
    seatSpots.forEach((s, i) => inst.setMatrixAt(i, m4.makeTranslation(s.x, s.y + 0.45, s.z)));
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    room.group.add(inst);
  }
  // seat-row colliders (low, so you walk the rows in front of them)
  for (let r = 0; r < rows; r++) {
    const z = tierFront + r * rowPitch + 0.75;
    const y = (r + 1) * step;
    for (const s of [-1, 1]) room.aabb(s * 0.7, y, z - 0.3, s * 5.1, y + 1.0, z + 0.4, 'carpet');
  }

  // screen + slideshow
  const sw = 14.5;
  const sh = 6.2;
  const sy = 1.6;
  const screenZ = -D / 2 + 0.6;
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round((2048 * sh) / sw);
  const ctx = canvas.getContext('2d')!;
  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.1, roughness: 0.9 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.position.set(0, sy + sh / 2, screenZ);
  room.group.add(screen);
  room.box(room.paint(0x050505, 0.95), 0, sy - 0.25, screenZ - 0.05, sw + 0.8, sh + 0.5, 0.05, false);
  // stage
  room.box(darkWood, 0, 0, screenZ + 1.3, sw + 1, 0.6, 2.4, true, 'wood');
  // curtains
  for (const s of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const g = new THREE.CylinderGeometry(0.16, 0.16, H - 0.3, 10, 1, true, 0, Math.PI);
      g.rotateY(Math.PI / 2);
      g.translate(s * (sw / 2 + 0.25 + k * 0.28), (H - 0.3) / 2, screenZ + 0.2 + (k % 2) * 0.08);
      room.B.add(velvet, g, undefined, false);
    }
  }
  const valance = new THREE.CylinderGeometry(0.2, 0.2, sw + 6, 12, 1, true, 0, Math.PI);
  valance.rotateZ(Math.PI / 2);
  valance.translate(0, H - 0.6, screenZ + 0.3);
  room.B.add(velvet, valance, undefined, false);
  // screen light spill onto the seats (colour follows the poster)
  const spill = room.rect(0, sy + sh / 2, screenZ + 0.4, sw, sh, 0xffffff, 2.6, new THREE.Vector3(0, 1.5, 4));
  // sconces
  for (const s of [-1, 1]) {
    for (const z of [-12, -6, 0]) {
      room.box(room.glow(0xffb070, 1.6), s * (W / 2 - 0.08), 3.4, z, 0.08, 0.5, 0.3, false, 'wood', false);
      room.point(s * (W / 2 - 0.6), 3.6, z, 0xffb070, 1.6, 6);
    }
  }
  // projector beam from the booth window
  const booth = new THREE.Vector3(0, 6.4, PART_Z - 0.2);
  room.box(room.glow(0xbfd6ff, 2.2), 0, 6.15, PART_Z - 0.18, 1.0, 0.5, 0.02, false, 'wood', false);
  const target = new THREE.Vector3(0, sy + sh / 2, screenZ);
  const len = booth.distanceTo(target);
  const beamGeo = new THREE.ConeGeometry(5.6, len, 32, 1, true);
  beamGeo.translate(0, -len / 2, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.75, 0.82, 1.0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float along = 1.0 - vUv.y; float edge = sin(vUv.x * 3.14159 * 2.0 * 8.0 + uTime * 0.6) * 0.05 + 0.95;
        float a = ((1.0 - along) * 0.026 * edge + 0.006) * smoothstep(0.0, 0.25, along); gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  room.group.add(beam);
  beam.position.copy(booth);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(booth).normalize());

  // ---------------- now showing reel ----------------
  let slide = 0;
  let slideT = 0;
  let fade = 1;
  const imgs = new Map<number, HTMLImageElement>();
  const avg = new THREE.Color(1, 1, 1);
  const draw = (i: number) => {
    const m = movies[i];
    if (!m) return;
    let img = imgs.get(i);
    if (!img) {
      img = new Image();
      img.src = m.art;
      imgs.set(i, img);
    }
    const paint = () => {
      const W2 = canvas.width;
      const H2 = canvas.height;
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W2, H2);
      ctx.save();
      ctx.filter = 'blur(40px) brightness(0.45) saturate(1.3)';
      ctx.drawImage(img!, -100, -200, W2 + 200, H2 + 400);
      ctx.restore();
      const ph2 = H2 * 0.86;
      const pw2 = ph2 / 1.5;
      ctx.drawImage(img!, 120, (H2 - ph2) / 2, pw2, ph2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 34px "Avenir Next", system-ui, sans-serif';
      ctx.fillText(`NOW SHOWING  ·  #${i + 1} OF ${movies.length}`, 200 + pw2, 200);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 110px "Avenir Next Condensed", "Arial Narrow", sans-serif';
      const words = m.title.split(' ');
      let line = '';
      let y = 330;
      for (const wd of words) {
        if (ctx.measureText(`${line}${wd} `).width > W2 - pw2 - 320) { ctx.fillText(line, 200 + pw2, y); y += 118; line = ''; }
        line += `${wd} `;
      }
      ctx.fillText(line, 200 + pw2, y);
      if (m.year) {
        ctx.fillStyle = '#ff7a5a';
        ctx.font = '700 64px "Avenir Next", system-ui, sans-serif';
        ctx.fillText(String(m.year), 200 + pw2, y + 100);
      }
      screenTex.needsUpdate = true;
      // average colour for the light spill
      const t = document.createElement('canvas');
      t.width = t.height = 1;
      const tc = t.getContext('2d')!;
      tc.drawImage(img!, 0, 0, 1, 1);
      const d = tc.getImageData(0, 0, 1, 1).data;
      avg.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace).lerp(new THREE.Color(1, 1, 1), 0.35);
    };
    if (img.complete && img.naturalWidth) paint();
    else img.onload = paint;
  };
  const go = (d: number) => {
    slide = (slide + d + movies.length) % Math.max(1, movies.length);
    fade = 0;
    slideT = 0;
    draw(slide);
  };
  draw(0);
  room.updates.push((dt, t) => {
    beamMat.uniforms.uTime.value = t;
    slideT += dt;
    if (slideT > 7) go(1);
    fade = Math.min(1, fade + dt * 2.5);
    screenMat.emissiveIntensity = 1.1 * fade;
    spill.color.lerp(avg, 1 - Math.exp(-dt * 3));
    spill.intensity = 2.6 * fade;
    beamMat.uniforms.uColor.value.copy(avg).multiplyScalar(0.85);
  });

  // ---------------- seats you can sit in ----------------
  for (let r = 1; r < rows; r += 2) {
    for (const x of [1.0, -1.0, 3.48, -3.48]) {
      const s = seatSpots.find((p) => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - (tierFront + r * rowPitch + 0.75)) < 0.01)!;
      room.interactables.push({
        id: `seat:${r}:${x}`,
        position: room.v(s.x, s.y + 0.6, s.z - 0.6),
        radius: 1.3,
        verb: 'Watch',
        label: 'Now Showing',
        onInteract: () => sit(game, {
          hip: room.v(s.x, s.y + 0.52, s.z + 0.02),
          facing: Math.PI,
          firstPerson: true,
          hint: 'E  Stand up · A/D  Change film · Mouse  Look around',
          shot: { position: room.v(s.x + 0.35, s.y + 1.32, s.z + 0.75), target: room.v(0, sy + sh / 2 - 0.2, screenZ), fov: 55, blend: 0.9 },
          onUpdate: () => {
            if (game.input.pressed('next')) go(1);
            if (game.input.pressed('prev')) go(-1);
          },
        }),
      });
    }
  }

  room.exitTo('cinema');
  return room.finish({ id: 'cinema', name: 'Cinema', music: 'movies', ambience: 'interior', envIntensity: 0.32, boom: 3.4 });
}
