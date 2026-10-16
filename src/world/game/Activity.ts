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
  /** Escape / Back: how to leave (default: end the activity) */
  back?: () => void;
  /** 'pause': Escape pauses instead of leaving (e.g. mid-climb) */
  escape?: 'close' | 'pause';
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
  /** Called once when fully seated; `stand` gets the player up */
  afterSeated?: (stand: () => void) => void;
  /** Hide the player's body while seated (first-person views) */
  hideCharacter?: boolean;
  /**
   * Watch from the seat's own eyes (screens: cinema, TV, monitors): the
   * camera sits at seated eye height looking at `shot.target` (or straight
   * ahead), the body is hidden, and the mouse looks around.
   */
  firstPerson?: boolean;
}

/** Sit the player on a seat (SitDown → SitIdle loop → StandUp) */
export function sit(game: Game, seat: Seat): void {
  const ch = game.player.character;
  // seated pelvis offset for *this* body (avatars differ in height)
  const pelvisSeated = ch.boneOffset('SitIdle', 'pelvis', 0.3);
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
  let seatedFired = false;
  let busy = false; // an overlay (browser) is open while seated
  // Pin: once down, the pelvis stays exactly on the seat whatever the clips
  // do (SitDown ends a little off SitIdle's pose; without this the body
  // visibly hops when one hands over to the other)
  let pin = 0;
  const pelvis = ch.bones.get('pelvis');
  ch.play('SitDown', { fade: 0.25, onDone: () => ch.play('SitIdle', { loop: true, fade: 0.25 }) });
  game.events.emit('sfx', { name: 'sit' });
  seat.onSit?.();
  const hide = seat.hideCharacter || seat.firstPerson;
  let shot = seat.shot ?? null;
  if (seat.firstPerson) {
    const eye = seat.hip.clone().addScaledVector(fwd, 0.1).add(new THREE.Vector3(0, 0.74 * ch.root.scale.y, 0));
    shot = { position: eye, target: seat.shot?.target ?? eye.clone().addScaledVector(fwd, 5), fov: seat.shot?.fov ?? 60, blend: seat.shot?.blend ?? 0.8, orbit: { yaw: 1.3, pitch: 0.55 } };
  } else if (shot && !shot.orbit) {
    shot = { ...shot, orbit: { yaw: 0.9, pitch: 0.4 } };
  }
  game.beginActivity({
    name: 'sit',
    shot,
    hint: seat.hint ?? 'E  Stand up · Mouse  Look around',
    back: () => standUp(),
    update: (dt) => {
      t = Math.min(1, t + dt / 0.45);
      const k = t * t * (3 - 2 * t);
      game.player.setPosition(start.clone().lerp(root, k));
      ch.root.position.copy(game.player.position);
      ch.root.rotation.y = seat.facing;
      game.player.facing = seat.facing;
      // pelvis pin: ramps in as SitDown finishes, out while standing
      const down = ch.overrideName === 'SitIdle' || (ch.overrideName === 'SitDown' && t >= 1);
      pin = standing ? Math.max(0, pin - dt / 0.35) : down ? Math.min(1, pin + dt / 0.3) : pin;
      if (pelvis && pin > 0) {
        ch.root.updateMatrixWorld(true);
        const err = seat.hip.clone().sub(pelvis.getWorldPosition(new THREE.Vector3()));
        if (err.length() < 0.4) ch.root.position.addScaledVector(err, pin);
      }
      if (standing) return;
      seat.onUpdate?.(dt);
      if (!seatedFired && t >= 1 && seat.afterSeated) {
        seatedFired = true;
        busy = true;
        seat.afterSeated(() => { busy = false; standUp(); });
      }
      if (busy) { game.browser.update(); return; }
      if (t >= 1 && (game.input.pressed('interact') || game.input.pressed('jump') || game.input.pressed('back'))) standUp();
    },
    end: () => { if (hide) ch.root.visible = true; },
  });
  if (hide) ch.root.visible = false;
  function standUp(): void {
        if (standing) return;
        standing = true;
        ch.root.visible = true;
        if (seat.firstPerson) game.rig.releaseShot(); // don't stand up through the camera
        ch.play('StandUp', {
          fade: 0.15,
          onDone: () => {
            // Walk back out to where you stood before sitting (known to be
            // clear), else the nearest clear spot: never pop into a seat row
            const out = root.clone().addScaledVector(fwd, 0.55);
            out.y = Math.max(seat.hip.y - 0.5, start.y);
            game.endActivity();
            const p = game.player;
            const spot = p.freeSpot([start, out], seat.hip.clone().setY(start.y));
            if (spot) p.walkOut([spot], () => seat.onStand?.());
            else seat.onStand?.();
          },
        });
  }
}
