// Canvas-generated signage: fascia boards, blade signs, street signs,
// awnings, menu boards, murals. Signs read as printed/built objects —
// dimensional letters with drop shadows on painted boards.

import * as THREE from 'three';
import { rng } from '../engine/math';

const DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, aniso = 8): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

function fitFont(g: CanvasRenderingContext2D, text: string, family: string, weight: string, maxW: number, maxH: number): number {
  let size = maxH;
  g.font = `${weight} ${size}px ${family}`;
  while (g.measureText(text).width > maxW && size > 10) {
    size -= 2;
    g.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Shop fascia: painted board with dimensional letters */
export function fasciaTexture(text: string, accent: number, dark = true, serif = false): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 192);
  const board = dark ? '#16181d' : '#ece6d8';
  g.fillStyle = board;
  g.fillRect(0, 0, 1024, 192);
  // board bevel
  g.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 1012, 180);
  const fam = serif ? SERIF : DISPLAY;
  fitFont(g, text, fam, '800', 940, 130);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // letter depth
  g.fillStyle = dark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)';
  g.fillText(text, 512 + 5, 100 + 6);
  g.fillStyle = hex(accent);
  g.fillText(text, 512, 100);
  // top highlight on letters
  g.globalCompositeOperation = 'source-atop';
  const grad = g.createLinearGradient(0, 40, 0, 160);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 192);
  g.globalCompositeOperation = 'source-over';
  return tex(c);
}

/** Vertical blade sign (cinema, hotel…) */
export function bladeTexture(text: string, accent: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 1024);
  g.fillStyle = '#1a1b20';
  g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = hex(accent);
  g.lineWidth = 14;
  g.strokeRect(14, 14, 228, 996);
  const letters = text.split('');
  const step = 900 / letters.length;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${Math.min(170, step * 0.95)}px ${DISPLAY}`;
  letters.forEach((ch, i) => {
    const y = 70 + step * (i + 0.5);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillText(ch, 132, y + 5);
    g.fillStyle = '#fff6e0';
    g.fillText(ch, 128, y);
  });
  // bulbs
  for (let y = 40; y < 1000; y += 46) {
    for (const x of [30, 226]) {
      g.fillStyle = '#ffe6a0';
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  return tex(c);
}

/** Green street-name sign */
export function streetSignTexture(name: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 112);
  g.fillStyle = '#1f6b3a';
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = '#f2f2f2';
  g.lineWidth = 5;
  g.strokeRect(8, 8, 496, 96);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, name, '"Helvetica Neue", Arial, sans-serif', '700', 470, 64);
  g.fillText(name, 256, 58);
  return tex(c);
}

/** Striped awning fabric */
export function awningTexture(accent: number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 64);
  const a = new THREE.Color(accent);
  const dark = `#${a.clone().multiplyScalar(0.75).getHexString()}`;
  const light = '#f3efe6';
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? dark : light;
    g.fillRect(i * 32, 0, 32, 64);
  }
  const t = tex(c, 4);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Chalk menu board */
export function menuTexture(title: string, lines: string[]): THREE.CanvasTexture {
  const [c, g] = canvas(256, 384);
  g.fillStyle = '#1d2420';
  g.fillRect(0, 0, 256, 384);
  g.strokeStyle = '#6b4a2f';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 242, 370);
  g.fillStyle = '#f4f1e6';
  g.textAlign = 'center';
  g.font = `700 34px ${DISPLAY}`;
  g.fillText(title, 128, 60);
  g.font = `22px ${SERIF}`;
  lines.forEach((l, i) => g.fillText(l, 128, 112 + i * 40));
  return tex(c, 4);
}

/** Climbing gym mural: rock shards + giant wordmark */
export function muralTexture(word: string, sub: string, accent: number): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 640);
  g.fillStyle = '#2e3136';
  g.fillRect(0, 0, 1024, 640);
  const a = new THREE.Color(accent);
  const shades = [hex(accent), `#${a.clone().multiplyScalar(0.72).getHexString()}`, `#${a.clone().lerp(new THREE.Color(0xffffff), 0.3).getHexString()}`, '#43464d', '#54585f'];
  const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const bx = 320 + r() * 660;
    const by = 640 - r() * 520;
    const s = 90 + r() * 190;
    g.fillStyle = shades[Math.floor(r() * shades.length)];
    g.globalAlpha = 0.85 + r() * 0.15;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + s * (0.5 + r() * 0.6), by - s * (0.3 + r() * 0.5));
    g.lineTo(bx + s * (0.1 + r() * 0.5), by - s * (0.8 + r() * 0.4));
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#f2efe8';
  fitFont(g, word, DISPLAY, '800', 900, 110);
  g.fillText(word, 48, 150);
  g.fillStyle = hex(accent);
  g.fillRect(52, 178, 420, 14);
  g.font = `700 52px ${DISPLAY}`;
  g.fillStyle = '#b9bec7';
  g.fillText(sub, 52, 266);
  return tex(c);
}

/** Generic shop display contents: shelves of coloured goods */
export function shelfTexture(seed: number, accent: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  const r = rng(seed);
  g.fillStyle = '#3a342e';
  g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 3; row++) {
    const y = 30 + row * 78;
    g.fillStyle = '#6d5a46';
    g.fillRect(0, y + 58, 512, 8);
    let x = 6;
    while (x < 500) {
      const w = 16 + r() * 34;
      const h = 26 + r() * 30;
      const col = new THREE.Color().setHSL(r(), 0.35 + r() * 0.4, 0.35 + r() * 0.35);
      if (r() < 0.25) col.set(accent);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x, y + 58 - h, w - 3, h);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + 2, y + 60 - h, 4, h - 6);
      x += w;
    }
  }
  return tex(c, 4);
}

/** Simple house number plate */
export function plateTexture(text: string): THREE.CanvasTexture {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#20232a';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#e8dcc0';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 40px ${SERIF}`;
  g.fillText(text, 64, 34);
  return tex(c, 2);
}
