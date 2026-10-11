// Renderer + post stack.
//
//   Render (HDR) → GTAO (half-res) → Bloom (HDR) → Output (ACES + sRGB)
//   → Grade (LDR: contrast, saturation, warmth, vignette, grain, CA, filters)
//   → SMAA
//
// One persistent camera drives everything (player rig, cinematics, photo
// mode), so passes that bind a camera are built once.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export const PIXEL_RATIO_CAP = 1.5;

export type PhotoFilter = 'none' | 'noir' | 'warm' | 'cool' | 'retro' | 'vivid';
const FILTER_ID: Record<PhotoFilter, number> = { none: 0, noir: 1, warm: 2, cool: 3, retro: 4, vivid: 5 };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    contrast: { value: 1.06 },
    saturation: { value: 1.08 },
    warmth: { value: 0.02 },
    vignette: { value: 0.22 },
    grain: { value: 0.018 },
    aberration: { value: 0.0012 },
    filterId: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, contrast, saturation, warmth, vignette, grain, aberration;
    uniform int filterId;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 sat(vec3 c, float s) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return mix(vec3(l), c, s); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      // Chromatic aberration grows toward the frame edge only
      vec2 off = d * aberration * r2 * 4.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = (c - 0.5) * contrast + 0.5;
      c = sat(c, saturation);
      c += vec3(warmth, warmth * 0.35, -warmth * 0.6);
      if (filterId == 1) { float l = dot(c, vec3(0.3, 0.59, 0.11)); c = vec3(pow(l, 1.15)) * 1.05; }
      else if (filterId == 2) { c = sat(c, 1.1) * vec3(1.08, 1.0, 0.86); }
      else if (filterId == 3) { c = sat(c, 0.95) * vec3(0.9, 1.0, 1.12); }
      else if (filterId == 4) { c = sat(c, 0.7) * vec3(1.06, 0.98, 0.84) + vec3(0.04, 0.03, 0.0); }
      else if (filterId == 5) { c = sat((c - 0.5) * 1.12 + 0.5, 1.35); }
      float v = smoothstep(0.85, 0.2, r2 * 2.2);
      c *= mix(1.0 - vignette, 1.0, v);
      c += (hash(vUv * 1031.0 + fract(time)) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  readonly camera: THREE.PerspectiveCamera;
  private renderPass: RenderPass;
  readonly gtao: GTAOPass;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private smaa: SMAAPass;

  constructor(private container: HTMLElement, scene: THREE.Scene) {
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.08, 1500);

    const w = container.clientWidth;
    const h = container.clientHeight;
    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.gtao = new GTAOPass(scene, this.camera, w, h);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.9;
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 16 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setScene(scene: THREE.Scene): void {
    this.renderPass.scene = scene;
    this.gtao.scene = scene;
  }

  setFilter(f: PhotoFilter): void {
    this.grade.uniforms.filterId.value = FILTER_ID[f];
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    // AO at half resolution: visually indistinguishable after the denoise
    const pr = this.renderer.getPixelRatio();
    this.gtao.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.grade.uniforms.resolution.value.set(w, h);
  }

  render(time: number): void {
    this.grade.uniforms.time.value = time;
    this.composer.render();
  }
}
