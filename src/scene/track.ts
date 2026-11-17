import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Buggy } from "./buggyTypes";

/* ================================================================== API */
export type GateId = "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "projects" | "pit";
export interface GateSpec { id: GateId; label: string; sub: string }
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
  resetCar(): void;
  teleportToGate(id: GateId): void;
  dispose(): void;
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
const AMBER = new THREE.Color(0xffa21a);
const GREEN = new THREE.Color(0x3dff8a);

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
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const FOG = new THREE.Color(0x151c2e);
  scene.fog = new THREE.Fog(FOG, 38, 200);
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
  const hemi = new THREE.HemisphereLight(0x6a80b4, 0x2a2016, 0.75);
  scene.add(hemi);
  const MOON_DIR = new THREE.Vector3(-0.45, 0.62, 0.64).normalize();
  const moon = new THREE.DirectionalLight(0x9db3e6, 0.62);
  moon.castShadow = true;
  moon.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 90 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
  scene.add(moon, moon.target);
  const gateLight = new THREE.PointLight(0xffa21a, 0, 16, 2);
  scene.add(gateLight);

  /* ------------------------------------------------------------- sky */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      zen: { value: new THREE.Color(0x050916) }, mid: { value: new THREE.Color(0x18244a) },
      hor: { value: new THREE.Color(0x4b4a72) }, glow: { value: new THREE.Color(0xd2703a) },
      glowDir: { value: new THREE.Vector3(0.75, 0, -0.66).normalize() }, fogC: { value: FOG.clone() },
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform vec3 zen, mid, hor, glow, glowDir, fogC; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h)); c = mix(c, zen, smoothstep(0.18, 0.75, h));
        vec2 hz = normalize(d.xz + 1e-5); float a = max(dot(hz, glowDir.xz), 0.);
        float g = pow(a, 5.) * (1. - smoothstep(-0.02, 0.32, h)); c += glow * g * 0.9;
        c += glow * pow(a, 40.) * (1. - smoothstep(0., 0.08, h)) * 0.6;
        c = mix(c, fogC, 1. - smoothstep(-0.06, 0.02, h));
        gl_FragColor = vec4(c, 1.); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const skyGroup = new THREE.Group(); scene.add(skyGroup);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.renderOrder = -10; skyGroup.add(sky);
  {
    const n = low ? 400 : 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * Math.PI * 2, v = 0.12 + Math.pow(rand(), 0.7) * 0.88;
      const r = Math.sqrt(1 - v * v);
      pos.set([Math.cos(u) * r * 850, v * 850, Math.sin(u) * r * 850], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc9d6ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
    skyGroup.add(stars);
    const moonTex = canvasTex(128, 128, (c) => {
      const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,250,235,1)"); gr.addColorStop(0.32, "rgba(240,240,255,1)"); gr.addColorStop(0.36, "rgba(170,190,255,0.35)"); gr.addColorStop(1, "rgba(120,140,220,0)");
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    });
    const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, color: 0xffffff }));
    moonSprite.scale.setScalar(70); moonSprite.position.copy(MOON_DIR).multiplyScalar(820); skyGroup.add(moonSprite);
  }

  /* --------------------------------------------- environment for metals */
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), skyMat));
    const em = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc98a).multiplyScalar(6) });
    for (const [x, y, z] of [[20, 12, 5], [-18, 10, -12], [5, 14, 22]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), em); b.position.set(x, y, z); env.add(b); }
    const grd = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x1a1612 })); grd.rotation.x = -Math.PI / 2; grd.position.y = -1; env.add(grd);
    scene.environment = pmrem.fromScene(env, 0, 0.1, 200).texture;
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.45;
    env.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.material !== skyMat) (m.material as THREE.Material).dispose(); } });
  }

  /* ---------------------------------------------------------- ground */
  const world = new THREE.Group(); scene.add(world);
  const grassTex = canvasTex(256, 256, (g) => {
    g.fillStyle = "#2a3520"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = rand();
      g.fillStyle = v < 0.5 ? `rgba(${20 + rand() * 30},${40 + rand() * 40},${18 + rand() * 20},0.55)` : v < 0.8 ? `rgba(${60 + rand() * 40},${55 + rand() * 30},${30},0.35)` : "rgba(10,14,8,0.5)";
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
      const c = new THREE.Color().setRGB(0.55 + n * 0.5, 0.6 + n * 0.45, 0.5 + n * 0.4);
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
    g.fillStyle = "#6c513d"; g.fillRect(0, 0, Wc, Hc);
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
        g.fillStyle = `rgba(40,28,20,${0.08 + rand() * 0.12})`; g.fillRect(x, y, 3 + rand() * 6, 10 + rand() * 30);
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
  if (!low) { dirtMat.bumpMap = dirtTex; dirtMat.bumpScale = 1.6; }
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
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x2b3a22, roughness: 1, flatShading: true });
    const n = low ? 160 : 340;
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, n);
    let k = 0, guard = 0;
    while (k < n && guard++ < 6000) {
      const x = -75 + rand() * 160, z = -55 + rand() * 135;
      if (nearTrack(x, z, WALL_D + 2.2) || inGarage(x, z)) continue;
      const s = 0.35 + rand() * 0.9;
      bushes.setMatrixAt(k, place(p4.set(x, s * 0.25, z), rand() * 6, new THREE.Vector3(s * (1 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (1 + rand() * 0.6))));
      const c = new THREE.Color().setHSL(0.22 + rand() * 0.08, 0.3, 0.6 + rand() * 0.5); bushes.setColorAt(k, c); k++;
    }
    bushes.count = k; bushes.computeBoundingSphere(); bushes.receiveShadow = true; world.add(bushes);

    const treeGeo = new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0);
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x101a14 });
    const nt = low ? 260 : 520;
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, nt);
    for (let i = 0; i < nt; i++) {
      const a = rand() * Math.PI * 2, r = 52 + Math.pow(rand(), 0.8) * 120;
      const x = 3 + Math.cos(a) * r, z = 13 + Math.sin(a) * r, h = 6 + rand() * 10;
      trees.setMatrixAt(i, place(p4.set(x, 0, z), 0, new THREE.Vector3(h * (0.22 + rand() * 0.12), h, h * (0.22 + rand() * 0.12))));
    }
    trees.computeBoundingSphere(); world.add(trees);

    // hills ring
    const seg = 120, rows = [180, 230, 290, 380];
    const pos: number[] = [], idx: number[] = [];
    for (let r = 0; r < rows.length; r++) for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const hgt = r === 0 ? -1 : r === 3 ? 10 : (r === 1 ? 10 : 22) * (0.45 + 0.35 * Math.sin(a * 3 + 1) + 0.2 * Math.sin(a * 7 + 2) + 0.15 * Math.sin(a * 13));
      pos.push(3 + Math.cos(a) * rows[r], Math.max(hgt, r === 0 ? -1 : 2), 13 + Math.sin(a) * rows[r]);
    }
    for (let r = 0; r < rows.length - 1; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx);
    const hills = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: 0x0c1220, side: THREE.DoubleSide })); world.add(hills);
  }

  /* -------------------------------------------- floodlight towers */
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d2, emissiveIntensity: 5.5 });
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
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd7a0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(4.2); halo.position.set(0, 0, 0.4); frame.add(halo);
    if (light) {
      const sp = new THREE.SpotLight(0xffd49a, low ? 1700 : 1500, 90, 0.62, 0.75, 2);
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
      c.fillStyle = "#4a5562"; c.fillRect(0, 0, 512, 512);
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
      else if (kind === 1) { c.fillStyle = "#ffae1a"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#14110e"; c.font = `44px ${STENCIL}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("BAJA", 64, 42); }
      else if (kind === 2) { c.fillStyle = "#1d3f8f"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#f2f2f2"; c.font = `40px ${STENCIL}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("MU", 64, 42); }
      else { c.fillStyle = "#c22a1e"; c.fillRect(0, 0, 128, 80); c.fillStyle = "#f2f2f2"; c.fillRect(0, 34, 128, 12); }
    });
    const geo = new THREE.PlaneGeometry(1.3, 0.8, 8, 2); geo.translate(0.65, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set(x, 4.15, z); m.rotation.y = 0.6; world.add(m);
    flags.push({ geo, base: (geo.attributes.position.array as Float32Array).slice(), ph: rand() * 6 });
  }

  /* ------------------------------------------------------ start gantry */
  const startLamps: THREE.MeshStandardMaterial[] = [];
  function gantry() {
    const i = 0; const g = new THREE.Group(); const c = at(i, 0); g.position.copy(c); g.rotation.y = yawAt(i); world.add(g);
    const xl = T.offL[i] + 0.5, xr = -(T.offR[i] + 0.5), span = xl - xr, cx = (xl + xr) / 2;
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
    const beacon = new THREE.MeshStandardMaterial({ color: 0x221500, emissive: AMBER.clone(), emissiveIntensity: 2 });
    for (const x of [xl, xr]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 6.1, 0.36), darkMat); post.position.set(x, 3.05, 0); post.castShadow = true; g.add(post);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.42), hazardMat); sleeve.position.set(x, 0.6, 0); g.add(sleeve);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), beacon); cap.position.set(x, 6.25, 0); g.add(cap);
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), beacon); em.position.set(x - Math.sign(x) * 0.25, 0.6, 0); g.add(em);
      for (const dz of [-1.4, 1.4]) coneSpots.push(g.localToWorld(new THREE.Vector3(x + Math.sign(x) * 0.5, 0, dz)));
    }
    const tex = canvasTex(1536, 300, (k) => {
      const w = 1536, h = 300;
      const gr = k.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1e1914"); gr.addColorStop(1, "#0c0a08"); k.fillStyle = gr; k.fillRect(0, 0, w, h);
      hazard(k, 0, 0, w, 20); hazard(k, 0, h - 20, w, 20);
      k.fillStyle = "#ffae1a"; k.fillRect(44, 50, 200, h - 100);
      k.fillStyle = "#14110d"; k.font = `150px ${STENCIL}`; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText(String(n).padStart(2, "0"), 144, h / 2 + 8);
      let fs = 168; k.font = `${fs}px ${STENCIL}`;
      while (k.measureText(spec.label).width > w - 340 && fs > 50) { fs -= 6; k.font = `${fs}px ${STENCIL}`; }
      k.fillStyle = "#f4ead6"; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(spec.label, 284, 182);
      k.font = `600 42px ${MONO}`; k.fillStyle = "#ffae1a"; setSpacing(k, 9); k.fillText(spec.sub.toUpperCase(), 290, 248);
    });
    const banner = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.65 });
    const bw = span - 0.2, bh = bw / 5.12;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(span + 0.3, bh + 0.25, 0.18), darkMat); frame.position.set(cx, 5.9 - bh / 2, 0); frame.castShadow = true; g.add(frame);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), banner); p.position.set(cx, 5.9 - bh / 2, side * 0.1); if (side < 0) p.rotation.y = Math.PI; g.add(p);
    }
    const beam = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, span - 0.6, 6), beam); core.rotation.z = Math.PI / 2; core.position.set(cx, 0.6, 0); g.add(core);
    const glow = new THREE.MeshBasicMaterial({ map: beamGlowTex, color: AMBER.clone(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const rx of [0, Math.PI / 2]) { const gp = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.6, 0.5), glow); gp.position.set(cx, 0.6, 0); gp.rotation.x = rx; g.add(gp); }
    const ground = new THREE.MeshBasicMaterial({ map: beamGlowTex, color: AMBER.clone(), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const gpl = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.6, 2.2), ground); gpl.rotation.x = -Math.PI / 2; gpl.position.set(cx, 0.045, 0); g.add(gpl);
    gates.push({ spec, s, i, banner, beam, glow, ground, beacon, armed: true, prevDs: 0, centre: g.localToWorld(new THREE.Vector3(cx, 2.5, 0)) });
  }
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
  function readInput() {
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

  /* ---------------------------------------------------------- physics */
  function step(dt: number) {
    const inp = readInput();
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

    // vertical
    g = groundY(car.x, car.z);
    if (car.air) {
      car.vy -= GRAV * dt; car.y += car.vy * dt;
      if (car.y <= g) {
        const impact = -car.vy; car.y = g; car.vy = 0; car.air = false;
        body.bobV -= Math.min(1.4, impact * 0.22);
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
        if (!cleared.includes(gt.spec.id)) cleared.push(gt.spec.id);
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
      camLook.lerpVectors(CENTRE, new THREE.Vector3(car.x, 0.7, car.z), ease(clamp((introT - 1.2) / 4.5, 0, 1)));
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
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.position.copy(camPos); camera.lookAt(camLook);
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

  function updateGates(t: number) {
    const nx = nextGate();
    for (const g of gates) {
      const isNext = g === nx, isCl = cleared.includes(g.spec.id);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      if (isCl) {
        g.banner.emissive.setRGB(0.55, 1, 0.65); g.banner.emissiveIntensity = 0.5; g.banner.color.setRGB(0.75, 1, 0.8);
        g.beam.color.copy(GREEN).multiplyScalar(0.9); g.beam.opacity = 0.4; g.glow.color.copy(GREEN); g.glow.opacity = 0.1;
        g.ground.color.copy(GREEN); g.ground.opacity = 0.12; g.beacon.emissive.copy(GREEN); g.beacon.emissiveIntensity = 1.6;
      } else if (isNext) {
        g.banner.emissive.setRGB(1, 0.86, 0.62); g.banner.emissiveIntensity = 0.75 + pulse * 0.55; g.banner.color.setRGB(1, 1, 1);
        g.beam.color.copy(AMBER).multiplyScalar(2.5 + pulse * 2.5); g.beam.opacity = 1; g.glow.color.copy(AMBER); g.glow.opacity = 0.55 + pulse * 0.4;
        g.ground.color.copy(AMBER); g.ground.opacity = 0.45 + pulse * 0.4; g.beacon.emissive.copy(AMBER); g.beacon.emissiveIntensity = 2 + pulse * 5;
      } else {
        g.banner.emissive.setRGB(1, 0.9, 0.75); g.banner.emissiveIntensity = 0.3; g.banner.color.setRGB(0.85, 0.85, 0.85);
        g.beam.color.copy(AMBER).multiplyScalar(1.2); g.beam.opacity = 0.45; g.glow.color.copy(AMBER); g.glow.opacity = 0.18;
        g.ground.color.copy(AMBER); g.ground.opacity = 0.15; g.beacon.emissive.copy(AMBER); g.beacon.emissiveIntensity = 0.9;
      }
    }
    if (nx) { gateLight.position.copy(nx.centre); gateLight.intensity = 14 + 10 * Math.sin(t * 4.2); } else gateLight.intensity = 0;
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
    updateGates(t);
    updateFlags(t);
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
    dustMat.uniforms.uScale.value = H() * renderer.getPixelRatio();
  };
  dustMat.uniforms.uScale.value = H() * renderer.getPixelRatio();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(container); window.addEventListener("resize", onResize);
  const onVis = () => { const was = running; running = !document.hidden; if (running && !was && !disposed) { clock.getDelta(); frame(); } };
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
          teleAcc += 1 / 60; if (teleAcc >= 0.1) { teleAcc = 0; sendTelemetry(); }
        }
        if (auto) touch = { throttle: 0, steer: 0, brake: false };
      },
      sceneTris,
      renderer, scene, camera, car,
      setCam(pos: [number, number, number] | null, look?: [number, number, number]) { camOverride = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...(look ?? [0, 0, 0])) } : null; },
      info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, buggyTris: buggy.root.userData.triangleCount, lap: L, gates: gates.map((g) => [g.spec.id, Math.round(g.s)]) }),
    };
  }

  const api: TrackAPI = {
    setInput(i) { touch = { throttle: i.throttle || 0, steer: i.steer || 0, brake: !!i.brake }; },
    setPaused(p) { paused = p; if (p) keys.clear(); },
    resetCar() { ready.then(() => { placeCar(L - 5); introMode = false; }); },
    teleportToGate(id) {
      ready.then(() => {
        const g = gates.find((x) => x.spec.id === id); if (!g) return;
        placeCar(g.s - 8); introMode = false;
      });
    },
    dispose() {
      disposed = true; running = false; cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); ro?.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) {
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
