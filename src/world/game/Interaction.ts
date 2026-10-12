// Interaction system: anything the player can act on with E / Enter / pad X.
//
// Targeting follows the camera, not the character's exact facing:
//  1. Aim pass — a ray from the screen centre hits "aim" meshes (posters,
//     covers, cabinet screens…). If the hit is within reach of the player,
//     that exact item is the target, and the prompt names it.
//  2. Cone pass — everything else (doors, seats, pets, machines) is scored by
//     the angle between the camera's view and the target, plus distance, so
//     looking roughly at a door from a step or two away is enough.

import * as THREE from 'three';

export interface AimPick {
  verb: string;
  label: string;
  act: () => void;
}

export interface Interactable {
  id: string;
  /** World position (or a function for moving targets like pets) */
  position: THREE.Vector3 | (() => THREE.Vector3);
  radius: number;
  /** Verb shown in the prompt: "Sit", "Browse", "Pet"… */
  verb: string | (() => string);
  /** Object name: "BaoBao", "Record crate"… */
  label: string | (() => string);
  enabled?: () => boolean;
  onInteract: () => void;
  /** Prefer this over equally-good candidates */
  priority?: number;
  /** Unused (kept for compatibility); targeting is camera-driven */
  facing?: boolean;
  /**
   * Aim targets: meshes the camera ray can hit. `pick` maps the hit to the
   * specific item (e.g. which poster). Aim-only interactables don't take
   * part in the cone pass.
   */
  aim?: THREE.Object3D[];
  pick?: (hit: THREE.Intersection) => AimPick | null;
  /** Only targetable by looking at its aim meshes */
  aimOnly?: boolean;
}

export interface Resolved {
  it: Interactable;
  verb: string;
  label: string;
  act: () => void;
}

const _ray = new THREE.Raycaster();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _p = new THREE.Vector3();
const REACH = 3.4;

export class InteractionSystem {
  current: Resolved | null = null;

  resolve(list: Interactable[], playerPos: THREE.Vector3, camera: THREE.Camera): Resolved | null {
    camera.getWorldDirection(_fwd);
    const camPos = camera.position;

    // ---- 1. aim pass ----
    const aimList: THREE.Object3D[] = [];
    const owner = new Map<THREE.Object3D, Interactable>();
    for (const it of list) {
      if (!it.aim || (it.enabled && !it.enabled())) continue;
      for (const o of it.aim) { aimList.push(o); owner.set(o, it); }
    }
    let best: Resolved | null = null;
    if (aimList.length) {
      _ray.set(camPos, _fwd);
      _ray.far = camPos.distanceTo(playerPos) + REACH + 1;
      const hits = _ray.intersectObjects(aimList, false);
      for (const h of hits) {
        // ignore hits behind the player (between camera and character)
        if (h.distance < camPos.distanceTo(playerPos) * 0.6) continue;
        _p.copy(h.point);
        const horiz = Math.hypot(_p.x - playerPos.x, _p.z - playerPos.z);
        if (horiz > REACH || Math.abs(_p.y - playerPos.y - 1) > 2.6) break;
        const it = owner.get(h.object)!;
        const pick = it.pick?.(h);
        if (pick) best = { it, ...pick };
        else best = { it, verb: InteractionSystem.text(it.verb), label: InteractionSystem.text(it.label), act: it.onInteract };
        break;
      }
    }
    if (best) {
      this.current = best;
      return best;
    }

    // ---- 2. cone pass ----
    let bestScore = Infinity;
    for (const it of list) {
      if (it.aimOnly) continue;
      if (it.enabled && !it.enabled()) continue;
      const pos = typeof it.position === 'function' ? it.position() : it.position;
      const horiz = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
      if (horiz > it.radius * 1.35 || Math.abs(pos.y - playerPos.y - 1) > 2.4) continue;
      _to.copy(pos).sub(camPos).normalize();
      const ang = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_to.dot(_fwd), -1, 1)));
      // right next to it: any reasonable view counts; further away: need to look at it
      const limit = horiz < 1.3 ? 75 : 38;
      if (ang > limit) continue;
      const score = ang + horiz * 7 - (it.priority ?? 0) * 6;
      if (score < bestScore) {
        bestScore = score;
        best = { it, verb: InteractionSystem.text(it.verb), label: InteractionSystem.text(it.label), act: it.onInteract };
      }
    }
    this.current = best;
    return best;
  }

  static text(v: string | (() => string)): string {
    return typeof v === 'function' ? v() : v;
  }
}
