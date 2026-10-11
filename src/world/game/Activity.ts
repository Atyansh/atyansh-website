// Activities own input (and optionally the camera) while the player does
// something other than walking: sitting, browsing a collection, playing the
// arcade cabinet, climbing, petting… Game routes the frame to the active one.

import * as THREE from 'three';
import type { Game } from './Game';
import type { Shot } from './CameraRig';

export interface Activity {
  name: string;
  /** per-frame logic; read input from game.input */
  update(dt: number): void;
  /** called when the activity ends (either by itself or forced) */
  end?(): void;
  /** camera shot to hold while active */
  shot?: Shot | null;
  /** keep the free orbit camera (e.g. climbing) */
  freeCamera?: boolean;
  /** HUD hint line, e.g. "E  Stand up · A/D  Channel" */
  hint?: string;
}

export interface Seat {
  /** world-space point where the pelvis should rest */
  hip: THREE.Vector3;
  /** direction the sitter faces (radians, 0 = +Z) */
  facing: number;
  shot?: Shot;
  hint?: string;
  /** extra per-frame logic while seated (channel surfing, …) */
  onUpdate?: (dt: number) => void;
  onSit?: () => void;
  onStand?: () => void;
}

let pelvisSeated: THREE.Vector3 | null = null;

/** Sit the player on a seat (SitDown → SitIdle loop → StandUp) */
export function sit(game: Game, seat: Seat): void {
  const ch = game.player.character;
  if (!pelvisSeated) pelvisSeated = ch.boneOffset('SitIdle', 'pelvis', 0.3);
  const fwd = new THREE.Vector3(Math.sin(seat.facing), 0, Math.cos(seat.facing));
  const right = new THREE.Vector3(Math.cos(seat.facing), 0, -Math.sin(seat.facing));
  // root such that the seated pelvis lands on the seat point
  const root = seat.hip.clone()
    .addScaledVector(fwd, -pelvisSeated.z)
    .addScaledVector(right, -pelvisSeated.x);
  root.y = seat.hip.y - pelvisSeated.y;
  const start = game.player.position.clone();
  let t = 0;
  let standing = false;
  ch.play('SitDown', { fade: 0.25, onDone: () => ch.play('SitIdle', { loop: true, fade: 0.2 }) });
  game.events.emit('sfx', { name: 'sit' });
  seat.onSit?.();
  game.beginActivity({
    name: 'sit',
    shot: seat.shot ?? null,
    hint: seat.hint ?? 'E  Stand up',
    update: (dt) => {
      t = Math.min(1, t + dt / 0.45);
      const k = t * t * (3 - 2 * t);
      game.player.setPosition(start.clone().lerp(root, k));
      ch.root.position.copy(game.player.position);
      ch.root.rotation.y = seat.facing;
      game.player.facing = seat.facing;
      if (!standing) seat.onUpdate?.(dt);
      if (!standing && t >= 1 && (game.input.pressed('interact') || game.input.pressed('jump') || game.input.pressed('back'))) {
        standing = true;
        ch.play('StandUp', {
          fade: 0.15,
          onDone: () => {
            // step forward off the seat
            const out = root.clone().addScaledVector(fwd, 0.55);
            out.y = Math.max(seat.hip.y - 0.5, start.y);
            game.player.setPosition(out);
            game.endActivity();
            seat.onStand?.();
          },
        });
      }
    },
  });
}
