import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Buggy } from "./buggyTypes";

/* ================================================================== API */
export type GateId = "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "projects" | "pit";
export interface GateSpec {
  id: GateId; label: string; sub: string;
  /** optional CSS hex accent (banner, post light strips, timing beam, burst). Falls back to a vivid palette by index. */
  color?: string;
}
export interface Telemetry { speedKmh: number; rpm: number; gear: number; lapTime: number; bestLap: number | null; gatesCleared: GateId[]; nextGate: GateId | null; }
export interface TrackOptions {
  container: HTMLElement;
  createBuggy: () => Buggy;
  gates: GateSpec[];
  onGate: (id: GateId) => void;
  onTelemetry: (t: Telemetry) => void;
  onReady: () => void;
  quality?: "high" | "low";
}
export interface TrackAPI {
  setInput(i: { throttle: number; steer: number; brake: boolean }): void;
  setPaused(p: boolean): void;
  /** let the car drive itself round the lap */
  setAuto(on: boolean): void;
  /** start a new stage: relabel the gates (matched by id), reset which are cleared, and move the sky to another time of day (0 dawn · 1 day · 2 sunset · 3 night) */
  setStage(specs: GateSpec[], theme: number): void;
  resetCar(): void;
  teleportToGate(id: GateId): void;
  dispose(): void;
  /** ~6 s finale over the start/finish: fireworks, gantry confetti, flashing green start lights, arpeggio. */
  celebrate(): void;
  /** WebAudio engine/chime/landing/finale sounds. Default off; call with true from a user gesture. */
  setSound(on: boolean): void;
}

/* ============================================================ constants */
const STENCIL = '"Saira Stencil One", "Impact", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** closed centreline (x, z). Lap runs +X along the start straight, clockwise seen from above. */
const CTRL: [number, number][] = [
  [0, 0], [10, 0], [20, 0], [31.3, 4.7], [36, 16], [31.3, 27.3], [20, 32], [8, 31.5],
  [-2, 27.5], [-12, 21], [-20, 18.5], [-26.6, 15.7], [-29.3, 9.25], [-26.6, 2.8], [-20, 0], [-10, 0],
];
const HALF_W = 4.2;         // racing surface half width
const WALL_D = 5.8;         // barrier offset from centreline
const NS = 640;             // centreline samples
const VMAX = 16.7;          // ~60 km/h
const VREV = 6.0;
const WB = 1.58;            // wheelbase
const GRAV = 17;
const RAMP = { s: 77, len: 5.2, h: 0.85, w: 3.8 };
const RAMP_GAP: [number, number] = [70, 92];   // no gates here
const GARAGE = { x: -12, z: -16.5 };
const GREEN = new THREE.Color(0x3dff8a);
/** vivid default gate accents, used by index when a GateSpec has no colour */
const GATE_PALETTE = ["#ff2e88", "#ffb21a", "#18d4ff", "#7dff3a", "#a66bff", "#ff6a1f", "#1fffc8", "#ffe14a"];
/** golden-hour sun: where the disc sits in the sky (low) and where the key light comes from (a bit higher) */
const SUN_AZ = new THREE.Vector2(-0.98, 0.2).normalize();
const SUN_SKY = new THREE.Vector3(SUN_AZ.x, 0.075, SUN_AZ.y).normalize();
const SUN_DIR = new THREE.Vector3(SUN_AZ.x, 0.5, SUN_AZ.y).normalize();

/* ============================================================== helpers */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapAngle = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function setSpacing(g: CanvasRenderingContext2D, px: number) { (g as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; }

function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 34) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = "#15120e"; g.fillRect(x, y, w, h);
  g.fillStyle = "#f0b414";
  for (let i = -h; i < w + h; i += step) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + step / 2, y); g.lineTo(x + i + step / 2 - h, y + h); g.lineTo(x + i - h, y + h); g.fill(); }
  g.restore();
}

/* ========================================================= track data */
interface TrackData {
  L: number; ds: number;
  px: Float32Array; pz: Float32Array; tx: Float32Array; tz: Float32Array; k: Float32Array;
  offL: Float32Array; offR: Float32Array; limL: Float32Array; limR: Float32Array;
  tyreL: Uint8Array; tyreR: Uint8Array;
}
function smoothCyclic(a: Float32Array, r: number, passes: number) {
  const n = a.length, tmp = new Float32Array(n);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) { let s = 0; for (let o = -r; o <= r; o++) s += a[(i + o + n) % n]; tmp[i] = s / (2 * r + 1); }
    a.set(tmp);
  }
}
function cleanRuns(f: Uint8Array, minLen: number) {
  const n = f.length;
  for (const run of runs((i) => f[i] === 1)) if (run[1] < minLen) for (let j = 0; j < run[1]; j++) f[(run[0] + j) % n] = 0;
}
/** contiguous cyclic runs [start, length] of samples where pred holds */
function runs(pred: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < NS; i++) if (!pred(i)) { start = i; break; }
  if (start < 0) return [[0, NS]];
  let cur = -1;
  for (let o = 1; o <= NS; o++) {
    const i = (start + o) % NS;
    if (pred(i)) { if (cur < 0) cur = i; }
    else if (cur >= 0) { out.push([cur, (i - cur + NS) % NS]); cur = -1; }
  }
  return out;
}
function buildTrackData(): TrackData {
  const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
  const L = curve.getLength(), ds = L / NS;
  const px = new Float32Array(NS), pz = new Float32Array(NS), tx = new Float32Array(NS), tz = new Float32Array(NS);
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < NS; i++) {
    curve.getPointAt(i / NS, p); curve.getTangentAt(i / NS, t); t.y = 0; t.normalize();
    px[i] = p.x; pz[i] = p.z; tx[i] = t.x; tz[i] = t.z;
  }
  const k = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    const a = (i - 1 + NS) % NS, b = (i + 1) % NS;
    k[i] = ((tx[b] - tx[a]) * -tz[i] + (tz[b] - tz[a]) * tx[i]) / (2 * ds); // + = turning right
  }
  smoothCyclic(k, 6, 3);
  const offL = new Float32Array(NS), offR = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    const kk = k[i], inner = Math.abs(kk) > 1e-4 ? clamp(0.8 / Math.abs(kk), HALF_W + 0.9, WALL_D) : WALL_D;
    offR[i] = kk > 0 ? inner : WALL_D; offL[i] = kk < 0 ? inner : WALL_D;
  }
  smoothCyclic(offL, 4, 2); smoothCyclic(offR, 4, 2);
  const tyreL = new Uint8Array(NS), tyreR = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) { tyreR[i] = k[i] < -1 / 26 ? 1 : 0; tyreL[i] = k[i] > 1 / 26 ? 1 : 0; }
  cleanRuns(tyreL, 10); cleanRuns(tyreR, 10);
  const limL = new Float32Array(NS), limR = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    limL[i] = offL[i] - (tyreL[i] ? 1.5 : 0.95);
    limR[i] = offR[i] - (tyreR[i] ? 1.5 : 0.95);
  }
  return { L, ds, px, pz, tx, tz, k, offL, offR, limL, limR, tyreL, tyreR };
}

