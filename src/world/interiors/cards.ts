// Text-only content (projects, blog posts, Euler problems) rendered as
// designed cards: used both as wall art and as browser "covers".

import * as THREE from 'three';

export interface CardSpec {
  kicker: string;
  title: string;
  body?: string;
  chips?: string[];
  footer?: string;
  accent: string;
  bg?: string;
  big?: string;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number): number {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const w of words) {
    if (g.measureText(`${line}${w} `).width > maxW && line) {
      g.fillText(line.trim(), x, y);
      y += lh;
      line = '';
      if (++lines >= maxLines - 1) {
        let rest = words.slice(words.indexOf(w)).join(' ');
        while (g.measureText(`${rest}…`).width > maxW && rest.length > 3) rest = rest.slice(0, -2);
        g.fillText(`${rest}…`, x, y);
        return y + lh;
      }
    }
    line += `${w} `;
  }
  g.fillText(line.trim(), x, y);
  return y + lh;
}

export function drawCard(spec: CardSpec, w = 600, h = 800): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = spec.bg ?? '#14161d';
  g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `${spec.accent}33`);
  grad.addColorStop(1, 'transparent');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = spec.accent;
  g.fillRect(0, 0, w, 12);
  const pad = 46;
  g.fillStyle = spec.accent;
  g.font = '700 22px "Avenir Next", system-ui, sans-serif';
  g.fillText(spec.kicker.toUpperCase(), pad, 70);
  let y = 150;
  if (spec.big) {
    g.fillStyle = '#ffffff';
    g.font = '800 150px "Avenir Next Condensed", "Arial Narrow", sans-serif';
    g.fillText(spec.big, pad - 6, 230);
    y = 300;
  }
  g.fillStyle = '#f4f1ea';
  g.font = '800 52px "Avenir Next Condensed", "Arial Narrow", sans-serif';
  y = wrap(g, spec.title, pad, y, w - pad * 2, 58, 3) + 10;
  if (spec.chips?.length) {
    g.font = '600 20px "Avenir Next", system-ui, sans-serif';
    let x = pad;
    for (const chip of spec.chips.slice(0, 6)) {
      const cw = g.measureText(chip).width + 24;
      if (x + cw > w - pad) { x = pad; y += 40; }
      g.fillStyle = `${spec.accent}33`;
      g.fillRect(x, y - 24, cw, 34);
      g.fillStyle = spec.accent;
      g.fillText(chip, x + 12, y);
      x += cw + 10;
    }
    y += 56;
  }
  if (spec.body) {
    g.fillStyle = 'rgba(244,241,234,0.78)';
    g.font = '400 26px "Avenir Next", system-ui, sans-serif';
    wrap(g, spec.body, pad, y, w - pad * 2, 38, Math.floor((h - y - 80) / 38));
  }
  if (spec.footer) {
    g.fillStyle = 'rgba(244,241,234,0.45)';
    g.font = '600 20px "Avenir Next", system-ui, sans-serif';
    g.fillText(spec.footer, pad, h - 40);
  }
  return c;
}

export function cardTexture(spec: CardSpec, w?: number, h?: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(drawCard(spec, w, h));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function cardURL(spec: CardSpec, w?: number, h?: number): string {
  return drawCard(spec, w, h).toDataURL('image/jpeg', 0.86);
}
