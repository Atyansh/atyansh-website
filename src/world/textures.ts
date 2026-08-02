// Procedural canvas textures for The Block — no image assets, everything
// generated at boot. Deterministic via a tiny seeded RNG so every visit
// renders the same city.

import * as THREE from 'three';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

/** Asphalt: dark speckle + faint cracks + patch variation. Tile ≈ 6m. */
export function asphaltTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const rnd = mulberry(101);
  g.fillStyle = '#3f4146';
  g.fillRect(0, 0, 512, 512);
  // Large soft patches (repaved variation)
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 90 + rnd() * 160;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = 56 + Math.floor(rnd() * 14);
    grad.addColorStop(0, `rgba(${tone},${tone + 2},${tone + 6},0.55)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  // Speckle
  for (let i = 0; i < 9000; i++) {
    const v = 40 + Math.floor(rnd() * 50);
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rnd() * 0.4})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1.2, 1.2);
  }
  // Faint cracks
  g.strokeStyle = 'rgba(22,23,26,0.55)';
  g.lineWidth = 1.1;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    let x = rnd() * 512, y = rnd() * 512;
    g.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (rnd() - 0.5) * 90;
      y += (rnd() - 0.5) * 90;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return finish(c, repeatX, repeatY);
}

/** Concrete sidewalk with 2m expansion-joint slabs. Tile = 2 slabs (4m). */
export function sidewalkTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const rnd = mulberry(202);
  g.fillStyle = '#b6b7ba';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const v = 150 + Math.floor(rnd() * 60);
    g.fillStyle = `rgba(${v},${v},${v},${0.2 + rnd() * 0.3})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1.4, 1.4);
  }
  // Slab joints: 2 per tile each way
  g.strokeStyle = 'rgba(90,92,96,0.85)';
  g.lineWidth = 3;
  for (const p of [0, 256, 511]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  // Stains
  for (let i = 0; i < 5; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(96,96,100,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  return finish(c, repeatX, repeatY);
}

/**
 * Upper-facade window grid. One tile = one structural bay (~4m) x one floor
 * (~3.2m): wall surround, spandrel band, and a window whose glass varies
 * between sky-reflection tones. Tinted toward the building accent.
 */
export function windowsTexture(
  baseColor: number,
  accent: number,
  seed: number,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry(seed);
  const base = new THREE.Color(baseColor).lerp(new THREE.Color(accent), 0.14);
  const wall = `#${base.getHexString()}`;
  const wallShade = `#${base.clone().multiplyScalar(0.82).getHexString()}`;
  g.fillStyle = wall;
  g.fillRect(0, 0, 256, 256);
  // subtle stucco noise
  for (let i = 0; i < 2200; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
  }
  // spandrel band at tile bottom
  g.fillStyle = wallShade;
  g.fillRect(0, 218, 256, 38);
  // window: frame + glass
  const wx = 42, wy = 44, ww = 172, wh = 150;
  g.fillStyle = '#2c2f34';
  g.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);
  const glassTones = ['#87a6c4', '#7797b6', '#9db8d2', '#6d8cab', '#5e7d9c'];
  const tone = glassTones[Math.floor(rnd() * glassTones.length)];
  const grad = g.createLinearGradient(0, wy, 0, wy + wh);
  grad.addColorStop(0, '#c8daea');
  grad.addColorStop(0.45, tone);
  grad.addColorStop(1, '#4a6580');
  g.fillStyle = grad;
  g.fillRect(wx, wy, ww, wh);
  // mullions
  g.fillStyle = '#31343a';
  g.fillRect(wx + ww / 2 - 3, wy, 6, wh);
  g.fillRect(wx, wy + wh / 2 - 3, ww, 6);
  // sill highlight
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(wx - 7, wy + wh + 7, ww + 14, 5);
  return finish(c, repeatX, repeatY);
}

/** Grass with mowing variation for the park. */
export function grassTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry(303);
  g.fillStyle = '#5f8b4f';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const green = 110 + Math.floor(rnd() * 60);
    g.fillStyle = `rgba(${green - 60},${green},${green - 70},${0.3 + rnd() * 0.4})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
  }
  // mow stripes
  for (let x = 0; x < 256; x += 64) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x, 0, 32, 256);
  }
  return finish(c, repeatX, repeatY);
}

/**
 * Standing-seam metal panel for industrial facades (the climbing gym):
 * charcoal field, vertical ribs, faint horizontal panel seams.
 */
export function metalPanelTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry(404);
  g.fillStyle = '#383b41';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
  }
  // Vertical standing-seam ribs
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(x, 0, 2, 256);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x + 3, 0, 3, 256);
  }
  // Horizontal panel seams
  g.fillStyle = 'rgba(0,0,0,0.20)';
  for (const y of [0, 128]) g.fillRect(0, y, 256, 2);
  return finish(c, repeatX, repeatY);
}

/**
 * Painted climbing-wall plywood: warm light field, faint 1.5m panel seams,
 * and the t-nut grid every ~20cm that reads unmistakably as a gym wall.
 * One tile = one 1.5m panel; set repeat = meters / 1.5 for constant density.
 */
export function plyPanelTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry(505);
  g.fillStyle = '#ddd8cb';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
  }
  // Panel seams on the tile edges
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  // T-nut grid: 7x7 per 1.5m panel (~21cm spacing)
  g.fillStyle = 'rgba(40,38,34,0.5)';
  for (let gx = 0; gx < 7; gx++) {
    for (let gy = 0; gy < 7; gy++) {
      g.beginPath();
      g.arc(19 + gx * 36.5, 19 + gy * 36.5, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(c, repeatX, repeatY);
}

/** Painted awning stripes in a building's accent. */
export function awningTexture(accent: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 128);
  const a = new THREE.Color(accent);
  const dark = `#${a.clone().multiplyScalar(0.72).getHexString()}`;
  const light = `#${a.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString()}`;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? dark : light;
    g.fillRect(i * 32, 0, 32, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
