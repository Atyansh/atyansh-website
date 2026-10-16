// Day/night lighting registry. Emissive materials (signs, displays, lamp
// heads, lit windows) register their day/night intensities; real lights
// register too. On a time-of-day change everything blends to the new level.
//
// Real lamp lights are pooled: only the N lamps nearest the player get an
// actual PointLight at night (shader cost scales with light count).

import * as THREE from 'three';
import { cityUniforms } from './WindowMaterial';

interface Entry { m: THREE.MeshStandardMaterial; day: number; night: number }

export class NightLights {
  private entries: Entry[] = [];
  private lamps: THREE.Vector3[] = [];
  private pool: THREE.PointLight[] = [];
  night = 0;

  constructor(private scene: THREE.Scene, poolSize = 6) {
    for (let i = 0; i < poolSize; i++) {
      const l = new THREE.PointLight(0xffc98a, 0, 16, 1.6);
      l.visible = false;
      this.pool.push(l);
      scene.add(l);
    }
  }

  register(m: THREE.MeshStandardMaterial, day: number, night: number): void {
    this.entries.push({ m, day, night });
    m.emissiveIntensity = THREE.MathUtils.lerp(day, night, this.night);
  }

  /** Lamp head position eligible for a pooled PointLight at night */
  addLamp(p: THREE.Vector3): void {
    this.lamps.push(p.clone());
  }

  set(night: number): void {
    this.night = night;
    cityUniforms.night.value = night;
    for (const e of this.entries) e.m.emissiveIntensity = THREE.MathUtils.lerp(e.day, e.night, night);
  }

  /** Assign pooled lights to the lamps nearest the focus */
  update(focus: THREE.Vector3, active: boolean): void {
    const on = active && this.night > 0.3;
    if (!on) {
      for (const l of this.pool) l.visible = false;
      return;
    }
    const sorted = this.lamps
      .map((p) => ({ p, d: p.distanceToSquared(focus) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.pool.length);
    // Keep every pooled light visible at night (unused ones at zero): toggling
    // visibility changes the light count and recompiles every shader
    this.pool.forEach((l, i) => {
      const s = sorted[i];
      l.visible = true;
      if (!s) { l.intensity = 0; return; }
      l.position.copy(s.p).add(new THREE.Vector3(0, -0.4, 0));
      l.intensity = 38 * this.night;
    });
    void this.scene;
  }
}
