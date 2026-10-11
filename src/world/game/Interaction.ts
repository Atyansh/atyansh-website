// Interaction system: anything the player can act on with E / Enter / pad X.
// Each frame the best candidate is chosen by distance and facing; the HUD
// shows its prompt. Activities (sitting, browsing, petting…) implement
// `onInteract` and usually lock the player until they finish.

import * as THREE from 'three';

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
  /** Prefer this over equally-near candidates */
  priority?: number;
  /** Require the player to roughly face it (default true) */
  facing?: boolean;
}

const _p = new THREE.Vector3();

export class InteractionSystem {
  current: Interactable | null = null;

  resolve(list: Interactable[], playerPos: THREE.Vector3, facing: number): Interactable | null {
    const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const it of list) {
      if (it.enabled && !it.enabled()) continue;
      const pos = typeof it.position === 'function' ? it.position() : it.position;
      _p.set(pos.x - playerPos.x, 0, pos.z - playerPos.z);
      const dy = Math.abs(pos.y - playerPos.y - 1);
      const d = _p.length();
      if (d > it.radius || dy > 2.2) continue;
      const dot = d > 0.05 ? _p.normalize().dot(fwd) : 1;
      if (it.facing !== false && dot < -0.1) continue;
      const score = d * (1.6 - dot) - (it.priority ?? 0);
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    this.current = best;
    return best;
  }

  static text(v: string | (() => string)): string {
    return typeof v === 'function' ? v() : v;
  }
}