/* ================================================================= main */
export function createTrack(opts: TrackOptions): TrackAPI {
  const { container } = opts;
  const low = opts.quality === "low";
  const W = () => container.clientWidth || window.innerWidth, H = () => container.clientHeight || window.innerHeight;
  const rand = mulberry(20260917);
  const debug = typeof location !== "undefined" && /[?&]trackdebug\b/.test(location.search);

  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.75));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const FOG = new THREE.Color(0xd8808a);
  scene.background = FOG.clone();
  scene.fog = new THREE.Fog(FOG, 60, 260);
  const camera = new THREE.PerspectiveCamera(56, W() / H(), 0.1, 1400);

  const T = buildTrackData();
  const finishers: (() => void)[] = [];
  const { L, ds, px, pz, tx, tz } = T;
  const textures: THREE.Texture[] = [];
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true, repeat = false) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = low ? 2 : 8;
    textures.push(t);
    return t;
  }
  /** world point at sample i, lateral offset d (+ = right of driving direction) */
  const at = (i: number, d: number, out = new THREE.Vector3(), y = 0) => out.set(px[i] - tz[i] * d, y, pz[i] + tx[i] * d);
  const idxOf = (s: number) => ((Math.round(s / ds) % NS) + NS) % NS;
  const yawAt = (i: number) => Math.atan2(tx[i], tz[i]);

  /* ---------------------------------------------------------- lights */
  const hemi = new THREE.HemisphereLight(0xffb3c6, 0x6a4a2e, 1.35);
  scene.add(hemi);
  const MOON_DIR = SUN_DIR; // the key light is now the low golden-hour sun
  const moon = new THREE.DirectionalLight(0xffc08a, 2.7);
  moon.castShadow = true;
  moon.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 90 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
  scene.add(moon, moon.target);
  const gateLight = new THREE.PointLight(0xffa21a, 0, 16, 2);
  scene.add(gateLight);

  /* ------------------------------------------------------------- sky */
  // golden-hour gradient: deep violet zenith -> magenta -> hot orange at the horizon, a big low sun and stylised clouds
  const skyMat = new THREE.ShaderMaterial({
    defines: { OCT: low ? 3 : 4 },
    uniforms: {
      zen: { value: new THREE.Color(0x2a1660) }, mid: { value: new THREE.Color(0x9a2f8e) },
      hor: { value: new THREE.Color(0xff7a4a) }, sunC: { value: new THREE.Color(0xffc76a) },
      sunDir: { value: SUN_SKY.clone() }, fogC: { value: FOG.clone() }, uTime: { value: 0 }, uDim: { value: 0 },
      side: { value: new THREE.Color(0.86, 0.34, 0.55) }, hot: { value: new THREE.Color(0.98, 0.44, 0.16) }, cLit: { value: new THREE.Color(1, 0.52, 0.55) }, cGold: { value: new THREE.Color(1, 0.82, 0.5) }, cDark: { value: new THREE.Color(0.42, 0.2, 0.5) },
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform vec3 zen, mid, hor, sunC, sunDir, fogC, side, hot, cLit, cGold, cDark; uniform float uTime, uDim; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < OCT; i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return s; }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec2 hz = normalize(d.xz + 1e-5); float az = dot(hz, normalize(sunDir.xz)) * .5 + .5; // 1 = towards the sun
        vec3 horC = mix(mix(side, hor, az), hot, pow(az, 6.));
        vec3 c = mix(horC, mid, smoothstep(0.0, 0.28, h)); c = mix(c, zen, smoothstep(0.22, 0.85, h));
        float a = max(dot(d, sunDir), 0.);
        c += sunC * (pow(a, 8.) * .16 + pow(a, 90.) * .38) * (1. - smoothstep(0., .6, h));
        // clouds on a virtual plane, streaked horizontally, lit pink/gold from the sun side, violet underneath
        if (h > 0.0) {
          vec2 p = d.xz / (h + .09); p *= vec2(.55, 1.6);
          float n = fbm(p * .9 + vec2(uTime * .006, 0.));
          float m = smoothstep(.5, .72, n) * smoothstep(0., .07, h) * (1. - smoothstep(.45, .8, h));
          float lit = smoothstep(.45, .85, fbm(p * .9 + vec2(uTime * .006, 0.) + normalize(sunDir.xz) * .18));
          vec3 cc = mix(cDark, mix(cLit, cGold, az), .35 + .65 * (1. - lit));
          cc += sunC * pow(a, 10.) * .5;
          c = mix(c, cc, m * .85);
        }
        // sun disc (drawn over clouds, HDR so the bloom catches it)
        float disc = smoothstep(.99945, .99965, dot(d, sunDir));
        c = mix(c, vec3(1.,.8,.5) * 2.4, disc);
        // finale: the sky drops towards deep violet so the fireworks pop
        c = mix(c, c * vec3(.32,.22,.5), uDim * smoothstep(-.02, .25, h));
        c = mix(c, fogC, 1. - smoothstep(-0.05, 0.015, h));
        gl_FragColor = vec4(c, 1.); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  /** four times of day, one per stage */
  const THEMES = [
    { zen: 0x34488f, mid: 0xe58fb0, hor: 0xffc38f, sunC: 0xfff0c8, fog: 0xf0b6ae, side: 0xe7a0b8, hot: 0xffc070, cLit: 0xffd2d8, cGold: 0xfff0c8, cDark: 0x8a6a9a, hs: 0xffd6e0, hg: 0x6a5a40, hi: 1.45, kc: 0xffe2c4, ki: 2.8 },
    { zen: 0x1f5fd0, mid: 0x6aa8ee, hor: 0xcfe8ff, sunC: 0xffffff, fog: 0xb8d6f2, side: 0xa8cdf2, hot: 0xfff4d8, cLit: 0xffffff, cGold: 0xfffbea, cDark: 0x9fb2c8, hs: 0xdcecff, hg: 0x5f7044, hi: 1.7, kc: 0xfff8ec, ki: 3.2 },
    { zen: 0x2a1660, mid: 0x9a2f8e, hor: 0xff7a4a, sunC: 0xffc76a, fog: 0xd8808a, side: 0xdb578c, hot: 0xfa7029, cLit: 0xff858c, cGold: 0xffd180, cDark: 0x6b3380, hs: 0xffb3c6, hg: 0x6a4a2e, hi: 1.35, kc: 0xffc08a, ki: 2.7 },
    { zen: 0x040822, mid: 0x18205e, hor: 0x5a3b9a, sunC: 0xc8d8ff, fog: 0x2c2a5c, side: 0x3a2f7a, hot: 0x8a6ad0, cLit: 0x6a6ab0, cGold: 0x9a9ad8, cDark: 0x141838, hs: 0x8a9cff, hg: 0x241a38, hi: 1.05, kc: 0xa8b8ff, ki: 1.9 },
  ];
  let themeFrom = 2, themeTo = 2, themeK = 1;
  const tmpCa = new THREE.Color(), tmpCb = new THREE.Color();
  function applyTheme(k: number) {
    const a = THEMES[themeFrom], b = THEMES[themeTo];
    const mixC = (x: number, y: number, out: THREE.Color) => out.copy(tmpCa.set(x)).lerp(tmpCb.set(y), k);
    const u = skyMat.uniforms;
    for (const key of ["zen", "mid", "hor", "sunC", "side", "hot", "cLit", "cGold", "cDark"] as const) mixC(a[key], b[key], u[key].value);
    mixC(a.fog, b.fog, u.fogC.value); mixC(a.fog, b.fog, scene.fog!.color); (scene.background as THREE.Color).copy(scene.fog!.color);
    mixC(a.hs, b.hs, hemi.color); mixC(a.hg, b.hg, hemi.groundColor); hemi.intensity = a.hi + (b.hi - a.hi) * k;
    mixC(a.kc, b.kc, moon.color); moon.intensity = a.ki + (b.ki - a.ki) * k;
  }
  const skyGroup = new THREE.Group(); scene.add(skyGroup);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.renderOrder = -10; skyGroup.add(sky);
  {
    // a few early stars high up in the violet
    const n = low ? 70 : 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * Math.PI * 2, v = 0.62 + rand() * 0.38;
      const r = Math.sqrt(1 - v * v);
      pos.set([Math.cos(u) * r * 850, v * 850, Math.sin(u) * r * 850], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe6f4, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.55, depthWrite: false }));
    skyGroup.add(stars);
  }

  /* --------------------------------------------- environment for metals */
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), skyMat));
    const em = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc98a).multiplyScalar(6) });
    for (const [x, y, z] of [[20, 12, 5], [-18, 10, -12], [5, 14, 22]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), em); b.position.set(x, y, z); env.add(b); }
    const grd = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x4a3a26 })); grd.rotation.x = -Math.PI / 2; grd.position.y = -1; env.add(grd);
    scene.environment = pmrem.fromScene(env, 0, 0.1, 200).texture;
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.55;
    env.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.material !== skyMat) (m.material as THREE.Material).dispose(); } });
  }

  /* ---------------------------------------------------------- ground */
  const world = new THREE.Group(); scene.add(world);
  const grassTex = canvasTex(256, 256, (g) => {
    g.fillStyle = "#4a8a2a"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = rand();
      g.fillStyle = v < 0.5 ? `rgba(${50 + rand() * 40},${100 + rand() * 50},${20 + rand() * 20},0.55)` : v < 0.8 ? `rgba(${150 + rand() * 50},${140 + rand() * 40},${50},0.35)` : "rgba(30,50,18,0.5)";
      g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 3);
    }
  }, true, true);
  grassTex.repeat.set(110, 110);
  {
    const geo = new THREE.PlaneGeometry(700, 700, 70, 70); geo.rotateX(-Math.PI / 2);
    const col = new Float32Array(geo.attributes.position.count * 3);
    const pa = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const n = 0.5 + 0.25 * Math.sin(x * 0.09 + Math.cos(z * 0.07) * 2) + 0.25 * Math.sin(z * 0.13 + x * 0.04);
      const c = new THREE.Color().setRGB(0.5 + n * 0.4, 0.62 + n * 0.42, 0.4 + n * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 1, metalness: 0 }));
    ground.receiveShadow = true; world.add(ground);
  }

  /* ---------------------------------------------------- ribbons (track) */
  function ribbon(i0: number, n: number, a: (i: number) => number, b: (i: number) => number, y: number, uv: (i: number, j: number, side: 0 | 1, d: number) => [number, number]) {
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    const v = new THREE.Vector3();
    for (let j = 0; j <= n; j++) {
      const i = (i0 + j) % NS;
      const da = a(i), db = b(i);
      at(i, da, v, y); pos.push(v.x, v.y, v.z); uvs.push(...uv(i, j, 0, da));
      at(i, db, v, y); pos.push(v.x, v.y, v.z); uvs.push(...uv(i, j, 1, db));
      if (j < n) { const q = j * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a ribbon whose left edge is at -left, right edge at +right; winding = up
  const dirtTex = canvasTex(512, 1024, (g) => {
    const Wc = 512, Hc = 1024;
    g.fillStyle = "#a8714a"; g.fillRect(0, 0, Wc, Hc);
    const blot = (x: number, y: number, r: number, c: string) => {
      for (const oy of [-Hc, 0, Hc]) { const gr = g.createRadialGradient(x, y + oy, 0, x, y + oy, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y + oy - r, r * 2, r * 2); }
    };
    for (let i = 0; i < 140; i++) blot(rand() * Wc, rand() * Hc, 30 + rand() * 90, rand() < 0.5 ? "rgba(52,38,28,0.35)" : "rgba(140,110,80,0.28)");
    // runoff (outside the racing surface) looser and lighter, with grass creeping in at the very edge
    const edge = (0.5 - HALF_W / (2 * WALL_D)) * Wc;
    for (const [x0, x1] of [[0, edge], [Wc - edge, Wc]]) {
      g.fillStyle = "rgba(150,124,92,0.22)"; g.fillRect(x0, 0, x1 - x0, Hc);
    }
    for (let i = 0; i < 2600; i++) {
      const side = rand() < 0.5, x = side ? Math.pow(rand(), 2.2) * 30 : Wc - Math.pow(rand(), 2.2) * 30;
      g.fillStyle = `rgba(${30 + rand() * 20},${50 + rand() * 30},${22},0.7)`; g.fillRect(x, rand() * Hc, 2, 3 + rand() * 6);
    }
    // ruts on the racing line
    for (const cx of [0.36, 0.44, 0.56, 0.64]) {
      for (let i = 0; i < 900; i++) {
        const y = rand() * Hc, x = cx * Wc + (rand() - 0.5) * 22 + Math.sin(y * 0.012 + cx * 9) * 10;
        g.fillStyle = `rgba(60,36,22,${0.05 + rand() * 0.08})`; g.fillRect(x, y, 3 + rand() * 6, 10 + rand() * 30);
      }
    }
    // speckle + pebbles
    for (let i = 0; i < 26000; i++) { const l = rand(); g.fillStyle = l < 0.55 ? `rgba(25,18,12,${0.2 + rand() * 0.3})` : `rgba(170,140,105,${0.08 + rand() * 0.16})`; g.fillRect(rand() * Wc, rand() * Hc, 1 + rand() * 1.5, 1 + rand() * 1.5); }
    for (let i = 0; i < 260; i++) {
      const x = rand() * Wc, y = rand() * Hc, r = 1.2 + rand() * 2.5;
      g.fillStyle = `rgba(${120 + rand() * 40},${105 + rand() * 35},${85 + rand() * 30},0.6)`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rand() * 0.4), rand() * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(20,14,10,0.4)"; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * 0.5, 0, 0, Math.PI); g.fill();
    }
  }, true, true);
  const DIRT_V = 8; // metres per texture repeat along the track
  const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.96, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  if (!low) { dirtMat.bumpMap = dirtTex; dirtMat.bumpScale = 0.9; }
  const track = new THREE.Mesh(
    ribbon(0, NS, (i) => -T.offL[i] - 0.25, (i) => T.offR[i] + 0.25, 0.012, (i, j, _s, d) => [0.5 + d / (2 * WALL_D + 0.5), (j * ds) / DIRT_V]),
    dirtMat,
  );
  track.receiveShadow = true; world.add(track);

  // kerbs on the bends
  const kerbTex = canvasTex(64, 128, (g) => {
    g.fillStyle = "#c92a1f"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ece6da"; g.fillRect(0, 64, 64, 64);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, 6, 128); g.fillRect(58, 0, 6, 128);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(60,40,25,${rand() * 0.35})`; g.fillRect(rand() * 64, rand() * 128, 2, 2); }
  }, true, true);
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [s0, n] of runs((i) => Math.abs(T.k[i]) > 1 / 42)) {
    for (const side of [-1, 1]) {
      const g = ribbon(s0, n,
        (i) => (side < 0 ? -(HALF_W + 0.75) : HALF_W) * 1,
        (i) => (side < 0 ? -HALF_W : HALF_W + 0.75),
        0.03, (_i, j, sd) => [sd, (j * ds) / 1.6]);
      const m = new THREE.Mesh(g, kerbMat); m.receiveShadow = true; world.add(m);
    }
  }
  // start/finish chequer
  {
    const chk = canvasTex(256, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#eee"; g.fillRect(x * 16, y * 16, 16, 16); } });
    const span = T.offL[0] + T.offR[0];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const c = at(0, (T.offR[0] - T.offL[0]) / 2); m.position.set(c.x, 0.035, c.z); m.rotation.y = yawAt(0);
    m.receiveShadow = true; world.add(m);
  }

  /* --------------------------------------------------------- barriers */
  const barTex = canvasTex(256, 64, (g) => {
    g.fillStyle = "#b8251c"; g.fillRect(0, 0, 128, 64); g.fillStyle = "#e6e0d4"; g.fillRect(128, 0, 128, 64);
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(126, 0, 4, 64); g.fillRect(0, 0, 3, 64);
    const gr = g.createLinearGradient(0, 64, 0, 30); gr.addColorStop(0, "rgba(60,42,28,0.8)"); gr.addColorStop(1, "rgba(60,42,28,0)"); g.fillStyle = gr; g.fillRect(0, 30, 256, 34);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, 4, 256, 3);
  }, true, true);
  const barMat = new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.55, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    const v = new THREE.Vector3(); let acc = 0; const prev = new THREE.Vector3();
    for (let j = 0; j <= NS; j++) {
      const i = j % NS; const d = side * (side < 0 ? T.offL[i] : T.offR[i]);
      at(i, d, v); if (j) acc += v.distanceTo(prev); prev.copy(v);
      pos.push(v.x, 0, v.z, v.x, 0.82, v.z); uvs.push(acc / 3, 0, acc / 3, 1);
      if (j < NS) { const q = j * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, barMat); m.receiveShadow = true; m.castShadow = !low; world.add(m);
  }

  /* ----------------------------------------------------- tyre walls */
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3(), e4 = new THREE.Euler();
  const place = (pos: THREE.Vector3, yaw: number, sc: number | THREE.Vector3, rx = 0, rz = 0) => {
    e4.set(rx, yaw, rz); q4.setFromEuler(e4);
    if (typeof sc === "number") s4.setScalar(sc); else s4.copy(sc);
    return m4.compose(pos, q4, s4);
  };
  {
    const prof = [[0.17, -0.12], [0.27, -0.13], [0.33, -0.09], [0.345, 0], [0.33, 0.09], [0.27, 0.13], [0.17, 0.12], [0.17, -0.12]].map(([x, y]) => new THREE.Vector2(x, y));
    const tyreGeo = new THREE.LatheGeometry(prof, 10);
    const tread = canvasTex(64, 64, (g) => { g.fillStyle = "#cfcfcf"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#7a7a7a"; for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 64); for (let i = 0; i < 64; i += 16) g.fillRect(0, i + 6, 64, 2); }, true, true);
    tread.repeat.set(6, 1);
    const tyreMat = new THREE.MeshStandardMaterial({ map: tread, roughness: 0.88, metalness: 0 });
    const mats: THREE.Matrix4[] = [], cols: THREE.Color[] = [];
    const BLACK = new THREE.Color(0x262626), RED = new THREE.Color(0xb8261d), WHITE = new THREE.Color(0xdcd6ca);
    for (const side of [-1, 1]) {
      const f = side < 0 ? T.tyreL : T.tyreR, off = side < 0 ? T.offL : T.offR;
      for (const [s0, n] of runs((i) => f[i] === 1)) {
        let acc = 0, col = 0; const prev = new THREE.Vector3(), v = new THREE.Vector3();
        for (let j = 0; j < n; j++) {
          const i = (s0 + j) % NS; at(i, side * (off[i] - 0.38), v);
          if (j) acc += v.distanceTo(prev); prev.copy(v);
          if (j === 0 || acc >= 0.68) {
            acc = 0; col++;
            const stack = Math.abs(T.k[i]) > 1 / 13 ? 3 : 2;
            for (let l = 0; l < stack; l++) {
              mats.push(place(p4.set(v.x, 0.13 + l * 0.26, v.z), rand() * 6.28, 1).clone());
              cols.push(l === stack - 1 ? (Math.floor(col / 2) % 2 ? RED : WHITE) : BLACK);
            }
          }
        }
      }
    }
    const inst = new THREE.InstancedMesh(tyreGeo, tyreMat, mats.length);
    mats.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, cols[i]); });
    inst.castShadow = !low; inst.receiveShadow = true; inst.computeBoundingSphere(); world.add(inst);
  }

  /* -------------------------------------------------- ramp (kicker) */
  const ri = idxOf(RAMP.s + RAMP.len / 2);
  const rtx = tx[ri], rtz = tz[ri];
  const rc = at(ri, 0);
  const rox = rc.x - rtx * RAMP.len / 2, roz = rc.z - rtz * RAMP.len / 2;
  const rampH = (u: number) => RAMP.h * Math.pow(u / RAMP.len, 1.7);
  function groundY(x: number, z: number) {
    const dx = x - rox, dz = z - roz;
    const u = dx * rtx + dz * rtz; if (u <= 0 || u >= RAMP.len) return 0;
    const w = -dx * rtz + dz * rtx; if (Math.abs(w) > RAMP.w / 2) return 0;
    return rampH(u);
  }
  {
    const shape = new THREE.Shape(); shape.moveTo(0, 0);
    for (let i = 1; i <= 14; i++) { const u = (i / 14) * RAMP.len; shape.lineTo(u, rampH(u)); }
    shape.lineTo(RAMP.len, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: RAMP.w, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); geo.translate(RAMP.w / 2, 0, 0);
    const plank = canvasTex(256, 256, (g) => {
      g.fillStyle = "#7d5a38"; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#6e4e30" : "#86613d"; g.fillRect(0, i * 32, 256, 30); g.fillStyle = "rgba(20,12,6,0.6)"; g.fillRect(0, i * 32 + 30, 256, 2); }
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(30,20,10,${rand() * 0.25})`; g.fillRect(rand() * 256, rand() * 256, 6 + rand() * 20, 1); }
    }, true, true);
    plank.repeat.set(0.5, 0.5);
    const ramp = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: plank, roughness: 0.85 }));
    ramp.position.set(rox, 0.012, roz); ramp.rotation.y = Math.atan2(rtx, rtz);
    ramp.castShadow = true; ramp.receiveShadow = true; world.add(ramp);
    // chevron board on the lip
    const chev = canvasTex(256, 64, (g) => hazard(g, 0, 0, 256, 64, 40));
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(RAMP.w, RAMP.h), new THREE.MeshStandardMaterial({ map: chev, roughness: 0.6, emissive: 0x3a2a00, emissiveMap: chev }));
    lip.position.set(0, RAMP.h / 2, RAMP.len + 0.01); ramp.add(lip);
  }

  /* ------------------------------------------- cones, bales, scrub */
  const coneSpots: THREE.Vector3[] = [], baleSpots: { p: THREE.Vector3; yaw: number }[] = [];
  {
    const coneGeo = mergeGeometries([
      new THREE.ConeGeometry(0.15, 0.44, 10, 1, true).translate(0, 0.25, 0),
      new THREE.BoxGeometry(0.34, 0.035, 0.34).translate(0, 0.0175, 0),
    ], true)!;
    const coneTex = canvasTex(8, 64, (g) => { g.fillStyle = "#ff5a0f"; g.fillRect(0, 0, 8, 64); g.fillStyle = "#f2f2f2"; g.fillRect(0, 22, 8, 12); g.fillRect(0, 42, 8, 7); });
    const coneMat = new THREE.MeshStandardMaterial({ map: coneTex, roughness: 0.5, emissive: 0x401000, side: THREE.DoubleSide });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 });
    // hairpin apex inner and outer cone lines (outside the barriers)
    for (let i = 0; i < NS; i += 6) {
      if (Math.abs(T.k[i]) > 1 / 11) {
        const inner = T.k[i] > 0 ? 1 : -1;
        coneSpots.push(at(i, inner * ((inner > 0 ? T.offR[i] : T.offL[i]) + 0.5)));
      }
    }
    // cones along the ramp approach, outside the walls
    for (let s = RAMP.s - 8; s < RAMP.s + 12; s += 1.6) { const i = idxOf(s); coneSpots.push(at(i, -(T.offL[i] + 0.45)), at(i, T.offR[i] + 0.45)); }
    const cones = new THREE.InstancedMesh(coneGeo, [coneMat, baseMat], 200);
    let nC = 0;
    const addCones = () => { for (const p of coneSpots) if (nC < 200) cones.setMatrixAt(nC++, place(p, rand() * 6, 1)); cones.count = nC; cones.computeBoundingSphere(); };
    cones.castShadow = !low; world.add(cones);
    // bales around hairpin, ramp, and gantry
    for (const [s0, n] of runs((i) => T.tyreL[i] === 1 || T.tyreR[i] === 1)) {
      for (let j = 0; j < n; j += 6) {
        const i = (s0 + j) % NS, side = T.tyreR[i] ? 1 : -1;
        if (Math.abs(T.k[i]) < 1 / 16) continue;
        baleSpots.push({ p: at(i, side * ((side > 0 ? T.offR[i] : T.offL[i]) + 1.0)), yaw: yawAt(i) });
      }
    }
    for (const s of [RAMP.s - 3, RAMP.s + 1.5, RAMP.s + 6]) { const i = idxOf(s); for (const side of [-1, 1]) baleSpots.push({ p: at(i, side * ((side > 0 ? T.offR[i] : T.offL[i]) + 1.2)), yaw: yawAt(i) }); }
    const strawTex = canvasTex(128, 64, (g) => {
      g.fillStyle = "#b08a42"; g.fillRect(0, 0, 128, 64);
      for (let i = 0; i < 1400; i++) { g.strokeStyle = rand() < 0.5 ? "rgba(220,186,110,0.5)" : "rgba(110,80,30,0.45)"; g.lineWidth = 1; g.beginPath(); const x = rand() * 128, y = rand() * 64; g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 12, y + (rand() - 0.5) * 4); g.stroke(); }
      g.fillStyle = "rgba(60,40,15,0.6)"; g.fillRect(0, 18, 128, 2); g.fillRect(0, 44, 128, 2);
    });
    const bales = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.5, 0.55), new THREE.MeshStandardMaterial({ map: strawTex, roughness: 1 }), 160);
    let nB = 0;
    const addBales = () => {
      for (const b of baleSpots) {
        if (nB >= 160) break;
        bales.setMatrixAt(nB++, place(p4.set(b.p.x, b.p.y + 0.25, b.p.z), b.yaw + Math.PI / 2 + (rand() - 0.5) * 0.15, 1));
      }
      bales.count = nB; bales.computeBoundingSphere();
    };
    bales.castShadow = true; bales.receiveShadow = true; world.add(bales);
    // deferred so gates/gantry/garage can add spots first
    finishers.push(addCones, addBales);
  }
  function finish() { for (const f of finishers) f(); }

  /* scrub / bushes / trees / hills */
  function nearTrack(x: number, z: number, m: number) {
    for (let i = 0; i < NS; i += 3) { const dx = x - px[i], dz = z - pz[i]; if (dx * dx + dz * dz < m * m) return true; }
    return false;
  }
  const inGarage = (x: number, z: number) => x > GARAGE.x - 11 && x < GARAGE.x + 11 && z > GARAGE.z - 8 && z < -5;
  {
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x5f8a2c, roughness: 1, flatShading: true });
    const n = low ? 160 : 340;
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, n);
    let k = 0, guard = 0;
    while (k < n && guard++ < 6000) {
      const x = -75 + rand() * 160, z = -55 + rand() * 135;
      if (nearTrack(x, z, WALL_D + 2.2) || inGarage(x, z)) continue;
      const s = 0.35 + rand() * 0.9;
      bushes.setMatrixAt(k, place(p4.set(x, s * 0.25, z), rand() * 6, new THREE.Vector3(s * (1 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (1 + rand() * 0.6))));
      // mostly lush greens, the odd golden or blossom-pink shrub
      const r0 = rand();
      const c = r0 < 0.08 ? new THREE.Color().setHSL(0.93, 0.7, 0.75) : r0 < 0.2 ? new THREE.Color().setHSL(0.12, 0.85, 0.8) : new THREE.Color().setHSL(0.2 + rand() * 0.08, 0.5, 0.65 + rand() * 0.3);
      bushes.setColorAt(k, c); k++;
    }
    bushes.count = k; bushes.computeBoundingSphere(); bushes.receiveShadow = true; world.add(bushes);

    const treeGeo = new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0);
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x2f6a3a });
    const nt = low ? 260 : 520;
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, nt);
    for (let i = 0; i < nt; i++) {
      const a = rand() * Math.PI * 2, r = 52 + Math.pow(rand(), 0.8) * 120;
      const x = 3 + Math.cos(a) * r, z = 13 + Math.sin(a) * r, h = 6 + rand() * 10;
      trees.setMatrixAt(i, place(p4.set(x, 0, z), 0, new THREE.Vector3(h * (0.22 + rand() * 0.12), h, h * (0.22 + rand() * 0.12))));
      trees.setColorAt(i, new THREE.Color().setHSL(0.3 + rand() * 0.12, 0.45, 0.55 + rand() * 0.35));
    }
    trees.computeBoundingSphere(); world.add(trees);

    // hills ring
    const seg = 120, rows = [180, 230, 290, 380];
    // hazy violet hills, lighter (more aerial perspective) towards the sun and with distance
    const pos: number[] = [], idx: number[] = [], col: number[] = [];
    const hNear = new THREE.Color(0x5a3a78), hFar = new THREE.Color(0xc0628a), hSun = new THREE.Color(0xf09070), hc = new THREE.Color();
    for (let r = 0; r < rows.length; r++) for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const hgt = r === 0 ? -1 : r === 3 ? 10 : (r === 1 ? 10 : 22) * (0.45 + 0.35 * Math.sin(a * 3 + 1) + 0.2 * Math.sin(a * 7 + 2) + 0.15 * Math.sin(a * 13));
      pos.push(3 + Math.cos(a) * rows[r], Math.max(hgt, r === 0 ? -1 : 2), 13 + Math.sin(a) * rows[r]);
      const toSun = Math.max(0, Math.cos(a) * SUN_AZ.x + Math.sin(a) * SUN_AZ.y);
      hc.copy(hNear).lerp(hFar, r === 0 ? 0.0 : r === 1 ? 0.15 : r === 2 ? 0.45 : 0.8).lerp(hSun, Math.pow(toSun, 3) * 0.6);
      col.push(hc.r, hc.g, hc.b);
    }
    for (let r = 0; r < rows.length - 1; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); hg.setIndex(idx);
    const hills = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); world.add(hills);
  }

  /* -------------------------------------------- floodlight towers */
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d2, emissiveIntensity: 2.2 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.7, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.5, roughness: 0.6 });
  function tower(x: number, z: number, ax: number, az: number, light: boolean) {
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 15, 8), steelMat); pole.position.y = 7.5; pole.castShadow = true; g.add(pole);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), darkMat); base.position.y = 0.2; g.add(base);
    const head = new THREE.Group(); head.position.y = 15.2; g.add(head);
    head.rotation.y = Math.atan2(ax - x, az - z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.25), darkMat); frame.rotation.x = 0.55; head.add(frame);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.44), lampMat);
      lamp.position.set(-0.82 + c * 0.82, 0.28 - r * 0.56, 0.13); frame.add(lamp);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd7a0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(3.4); halo.position.set(0, 0, 0.4); frame.add(halo);
    if (light) {
      const sp = new THREE.SpotLight(0xffd49a, low ? 520 : 420, 90, 0.62, 0.75, 2);
      sp.position.set(x, 15, z); sp.target.position.set(ax, 0, az);
      scene.add(sp, sp.target);
    }
  }
  const glowTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.2, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const TOWERS: [number, number, number, number, boolean][] = [
    [8, -9.5, 8, 2, true], [44, 15, 33, 15, !low], [26, 42, 20, 31, true],
    [-7, 37, -6, 25, !low], [-40, 9, -26, 9, true], [5, 13, 18, 8, !low],
  ];

  /* --------------------------------------------------------- garage */
  function buildGarage() {
    const g = new THREE.Group(); g.position.set(GARAGE.x, 0, GARAGE.z); world.add(g);
    const corr = canvasTex(512, 512, (c) => {
      c.fillStyle = "#2c7d86"; c.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 16) { const gr = c.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(0.5, "rgba(0,0,0,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0.10)"); c.fillStyle = gr; c.fillRect(x, 0, 16, 512); }
      for (let i = 0; i < 60; i++) { const x = rand() * 512, l = 40 + rand() * 200; const gr = c.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, "rgba(120,60,25,0.45)"); gr.addColorStop(1, "rgba(120,60,25,0)"); c.fillStyle = gr; c.fillRect(x, rand() * 300, 2 + rand() * 4, l); }
    }, true, true);
    corr.repeat.set(3, 1.3);
    const wall = new THREE.MeshStandardMaterial({ map: corr, roughness: 0.6, metalness: 0.35 });
    const W2 = 6, D2 = 4.5, HW = 5.2, DOOR = 3.2, DH = 4.1;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = wall) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    box(W2 * 2, HW, 0.2, 0, HW / 2, -D2);
    box(0.2, HW, D2 * 2, -W2, HW / 2, 0); box(0.2, HW, D2 * 2, W2, HW / 2, 0);
    box(W2 - DOOR, HW, 0.2, -(W2 + DOOR) / 2, HW / 2, D2); box(W2 - DOOR, HW, 0.2, (W2 + DOOR) / 2, HW / 2, D2);
    box(DOOR * 2, HW - DH, 0.2, 0, (HW + DH) / 2, D2);
    const roof = box(W2 * 2 + 0.8, 0.22, D2 * 2 + 1.2, 0, HW + 0.25, 0.3, darkMat); roof.rotation.x = -0.06;
    // interior
    const inner = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9, emissive: 0x3a2412, emissiveIntensity: 0.6 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 - 0.4, D2 * 2 - 0.4), new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; floor.receiveShadow = true; g.add(floor);
    const backIn = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2 - 0.4, HW), inner); backIn.position.set(0, HW / 2, -D2 + 0.11); g.add(backIn);
    const tube = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2d8, emissiveIntensity: 7 });
    for (const x of [-2.5, 2.5]) box(2.6, 0.08, 0.14, x, HW - 0.35, 0, tube).castShadow = false;
    // shelves + tool chest + lift silhouette
    for (const x of [-4.3, -2.6]) { box(1.5, 2.4, 0.5, x, 1.2, -D2 + 0.4, darkMat); for (let y = 0.6; y < 2.4; y += 0.6) box(1.4, 0.3, 0.4, x, y, -D2 + 0.45, new THREE.MeshStandardMaterial({ color: [0x6b4a2a, 0x8a3324, 0x2f4f6a][Math.floor(rand() * 3)], roughness: 0.8 })); }
    box(1.4, 1.1, 0.6, 3.8, 0.55, -D2 + 0.45, new THREE.MeshStandardMaterial({ color: 0xb02a1e, metalness: 0.4, roughness: 0.4 }));
    for (const x of [-0.65, 0.65]) box(0.42, 0.12, 2.7, x, 0.3, -0.4, new THREE.MeshStandardMaterial({ color: 0x2a5fb8, metalness: 0.45, roughness: 0.42 }));
    // rolled shutter + rails
    const shut = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, DOOR * 2 + 0.2, 16), wall); shut.rotation.z = Math.PI / 2; shut.position.set(0, DH + 0.3, D2 + 0.25); g.add(shut);
    for (const s of [-1, 1]) box(0.12, DH, 0.16, s * (DOOR + 0.06), DH / 2, D2 + 0.16, darkMat);
    // sign
    const signTex = canvasTex(1024, 160, (c) => {
      c.fillStyle = "#14110e"; c.fillRect(0, 0, 1024, 160);
      c.font = `92px ${STENCIL}`; c.fillStyle = "#f1e6d0"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SUMAHAR'S GARAGE", 512, 66);
      c.font = `600 30px ${MONO}`; c.fillStyle = "#ffae1a"; setSpacing(c, 8); c.fillText("HOME · PIT · CONTACT", 512, 132);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.55, roughness: 0.7 }));
    sign.position.set(0, HW - 0.55, D2 + 0.12); g.add(sign);
    const wl = box(0.5, 0.12, 0.3, 0, HW - 0.02, D2 + 0.3, tube); wl.castShadow = false;
    // interior light + light spill on the apron
    const pl = new THREE.PointLight(0xffb36b, low ? 45 : 60, 30, 1.7); pl.position.set(0, 3.2, 1.5); g.add(pl);
    const spillTex = canvasTex(256, 256, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,190,120,0.75)"); gr.addColorStop(1, "rgba(255,190,120,0)");
      c.fillStyle = gr; c.beginPath(); c.moveTo(70, 0); c.lineTo(186, 0); c.lineTo(256, 256); c.lineTo(0, 256); c.closePath(); c.fill();
    });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(0, 0.04, D2 + 4); g.add(spill);
    // apron
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(16, 8.6), new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.01, D2 + 4.3); apron.receiveShadow = true; g.add(apron);
    for (const [x, z, r] of [[-7.3, 3.2, 0.2], [-7.3, 3.8, -0.1], [7.4, 2.5, 0.1]]) baleSpots.push({ p: new THREE.Vector3(GARAGE.x + x, 0, GARAGE.z + z), yaw: Math.PI / 2 + r });
    baleSpots.push({ p: new THREE.Vector3(GARAGE.x - 7.3, 0.5, GARAGE.z + 3.5), yaw: Math.PI / 2 });
    for (const x of [-4.5, -3.8, 3.8, 4.5]) coneSpots.push(new THREE.Vector3(GARAGE.x + x, 0, GARAGE.z + D2 + 1.2));
  }

  /* ------------------------------------------------------------ flags */
  type Flag = { geo: THREE.BufferGeometry; base: Float32Array; ph: number };
  const flags: Flag[] = [];
  function flag(x: number, z: number, kind: number) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 4.6, 6), steelMat); pole.position.set(x, 2.3, z); pole.castShadow = true; world.add(pole);
    const tex = canvasTex(128, 80, (c) => {
      if (kind === 0) { for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { c.fillStyle = (i + j) % 2 ? "#111" : "#eee"; c.fillRect(i * 16, j * 16, 16, 16); } }
      else if (kind === 1) { c.fillStyle = "#ffb21a"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#1a0f22"; c.font = `44px ${STENCIL}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("BAJA", 64, 42); }
      else if (kind === 2) { c.fillStyle = "#ff2e88"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#fff4fa"; c.font = `40px ${STENCIL}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("MU", 64, 42); }
      else { c.fillStyle = "#18c8f0"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#fffbe8"; c.fillRect(0, 30, 128, 20); c.fillStyle = "#ff6a1f"; c.fillRect(0, 36, 128, 8); }
    });
    const geo = new THREE.PlaneGeometry(1.3, 0.8, 8, 2); geo.translate(0.65, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }));
    m.position.set(x, 4.15, z); m.rotation.y = 0.6; world.add(m);
    flags.push({ geo, base: (geo.attributes.position.array as Float32Array).slice(), ph: rand() * 6 });
  }
  /** a string of multicoloured pennants sagging between two points (one instanced mesh per call) */
  function bunting(a: THREE.Vector3, b: THREE.Vector3, sag: number) {
    const len = a.distanceTo(b), n = Math.max(3, Math.floor(len / 0.55));
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0], 3));
    tri.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const im = new THREE.InstancedMesh(tri, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, emissive: 0x332222 }), n);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2, p = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n; p.lerpVectors(a, b, u); p.y -= Math.sin(u * Math.PI) * sag;
      im.setMatrixAt(k, place(p, yaw, 1, (rand() - 0.5) * 0.3));
      im.setColorAt(k, new THREE.Color(GATE_PALETTE[k % GATE_PALETTE.length]));
    }
    im.computeBoundingSphere(); world.add(im);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 13 }, (_, k) => { const u = k / 12; return new THREE.Vector3().lerpVectors(a, b, u).setY(a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag); })), new THREE.LineBasicMaterial({ color: 0x2a2020 }));
    world.add(line);
  }

  /* ------------------------------------------------------ start gantry */
  const startLamps: THREE.MeshStandardMaterial[] = [];
  const gantryInfo = { a: new THREE.Vector3(), b: new THREE.Vector3(), mid: new THREE.Vector3() };
  function gantry() {
    const i = 0; const g = new THREE.Group(); const c = at(i, 0); g.position.copy(c); g.rotation.y = yawAt(i); world.add(g);
    const xl = T.offL[i] + 0.5, xr = -(T.offR[i] + 0.5), span = xl - xr, cx = (xl + xr) / 2;
    g.updateMatrixWorld(true);
    gantryInfo.a.copy(g.localToWorld(new THREE.Vector3(xl - 0.4, 5.4, 0))); gantryInfo.b.copy(g.localToWorld(new THREE.Vector3(xr + 0.4, 5.4, 0)));
    gantryInfo.mid.copy(g.localToWorld(new THREE.Vector3(cx, 6.4, 0)));
    // colour LED strips along the top and bottom of the gantry beam
    const ledMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    {
      const segs = 24, geos: THREE.BufferGeometry[] = [];
      for (const y of [5.48, 7.32]) for (const z of [-0.315, 0.315]) for (let k = 0; k < segs; k++) {
        const b = new THREE.BoxGeometry((span + 0.3) / segs - 0.04, 0.07, 0.02); b.translate(xr - 0.15 + ((k + 0.5) * (span + 0.3)) / segs, y, z);
        const col = new THREE.Color(GATE_PALETTE[k % GATE_PALETTE.length]).multiplyScalar(1.6), n = b.attributes.position.count, arr = new Float32Array(n * 3);
        for (let v = 0; v < n; v++) arr.set([col.r, col.g, col.b], v * 3);
        b.setAttribute("color", new THREE.BufferAttribute(arr, 3)); geos.push(b);
      }
      const merged = mergeGeometries(geos, false)!; geos.forEach((x) => x.dispose());
      g.add(new THREE.Mesh(merged, ledMat));
    }
    for (const x of [xl, xr]) {
      for (const dz of [-0.35, 0.35]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.6, 0.16), steelMat); p.position.set(x, 3.3, dz); p.castShadow = true; g.add(p); }
      for (let y = 0.6; y < 6.4; y += 0.8) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.86), steelMat); b.position.set(x, y, 0); b.rotation.x = 0.7; g.add(b); }
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.2), darkMat); foot.position.set(x, 0.15, 0); g.add(foot);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.4, 1.8, 0.6), darkMat); beam.position.set(cx, 6.4, 0); beam.castShadow = true; g.add(beam);
    const tex = canvasTex(2048, 256, (k) => {
      k.fillStyle = "#121010"; k.fillRect(0, 0, 2048, 256);
      hazard(k, 0, 0, 2048, 16, 30); hazard(k, 0, 240, 2048, 16, 30);
      k.font = `150px ${STENCIL}`; k.fillStyle = "#f3e9d4"; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText("SUMAHAR · TEST TRACK", 1024, 112);
      k.font = `600 34px ${MONO}`; k.fillStyle = "#ffae1a"; setSpacing(k, 10); k.fillText(`BAJA ENDURANCE CIRCUIT · LAP ${Math.round(L)} M · START / FINISH`, 1024, 210);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(span + 0.2, (span + 0.2) / 8), mat);
      pl.position.set(cx, 6.5, side * 0.31); if (side < 0) pl.rotation.y = Math.PI; g.add(pl);
    }
    for (let k = 0; k < 5; k++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2010, emissiveIntensity: 4 }); startLamps.push(m);
      for (const side of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), m); l.position.set(cx + (k - 2) * 0.55, 5.2, side * 0.31); if (side < 0) l.rotation.y = Math.PI; g.add(l); }
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.66), darkMat); hood.position.set(cx + (k - 2) * 0.55, 5.2, 0); g.add(hood);
    }
    for (const x of [xl + 1.3, xr - 1.3]) baleSpots.push({ p: g.localToWorld(new THREE.Vector3(x, 0, 0)), yaw: yawAt(i) + Math.PI / 2 }, { p: g.localToWorld(new THREE.Vector3(x, 0.5, 0)), yaw: yawAt(i) + Math.PI / 2 + 0.1 });
  }

  /* ------------------------------------------------------------- gates */
  interface GateRT {
    spec: GateSpec; s: number; i: number; banner: THREE.MeshStandardMaterial; beam: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial;
    ground: THREE.MeshBasicMaterial; beacon: THREE.MeshStandardMaterial; armed: boolean; prevDs: number; centre: THREE.Vector3;
    color: THREE.Color; strip: THREE.MeshBasicMaterial; check: THREE.MeshBasicMaterial; flash: number;
    beamA: THREE.Vector3; beamB: THREE.Vector3; fwd: THREE.Vector3; n: number; tex: THREE.CanvasTexture;
  }
  const gates: GateRT[] = [];
  function gateS(n: number): number[] {
    if (!n) return [];
    const last = L - 11; if (n === 1) return [last];
    const a = 14, b = L - 24, gap = RAMP_GAP[1] - RAMP_GAP[0], eff = b - a - gap;
    const out: number[] = [];
    for (let k = 0; k < n - 1; k++) { let s = a + (n === 2 ? 0 : (k * eff) / (n - 2)); if (s > RAMP_GAP[0]) s += gap; out.push(s); }
    out.push(last); return out;
  }
  const beamGlowTex = canvasTex(16, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 16, 128); });
  function buildGate(spec: GateSpec, n: number, s: number) {
    const i = idxOf(s); const g = new THREE.Group(); const c = at(i, 0); g.position.copy(c); g.rotation.y = yawAt(i); world.add(g);
    const xl = T.offL[i] + 0.4, xr = -(T.offR[i] + 0.4), span = xl - xr, cx = (xl + xr) / 2;
    const raw = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(spec.color ?? "") ? (spec.color!.startsWith("#") ? spec.color! : `#${spec.color}`) : GATE_PALETTE[(n - 1) % GATE_PALETTE.length];
    const color = new THREE.Color(raw);
    const hex = `#${color.getHexString()}`; // normalised 6-digit sRGB for the canvas
    const beacon = new THREE.MeshStandardMaterial({ color: 0x221500, emissive: color.clone(), emissiveIntensity: 2 });
    const strip = new THREE.MeshBasicMaterial({ color: color.clone(), toneMapped: false });
    for (const x of [xl, xr]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 6.1, 0.36), darkMat); post.position.set(x, 3.05, 0); post.castShadow = true; g.add(post);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.42), hazardMat); sleeve.position.set(x, 0.6, 0); g.add(sleeve);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), beacon); cap.position.set(x, 6.25, 0); g.add(cap);
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), beacon); em.position.set(x - Math.sign(x) * 0.25, 0.6, 0); g.add(em);
      // light strips on the inner and both broad faces of each post
      for (const dz of [-0.185, 0.185]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.4, 0.02), strip); st.position.set(x, 3.5, dz); g.add(st); }
      const si = new THREE.Mesh(new THREE.BoxGeometry(0.02, 4.4, 0.07), strip); si.position.set(x - Math.sign(x) * 0.185, 3.5, 0); g.add(si);
      for (const dz of [-1.4, 1.4]) coneSpots.push(g.localToWorld(new THREE.Vector3(x + Math.sign(x) * 0.5, 0, dz)));
    }
    const tex = canvasTex(1536, 300, (k) => drawBanner(k, spec, n, hex));
    const banner = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.65 });
    buildGateRest(g, spec, n, s, i, xl, xr, span, cx, color, beacon, strip, banner, tex);
  }
  function drawBanner(k: CanvasRenderingContext2D, spec: GateSpec, n: number, hex: string) {
      const w = 1536, h = 300; k.clearRect(0, 0, w, h); setSpacing(k, 0);
      const gr = k.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#241a3a"); gr.addColorStop(1, "#120d1e"); k.fillStyle = gr; k.fillRect(0, 0, w, h);
      // colour wash from the number block
      const wash = k.createLinearGradient(0, 0, w * 0.75, 0); wash.addColorStop(0, hex + "88"); wash.addColorStop(1, hex + "00"); k.fillStyle = wash; k.fillRect(0, 0, w, h);
      // top/bottom bands: gate colour with dark diagonal ticks
      for (const y of [0, h - 22]) {
        k.save(); k.beginPath(); k.rect(0, y, w, 22); k.clip(); k.fillStyle = hex; k.fillRect(0, y, w, 22);
        k.fillStyle = "rgba(20,10,30,0.35)"; for (let x = -22; x < w; x += 36) { k.beginPath(); k.moveTo(x, y + 22); k.lineTo(x + 14, y + 22); k.lineTo(x + 36, y); k.lineTo(x + 22, y); k.fill(); }
        k.restore();
      }
      k.fillStyle = hex; k.fillRect(44, 50, 200, h - 100);
      k.fillStyle = "#140c1c"; k.font = `150px ${STENCIL}`; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText(String(n).padStart(2, "0"), 144, h / 2 + 8);
      let fs = 168; k.font = `${fs}px ${STENCIL}`;
      while (k.measureText(spec.label).width > w - 340 && fs > 50) { fs -= 6; k.font = `${fs}px ${STENCIL}`; }
      k.fillStyle = "#fff6ea"; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(spec.label, 284, 182);
      k.font = `600 42px ${MONO}`; k.fillStyle = hex; setSpacing(k, 9); k.fillText(spec.sub.toUpperCase(), 290, 248);
  }
  function buildGateRest(g: THREE.Group, spec: GateSpec, n: number, s: number, i: number, xl: number, xr: number, span: number, cx: number, color: THREE.Color,
    beacon: THREE.MeshStandardMaterial, strip: THREE.MeshBasicMaterial, banner: THREE.MeshStandardMaterial, tex: THREE.CanvasTexture) {
    const bw = span - 0.2, bh = bw / 5.12;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(span + 0.3, bh + 0.25, 0.18), darkMat); frame.position.set(cx, 5.9 - bh / 2, 0); frame.castShadow = true; g.add(frame);
    // cleared badge: a green disc with a check, sitting on the banner's right end
    const check = new THREE.MeshBasicMaterial({ map: checkTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), banner); p.position.set(cx, 5.9 - bh / 2, side * 0.1); if (side < 0) p.rotation.y = Math.PI; g.add(p);
      const ck = new THREE.Mesh(new THREE.PlaneGeometry(bh * 0.78, bh * 0.78), check);
      ck.position.set(cx + side * (bw / 2 - bh * 0.55), 5.9 - bh / 2, side * 0.115); if (side < 0) ck.rotation.y = Math.PI; g.add(ck);
    }
    const beam = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, span - 0.6, 6), beam); core.rotation.z = Math.PI / 2; core.position.set(cx, 0.6, 0); g.add(core);
    const glow = new THREE.MeshBasicMaterial({ map: beamGlowTex, color: color.clone(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const rx of [0, Math.PI / 2]) { const gp = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.6, 0.5), glow); gp.position.set(cx, 0.6, 0); gp.rotation.x = rx; g.add(gp); }
    const ground = new THREE.MeshBasicMaterial({ map: beamGlowTex, color: color.clone(), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const gpl = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.6, 2.2), ground); gpl.rotation.x = -Math.PI / 2; gpl.position.set(cx, 0.045, 0); g.add(gpl);
    gates.push({
      spec, s, i, banner, beam, glow, ground, beacon, armed: true, prevDs: 0, centre: g.localToWorld(new THREE.Vector3(cx, 2.5, 0)),
      color, strip, check, flash: 0,
      beamA: g.localToWorld(new THREE.Vector3(xl - 0.3, 0.6, 0)), beamB: g.localToWorld(new THREE.Vector3(xr + 0.3, 0.6, 0)),
      fwd: new THREE.Vector3(tx[i], 0, tz[i]), n, tex,
    });
  }
  const checkTex = canvasTex(128, 128, (k) => {
    k.fillStyle = "#18c060"; k.beginPath(); k.arc(64, 64, 58, 0, Math.PI * 2); k.fill();
    k.strokeStyle = "#f4fff6"; k.lineWidth = 6; k.beginPath(); k.arc(64, 64, 52, 0, Math.PI * 2); k.stroke();
    k.lineWidth = 16; k.lineCap = "round"; k.lineJoin = "round"; k.beginPath(); k.moveTo(36, 66); k.lineTo(56, 86); k.lineTo(92, 44); k.stroke();
  });
  const hazTex = canvasTex(128, 128, (g) => hazard(g, 0, 0, 128, 128, 40));
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazTex, roughness: 0.6 });

  /* -------------------------------------------------------------- dust */
  const DUST_N = low ? 110 : 260;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST_N * 3), dAge = new Float32Array(DUST_N).fill(2), dSize = new Float32Array(DUST_N), dVel = new Float32Array(DUST_N * 3), dLife = new Float32Array(DUST_N).fill(1);
  dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute("aAge", new THREE.BufferAttribute(dAge, 1));
  dGeo.setAttribute("aSize", new THREE.BufferAttribute(dSize, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: H() }, uColor: { value: new THREE.Color(0x9a8266) } },
    vertexShader: `attribute float aAge; attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        float a = clamp(aAge, 0., 1.); vA = (1.-a)*(1.-a)*smoothstep(0., .08, a)*step(a, .999);
        gl_PointSize = aSize*(0.5 + a*1.8)*uScale / max(-mv.z, .5); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float m = smoothstep(.25, 0., dot(c,c)); gl_FragColor = vec4(uColor, m*vA*.42); }`,
    transparent: true, depthWrite: false,
  });
  const dust = new THREE.Points(dGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  let dHead = 0;
  function emitDust(x: number, y: number, z: number, vx: number, vz: number, size: number) {
    const i = dHead; dHead = (dHead + 1) % DUST_N;
    dPos.set([x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3], i * 3);
    dVel.set([vx * 0.25 + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.9, vz * 0.25 + (Math.random() - 0.5) * 1.2], i * 3);
    dAge[i] = 0; dLife[i] = 1.1 + Math.random() * 0.9; dSize[i] = size * (0.7 + Math.random() * 0.6);
  }
  function updateDust(dt: number) {
    for (let i = 0; i < DUST_N; i++) {
      if (dAge[i] >= 1) continue;
      dAge[i] += dt / dLife[i];
      const o = i * 3; dVel[o] *= 1 - dt * 1.5; dVel[o + 2] *= 1 - dt * 1.5; dVel[o + 1] *= 1 - dt * 0.8;
      dPos[o] += dVel[o] * dt; dPos[o + 1] += dVel[o + 1] * dt; dPos[o + 2] += dVel[o + 2] * dt;
    }
    dGeo.attributes.position.needsUpdate = true; dGeo.attributes.aAge.needsUpdate = true; dGeo.attributes.aSize.needsUpdate = true;
  }

  /* ------------------------------------------- sparks / fireworks / confetti */
  // pooled CPU-simulated Points; updated only while something is alive
  interface Pool { emit(p: THREE.Vector3, v: THREE.Vector3, c: THREE.Color, size: number, life: number, drag: number, grav: number): void; update(dt: number, t: number): void; mat: THREE.ShaderMaterial }
  function makePool(N: number, confetti: boolean): Pool {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), age = new Float32Array(N).fill(2), size = new Float32Array(N), seed = new Float32Array(N);
    const vel = new Float32Array(N * 3), life = new Float32Array(N).fill(1), drag = new Float32Array(N), grav = new Float32Array(N);
    for (let i = 0; i < N; i++) seed[i] = Math.random();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aAge", new THREE.BufferAttribute(age, 1)); geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1)); geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: H() }, uTime: { value: 0 } },
      vertexShader: `attribute vec3 aColor; attribute float aAge, aSize, aSeed; uniform float uScale, uTime; varying vec3 vC; varying float vA, vPh;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
          float a = clamp(aAge, 0., 1.); vC = aColor; vPh = aSeed*6.283 + uTime*(7. + aSeed*6.);
          ${confetti ? "vA = step(a, .999) * (1. - smoothstep(.8, 1., a));" : "vA = step(a, .999) * (1. - a) * (1. - a) * (.75 + .25*sin(uTime*40. + aSeed*30.));"}
          gl_PointSize = min(aSize * uScale / max(-mv.z, .5), uScale * .045); }`,
      fragmentShader: confetti
        ? `varying vec3 vC; varying float vA, vPh; void main(){ vec2 c = gl_PointCoord - .5; float w = .08 + .42*abs(sin(vPh)); if (abs(c.x) > w || abs(c.y) > .3 || vA <= 0.) discard; gl_FragColor = vec4(vC * (.75 + .35*abs(cos(vPh))), vA); }`
        : `varying vec3 vC; varying float vA, vPh; void main(){ vec2 c = gl_PointCoord - .5; float d = dot(c,c); float m = smoothstep(.25, 0., d); m *= m * m; float core = smoothstep(.02, 0., d); gl_FragColor = vec4((vC * 1.4 + core * 1.2) * m * vA, 1.); }`,
      transparent: true, depthWrite: false, blending: confetti ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    let head = 0, aliveUntil = -1, clock2 = 0;
    return {
      mat,
      emit(p, v, c, s, l, dg, gv) {
        const i = head; head = (head + 1) % N;
        pos.set([p.x, p.y, p.z], i * 3); vel.set([v.x, v.y, v.z], i * 3); col.set([c.r, c.g, c.b], i * 3);
        age[i] = 0; life[i] = l; size[i] = s; drag[i] = dg; grav[i] = gv;
        aliveUntil = Math.max(aliveUntil, clock2 + l + 0.1);
      },
      update(dt, t) {
        clock2 += dt; mat.uniforms.uTime.value = t;
        if (clock2 > aliveUntil) { pts.visible = false; return; }
        pts.visible = true;
        for (let i = 0; i < N; i++) {
          if (age[i] >= 1) continue;
          age[i] += dt / life[i];
          const o = i * 3, k = Math.exp(-drag[i] * dt);
          vel[o] *= k; vel[o + 1] = vel[o + 1] * k - grav[i] * dt; vel[o + 2] *= k;
          if (confetti) { vel[o] += Math.sin(t * 3 + seed[i] * 20) * 1.5 * dt; vel[o + 2] += Math.cos(t * 2.6 + seed[i] * 17) * 1.5 * dt; }
          pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
          if (pos[o + 1] < 0.03) { pos[o + 1] = 0.03; vel[o + 1] = 0; vel[o] *= 0.5; vel[o + 2] *= 0.5; }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true;
        geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
      },
    };
  }
  const sparks = makePool(low ? 700 : 1600, false);
  const confetti = makePool(low ? 180 : 420, true);
  const vTmp = new THREE.Vector3(), pTmp = new THREE.Vector3(), cTmp = new THREE.Color();
  const WHITE = new THREE.Color(1, 1, 1), tmpR = new THREE.Vector3();

  // expanding light ring through the gate on a pass (one shared mesh, additive)
  const ringMat = new THREE.MeshBasicMaterial({ map: undefined, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48, 1), ringMat); ring.visible = false; scene.add(ring);
  let ringT = 1; const ringO = new THREE.Vector3(), ringF = new THREE.Vector3();
  function updateRing(dt: number) {
    if (ringT >= 1) { ring.visible = false; return; }
    ringT = Math.min(1, ringT + dt / 0.55);
    const e = 1 - Math.pow(1 - ringT, 3);
    ring.visible = true; ring.scale.setScalar(1.2 + e * 5.5); ringMat.opacity = (1 - ringT) * 0.9;
    ring.position.copy(ringO).addScaledVector(ringF, e * 9); // the shockwave rolls ahead of the car
  }
  /** gate burst: sparks spray from the timing beam, mostly up and along the direction of travel */
  function gateBurst(gt: GateRT) {
    ring.position.lerpVectors(gt.beamA, gt.beamB, 0.5).setY(2.6); ring.lookAt(tmpR.copy(ring.position).add(gt.fwd)); ringO.copy(ring.position); ringF.copy(gt.fwd);
    ringMat.color.copy(gt.color).multiplyScalar(2.2); ringT = 0;
    const n = low ? 80 : 180;
    for (let k = 0; k < n; k++) {
      pTmp.lerpVectors(gt.beamA, gt.beamB, Math.random());
      const a = Math.random() * Math.PI * 2, up = 2.5 + Math.random() * 6.5, out = 1 + Math.random() * 5;
      vTmp.set(Math.cos(a) * out * 0.5, up, Math.sin(a) * out * 0.5).addScaledVector(gt.fwd, (Math.random() * 0.8 + 0.2) * 5);
      cTmp.copy(gt.color).lerp(WHITE, Math.random() * 0.35).multiplyScalar(low ? 1.5 : 2.8);
      sparks.emit(pTmp, vTmp, cTmp, 0.12 + Math.random() * 0.12, 0.7 + Math.random() * 0.5, 1.6, 7);
    }
    // a ring of slower embers around the beam centre
    pTmp.lerpVectors(gt.beamA, gt.beamB, 0.5);
    for (let k = 0; k < (low ? 24 : 48); k++) {
      const a = (k / (low ? 24 : 48)) * Math.PI * 2;
      vTmp.set(-gt.fwd.z * Math.cos(a) * 6, Math.sin(a) * 6 + 2, gt.fwd.x * Math.cos(a) * 6);
      cTmp.copy(gt.color).multiplyScalar(low ? 1.4 : 2.6);
      sparks.emit(pTmp, vTmp, cTmp, 0.11, 0.9, 2.6, 2);
    }
  }
  /** one firework shell: a short rising trail then a spherical burst (sometimes two-tone) */
  type Shell = { t: number; at: THREE.Vector3; c1: THREE.Color; c2: THREE.Color; fired: boolean; burst: boolean };
  let shells: Shell[] = [];
  function updateShells(dt: number) {
    for (const sh of shells) {
      sh.t -= dt;
      if (sh.t <= 0.55 && !sh.fired) { sh.fired = true; }
      if (sh.fired && !sh.burst && sh.t > 0) {
        // rising trail
        const u = 1 - sh.t / 0.55;
        pTmp.set(sh.at.x, sh.at.y * (0.2 + 0.8 * u), sh.at.z);
        vTmp.set((Math.random() - 0.5) * 0.6, -1, (Math.random() - 0.5) * 0.6);
        sparks.emit(pTmp, vTmp, cTmp.setRGB(2.2, 1.6, 1.0), 0.22, 0.45, 2, 3);
      }
      if (sh.t <= 0 && !sh.burst) {
        sh.burst = true;
        const n = low ? 80 : 190, sp = 13 + Math.random() * 6;
        for (let k = 0; k < n; k++) {
          // fibonacci sphere for an even shell
          const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), th = k * 2.39996;
          vTmp.set(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(sp * (0.85 + Math.random() * 0.3));
          cTmp.copy(k % 3 === 0 ? sh.c2 : sh.c1).multiplyScalar(low ? 1.6 : 3.4);
          const life = 1.3 + Math.random() * 0.7;
          sparks.emit(sh.at, vTmp, cTmp, 0.5 + Math.random() * 0.3, life, 1.7, 3.6);
        }
        flashK = Math.min(1.6, flashK + 0.5);
        sfx.pop();
      }
    }
    shells = shells.filter((s) => !s.burst || s.t > -0.1);
  }
  let flashK = 0;

  /* ------------------------------------------------------------ sound */
  // all synthesised; the AudioContext is created lazily on the first setSound(true)
  const sfx = (() => {
    let ctx: AudioContext | null = null, master: GainNode | null = null, on = false;
    let eng: { o1: OscillatorNode; o2: OscillatorNode; sub: OscillatorNode; lp: BiquadFilterNode; g: GainNode } | null = null;
    let noise: AudioBuffer | null = null;
    const live = () => !!ctx && on && ctx.state === "running";
    function init() {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch { ctx = null; return; }
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
      // engine: two detuned saws + a soft sine sub, through a low-pass that opens with throttle
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 2.2;
      const g = ctx.createGain(); g.gain.value = 0; lp.connect(g); g.connect(master);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
      o1.type = "sawtooth"; o2.type = "sawtooth"; sub.type = "sine"; o2.detune.value = 14; o1.detune.value = -9;
      const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain(); g1.gain.value = 0.32; g2.gain.value = 0.26; g3.gain.value = 0.5;
      o1.connect(g1).connect(lp); o2.connect(g2).connect(lp); sub.connect(g3).connect(lp);
      for (const o of [o1, o2, sub]) { o.frequency.value = 50; o.start(); }
      eng = { o1, o2, sub, lp, g };
      const len = Math.floor(ctx.sampleRate * 0.8); noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    function tone(freq: number, t0: number, dur: number, vol: number, type: OscillatorType = "sine", to?: number) {
      if (!ctx || !master) return;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noiseHit(t0: number, dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = "bandpass") {
      if (!ctx || !master || !noise) return;
      const s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f).connect(g).connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
    }
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    return {
      set(v: boolean) {
        on = v;
        if (v && !ctx) init();
        if (!ctx || !master) return;
        if (v) { if (!document.hidden) void ctx.resume(); master.gain.setTargetAtTime(0.12, ctx.currentTime, 0.08); }
        else { master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); const c = ctx; setTimeout(() => { if (!on && c.state === "running") void c.suspend(); }, 400); }
      },
      visibility(hidden: boolean) { if (!ctx) return; if (hidden) void ctx.suspend(); else if (on) void ctx.resume(); },
      /** called every frame: rpm/throttle/speed drive pitch, filter and level */
      engine(rpmV: number, thr: number, speed01: number, mute: boolean) {
        if (!live() || !eng || !ctx) return;
        const t = ctx.currentTime, f = 34 + (rpmV / 8200) * 96;
        for (const o of [eng.o1, eng.o2]) o.frequency.setTargetAtTime(f, t, 0.05);
        eng.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
        eng.lp.frequency.setTargetAtTime(380 + Math.abs(thr) * 900 + speed01 * 500, t, 0.08);
        eng.g.gain.setTargetAtTime(mute ? 0 : 0.18 + Math.abs(thr) * 0.32 + speed01 * 0.18, t, mute ? 0.05 : 0.12);
      },
      chime(k: number) {
        if (!live() || !ctx) return;
        const t = ctx.currentTime, base = 523.25 * Math.pow(2, PENTA[k % PENTA.length] / 12); // climbs a pentatonic step per gate
        tone(base, t, 0.55, 0.32, "triangle"); tone(base * 2, t, 0.35, 0.06, "sine");
        tone(base * 1.4983, t + 0.11, 0.9, 0.3, "triangle"); tone(base * 2.9966, t + 0.11, 0.6, 0.05, "sine");
      },
      land(impact: number) {
        if (!live() || !ctx) return;
        const t = ctx.currentTime, v = clamp(impact / 7, 0.3, 1);
        noiseHit(t, 0.35, 0.35 * v, 1800, 220); tone(110, t, 0.28, 0.55 * v, "sine", 42);
      },
      pop() {
        if (!live() || !ctx) return;
        const t = ctx.currentTime;
        noiseHit(t, 0.5, 0.22, 900, 120, "lowpass"); tone(70 + Math.random() * 30, t, 0.3, 0.25, "sine", 35);
        for (let i = 0; i < 5; i++) noiseHit(t + 0.15 + Math.random() * 0.5, 0.06, 0.05, 5000, 3000, "highpass");
      },
      arpeggio() {
        if (!live() || !ctx) return;
        const t = ctx.currentTime, root = 523.25; // C5 major, up and sparkle
        [0, 4, 7, 12, 16, 19, 24, 19, 24, 28].forEach((st, i) => tone(root * Math.pow(2, st / 12), t + i * 0.085, i === 9 ? 1.4 : 0.45, i === 9 ? 0.22 : 0.18, "triangle"));
        [0, 4, 7].forEach((st) => tone(root / 2 * Math.pow(2, st / 12), t + 0.85, 1.6, 0.1, "sine"));
      },
      dispose() { try { void ctx?.close(); } catch { /* ignore */ } ctx = null; eng = null; },
    };
  })();

  /* ---------------------------------------------------------- buggy */
  const buggy = opts.createBuggy();
  const carG = new THREE.Group(); carG.add(buggy.root); scene.add(carG);
  buggy.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.receiveShadow = true; });
  const car = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, steer: 0, air: false, groundVy: 0, idx: 0, s: 0, lat: 0, yawRate: 0, vf: 0, prevVf: 0 };
  const body = { bob: 0, bobV: 0, pitch: 0, roll: 0, accP: 0 };

  function nearest(x: number, z: number, full: boolean) {
    let best = car.idx, bd = Infinity;
    const scan = (i: number) => { const dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } };
    if (full) for (let i = 0; i < NS; i++) scan(i);
    else for (let o = -40; o <= 40; o++) scan((car.idx + o + NS) % NS);
    if (!full && bd > 100) return nearest(x, z, true);
    const dx = x - px[best], dz = z - pz[best];
    const along = dx * tx[best] + dz * tz[best];
    return { i: best, lat: -dx * tz[best] + dz * tx[best], s: (((best * ds + along) % L) + L) % L, dist: Math.sqrt(bd) };
  }
  function placeCar(s: number) {
    const i = idxOf(s); const p = at(i, 0);
    Object.assign(car, { x: p.x, z: p.z, y: groundY(p.x, p.z), vx: 0, vz: 0, vy: 0, yaw: yawAt(i), steer: 0, air: false, groundVy: 0, idx: i, s: (s % L + L) % L, lat: 0, yawRate: 0, vf: 0, prevVf: 0 });
    Object.assign(body, { bob: 0, bobV: 0, pitch: 0, roll: 0, accP: 0 });
    for (const g of gates) { g.prevDs = wrapS(car.s - g.s); g.armed = Math.abs(g.prevDs) > 4; }
    prevS = car.s;
    snapCam = true;
    // a teleport/reset voids the current lap; the timer restarts on the next throttle
    lapTime = 0; lapArmed = false; started = false;
    for (const m of startLamps) m.emissive.set(0xff2010);
  }
  const wrapS = (d: number) => { d = ((d % L) + L) % L; return d > L / 2 ? d - L : d; };

  /* ------------------------------------------------------------ input */
  const keys = new Set<string>();
  let touch = { throttle: 0, steer: 0, brake: false };
  const isTyping = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
  };
  const DRIVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (DRIVE_KEYS.has(e.code)) { keys.add(e.code); e.preventDefault(); }
    else if (e.code === "KeyR" && !e.repeat) { api.resetCar(); }
  };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
  const onBlur = () => keys.clear();
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur);
  let autopilot = false, stuckT = 0;
  function readInput() {
    const man = touch.throttle !== 0 || touch.steer !== 0 || touch.brake || keys.size > 0;
    if (autopilot && !man) {
      const i2 = (car.idx + 26) % NS, want = Math.atan2(px[i2] - car.x, pz[i2] - car.z), err = wrapAngle(want - car.yaw);
      return { thr: Math.abs(err) < 0.35 ? 0.85 : 0.35, steer: clamp(-err * 2.6, -1, 1), hb: false };
    }
    if (touch.throttle !== 0 || touch.steer !== 0 || touch.brake) return { thr: clamp(touch.throttle, -1, 1), steer: clamp(touch.steer, -1, 1), hb: touch.brake };
    const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
    return { thr: k("KeyW", "ArrowUp") - k("KeyS", "ArrowDown"), steer: k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"), hb: keys.has("Space") };
  }

  /* ---------------------------------------------------------- state */
  let paused = false, started = false, introMode = true, introT = 0;
  let lapTime = 0, bestLap: number | null = null, lapArmed = false, prevS = 0;
  const cleared: GateId[] = [];
  let rpm = 900, gear = 1, teleT = 0, snapCam = true;
  const nextGate = (): GateRT | null => gates.find((g) => !cleared.includes(g.spec.id)) ?? null;
  // juice: camera fov kick + shake, gate flash light, finale timer
  let lastThr = 0, fovKick = 0, shake = 0, celebrateT = 0, gateFlash = 0, celebrateLook = 0, shellCd = 0, confettiAcc = 0;
  const gateFlashCol = new THREE.Color();
  function gatePass(gt: GateRT, fresh: boolean) {
    gt.flash = 1;
    gateBurst(gt);
    fovKick = fresh ? 9 : 5; shake = Math.max(shake, fresh ? 0.22 : 0.1);
    gateFlashCol.copy(gt.color); gateFlash = 1;
    sfx.chime(Math.max(0, gates.indexOf(gt)));
  }

  /* ---------------------------------------------------------- physics */
  function step(dt: number) {
    const inp = readInput();
    lastThr = inp.thr;
    if (introMode && (inp.thr !== 0 || inp.steer !== 0 || inp.hb)) introMode = false;
    if (!started && inp.thr !== 0) { started = true; for (const m of startLamps) m.emissive.set(0x20ff60); }
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), rx = -fz, rz = fx;
    let vf = car.vx * fx + car.vz * fz, vl = car.vx * rx + car.vz * rz;
    car.steer += (inp.steer - car.steer) * damp(9, dt);
    if (!car.air) {
      const t = inp.thr;
      if (t > 0) vf += vf < -0.4 ? 15 * t * dt : 8.5 * t * Math.max(0, 1 - Math.pow(Math.max(vf, 0) / VMAX, 2)) * dt;
      else if (t < 0) vf += vf > 0.4 ? 15 * t * dt : 5 * t * Math.max(0, 1 - Math.pow(Math.max(-vf, 0) / VREV, 2)) * dt;
      vf -= vf * (t === 0 ? 0.45 : 0.18) * dt;
      if (t === 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 1.4 * dt);
      if (inp.hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 8 * dt);
      const grip = inp.hb ? 1.6 : 8.5;
      vl *= Math.exp(-grip * dt);
      const sp = Math.abs(vf);
      const maxA = 0.6 + (0.17 - 0.6) * clamp(sp / VMAX, 0, 1);
      car.yawRate = (-car.steer * maxA * vf) / WB * (inp.hb ? 1.4 : 1);
      // handbrake flick: a little extra rotation so it slides into the turn
      if (inp.hb && sp > 4) vl += car.steer * sp * 0.6 * dt;
    } else {
      car.yawRate *= 1 - dt * 1.5;
    }
    car.yaw = wrapAngle(car.yaw + car.yawRate * dt);
    car.vx = fx * vf + rx * vl; car.vz = fz * vf + rz * vl;
    car.prevVf = car.vf; car.vf = vf;

    const ox = car.x, oz = car.z;
    car.x += car.vx * dt; car.z += car.vz * dt;
    // step obstacle (side of the ramp): bounce off instead of teleporting up
    let g = groundY(car.x, car.z);
    if (!car.air && g - car.y > 0.3) { car.x = ox; car.z = oz; car.vx *= -0.25; car.vz *= -0.25; g = groundY(car.x, car.z); }

    // walls
    const nr = nearest(car.x, car.z, false);
    car.idx = nr.i;
    const rX = -tz[nr.i], rZ = tx[nr.i];
    const lim = nr.lat > 0 ? T.limR[nr.i] : -T.limL[nr.i];
    if (Math.abs(nr.lat) > Math.abs(lim) || nr.dist > 12) {
      const push = nr.lat - lim;
      car.x -= rX * push; car.z -= rZ * push;
      const vn = car.vx * rX + car.vz * rZ;
      const into = vn * Math.sign(nr.lat) > 0 ? Math.abs(vn) : 0;
      if (into > 0) { car.vx -= rX * vn * 1.2; car.vz -= rZ * vn * 1.2; }
      // forgiving: scrub a little (more on a hard hit) and steer the nose along the wall
      const scrub = Math.exp(-(0.5 + into * 0.35) * dt); car.vx *= scrub; car.vz *= scrub;
      const dir = car.vx * tx[nr.i] + car.vz * tz[nr.i] >= 0 ? 0 : Math.PI;
      const dy = wrapAngle(yawAt(nr.i) + dir - car.yaw);
      if (Math.abs(dy) < 1.3) car.yaw = wrapAngle(car.yaw + dy * damp(4, dt));
      if (into > 3) body.bobV += 0.3;
    }
    const nr2 = nearest(car.x, car.z, false); car.idx = nr2.i; car.lat = nr2.lat; car.s = nr2.s;
    if (inp.thr !== 0 && Math.abs(vf) < 0.8 && !car.air) { stuckT += dt; if (stuckT > 2.2) { stuckT = 0; placeCar(car.s); } } else stuckT = 0;

    // vertical
    g = groundY(car.x, car.z);
    if (car.air) {
      car.vy -= GRAV * dt; car.y += car.vy * dt;
      if (car.y <= g) {
        const impact = -car.vy; car.y = g; car.vy = 0; car.air = false;
        body.bobV -= Math.min(1.4, impact * 0.22);
        if (impact > 2.5) { sfx.land(impact); shake = Math.max(shake, clamp(impact * 0.025, 0, 0.16)); }
        const sp = Math.hypot(car.vx, car.vz);
        for (let k = 0; k < 14; k++) emitDust(car.x, 0.2, car.z, car.vx, car.vz, 1.4 + sp * 0.05);
      }
    } else {
      if (g < car.y - 0.03) { car.air = true; car.vy = car.groundVy; car.y += car.vy * dt; }
      else { car.groundVy = (g - car.y) / Math.max(dt, 1e-4); car.y = g; }
    }

    // timers + lap
    if (started) lapTime += dt;
    if (car.s > L * 0.4 && car.s < L * 0.6) lapArmed = true;
    const dS = wrapS(car.s - prevS);
    if (prevS > L - 20 && car.s < 20 && dS > 0) {
      if (lapArmed && started) { bestLap = bestLap === null ? lapTime : Math.min(bestLap, lapTime); lapTime = 0; }
      lapArmed = false;
    }
    prevS = car.s;

    // gates
    for (const gt of gates) {
      const d = wrapS(car.s - gt.s);
      const latOk = Math.abs(car.lat) < WALL_D + 0.5;
      if (gt.armed && latOk && Math.abs(d) < 4 && Math.abs(gt.prevDs) < 4 && (d >= 0) !== (gt.prevDs >= 0)) {
        gt.armed = false;
        const fresh = !cleared.includes(gt.spec.id);
        if (fresh) cleared.push(gt.spec.id);
        gatePass(gt, fresh);
        opts.onGate(gt.spec.id);
      }
      if (Math.abs(d) > 4) gt.armed = true;
      gt.prevDs = d;
    }

    // body motion (visual only)
    const sp = Math.hypot(car.vx, car.vz);
    const acc = (car.vf - car.prevVf) / Math.max(dt, 1e-4);
    body.accP += (clamp(acc * 0.006, -0.05, 0.05) - body.accP) * damp(6, dt);
    const rough = car.air ? 0 : (Math.sin(introT * 23.1) * 0.6 + Math.sin(introT * 37.7 + 1) * 0.4) * 0.012 * clamp(sp / VMAX, 0, 1);
    body.bobV += (-90 * body.bob - 9 * body.bobV) * dt; body.bob += body.bobV * dt; body.bob = clamp(body.bob, -0.12, 0.12);
    let slope = 0;
    if (car.air) slope = clamp(Math.atan2(car.vy, Math.max(sp, 2)) * 0.7, -0.35, 0.35);
    else { const hF = groundY(car.x + fx * 0.79, car.z + fz * 0.79), hR = groundY(car.x - fx * 0.79, car.z - fz * 0.79); slope = Math.atan2(hF - hR, WB); }
    body.pitch += (slope - body.pitch) * damp(car.air ? 3 : 14, dt);
    body.roll += (clamp(car.yawRate * car.vf * 0.011, -0.09, 0.09) - body.roll) * damp(7, dt);

    // dust
    if (!car.air && sp > 5) {
      const slide = Math.abs(vl);
      const rate = (sp - 5) * 0.9 + slide * 3;
      let n = rate * dt * 2; while (n > 0) { if (Math.random() < n) for (const s of [-1, 1]) emitDust(car.x - fx * 0.8 + rx * 0.62 * s, 0.15, car.z - fz * 0.8 + rz * 0.62 * s, -car.vx * 0.3, -car.vz * 0.3, 0.9 + slide * 0.12); n -= 1; }
    }

    // gearbox / rpm
    const kmh = sp * 3.6;
    const UP = [0, 13, 24, 35, 47, 64];
    let gr = 1; while (gr < 5 && kmh >= UP[gr]) gr++;
    gear = gr;
    const frac = clamp((kmh - UP[gr - 1]) / (UP[gr] - UP[gr - 1]), 0, 1);
    let target = gr === 1 ? 950 + frac * 6600 : 3300 + frac * 4500;
    if (Math.abs(inp.thr) > 0 && kmh < 6) target = Math.max(target, 1400 + Math.abs(inp.thr) * 2600);
    if (car.air && inp.thr > 0) target = Math.min(8200, target + 1200);
    rpm += (target - rpm) * damp(8, dt);
  }

  /* ------------------------------------------------------------ camera */
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  let camYaw = 0, fov = 56;
  const CENTRE = new THREE.Vector3(3, 0, 13);
  let camOverride: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  function chaseTargets(pos: THREE.Vector3, look: THREE.Vector3, yaw: number) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    pos.set(car.x - fx * 6.0, car.y * 0.6 + 2.35, car.z - fz * 6.0);
    look.set(car.x + fx * 3.4, car.y * 0.8 + 0.85, car.z + fz * 3.4);
  }
  function updateCamera(dt: number) {
    const sp = Math.hypot(car.vx, car.vz);
    const narrow = W() / H() < 0.8;
    if (camOverride) { camPos.copy(camOverride.pos); camLook.copy(camOverride.look); }
    else if (introMode) {
      const k = ease(clamp((introT - 1.2) / 5.5, 0, 1));
      const a = 2.4 + introT * 0.14;
      const orbit = tmpA.set(car.x + Math.sin(a) * 8.5, 2.6 + Math.sin(introT * 0.3) * 0.5, car.z + Math.cos(a) * 8.5);
      const wide = tmpB.set(CENTRE.x + 50, 34, CENTRE.z - 46);
      camPos.lerpVectors(wide, orbit, k);
      camLook.lerpVectors(tmpC.set(CENTRE.x, 7, CENTRE.z), new THREE.Vector3(car.x, 0.7, car.z), ease(clamp((introT - 1.2) / 4.5, 0, 1)));
      camYaw = car.yaw;
    } else {
      // look along the velocity when sliding forward, along the nose otherwise
      let yawT = car.yaw;
      if (car.vf > 3) { const vy = Math.atan2(car.vx, car.vz); yawT = car.yaw + wrapAngle(vy - car.yaw) * 0.35; }
      if (snapCam) camYaw = yawT; else camYaw = wrapAngle(camYaw + wrapAngle(yawT - camYaw) * damp(3.6, dt));
      chaseTargets(tmpA, tmpB, camYaw);
      if (snapCam) { camPos.copy(tmpA); camLook.copy(tmpB); }
      else {
        camPos.x += (tmpA.x - camPos.x) * damp(9, dt); camPos.z += (tmpA.z - camPos.z) * damp(9, dt);
        camPos.y += (tmpA.y - camPos.y) * damp(4, dt);
        camLook.lerp(tmpB, damp(10, dt));
      }
    }
    snapCam = false;
    camPos.y = Math.max(camPos.y, groundY(camPos.x, camPos.z) + 0.6);
    const fovT = (narrow ? 66 : 56) + (introMode ? 0 : 10 * clamp(sp / VMAX, 0, 1));
    fov += (fovT - fov) * damp(3, dt);
    // gate "aha": a fast fov punch that springs back, plus a short shake
    fovKick *= Math.exp(-dt * 6); shake *= Math.exp(-dt * 7);
    const fovNow = fov + fovKick;
    if (Math.abs(camera.fov - fovNow) > 0.01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
    const free = !camOverride && !introMode;
    celebrateLook += ((celebrateT > 0 && free ? 1 : 0) - celebrateLook) * damp(1.6, dt);
    camera.position.copy(camPos);
    if (free && shake > 0.002) camera.position.add(tmpA.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    camera.lookAt(tmpB.copy(camLook).setY(camLook.y + celebrateLook * 4));
    skyGroup.position.copy(camera.position);
  }

  /* --------------------------------------------------------- post */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.62, 0.55, 0.82);
  if (!low) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* --------------------------------------------------------- build */
  let raf = 0, running = true, disposed = false, readyFired = false, teleAcc = 0;
  const clock = new THREE.Clock();
  const ready = (async () => {
    await Promise.resolve(); // let the rest of createTrack finish declaring state first
    if (document.fonts?.load) {
      try { await Promise.race([Promise.all([document.fonts.load(`120px ${STENCIL}`), document.fonts.load(`600 40px ${MONO}`)]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* ignore */ }
    }
    if (disposed) return;
    for (const t of TOWERS) tower(...t);
    buildGarage();
    gantry();
    const ss = gateS(opts.gates.length);
    opts.gates.forEach((spec, k) => buildGate(spec, k + 1, ss[k]));
    for (let x = -4; x <= 18; x += 5.5) flag(x, -(T.offL[0] + 1.6), [0, 1, 2, 3][Math.round(x) & 3]);
    for (let x = -4; x + 5.5 <= 18.01; x += 5.5) bunting(new THREE.Vector3(x, 4.58, -(T.offL[0] + 1.6)), new THREE.Vector3(x + 5.5, 4.58, -(T.offL[0] + 1.6)), 0.55);
    for (const s of [118, 132]) { const i = idxOf(s); const p = at(i, T.k[i] > 0 ? -(T.offL[i] + 1.8) : T.offR[i] + 1.8); flag(p.x, p.z, s === 118 ? 0 : 1); }
    finish();
    mergeStatic(world);
    placeCar(L - 5);
  })();

  /** merge non-instanced static meshes that share a material (cuts draw calls a lot) */
  function mergeStatic(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const groups = new Map<string, THREE.Mesh[]>();
    const skip = new Set<THREE.BufferGeometry>(flags.map((f) => f.geo));
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || skip.has(m.geometry)) return;
      const attrs = Object.keys(m.geometry.attributes).sort().join(",");
      const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}|${attrs}|${m.renderOrder}`;
      const list = groups.get(key); if (list) list.push(m); else groups.set(key, [m]);
    });
    groups.forEach((list) => {
      if (list.length < 2) return;
      const geos = list.map((m) => { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld); g.clearGroups(); return g; });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      const mm = new THREE.Mesh(merged, list[0].material);
      mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; mm.renderOrder = list[0].renderOrder;
      root.add(mm);
      for (const m of list) { m.removeFromParent(); m.geometry.dispose(); }
    });
  }

  function updateGates(t: number, dt: number) {
    const nx = nextGate();
    for (const g of gates) {
      const isNext = g === nx, isCl = cleared.includes(g.spec.id);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      g.flash = Math.max(0, g.flash - dt * 1.6);
      const fl = g.flash * g.flash; // eased flash (1 -> 0 over ~0.6 s)
      if (isCl) {
        // cleared: own colour stays (strips, beam), banner gets a fresh-green tint and the check badge
        g.banner.emissive.setRGB(0.7, 1, 0.78); g.banner.emissiveIntensity = 0.45 + fl * 3; g.banner.color.setRGB(0.85, 1, 0.88);
        g.beam.color.copy(g.color).multiplyScalar(1.1 + fl * 6); g.beam.opacity = 0.5; g.glow.color.copy(g.color); g.glow.opacity = 0.14 + fl * 0.8;
        g.ground.color.copy(g.color); g.ground.opacity = 0.14 + fl * 0.8; g.beacon.emissive.copy(GREEN); g.beacon.emissiveIntensity = 1.8 + fl * 6;
        g.strip.color.copy(g.color).multiplyScalar(0.9 + fl * 3);
        g.check.opacity = Math.min(1, g.check.opacity + dt * 3);
      } else if (isNext) {
        g.banner.emissive.setRGB(1, 0.95, 0.9); g.banner.emissiveIntensity = 0.75 + pulse * 0.6 + fl * 3; g.banner.color.setRGB(1, 1, 1);
        g.beam.color.copy(g.color).multiplyScalar(2.5 + pulse * 3); g.beam.opacity = 1; g.glow.color.copy(g.color); g.glow.opacity = 0.55 + pulse * 0.45;
        g.ground.color.copy(g.color); g.ground.opacity = 0.5 + pulse * 0.45; g.beacon.emissive.copy(g.color); g.beacon.emissiveIntensity = 2.5 + pulse * 5;
        g.strip.color.copy(g.color).multiplyScalar(1.4 + pulse * 2.2);
        g.check.opacity = 0;
      } else {
        g.banner.emissive.setRGB(1, 0.95, 0.9); g.banner.emissiveIntensity = 0.35 + fl * 3; g.banner.color.setRGB(0.9, 0.9, 0.9);
        g.beam.color.copy(g.color).multiplyScalar(1.3 + fl * 6); g.beam.opacity = 0.5; g.glow.color.copy(g.color); g.glow.opacity = 0.2 + fl * 0.8;
        g.ground.color.copy(g.color); g.ground.opacity = 0.18 + fl * 0.8; g.beacon.emissive.copy(g.color); g.beacon.emissiveIntensity = 1.2;
        g.strip.color.copy(g.color).multiplyScalar(0.9 + fl * 3);
        g.check.opacity = 0;
      }
    }
    gateFlash = Math.max(0, gateFlash - dt * 1.8);
    if (gateFlash > 0.01) { gateLight.color.copy(gateFlashCol); gateLight.position.copy(tmpC.set(car.x, 2.5, car.z)); gateLight.intensity = 60 * gateFlash * gateFlash; }
    else if (nx) { gateLight.color.copy(nx.color); gateLight.position.copy(nx.centre); gateLight.intensity = 14 + 10 * Math.sin(t * 4.2); }
    else gateLight.intensity = 0;
  }
  const tmpC = new THREE.Vector3();
  function spawnShell(delay: number) {
    const f = tmpC.set(tx[0], 0, tz[0]), r = { x: -tz[0], z: tx[0] };
    const d = 12 + Math.random() * 22, side = (Math.random() - 0.5) * 34;
    const at3 = gantryInfo.mid.clone().addScaledVector(f, d); at3.x += r.x * side; at3.z += r.z * side; at3.y = 11 + Math.random() * 10;
    const c1 = new THREE.Color(GATE_PALETTE[Math.floor(Math.random() * GATE_PALETTE.length)]);
    const c2 = Math.random() < 0.5 ? c1.clone() : new THREE.Color(GATE_PALETTE[Math.floor(Math.random() * GATE_PALETTE.length)]);
    shells.push({ t: 0.55 + delay, at: at3, c1, c2, fired: false, burst: false });
  }
  function updateCelebrate(dt: number, t: number) {
    flashK = Math.max(0, flashK - dt * 2.5);
    const dimU = skyMat.uniforms.uDim;
    dimU.value += ((celebrateT > 0.8 ? 0.85 : 0) - dimU.value) * damp(celebrateT > 0.8 ? 2.2 : 0.8, dt);
    if (celebrateT > 0) {
      celebrateT -= dt;
      shellCd -= dt;
      if (shellCd <= 0 && celebrateT > 1.0) { spawnShell(0); if (!low && Math.random() < 0.35) spawnShell(0.12); shellCd = 0.3 + Math.random() * 0.35; }
      if (celebrateT > 2.6) {
        confettiAcc += dt * (low ? 70 : 160);
        while (confettiAcc >= 1) {
          confettiAcc -= 1;
          pTmp.lerpVectors(gantryInfo.a, gantryInfo.b, Math.random()); pTmp.y += 1.95;
          vTmp.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
          cTmp.set(GATE_PALETTE[Math.floor(Math.random() * GATE_PALETTE.length)]);
          confetti.emit(pTmp, vTmp, cTmp, 0.13 + Math.random() * 0.06, 3 + Math.random() * 1.5, 1.6, 2.4);
        }
      }
      const on = Math.floor(t * 7) % 2 === 0;
      startLamps.forEach((m, k) => m.emissive.set(on !== (k % 2 === 1) ? 0x20ff60 : 0x022a08));
      if (celebrateT <= 0) for (const m of startLamps) m.emissive.set(0x20ff60);
    }
    updateShells(dt); updateRing(dt);
    sparks.update(dt, t); confetti.update(dt, t);
  }
  function updateFlags(t: number) {
    for (const f of flags) {
      const a = f.geo.attributes.position.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) { const x = f.base[i]; a[i + 2] = f.base[i + 2] + Math.sin(x * 4 - t * 6 + f.ph) * 0.09 * x; }
      f.geo.attributes.position.needsUpdate = true; f.geo.computeVertexNormals();
    }
  }
  function sendTelemetry() {
    const nx = nextGate();
    opts.onTelemetry({
      speedKmh: Math.round(Math.hypot(car.vx, car.vz) * 3.6 * 10) / 10, rpm: Math.round(rpm), gear,
      lapTime: Math.round(lapTime * 1000) / 1000, bestLap: bestLap === null ? null : Math.round(bestLap * 1000) / 1000,
      gatesCleared: gates.filter((g) => cleared.includes(g.spec.id)).map((g) => g.spec.id), nextGate: nx ? nx.spec.id : null,
    });
  }

  function frame() {
    if (!running || disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!paused) {
      introT += dt;
      // sub-step physics for stability
      const n = dt > 0.025 ? 2 : 1;
      for (let k = 0; k < n; k++) step(dt / n);
      updateDust(dt);
      buggy.update(dt, introT);
    } else if (introMode) introT += dt;
    carG.position.set(car.x, car.y, car.z); carG.rotation.y = car.yaw;
    buggy.root.position.y = body.bob + (car.air ? 0 : Math.sin(introT * 29) * 0.004 * clamp(Math.hypot(car.vx, car.vz) / VMAX, 0, 1));
    buggy.root.rotation.set(-(body.pitch + body.accP), 0, body.roll);
    moon.position.set(car.x + MOON_DIR.x * 40, MOON_DIR.y * 40, car.z + MOON_DIR.z * 40); moon.target.position.set(car.x, 0, car.z);
    updateCamera(dt);
    updateGates(t, dt);
    updateFlags(t);
    // effects keep running while paused (React may pause behind a finale overlay)
    updateCelebrate(dt, t);
    skyMat.uniforms.uTime.value = t;
    if (themeK < 1) { themeK = Math.min(1, themeK + dt / 2.5); applyTheme(themeK * themeK * (3 - 2 * themeK)); }
    sfx.engine(rpm, paused ? 0 : lastThr, clamp(Math.hypot(car.vx, car.vz) / VMAX, 0, 1), paused);
    if (!low) bloom.strength = 0.5 + flashK * 0.35 + gateFlash * 0.25;
    teleAcc += dt; teleT += dt;
    if (teleAcc >= 0.1) { teleAcc = 0; sendTelemetry(); }
    if (debug) renderer.info.reset();
    composer.render();
    if (!readyFired) { readyFired = true; opts.onReady(); }
    raf = requestAnimationFrame(frame);
  }
  ready.then(() => { if (!disposed) { clock.getDelta(); frame(); } });

  const onResize = () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H()); composer.setSize(W(), H()); bloom.setSize(W(), H());
    dustMat.uniforms.uScale.value = sparks.mat.uniforms.uScale.value = confetti.mat.uniforms.uScale.value = H() * renderer.getPixelRatio();
  };
  dustMat.uniforms.uScale.value = sparks.mat.uniforms.uScale.value = confetti.mat.uniforms.uScale.value = H() * renderer.getPixelRatio();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(container); window.addEventListener("resize", onResize);
  const onVis = () => { sfx.visibility(document.hidden); const was = running; running = !document.hidden; if (running && !was && !disposed) { clock.getDelta(); frame(); } };
  document.addEventListener("visibilitychange", onVis);

  if (debug) {
    renderer.info.autoReset = false;
    const sceneTris = () => {
      let n = 0;
      scene.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return;
        let p: THREE.Object3D | null = o; while (p) { if (p === carG) return; p = p.parent; }
        const g = m.geometry; const c = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        n += c * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
      });
      return Math.round(n);
    };
    (window as unknown as Record<string, unknown>).__trackDebug = {
      advance(sec: number, auto = false) {
        const n = Math.round(sec * 60);
        for (let k = 0; k < n; k++) {
          if (auto) {
            const i2 = (car.idx + 26) % NS, want = Math.atan2(px[i2] - car.x, pz[i2] - car.z), err = wrapAngle(want - car.yaw);
            touch = { throttle: Math.abs(err) < 0.35 ? 1 : 0.35, steer: clamp(-err * 2.6, -1, 1), brake: false };
          }
          introT += 1 / 60; step(1 / 60); updateDust(1 / 60); updateCamera(1 / 60);
          updateGates(introT, 1 / 60); updateCelebrate(1 / 60, introT);
          teleAcc += 1 / 60; if (teleAcc >= 0.1) { teleAcc = 0; sendTelemetry(); }
        }
        if (auto) touch = { throttle: 0, steer: 0, brake: false };
      },
      /** step only the effects (bursts, fireworks, confetti, flashes) without moving the car */
      fx(sec: number) { const n = Math.round(sec * 60); for (let k = 0; k < n; k++) { introT += 1 / 60; if (themeK < 1) { themeK = Math.min(1, themeK + 1 / 150); applyTheme(themeK * themeK * (3 - 2 * themeK)); } updateGates(introT, 1 / 60); updateCelebrate(1 / 60, introT); updateCamera(1 / 60); } },
      celebrate: () => api.celebrate(),
      sceneTris,
      renderer, scene, camera, car,
      setCam(pos: [number, number, number] | null, look?: [number, number, number]) { camOverride = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...(look ?? [0, 0, 0])) } : null; },
      info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, buggyTris: buggy.root.userData.triangleCount, lap: L, gates: gates.map((g) => [g.spec.id, Math.round(g.s)]) }),
    };
  }

  const api: TrackAPI = {
    setInput(i) { touch = { throttle: i.throttle || 0, steer: i.steer || 0, brake: !!i.brake }; },
    setStage(specs, theme) {
      ready.then(() => {
        cleared.length = 0;
        for (const sp of specs) {
          const g = gates.find((x) => x.spec.id === sp.id); if (!g) continue;
          g.spec = sp; if (sp.color) g.color.set(sp.color);
          const hex = `#${g.color.getHexString()}`; const k = (g.tex.image as HTMLCanvasElement).getContext("2d")!;
          drawBanner(k, sp, g.n, hex); g.tex.needsUpdate = true; g.flash = 1;
        }
        if (theme !== themeTo) { themeFrom = themeTo; themeTo = Math.max(0, Math.min(THEMES.length - 1, theme)); themeK = 0; }
      });
    },
    setAuto(on) { autopilot = on; if (on) { introMode = false; } },
    setPaused(p) { paused = p; if (p) keys.clear(); sfx.engine(rpm, 0, 0, p); },
    celebrate() {
      ready.then(() => {
        if (disposed) return;
        celebrateT = 6.2; shellCd = 0.25; confettiAcc = 0; flashK = 1;
        spawnShell(0); spawnShell(0.25); if (!low) spawnShell(0.45);
        sfx.arpeggio();
      });
    },
    setSound(on) { if (!disposed) sfx.set(!!on); },
    resetCar() { ready.then(() => { placeCar(L - 5); introMode = false; }); },
    teleportToGate(id) {
      ready.then(() => {
        const g = gates.find((x) => x.spec.id === id); if (!g) return;
        placeCar(g.s - 8); introMode = false;
      });
    },
    dispose() {
      disposed = true; running = false; cancelAnimationFrame(raf);
      sfx.dispose();
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); ro?.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.Line).isLine) {
          m.geometry?.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x?.dispose());
        }
      });
      textures.forEach((t) => t.dispose());
      (scene.environment as THREE.Texture | null)?.dispose();
      pmrem.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
      if (debug) delete (window as unknown as Record<string, unknown>).__trackDebug;
    },
  };
  void teleT;
  return api;
}
