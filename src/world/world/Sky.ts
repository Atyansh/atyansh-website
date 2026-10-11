// Sky, sun and time of day.
//
// Each preset pairs a 1k HDR (image-based lighting + sun extraction) with a
// 4096x1024 tonemapped JPG of the upper hemisphere (crisp backdrop). The
// backdrop dome runs the JPG through an *inverse* ACES curve so that after
// the global ACES tonemap in OutputPass it lands back on the photographer's
// grade — sharp clouds without shipping a 20MB 4k HDR.
//
// The sun direction + tint are found from the HDR's brightest region, so
// shadows always agree with the sky. The shadow frustum follows the player,
// snapped to shadow-map texels to avoid shimmering.

import * as THREE from 'three';
import type { Assets } from '../engine/Assets';

export type TimeOfDay = 'day' | 'sunset' | 'dusk' | 'night';

interface Preset {
  hdri: string;
  sun: number;
  env: number;
  exposure: number;
  /** 0 = lamps off, 1 = full night lighting */
  night: number;
  fog: number;
  bg: number;
  /** override light direction (e.g. moonlight) */
  dir?: THREE.Vector3;
  sunColor?: THREE.Color;
}

export const PRESETS: Record<TimeOfDay, Preset> = {
  day: { hdri: 'kloofendal_48d_partly_cloudy_puresky', sun: 3.6, env: 0.9, exposure: 1.0, night: 0, fog: 0.0016, bg: 1 },
  sunset: { hdri: 'qwantani_sunset_puresky', sun: 3.0, env: 0.85, exposure: 1.05, night: 0.35, fog: 0.0024, bg: 1 },
  dusk: {
    hdri: 'qwantani_dusk_2_puresky', sun: 0.35, env: 1.0, exposure: 1.25, night: 0.85, fog: 0.003, bg: 1,
    dir: new THREE.Vector3(-0.4, 0.6, 0.5).normalize(), sunColor: new THREE.Color(0.75, 0.68, 0.9),
  },
  night: {
    hdri: 'qwantani_night_puresky', sun: 0.22, env: 1.6, exposure: 1.35, night: 1, fog: 0.0032, bg: 1.2,
    dir: new THREE.Vector3(0.3, 0.8, -0.4).normalize(), sunColor: new THREE.Color(0.55, 0.65, 1.0),
  },
};

// three's ACESFilmicToneMapping matrices (GLSL column order)
const ACES_IN = new THREE.Matrix3().fromArray([0.59719, 0.076, 0.0284, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777]);
const ACES_OUT = new THREE.Matrix3().fromArray([1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602]);

const domeMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    tSky: { value: null as THREE.Texture | null },
    invIn: { value: ACES_IN.clone().invert() },
    invOut: { value: ACES_OUT.clone().invert() },
    exposure: { value: 1 },
    intensity: { value: 1 },
    horizon: { value: new THREE.Color(0.7, 0.75, 0.82) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww; // pin to far plane
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tSky;
    uniform mat3 invIn, invOut;
    uniform float exposure, intensity;
    uniform vec3 horizon;
    varying vec3 vDir;
    vec3 invRRT(vec3 y) {
      y = clamp(y, 0.0, 0.985);
      vec3 A = 0.983729 * y - 1.0;
      vec3 B = 0.4329510 * y - 0.0245786;
      vec3 C = 0.238081 * y + 0.000090537;
      return (-B - sqrt(B * B - 4.0 * A * C)) / (2.0 * A);
    }
    void main() {
      vec3 d = normalize(vDir);
      float u = atan(d.z, d.x) * 0.15915494 + 0.5;
      float el = asin(clamp(d.y, -1.0, 1.0)) * 0.63661977; // 0 at horizon, 1 at zenith
      vec3 target;
      if (el >= 0.0) target = texture2D(tSky, vec2(u, el)).rgb; // texture holds the upper half, v=0 at horizon
      else target = mix(texture2D(tSky, vec2(u, 0.002)).rgb, horizon, clamp(-el * 6.0, 0.0, 1.0));
      vec3 v = invRRT(invOut * (target * intensity));
      vec3 scene = (invIn * v) / (exposure / 0.6);
      gl_FragColor = vec4(max(scene, 0.0), 1.0);
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  toneMapped: false,
});

