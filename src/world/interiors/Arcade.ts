// ARCADE — neon-lit room of cabinets skinned with the real Steam library,
// a "Most Played" hours leaderboard, a claw machine, a retro TV corner and
// one playable cabinet: BLOCK BREAKER.
//
// Perf: all game screens share one atlas texture + CRT shader (one draw),
// marquees share another, cabinet bodies are instanced per colour.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { Room } from './Room';
import { gameItems } from './items';
import { BlockBreaker } from '../game/BlockBreaker';
import { boxGeo } from '../world/geo';

const W = 18;
const D = 22;
const H = 4.4;
const PROFILE: Array<[number, number]> = [[0, 0], [0.82, 0], [0.82, 0.9], [0.94, 0.98], [0.94, 1.04], [0.66, 1.16], [0.58, 1.2], [0.5, 1.75], [0.7, 1.86], [0.7, 2.08], [0, 2.08]];
const CAB_W = 0.74;
const ATLAS_COLS = 8;
const SLOT_W = 256;
const SLOT_H = 220;

function cabinetGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: CAB_W, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  g.rotateY(-Math.PI / 2); // depth → +z (front), width → x
  g.translate(CAB_W / 2, 0, -0.42);
  return g;
}

function crtMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uTime: { value: 0 }, uGain: { value: 1.25 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform float uTime; uniform float uGain; varying vec2 vUv;
      void main(){
        vec2 cell = fract(vUv * vec2(${ATLAS_COLS}.0, 1.0));
        vec2 uv = vUv;
        // slot-local barrel distortion
        vec2 local = cell * 2.0 - 1.0;
        float scan = 0.82 + 0.18 * sin(vUv.y * 2200.0);
        vec3 c = texture2D(map, uv).rgb;
        c = pow(c, vec3(2.2)); // sRGB → linear (canvas texture sampled raw)
        float vig = 1.0 - dot(local, local) * 0.18;
        float flick = 0.97 + 0.03 * sin(uTime * 37.0 + vUv.y * 3.0);
        gl_FragColor = vec4(c * scan * vig * flick * uGain + vec3(0.01, 0.02, 0.03), 1.0);
      }`,
  });
}

function carpetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d0a1a';
  g.fillRect(0, 0, 512, 512);
  const cols = ['#ff3fae', '#3fe0ff', '#ffd23f', '#8f6bff', '#5ef08f'];
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = cols[i % cols.length];
    g.lineWidth = 4;
    g.beginPath();
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    g.moveTo(x, y);
    g.bezierCurveTo(x + 40, y - 30, x + 60, y + 40, x + 100, y);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 10, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = '#ffffff'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(W / 3, D / 3);
  t.anisotropy = 8;
  return t;
}

export function buildArcade(game: Game, index: number): Level {
  const room = new Room(game, index, W, D, H);
  const games = game.data.games ?? [];
  room.shell({ floor: 'rubber_tiles', wall: '', wallColor: 0x17131f, ceiling: 0x07060a, baseboard: 0xff3fae, surface: 'carpet' });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95, color: 0x6a6a6a }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.004;
  carpet.receiveShadow = true;
  room.group.add(carpet);
  const open = (start: number) => game.browse({ heading: 'The Library · Steam', accent: '#c77dff', items: gameItems(game.data), start, aspect: 1.4 });

  // ---- cabinet layout ----
  type Spot = { x: number; z: number; ry: number };
  const spots: Spot[] = [];
  for (let i = 0; i < 16; i++) spots.push({ x: -6.9 + i * 0.92, z: -D / 2 + 0.55, ry: 0 });
  for (let i = 0; i < 12; i++) spots.push({ x: -5.06 + i * 0.92, z: -1.65, ry: 0 });
  for (let i = 0; i < 12; i++) spots.push({ x: -5.06 + i * 0.92, z: -3.35, ry: Math.PI });
  for (let i = 0; i < 8; i++) spots.push({ x: -W / 2 + 0.55, z: 1.8 + i * 0.92, ry: Math.PI / 2 });

  // ---- screen + marquee atlases ----
  const n = Math.min(games.length, spots.length);
  const rows = Math.ceil(Math.max(1, n) / ATLAS_COLS);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = ATLAS_COLS * SLOT_W;
  screenCanvas.height = rows * SLOT_H;
  const sg = screenCanvas.getContext('2d')!;
  sg.fillStyle = '#05050a';
  sg.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.NoColorSpace;
  const marqCanvas = document.createElement('canvas');
  marqCanvas.width = ATLAS_COLS * 256;
  marqCanvas.height = rows * 64;
  const mg = marqCanvas.getContext('2d')!;
  const marqTex = new THREE.CanvasTexture(marqCanvas);
  marqTex.colorSpace = THREE.SRGBColorSpace;
  const accentCols = ['#ff3fae', '#3fe0ff', '#ffd23f', '#8f6bff', '#5ef08f', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const gx = (i % ATLAS_COLS) * SLOT_W;
    const gy = Math.floor(i / ATLAS_COLS) * SLOT_H;
    const img = new Image();
    img.onload = () => {
      sg.save();
      sg.filter = 'blur(10px) brightness(0.5)';
      sg.drawImage(img, gx - 20, gy - 20, SLOT_W + 40, SLOT_H + 40);
      sg.restore();
      const h = SLOT_H - 16;
      const w = (h * img.naturalWidth) / img.naturalHeight;
      sg.drawImage(img, gx + (SLOT_W - w) / 2, gy + 8, w, h);
      screenTex.needsUpdate = true;
    };
    img.src = games[i].art;
    const mx = (i % ATLAS_COLS) * 256;
    const my = Math.floor(i / ATLAS_COLS) * 64;
    const col = accentCols[i % accentCols.length];
    mg.fillStyle = '#0b0912';
    mg.fillRect(mx, my, 256, 64);
    mg.fillStyle = col;
    mg.fillRect(mx, my, 256, 6);
    mg.fillRect(mx, my + 58, 256, 6);
    mg.font = '800 34px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    mg.textAlign = 'center';
    mg.textBaseline = 'middle';
    mg.shadowColor = col;
    mg.shadowBlur = 10;
    mg.fillStyle = '#ffffff';
    let t = games[i].title.toUpperCase();
    while (mg.measureText(t).width > 236 && t.length > 3) t = `${t.slice(0, -2)}…`;
    mg.fillText(t, mx + 128, my + 33);
    mg.shadowBlur = 0;
  }
  marqTex.needsUpdate = true;

  // ---- build merged screens/marquees + instanced bodies ----
  const screenParts: THREE.BufferGeometry[] = [];
  const marqParts: THREE.BufferGeometry[] = [];
  const bodyGeo = cabinetGeometry();
  const bodyCols = [0x1b1530, 0x2a1030, 0x0f2030, 0x302010, 0x1a2a18, 0x301818];
  const bodyLists: THREE.Matrix4[][] = bodyCols.map(() => []);
  const ctrlStick: THREE.Matrix4[] = [];
  const ctrlButtons: THREE.Matrix4[] = [];
  const screenTilt = Math.atan2(0.08, 0.51);
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    const M = new THREE.Matrix4().makeRotationY(s.ry).setPosition(s.x, 0, s.z);
    bodyLists[i % bodyCols.length].push(M.clone());
    const slot = (u0: number, v0: number, uw: number, vh: number, g: THREE.PlaneGeometry) => {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * uw, v0 + uv.getY(k) * vh);
    };
    // screen
    const sgeo = new THREE.PlaneGeometry(0.62, 0.52);
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    slot(col / ATLAS_COLS, 1 - (row + 1) / rows, 1 / ATLAS_COLS, 1 / rows, sgeo);
    sgeo.rotateX(-screenTilt);
    sgeo.translate(0, 1.465, 0.565 - 0.42);
    sgeo.applyMatrix4(M);
    screenParts.push(sgeo);
    // marquee
    const mgeo = new THREE.PlaneGeometry(0.68, 0.2);
    slot(col / ATLAS_COLS, 1 - (row + 1) / rows, 1 / ATLAS_COLS, 1 / rows, mgeo);
    mgeo.translate(0, 1.97, 0.705 - 0.42);
    mgeo.applyMatrix4(M);
    marqParts.push(mgeo);
    // controls
    ctrlStick.push(M.clone().multiply(new THREE.Matrix4().makeTranslation(-0.14, 1.16, 0.84 - 0.42)));
    for (const bx of [0.04, 0.13, 0.22]) ctrlButtons.push(M.clone().multiply(new THREE.Matrix4().makeTranslation(bx, 1.12, 0.8 - 0.42)));
    // interaction per cabinet
    const front = new THREE.Vector3(Math.sin(s.ry), 0, Math.cos(s.ry));
    room.interactables.push({
      id: `cab:${i}`, position: room.v(s.x + front.x * 0.9, 1, s.z + front.z * 0.9), radius: 1.0, verb: 'Look at', label: games[i].title,
      onInteract: () => open(i),
    });
  }
  const crt = crtMaterial(screenTex);
  room.group.add(new THREE.Mesh(mergeGeometries(screenParts)!, crt));
  const marqMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: marqTex, emissiveIntensity: 1.5 });
  room.group.add(new THREE.Mesh(mergeGeometries(marqParts)!, marqMat));
  bodyCols.forEach((c, k) => {
    const list = bodyLists[k];
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(bodyGeo, room.paint(c, 0.45, 0.25), list.length);
    list.forEach((m, j) => inst.setMatrixAt(j, m));
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    room.group.add(inst);
  });
  const stick = new THREE.InstancedMesh((() => { const g = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8); g.translate(0, 0.06, 0); const b = new THREE.SphereGeometry(0.032, 10, 8); b.translate(0, 0.13, 0); return mergeGeometries([g.toNonIndexed(), b.toNonIndexed()])!; })(),
    room.paint(0xe8443a, 0.4, 0.2), ctrlStick.length);
  ctrlStick.forEach((m, j) => stick.setMatrixAt(j, m));
  room.group.add(stick);
  const btn = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14), room.glow(0x3fe0ff, 1.2), ctrlButtons.length);
  ctrlButtons.forEach((m, j) => btn.setMatrixAt(j, m));
  room.group.add(btn);
  // row colliders
  room.aabb(-7.4, 0, -D / 2, 7.4, 2.1, -D / 2 + 1.0, 'metal');
  room.aabb(-5.5, 0, -3.8, 5.5, 2.1, -1.2, 'metal');
  room.aabb(-W / 2, 0, 1.3, -W / 2 + 1.0, 2.1, 1.8 + 7 * 0.92 + 0.5, 'metal');

  // ---- playable BLOCK BREAKER cabinet ----
  const bb = new BlockBreaker(game.save.data.arcadeBest);
  bb.texture.colorSpace = THREE.NoColorSpace; // CRT shader linearises itself
  const ppos = { x: W / 2 - 0.6, z: 4.2, ry: -Math.PI / 2 };
  const PM = new THREE.Matrix4().makeRotationY(ppos.ry).setPosition(ppos.x, 0, ppos.z);
  const pbody = new THREE.Mesh(bodyGeo, room.paint(0x3a0f45, 0.35, 0.4));
  pbody.applyMatrix4(PM);
  pbody.castShadow = true;
  room.group.add(pbody);
  const bbMat = crtMaterial(bb.texture);
  bbMat.fragmentShader = bbMat.fragmentShader.replace('vec2 cell = fract(vUv * vec2(8.0, 1.0));', 'vec2 cell = vUv;');
  const pscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), bbMat);
  pscreen.position.set(0, 1.47, 0.565 - 0.42);
  pscreen.rotation.x = -screenTilt;
  pscreen.applyMatrix4(PM);
  room.group.add(pscreen);
  const signTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#12051a'; g.fillRect(0, 0, 512, 128);
    g.font = '900 64px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3fae'; g.shadowBlur = 20; g.fillStyle = '#fff';
    g.fillText('BLOCK BREAKER', 256, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pmarq = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.2), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 2 }));
  pmarq.position.set(0, 1.97, 0.705 - 0.42);
  pmarq.applyMatrix4(PM);
  room.group.add(pmarq);
  room.spot(ppos.x - 2, H - 0.1, ppos.z, ppos.x, 1, ppos.z, 0xff6ad5, 30, 0.45);
  room.aabb(ppos.x - 0.5, 0, ppos.z - 0.45, ppos.x + 0.5, 2.1, ppos.z + 0.45, 'metal');
  // PLAY ME floor decal
  const decal = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), room.glow(0xff3fae, 1.4));
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(ppos.x - 1.1, 0.01, ppos.z);
  room.group.add(decal);
  bb.onSfx = (name) => game.events.emit('sfx', { name: `arcade:${name}` });
  bb.onScore = (score) => {
    if (score > game.save.data.arcadeBest) {
      game.save.data.arcadeBest = score;
      game.save.write();
      game.ui.toast('New high score!', `BLOCK BREAKER · ${score}`, '🕹', 'reward');
    }
    game.events.emit('progress', { key: `arcade:${score}` });
  };
  let playing = false;
  room.interactables.push({
    id: 'blockbreaker', position: room.v(ppos.x - 1.0, 1, ppos.z), radius: 1.5, verb: 'Play', label: 'BLOCK BREAKER', priority: 2,
    onInteract: () => {
      playing = true;
      const ch = game.player.character;
      game.player.setPosition(room.v(ppos.x - 0.95, 0, ppos.z));
      game.player.facing = Math.PI / 2;
      ch.root.rotation.y = Math.PI / 2;
      ch.play('Push', { loop: true, fade: 0.3, timeScale: 0.25 });
      game.beginActivity({
        name: 'arcade',
        hint: 'A/D  Move · Space  Launch · E  Leave',
        shot: { position: room.v(ppos.x - 1.4, 1.72, ppos.z), target: room.v(ppos.x - 0.1, 1.46, ppos.z), fov: 36, blend: 0.8 },
        update: (dt) => {
          const i = game.input;
          const dir = (i.isDown('right') ? 1 : 0) - (i.isDown('left') ? 1 : 0) + game.input.padMove.x;
          const mouse = i.consumeMouse();
          bb.update(dt, { dir, dx: mouse.dx, launch: i.pressed('jump') || i.pressed('confirm') && !i.pressed('interact') });
          if (i.pressed('interact') || i.pressed('back')) game.endActivity();
        },
        end: () => { playing = false; ch.stopOverride(0.3); },
      });
    },
  });
  room.updates.push((dt, t) => {
    crt.uniforms.uTime.value = t;
    bbMat.uniforms.uTime.value = t;
    if (!playing) bb.update(dt, { dir: 0, dx: 0, launch: false });
  });

  // ---- MOST PLAYED leaderboard ----
  const lb = document.createElement('canvas');
  lb.width = 1024;
  lb.height = 1024;
  const lg = lb.getContext('2d')!;
  lg.fillStyle = '#0a0612';
  lg.fillRect(0, 0, 1024, 1024);
  lg.strokeStyle = '#ff3fae';
  lg.lineWidth = 10;
  lg.shadowColor = '#ff3fae';
  lg.shadowBlur = 24;
  lg.strokeRect(24, 24, 976, 976);
  lg.shadowBlur = 0;
  lg.textAlign = 'center';
  lg.fillStyle = '#ffffff';
  lg.font = '900 92px "Avenir Next Condensed", "Arial Narrow", sans-serif';
  lg.fillText('MOST PLAYED', 512, 140);
  lg.font = '700 40px "Courier New", monospace';
  lg.fillStyle = '#3fe0ff';
  lg.fillText('HOURS · STEAM', 512, 200);
  games.slice(0, 10).forEach((gm, i) => {
    const y = 290 + i * 70;
    lg.textAlign = 'left';
    lg.fillStyle = i < 3 ? '#ffd23f' : '#ffffff';
    lg.font = '700 44px "Courier New", monospace';
    let t = `${String(i + 1).padStart(2, ' ')}. ${gm.title.toUpperCase()}`;
    while (lg.measureText(t).width > 700 && t.length > 6) t = `${t.slice(0, -2)}…`;
    lg.fillText(t, 70, y);
    lg.textAlign = 'right';
    lg.fillStyle = '#5ef08f';
    lg.fillText(String(gm.hours ?? 0), 954, y);
  });
  const lbTex = new THREE.CanvasTexture(lb);
  lbTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: lbTex, emissiveIntensity: 1.2 }));
  board.position.set(W / 2 - 0.05, 2.2, -4.5);
  board.rotation.y = -Math.PI / 2;
  room.group.add(board);

  // ---- claw machine (front-left) ----
  {
    const cx = -W / 2 + 1.1;
    const cz = D / 2 - 1.6;
    room.box(room.paint(0xff3fae, 0.35, 0.4), cx, 0, cz, 1.2, 0.9, 1.2, true, 'metal');
    room.box(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0.05 }), cx, 0.9, cz, 1.2, 1.3, 1.2, false, 'metal', false);
    room.box(room.paint(0xff3fae, 0.35, 0.4), cx, 2.2, cz, 1.24, 0.3, 1.24, false);
    room.aabb(cx - 0.62, 0, cz - 0.62, cx + 0.62, 2.5, cz + 0.62, 'metal');
    const plush = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.95 }), 40);
    const pc = new THREE.Color();
    for (let i = 0; i < 40; i++) {
      plush.setMatrixAt(i, new THREE.Matrix4().makeTranslation(cx + (Math.random() - 0.5) * 1.0, 0.98 + Math.random() * 0.3, cz + (Math.random() - 0.5) * 1.0));
      plush.setColorAt(i, pc.setHSL(Math.random(), 0.6, 0.6));
    }
    room.group.add(plush);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), room.paint(0xc8ccd2, 0.3, 0.9));
    claw.position.set(cx, 1.85, cz);
    claw.rotation.x = Math.PI;
    room.group.add(claw);
    room.updates.push((_dt, t) => { claw.position.x = cx + Math.sin(t * 0.7) * 0.35; claw.position.z = cz + Math.cos(t * 0.5) * 0.3; });
    room.point(cx, 2.0, cz, 0xff8ad8, 1.6, 4);
  }

  // ---- retro corner ----
  room.prop('side_table_01', W / 2 - 1.2, -D / 2 + 2.6, 0, {}, 'bounds');
  room.prop('Television_01', W / 2 - 1.2, -D / 2 + 2.6, -Math.PI / 2 + 0.3, {}, 'none', 0.45);
  room.prop('gaming_console', W / 2 - 1.5, -D / 2 + 3.4, 0.4, {}, 'none', 0);
  for (const [bx, bz, c] of [[W / 2 - 2.6, -D / 2 + 2.2, 0x6b3fd8], [W / 2 - 2.8, -D / 2 + 3.6, 0x1fb8a8]] as Array<[number, number, number]>) {
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), room.paint(c, 0.95));
    bean.scale.set(1, 0.6, 1);
    bean.position.set(bx, 0.27, bz);
    bean.castShadow = bean.receiveShadow = true;
    room.group.add(bean);
    room.aabb(bx - 0.4, 0, bz - 0.4, bx + 0.4, 0.5, bz + 0.4, 'carpet');
  }

  // ---- neon + lights ----
  const neonCols = [0xff3fae, 0x3fe0ff];
  for (const [x, z, len, ry, k] of [[0, -D / 2 + 0.04, W - 0.4, 0, 0], [-W / 2 + 0.04, 0, D - 0.4, Math.PI / 2, 1], [W / 2 - 0.04, 0, D - 0.4, Math.PI / 2, 0]] as Array<[number, number, number, number, number]>) {
    for (const y of [3.7, 3.85]) {
      const g = boxGeo(len, 0.035, 0.035);
      g.rotateY(ry);
      g.translate(x, y, z);
      room.B.add(room.glow(neonCols[(k + (y > 3.8 ? 1 : 0)) % 2], 2.6), g, undefined, false);
    }
  }
  room.point(-4, 3.2, -6, 0xb44df0, 6, 12);
  room.point(4, 3.2, -6, 0x3fe0ff, 5, 12);
  room.point(0, 3.2, 3, 0xff3fae, 5, 12);
  room.point(0, 3.2, 8, 0xfff0e0, 3, 10);
  room.rect(0, H - 0.05, 0, 6, 1.2, 0x9f8cff, 0.8);

  room.exitTo('arcade');
  return room.finish({ id: 'arcade', name: 'Arcade', music: 'games', ambience: 'arcade', envIntensity: 0.18 });
}
