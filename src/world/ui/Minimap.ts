// Minimap: the static city map is rendered once to an offscreen canvas
// (streets, sidewalks, park, building footprints coloured by accent, labels);
// each frame it is drawn rotated with the camera plus live markers.

import { BLOCK, CURB, CURB_H, LOTS, OUTER_LOTS, PARK, ROAD_OUT, OUTER_FRONT, facingRotation, type Lot } from '../world/layout';
import type { Game } from '../game/Game';

const PPM = 4; // pixels per metre in the static map
const EXTENT = 110;

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function renderCityMap(): HTMLCanvasElement {
  const size = EXTENT * 2 * PPM;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const X = (x: number) => (x + EXTENT) * PPM;
  const Z = (z: number) => (z + EXTENT) * PPM;
  g.fillStyle = '#1b1e25';
  g.fillRect(0, 0, size, size);
  // roads
  g.fillStyle = '#2c3039';
  g.fillRect(X(-EXTENT), Z(-ROAD_OUT.z), size, (ROAD_OUT.z - CURB.z) * PPM);
  g.fillRect(X(-EXTENT), Z(CURB.z), size, (ROAD_OUT.z - CURB.z) * PPM);
  g.fillRect(X(-ROAD_OUT.x), Z(-EXTENT), (ROAD_OUT.x - CURB.x) * PPM, size);
  g.fillRect(X(CURB.x), Z(-EXTENT), (ROAD_OUT.x - CURB.x) * PPM, size);
  // sidewalks
  g.fillStyle = '#3b404b';
  g.fillRect(X(-CURB.x), Z(-CURB.z), CURB.x * 2 * PPM, CURB.z * 2 * PPM);
  // park
  g.fillStyle = '#3f6b3a';
  g.fillRect(X(PARK.minX), Z(PARK.minZ), (PARK.maxX - PARK.minX) * PPM, (PARK.maxZ - PARK.minZ) * PPM);
  // buildings
  const drawLot = (l: Lot) => {
    const rot = facingRotation(l.facing);
    const sn = Math.abs(Math.sin(rot));
    const cs = Math.abs(Math.cos(rot));
    const hx = (cs * l.w + sn * l.d) / 2;
    const hz = (sn * l.w + cs * l.d) / 2;
    g.fillStyle = l.enter ? hex(l.accent) : l.backdrop ? '#262a32' : '#4a505c';
    g.globalAlpha = l.enter ? 0.85 : 1;
    g.fillRect(X(l.x - hx), Z(l.z - hz), hx * 2 * PPM, hz * 2 * PPM);
    g.globalAlpha = 1;
    if (l.enter) {
      g.fillStyle = '#ffffff';
      g.font = `700 ${PPM * 3.2}px "Avenir Next Condensed", "Arial Narrow", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(l.name.toUpperCase(), X(l.x), Z(l.z));
    }
  };
  [...OUTER_LOTS, ...LOTS].forEach(drawLot);
  void BLOCK; void CURB_H; void OUTER_FRONT;
  return c;
}

export class Minimap {
  private map = renderCityMap();
  private acc = 0;
  constructor(private game: Game, private canvas: HTMLCanvasElement) {}

  update(dt: number): void {
    this.acc += dt;
    if (this.acc < 1 / 20) return;
    this.acc = 0;
    const g = this.canvas.getContext('2d')!;
    const S = this.canvas.width;
    const game = this.game;
    g.clearRect(0, 0, S, S);
    if (!game.player) return;
    if (game.level?.interior) {
      g.fillStyle = '#151820';
      g.fillRect(0, 0, S, S);
      g.fillStyle = '#ffffff';
      g.font = '800 40px "Avenir Next Condensed", sans-serif';
      g.textAlign = 'center';
      g.fillText(game.level.name.toUpperCase(), S / 2, S / 2);
      g.font = '600 22px "Avenir Next", sans-serif';
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.fillText('indoors', S / 2, S / 2 + 34);
      return;
    }
    const p = game.player.position;
    const zoom = 1.6; // canvas px per map px
    const yaw = game.rig.yaw; // camera boom direction; view = yaw + PI
    g.save();
    g.translate(S / 2, S / 2);
    // view direction (yaw + PI) points up the screen
    g.rotate(yaw);
    g.scale(zoom, zoom);
    g.drawImage(this.map, -(p.x + EXTENT) * PPM, -(p.z + EXTENT) * PPM);
    // live markers in map space
    const mark = (x: number, z: number, col: string, r: number) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc((x - p.x) * PPM, (z - p.z) * PPM, r, 0, Math.PI * 2);
      g.fill();
    };
    const pets = (game as unknown as { petMarkers?: () => Array<{ x: number; z: number }> }).petMarkers?.() ?? [];
    for (const m of pets) mark(m.x, m.z, '#ffb547', 4);
    const recs = (game as unknown as { recordMarkers?: () => Array<{ x: number; z: number }> }).recordMarkers?.() ?? [];
    for (const m of recs) mark(m.x, m.z, '#ffe27a', 3);
    g.restore();
    // player arrow (always up = facing relative to camera)
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-(game.player.facing - (yaw + Math.PI)));
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(11, 12);
    g.lineTo(0, 6);
    g.lineTo(-11, 12);
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
    // north marker on the rim
    g.fillStyle = '#ff5a4e';
    g.font = '800 26px "Avenir Next Condensed", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', S / 2 + Math.sin(yaw) * (S / 2 - 22), S / 2 - Math.cos(yaw) * (S / 2 - 22));
  }
}