export class Sky {
  readonly sun: THREE.DirectionalLight;
  readonly dome: THREE.Mesh;
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  current: TimeOfDay = 'day';
  /** 0..1 — systems poll this to drive lamps / window lights */
  night = 0;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private shadowExtent = 45;
  onChange: ((t: TimeOfDay, night: number) => void)[] = [];

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, private assets: Assets) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sun = new THREE.DirectionalLight(0xfff1de, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -this.shadowExtent;
    cam.right = cam.top = this.shadowExtent;
    cam.near = 1;
    cam.far = 260;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun, this.sun.target);

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), domeMaterial());
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
    scene.fog = new THREE.FogExp2(0xb8c8da, 0.0016);
  }

  async set(t: TimeOfDay): Promise<void> {
    const p = PRESETS[t];
    const [hdr, bg] = await Promise.all([
      this.assets.hdr(`sky/${p.hdri}.hdr`),
      new THREE.TextureLoader().loadAsync(`/world/assets/sky/${p.hdri}_bg.jpg`),
    ]);
    bg.colorSpace = THREE.SRGBColorSpace;
    bg.wrapS = THREE.RepeatWrapping;
    // No mips: the equirect u-seam's derivative jump would pick the lowest mip
    // and draw a vertical streak down the sky
    bg.generateMipmaps = false;
    bg.minFilter = THREE.LinearFilter;

    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const rt = this.pmrem.fromEquirectangular(hdr);
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = p.env;

    // Sun from the brightest HDR region
    const { dir, color, horizon } = analyseHdr(hdr);
    this.sunDir.copy(p.dir ?? dir);
    if (this.sunDir.y < 0.08) this.sunDir.y = 0.08;
    this.sunDir.normalize();
    this.sun.color.copy(p.sunColor ?? color);
    this.sun.intensity = p.sun;
    hdr.dispose();

    const m = this.dome.material as THREE.ShaderMaterial;
    (m.uniforms.tSky.value as THREE.Texture | null)?.dispose();
    m.uniforms.tSky.value = bg;
    m.uniforms.exposure.value = p.exposure;
    m.uniforms.intensity.value = p.bg;
    m.uniforms.horizon.value.copy(horizon);
    this.renderer.toneMappingExposure = p.exposure;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(horizon);
    fog.density = p.fog;
    this.current = t;
    this.night = p.night;
    this.onChange.forEach((fn) => fn(t, p.night));
  }

  /** Keep the shadow frustum centred on the focus point, texel-snapped */
  update(focus: THREE.Vector3, camera: THREE.Camera): void {
    this.dome.position.copy(camera.position);
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    // Light-space axes
    const fwd = this.sunDir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const r = Math.round(focus.dot(right) / texel) * texel;
    const u = Math.round(focus.dot(up) / texel) * texel;
    const f = focus.dot(fwd);
    const snapped = right.multiplyScalar(r).add(up.multiplyScalar(u)).add(fwd.multiplyScalar(f));
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(this.sunDir, 120);
    this.sun.target.updateMatrixWorld();
  }

  setShadowExtent(e: number): void {
    this.shadowExtent = e;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -e;
    cam.right = cam.top = e;
    cam.updateProjectionMatrix();
  }
}

/** Find sun direction/colour and average horizon colour of an equirect HDR */
function analyseHdr(tex: THREE.DataTexture): { dir: THREE.Vector3; color: THREE.Color; horizon: THREE.Color } {
  const { width: W, height: H } = tex.image;
  const data = tex.image.data as unknown as ArrayLike<number>;
  const stride = data.length / (W * H);
  const half = tex.type === THREE.HalfFloatType;
  const val = (i: number) => (half ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
  let best = -1;
  let bi = 0;
  for (let y = 0; y < H / 2; y++) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * stride;
      const l = val(i) * 0.2126 + val(i + 1) * 0.7152 + val(i + 2) * 0.0722;
      if (l > best) { best = l; bi = y * W + x; }
    }
  }
  const px = bi % W;
  const py = Math.floor(bi / W);
  // three's equirect convention (flipY): row 0 is the top of the image
  const u = (px + 0.5) / W;
  const v = 1 - (py + 0.5) / H;
  const lat = (v - 0.5) * Math.PI;
  const phi = (u - 0.5) * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat)).normalize();

  // Sun tint: a ring around the hotspot, normalised to its max channel
  const c = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const x = (px + dx + W) % W;
      const y = Math.min(H - 1, Math.max(0, py + dy));
      const i = (y * W + x) * stride;
      c.r += val(i); c.g += val(i + 1); c.b += val(i + 2); n++;
    }
  }
  const m = Math.max(c.r, c.g, c.b) || 1;
  const color = new THREE.Color(c.r / m, c.g / m, c.b / m).lerp(new THREE.Color(1, 1, 1), 0.35);

  // Horizon colour: average of the row just above the horizon
  const hy = Math.floor(H / 2) - 3;
  const h = new THREE.Color(0, 0, 0);
  for (let x = 0; x < W; x += 4) {
    const i = (hy * W + x) * stride;
    h.r += val(i); h.g += val(i + 1); h.b += val(i + 2);
  }
  h.multiplyScalar(4 / W);
  const hm = Math.max(h.r, h.g, h.b) || 1;
  const horizon = new THREE.Color(h.r / hm, h.g / hm, h.b / hm).multiplyScalar(Math.min(1, hm * 0.9));
  return { dir, color, horizon };
}
