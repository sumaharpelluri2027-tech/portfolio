/**
 * The four test drives, in 3D, with the real garage buggy. Each one is its own short course and world:
 *  road    · Strategy  · alpine pass at dawn: mountain climb, a highway blocked by funded rivals, or a mud track
 *  funnel  · Marketing · neon city at night: boosters, then a ramp jump onto a conversion scale (target 50%)
 *  orders  · Ops       · container yard at midday: problems drop into your lane
 *  runway  · Finance   · desert at sunset: rolling dunes road, fuel is runway, oasis at ₹2.5 Cr
 * One renderer lives for the whole session; each activity builds its course into a group and tears it down after.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Buggy } from "./buggyTypes";

export type GameKind = "road" | "funnel" | "orders" | "runway";
export interface GameScore { road?: string; conv: number; orders: number; auto: boolean; fuel: number; aum: number; rivals: number; dodged: number; prog: number }
export interface GameHooks { onPop(t: string, c: string): void; onScore(p: Partial<GameScore>): void; onTel(kmh: number, prog: number): void; onDone(): void; onAuto?(on: boolean): void }
export interface ArenaAPI {
  /** build a course's world with its best road and slowly orbit the buggy (behind the decision card) */
  preview(kind: GameKind): void;
  start(kind: GameKind, choice: string, hooks: GameHooks): void;
  setAuto(on: boolean): void;
  /** touch steering, -1..1 */
  setSteer(v: number): void;
  setPaused(p: boolean): void;
  dispose(): void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(x: number, z: number) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) + (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
}
const fbm = (x: number, z: number) => noise(x, z) * 0.55 + noise(x * 2.1 + 5, z * 2.1) * 0.3 + noise(x * 4.3 + 9, z * 4.3) * 0.15;
const MONO = '"JetBrains Mono", ui-monospace, monospace', STENCIL = '"Saira Stencil One", Impact, sans-serif';

/* -------------------------------------------------------------------- the four skies */
interface Theme { top: number; mid: number; hor: number; sun: number; sunDir: [number, number, number]; fog: number; fogN: number; fogF: number; hemiS: number; hemiG: number; hemiI: number; key: number; keyI: number; exp: number; bloom: number; stars: boolean }
const THEMES: Record<GameKind, Theme> = {
  road: { top: 0x3a5aa8, mid: 0xb7a6d8, hor: 0xffd0a0, sun: 0xffe2b0, sunDir: [-0.35, 0.16, 0.92], fog: 0xd9c7d6, fogN: 40, fogF: 330, hemiS: 0xdde4ff, hemiG: 0x4a5a3a, hemiI: 1.25, key: 0xffe0b8, keyI: 3.0, exp: 1.0, bloom: 0.25, stars: false },
  funnel: { top: 0x03051a, mid: 0x1a1450, hor: 0x5a2a8a, sun: 0xff5fb0, sunDir: [0.0, 0.08, 1.0], fog: 0x1c1440, fogN: 30, fogF: 260, hemiS: 0x6a70ff, hemiG: 0x180c28, hemiI: 0.7, key: 0x9ab0ff, keyI: 1.1, exp: 1.1, bloom: 0.6, stars: true },
  orders: { top: 0x2a6fd8, mid: 0x7fb4f0, hor: 0xdcecff, sun: 0xffffff, sunDir: [0.45, 0.75, 0.35], fog: 0xc8dcf0, fogN: 60, fogF: 380, hemiS: 0xe4f0ff, hemiG: 0x6a6a60, hemiI: 1.35, key: 0xfff6e6, keyI: 3.4, exp: 1.0, bloom: 0.12, stars: false },
  runway: { top: 0x3a2a78, mid: 0xc4508a, hor: 0xffa060, sun: 0xffc070, sunDir: [-0.2, 0.1, 0.97], fog: 0xe89a7a, fogN: 50, fogF: 360, hemiS: 0xffc8a8, hemiG: 0x8a5a3a, hemiI: 1.2, key: 0xffb070, keyI: 3.0, exp: 1.05, bloom: 0.3, stars: false },
};

/* -------------------------------------------------------------------- course contract */
interface Car { x: number; y: number; z: number; yaw: number; v: number; vy: number; air: boolean; stopT: number; cap: number; boostT: number; pitch: number; roll: number }
interface Course {
  group: THREE.Group;
  len: number; halfW: number; vmax: number; acc: number;
  roadX(z: number): number;
  h(x: number, z: number): number;
  /** autopilot: where to steer (world x), or null to follow the road */
  aim(car: Car): number | null;
  /** per-frame rules; returns true when the activity is over */
  tick(dt: number, t: number, car: Car): boolean;
  dust: number; crawl?: (car: Car) => number;
  /** sideways camera offset in metres, e.g. to show a climb from the valley side */
  camSide?: (car: Car) => number;
  frame?(t: number, dt: number): void;
}

/* ==================================================================== the arena */
export function createArena(opts: { container: HTMLElement; createBuggy: () => Buggy; quality: "high" | "low" }): ArenaAPI {
  const { container } = opts, low = opts.quality === "low";
  const W = () => container.clientWidth || window.innerWidth, H = () => container.clientHeight || window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.75));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 50, 300);
  const camera = new THREE.PerspectiveCamera(58, W() / H(), 0.1, 2000);
  const composer = low ? null : new EffectComposer(renderer);
  let bloom: UnrealBloomPass | null = null;
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), 0.4, 0.5, 0.82); composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* --- sky, lights --- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.2, 1) }, stars: { value: 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform vec3 top, mid, hor, sun, sunDir; uniform float stars; varying vec3 vD;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        float a = max(dot(d, normalize(sunDir)), 0.);
        c += sun * (pow(a, 6.) * .35 + pow(a, 60.) * .6 + smoothstep(.9993, .9996, a) * 2.5);
        if (stars > 0.5 && h > 0.05) { vec2 g = floor(d.xz / (h + .3) * 260.); float s = step(.9975, h2(g)); c += vec3(s) * smoothstep(.05, .4, h) * .9; }
        c = mix(c, hor, 1. - smoothstep(-0.04, 0.03, h));
        gl_FragColor = vec4(c, 1.); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 3); key.castShadow = true;
  key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTex: THREE.Texture | null = null;
  function applyTheme(k: GameKind) {
    const th = THEMES[k], u = skyMat.uniforms;
    u.top.value.set(th.top); u.mid.value.set(th.mid); u.hor.value.set(th.hor); u.sun.value.set(th.sun); u.sunDir.value.set(...th.sunDir).normalize(); u.stars.value = th.stars ? 1 : 0;
    const f = scene.fog as THREE.Fog; f.color.set(th.fog); f.near = th.fogN; f.far = th.fogF; scene.background = new THREE.Color(th.fog);
    hemi.color.set(th.hemiS); hemi.groundColor.set(th.hemiG); hemi.intensity = th.hemiI;
    key.color.set(th.key); key.intensity = th.keyI; renderer.toneMappingExposure = th.exp;
    if (bloom) bloom.strength = th.bloom;
    // reflections for the buggy's metal, taken from this sky
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat));
    const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: th.hemiG })); g.rotation.x = -Math.PI / 2; g.position.y = -2; envScene.add(g);
    envTex?.dispose(); envTex = pmrem.fromScene(envScene, 0, 0.1, 200).texture; scene.environment = envTex;
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = k === "funnel" ? 0.9 : 0.6;
  }

  /* --- the buggy --- */
  const buggy = opts.createBuggy();
  const carG = new THREE.Group(); carG.rotation.order = "YXZ"; carG.add(buggy.root); scene.add(carG);
  buggy.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.receiveShadow = true; } });
  const headL = new THREE.SpotLight(0xfff2d0, 0, 40, 0.5, 0.6, 1.2); headL.position.set(0, 1.1, 0.9); headL.target.position.set(0, 0, 12); carG.add(headL, headL.target);

  /* --- shared helpers --- */
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return track(t);
  }
  const std = (color: number, rough = 0.8, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  /** a floating sign that always faces the camera */
  function label(text: string, bg: string, fg = "#14110e", size = 1, sub?: string) {
    const c = document.createElement("canvas"), g = c.getContext("2d")!;
    g.font = `700 64px ${MONO}`; const w1 = g.measureText(text).width; g.font = `500 40px ${MONO}`; const w2 = sub ? g.measureText(sub).width : 0;
    const w = Math.ceil(Math.max(w1, w2) + 80), h = sub ? 170 : 110; c.width = w; c.height = h;
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill();
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 64px ${MONO}`; g.fillText(text, w / 2, sub ? 62 : h / 2 + 3);
    if (sub) { g.font = `500 40px ${MONO}`; g.globalAlpha = 0.8; g.fillText(sub, w / 2, 124); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; track(t);
    const m = track(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }));
    const s = new THREE.Sprite(m); s.scale.set((w / h) * 1.1 * size, 1.1 * size, 1); s.renderOrder = 5; return s;
  }
  /** a big painted banner on two posts across the road */
  function arch(z: number, y: number, halfW: number, text: string, bg: string, fg: string, glow = false) {
    const g = new THREE.Group(); g.position.set(0, y, z);
    const post = std(0x22252a, 0.5, 0.6);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6, 0.35), post); p.position.set(sx * (halfW + 0.6), 3, 0); p.castShadow = true; g.add(p); }
    const tex = canvasTex(1024, 160, (k) => { k.fillStyle = bg; k.fillRect(0, 0, 1024, 160); k.fillStyle = fg; k.font = `110px ${STENCIL}`; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText(text, 512, 88); });
    const b = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 1.6, 1.4, 0.2), [post, post, post, post, std(0xffffff, 0.6, 0, { map: tex, emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? tex : null, emissiveIntensity: glow ? 0.9 : 0 }), post]);
    b.position.set(0, 5.6, 0); b.rotation.y = Math.PI; b.castShadow = true; g.add(b);
    return g;
  }
  function pineGeo() {
    const trunk = new THREE.CylinderGeometry(0.15, 0.25, 1.6, 6); trunk.translate(0, 0.8, 0);
    const parts = [trunk];
    for (let k = 0; k < 3; k++) { const c = new THREE.ConeGeometry(1.7 - k * 0.38, 2.4, 7); c.translate(0, 2.0 + k * 1.15, 0); parts.push(c); }
    const cols = [0x5a3a22, 0x1f4a2a, 0x24552f, 0x2d6338];
    parts.forEach((p, i) => { const n = p.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color(cols[i]); for (let j = 0; j < n; j++) col.set([cc.r, cc.g, cc.b], j * 3); p.setAttribute("color", new THREE.BufferAttribute(col, 3)); });
    return track(mergeGeometries(parts.map((p) => p.toNonIndexed()))!);
  }
  function scatter(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, spot: (r: () => number) => [number, number, number, number, number] | null, seed: number, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, n), r = rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let k = 0;
    for (let i = 0; i < n * 4 && k < n; i++) { const s = spot(r); if (!s) continue; const [x, y, z, sc, yaw] = s; q.setFromEuler(e.set(0, yaw, 0)); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(k++, m); }
    im.count = k; im.castShadow = shadow; im.receiveShadow = true; return im;
  }
  /** a heightfield ground for the course, coloured per vertex */
  function terrain(x0: number, x1: number, z0: number, z1: number, step: number, h: (x: number, z: number) => number, col: (x: number, z: number, y: number, c: THREE.Color) => void, mat: THREE.MeshStandardMaterial) {
    const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = h(x, z); p.setY(i, y); col(x, z, y, c); cols.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(track(geo), mat); m.receiveShadow = true; return m;
  }
  /** the driving surface: a ribbon that follows the road's line and height */
  function road(len: number, halfW: number, roadX: (z: number) => number, h: (x: number, z: number) => number, mat: THREE.Material, z0 = -20, vRepeat = 8) {
    const n = Math.ceil((len - z0) / 1.0), pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 + i, cx = roadX(z);
      for (const sx of [-1, 1]) { const x = cx + sx * halfW; pos.push(x, h(x, z) + 0.04, z); uv.push(sx < 0 ? 0 : 1, (z - z0) / vRepeat); }
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(track(geo), mat); m.receiveShadow = true; return m;
  }

  /* --- effects: dust/spray, confetti --- */
  const DN = low ? 140 : 320;
  const dPos = new Float32Array(DN * 3), dVel = new Float32Array(DN * 3), dAge = new Float32Array(DN).fill(9), dCol = new Float32Array(DN * 3);
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute("color", new THREE.BufferAttribute(dCol, 3));
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.7, map: puffTex, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false })); dust.frustumCulled = false; scene.add(dust);
  let dHead = 0; const dc = new THREE.Color();
  function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number) {
    const i = dHead++ % DN; dPos.set([x, y, z], i * 3); dVel.set([vx, vy, vz], i * 3); dAge[i] = 0; dc.set(color); dCol.set([dc.r, dc.g, dc.b], i * 3);
  }
  function updateDust(dt: number) {
    for (let i = 0; i < DN; i++) {
      if (dAge[i] > 1.4) { dPos[i * 3 + 1] = -999; continue; }
      dAge[i] += dt; dVel[i * 3 + 1] -= 6 * dt;
      dPos[i * 3] += dVel[i * 3] * dt; dPos[i * 3 + 1] += dVel[i * 3 + 1] * dt; dPos[i * 3 + 2] += dVel[i * 3 + 2] * dt;
    }
    dGeo.attributes.position.needsUpdate = true; dGeo.attributes.color.needsUpdate = true;
  }
  function burst(x: number, y: number, z: number, n: number) {
    const cols = [0xf2b705, 0xff5fb0, 0x3ad0ff, 0x2bff88, 0xffffff];
    for (let k = 0; k < n; k++) emit(x + (Math.random() - 0.5) * 6, y + Math.random() * 2, z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10, 6 + Math.random() * 9, (Math.random() - 0.5) * 10, cols[k % cols.length]);
  }

  /* --- input --- */
  const keys = new Set<string>();
  let touchSteer = 0, auto = true, hooks: GameHooks | null = null;
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const t = e.target as HTMLElement | null; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase(); if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(k)) return;
    if (down) { keys.add(k); if (running && auto) { auto = false; hooks?.onAuto?.(false); } } else keys.delete(k);
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  /* --- state --- */
  let course: Course | null = null, kind: GameKind = "road";
  const car: Car = { x: 0, y: 0, z: 0, yaw: 0, v: 0, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0, pitch: 0, roll: 0 };
  let running = false, finished = false, endT = -1, t = 0, paused = false, mode: "preview" | "run" = "preview", orbit = 0, introT = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  function build(k: GameKind, choice: string): Course {
    const r = (k === "road" ? roadCourse : k === "funnel" ? funnelCourse : k === "orders" ? opsCourse : desertCourse)(choice);
    return r;
  }
  function clear() {
    if (course) { scene.remove(course.group); course.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) m.geometry?.dispose(); }); }
    disposables.splice(0).forEach((d) => d.dispose());
    course = null;
  }
  function load(k: GameKind, choice: string) {
    clear(); kind = k; applyTheme(k); course = build(k, choice); scene.add(course.group);
    Object.assign(car, { x: course.roadX(0), z: 0, yaw: 0, v: 0, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0 }); car.y = course.h(car.x, 0);
    headL.intensity = k === "funnel" ? 12 : 0;
    dAge.fill(9); t = 0; endT = -1; finished = false; introT = 0;
  }

  /* --- physics --- */
  const GRAV = 18;
  function step(dt: number) {
    const c = course!; t += dt;
    if (mode === "preview") { car.v = 0; car.y = c.h(car.x, car.z); return; }
    let thr = 0, steer = 0;
    const kl = keys.has("arrowleft") || keys.has("a"), kr = keys.has("arrowright") || keys.has("d");
    if (auto || mode !== "run") {
      thr = 1;
      const tx = c.aim(car) ?? c.roadX(car.z + 6);
      const ahead = Math.atan2(c.roadX(car.z + 8) - c.roadX(car.z), 8);
      const want = clamp(ahead + (tx - car.x) * 0.22, -0.55, 0.55);
      steer = clamp((want - car.yaw) * 3.2, -1, 1);
    } else {
      thr = keys.has("arrowdown") || keys.has("s") ? -0.6 : 1; // the gas is on by default: you steer
      steer = (kl ? 1 : 0) - (kr ? 1 : 0) + touchSteer * -1;
    }
    if (finished) thr = -0.4;
    if (car.stopT > 0) { car.stopT -= dt; car.v = Math.max(0, car.v - 40 * dt); }
    else if (!car.air) {
      const sl = (c.h(car.x + Math.sin(car.yaw) * 0.6, car.z + Math.cos(car.yaw) * 0.6) - c.h(car.x - Math.sin(car.yaw) * 0.6, car.z - Math.cos(car.yaw) * 0.6)) / 1.2;
      const vmax = c.vmax * (car.boostT > 0 ? 1.35 : 1);
      let a = thr > 0 ? thr * c.acc * (1 - car.v / vmax) : thr * 14;
      if (car.boostT > 0) a += 8;
      a -= GRAV * 0.55 * Math.sin(Math.atan(sl));
      car.v = clamp(car.v + a * dt, c.crawl ? c.crawl(car) : 0, Math.min(car.cap, vmax * 1.2));
    }
    car.boostT -= dt;
    // steering (yaw follows input, softened at low speed)
    car.yaw += steer * 1.5 * dt * clamp(car.v / 5, 0, 1) * (car.air ? 0.2 : 1);
    if (Math.abs(steer) < 0.05 && !car.air && !(auto || mode !== "run")) car.yaw *= 1 - damp(0.6, dt);
    car.yaw = clamp(car.yaw, -0.75, 0.75);
    car.x += Math.sin(car.yaw) * car.v * dt; car.z += Math.cos(car.yaw) * car.v * dt;
    // the road edges
    const off = car.x - c.roadX(car.z);
    if (Math.abs(off) > c.halfW - 0.9) { car.x = c.roadX(car.z) + Math.sign(off) * (c.halfW - 0.9); car.yaw *= 0.6; car.v *= 1 - damp(1.5, dt); }
    // height
    const gy = c.h(car.x, car.z);
    if (car.air) { car.vy -= GRAV * dt; car.y += car.vy * dt; if (car.y <= gy) { car.y = gy; car.air = false; shake = Math.min(0.5, Math.abs(car.vy) * 0.03); car.vy = 0; landPuff(); } }
    else car.y = gy;
    // body attitude from the ground under the wheels
    const fwd = c.h(car.x + Math.sin(car.yaw) * 0.8, car.z + Math.cos(car.yaw) * 0.8), back = c.h(car.x - Math.sin(car.yaw) * 0.8, car.z - Math.cos(car.yaw) * 0.8);
    const lft = c.h(car.x + Math.cos(car.yaw) * 0.7, car.z - Math.sin(car.yaw) * 0.7), rgt = c.h(car.x - Math.cos(car.yaw) * 0.7, car.z + Math.sin(car.yaw) * 0.7);
    const tp = car.air ? -Math.atan2(car.vy, Math.max(4, car.v)) * 0.5 : Math.atan2(fwd - back, 1.6), tr = car.air ? 0 : Math.atan2(rgt - lft, 1.4);
    car.pitch += (tp - car.pitch) * damp(10, dt); car.roll += (tr - car.roll) * damp(10, dt);
    // dust
    if (car.v > 3 && !car.air && Math.random() < (low ? 0.25 : 0.5)) {
      for (const sx of [-0.65, 0.65]) emit(car.x + Math.cos(car.yaw) * sx - Math.sin(car.yaw) * 1.1, car.y + 0.25, car.z - Math.cos(car.yaw) * 1.1 + Math.sin(car.yaw) * sx, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 2, -car.v * 0.15, c.dust);
    }
    if (mode === "run" && !finished && c.tick(dt, t, car)) { finished = true; endT = t; }
    if (mode === "run" && finished && endT >= 0 && t - endT > 1.4 && running) { running = false; hooks?.onDone(); }
    if (mode === "run") hooks?.onTel(car.v * 3.6, clamp(car.z / c.len, 0, 1));
  }
  function landPuff() { for (let k = 0; k < 18; k++) emit(car.x + (Math.random() - 0.5) * 2, car.y + 0.2, car.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, course!.dust); }

  /* --- camera --- */
  let shake = 0, camSideS = 0;
  function updateCamera(dt: number) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    if (mode === "preview") {
      orbit += dt * 0.18;
      const r = 8.5;
      camPos.set(car.x + Math.sin(orbit + 2.4) * r, car.y + 3.2, car.z + Math.cos(orbit + 2.4) * r);
      camLook.set(car.x, car.y + 0.9, car.z);
      camera.position.copy(camPos);
    } else {
      introT += dt;
      const air = car.air ? 1 : 0, back = 5.6 + air * 3 + clamp(car.v / 18, 0, 1) * 1.0, up = 2.3 + air * 2.2;
      const side = course?.camSide?.(car) ?? 0; camSideS += (side - camSideS) * damp(1.5, dt);
      const want = new THREE.Vector3(car.x - fx * back + camSideS, car.y + up + Math.abs(camSideS) * 0.25, car.z - fz * back + Math.abs(camSideS) * 0.35);
      const wantLook = new THREE.Vector3(car.x + fx * 6, car.y + 1.1, car.z + fz * 6);
      const k = introT < 1.6 ? damp(2, dt) : damp(4.5, dt);
      camPos.lerp(want, k); camLook.lerp(wantLook, damp(6, dt));
      camera.position.copy(camPos);
      if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
      camera.fov += ((58 + (car.boostT > 0 ? 10 : 0) + clamp(car.v / 20, 0, 1) * 6) - camera.fov) * damp(4, dt); camera.updateProjectionMatrix();
    }
    camera.lookAt(camLook);
    const th = THEMES[kind], sd = new THREE.Vector3(...th.sunDir).normalize();
    key.position.set(car.x + sd.x * 60 + 10, car.y + 45, car.z + sd.z * 60 - 10); key.target.position.set(car.x, car.y, car.z + 6);
    sky.position.copy(camera.position);
  }

  /* --- loop --- */
  const clock = new THREE.Clock();
  let raf = 0, alive = true;
  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (course && !paused) { const n = dt > 0.025 ? 2 : 1; for (let i = 0; i < n; i++) step(dt / n); updateDust(dt); course.frame?.(t, dt); }
    render(dt);
  }
  function render(dt: number) {
    if (!course) return;
    carG.position.set(car.x, car.y, car.z); carG.rotation.set(-car.pitch, car.yaw, car.roll);
    buggy.update(dt, t);
    updateCamera(dt);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  const onResize = () => { renderer.setSize(W(), H()); composer?.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); };
  window.addEventListener("resize", onResize);
  frame();
  const dbg = { advance(sec: number) { for (let i = 0; i < Math.round(sec * 60); i++) { if (course) { step(1 / 60); updateDust(1 / 60); course.frame?.(t, 1 / 60); updateCamera(1 / 60); } } render(0); } };
  (window as unknown as Record<string, unknown>).__game = dbg;

  /* ================================================================== 1 · STRATEGY: the alpine pass */
  function roadCourse(choice: string): Course {
    const mountain = choice === "mountain", flat = choice === "flat", mud = choice === "mud";
    const len = mountain ? 175 : 190, halfW = flat ? 6.2 : 4.2, LIMIT = mountain ? 17 : 12;
    const prof = (z: number) => !mountain ? 0 : z < 22 ? 0 : z < 92 ? 21 * smooth((z - 22) / 70) : z < 108 ? 21 : z < 158 ? 21 * (1 - smooth((z - 108) / 50)) : 0;
    const h = (x: number, z: number) => {
      const d = Math.max(0, Math.abs(x) - halfW - 1), n = fbm(x * 0.04, z * 0.04);
      if (mountain && x > 0) return Math.max(prof(z) - d * 0.75 - d * d * 0.004, -4 + n * 6) + n * Math.min(d, 6) * 0.4;
      return prof(z) + d * (mountain ? 0.55 : 0.32) + d * d * 0.012 + n * Math.min(d, 18) * 0.9;
    };
    const g = new THREE.Group();
    const groundMat = std(0xffffff, 1, 0, { vertexColors: true });
    g.add(terrain(-140, 140, -60, len + 160, low ? 3 : 2, h, (x, z, y, c) => {
      const d = Math.abs(x) - halfW, rock = smooth((Math.abs(y - prof(z)) - 7) / 10), snow = smooth((y - 26) / 6);
      c.setRGB(0.2, 0.36, 0.18).lerp(new THREE.Color(0.32, 0.42, 0.22), fbm(x * 0.1, z * 0.1)).lerp(new THREE.Color(0.42, 0.4, 0.38), rock).lerp(new THREE.Color(0.94, 0.95, 1), snow);
      if (d < 1.2) c.lerp(new THREE.Color(0.36, 0.28, 0.2), 0.7);
    }, groundMat));
    // the road surface for the chosen route
    const surf = canvasTex(256, 512, (k) => {
      if (flat) { k.fillStyle = "#3a3d42"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; k.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
        k.fillStyle = "#f4efe2"; k.fillRect(6, 0, 6, 512); k.fillRect(244, 0, 6, 512); k.fillStyle = "#f2b705"; for (const x of [84, 168]) k.fillRect(x, 0, 5, 220); }
      else if (mud) { k.fillStyle = "#4a321c"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 70; i++) { k.fillStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 15},8,.7)`; k.beginPath(); k.ellipse(Math.random() * 256, Math.random() * 512, 10 + Math.random() * 30, 6 + Math.random() * 16, 0, 0, 7); k.fill(); }
        k.strokeStyle = "rgba(20,12,4,.6)"; k.lineWidth = 14; for (const x of [80, 176]) { k.beginPath(); k.moveTo(x, 0); k.lineTo(x + 6, 512); k.stroke(); } }
      else { k.fillStyle = "#7a5e44"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 4000; i++) { const v = 90 + Math.random() * 80; k.fillStyle = `rgba(${v},${v * 0.8},${v * 0.6},.5)`; k.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
        k.strokeStyle = "rgba(60,40,25,.5)"; k.lineWidth = 10; for (const x of [70, 186]) { k.beginPath(); k.moveTo(x, 0); k.lineTo(x, 512); k.stroke(); } }
    }, [1, 1]);
    g.add(road(len + 60, halfW, () => 0, (x, z) => prof(z), std(0xffffff, mud ? 0.35 : flat ? 0.75 : 0.95, 0, { map: surf }), -40, flat ? 14 : 8));
    // snow peaks on the horizon
    const peakMat = std(0x6f7fa8, 0.9, 0, { flatShading: true }), snowMat = std(0xf6f8ff, 0.6);
    const pr = rng(4);
    for (let i = 0; i < 14; i++) {
      const ang = -1.2 + (i / 13) * 2.4, dist = 330 + pr() * 160, ph = 80 + pr() * 90, rad = 60 + pr() * 50;
      const p = new THREE.Mesh(new THREE.ConeGeometry(rad, ph, 7), peakMat); p.position.set(Math.sin(ang) * dist, ph / 2 - 10, Math.cos(ang) * dist + len * 0.5); g.add(p);
      const s = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.36, ph * 0.36, 7), snowMat); s.position.set(p.position.x, ph - 10 - ph * 0.18 + 0.5, p.position.z); g.add(s);
    }
    // a forest both sides
    const pg = pineGeo(), pm = std(0xffffff, 0.9, 0, { vertexColors: true, flatShading: true });
    g.add(scatter(pg, pm, low ? 260 : 560, (r) => { const side = r() < 0.5 ? -1 : 1, x = side * (halfW + 3 + Math.pow(r(), 1.6) * 80), z = -40 + r() * (len + 140); const y = h(x, z); if (y > 30) return null; return [x, y - 0.1, z, 0.8 + r() * 1.1, r() * 6]; }, 7));
    const rockG = track(new THREE.DodecahedronGeometry(1, 0)), rockM = std(0x7c7f86, 0.95, 0, { flatShading: true });
    g.add(scatter(rockG, rockM, 60, (r) => { const side = r() < 0.5 ? -1 : 1, x = side * (halfW + 1.6 + r() * 14), z = r() * len; return [x, h(x, z), z, 0.4 + r() * 1.2, r() * 6]; }, 9));
    // signs, finish
    const sign = label(mountain ? "MOUNTAIN PASS ↗" : flat ? "HIGHWAY · EVERYONE'S HERE" : "SAME OLD ROAD", mountain ? "#4fc3f7" : flat ? "#9fb4c8" : "#a1764a", "#14110e", 1.1); sign.position.set(-halfW - 1, 3.2, 14); g.add(sign);
    if (mountain) { const s2 = label("SUMMIT · B2B2C", "#ffe2a8", "#14110e", 1.3, "a new model, a road of our own"); s2.position.set(halfW + 1.5, prof(100) + 4, 100); g.add(s2); }
    g.add(arch(len, h(0, len), halfW, "MARKET LEAD", "#f2b705", "#14110e"));
    // funded rivals that own the highway
    const rivals: THREE.Group[] = [];
    if (flat) {
      const cols = [0xc62828, 0x6a1b9a, 0x1565c0];
      [-4, 0, 4].forEach((x, k) => {
        const rv = new THREE.Group(); rv.position.set(x, 0, 26 + (k === 1 ? 3 : 0));
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.2), std(cols[k], 0.35, 0.5)); body.position.y = 0.75; rv.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.1), std(0x1a1d22, 0.15, 0.6)); cab.position.set(0, 1.45, -0.2); rv.add(cab);
        for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), std(0x111111, 0.8)); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); rv.add(w); }
        const tl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.05), std(0xff2020, 0.5, 0, { emissive: 0xff2020, emissiveIntensity: 2 })); tl.position.set(0, 0.95, -2.12); rv.add(tl);
        rv.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
        g.add(rv); rivals.push(rv);
      });
      const tag = label("FUNDED RIVALS · ₹₹₹", "#ef5350", "#ffffff", 1.2); tag.position.set(0, 3.4, 0); rivals[1].add(tag);
    }
    const said = new Set<string>(); const pop = (k: string, txt: string, col: string) => { if (!said.has(k)) { said.add(k); hooks?.onPop(txt, col); } };
    hooks?.onScore({ road: choice, rivals: 0, prog: 0 });
    return {
      group: g, len, halfW, vmax: mud ? 6 : 17, acc: mud ? 4 : 9, dust: mud ? 0x4a321c : flat ? 0x9a9a9a : 0x9a7a5a,
      roadX: () => 0, h: (x, z) => prof(z) + (Math.abs(x) > halfW ? h(x, z) - prof(z) : 0),
      crawl: (c) => (mountain && c.z > 22 && c.z < 92 ? 5 : 0),
      camSide: (c) => (mountain && c.z > 18 && c.z < 120 ? 7.5 : 0),
      aim: () => (flat ? 0 : null),
      tick(dt, t, c) {
        if (flat) {
          rivals.forEach((rv, k) => { rv.position.z += 6.2 * dt; rv.position.x = [-4, 0, 4][k] + Math.sin(t * 1.3 + k) * 0.3; });
          const front = Math.min(...rivals.map((rv) => rv.position.z));
          if (c.z > front - 6) { c.z = Math.min(c.z, front - 5.6); c.v = Math.min(c.v, 6.2); c.cap = 6.4; pop("rival", "BLOCKED BY FUNDED RIVALS", "#ef5350"); hooks?.onScore({ rivals: 3 }); }
        }
        if (mud) {
          if (Math.random() < 0.7) for (const sx of [-0.7, 0.7]) emit(c.x + sx, c.y + 0.3, c.z - 1, sx * 3, 3 + Math.random() * 3, -2 - Math.random() * 2, 0x3a2614);
          if (t > 1.2) pop("mud", "WHEELS SPINNING · SLOW GRIND", "#a1764a");
          if (t > 6.5) pop("mud2", "STILL IN THE MUD", "#a1764a");
        }
        if (mountain) { if (c.z > 26) pop("climb", "HARD CLIMB", "#4fc3f7"); if (c.z > 94) pop("top", "OVER THE TOP", "#4fc3f7"); if (c.z > 135) pop("road", "THE ROAD IS YOURS", "#2bff88"); }
        hooks?.onScore({ prog: clamp(c.z / len, 0, 1) });
        if (c.z >= len) { pop("win", "MARKET LEADER", "#2bff88"); burst(0, h(0, len) + 4, len, 90); return true; }
        if (t >= LIMIT) { pop("end", flat ? "TIME'S UP · RIVALS OWN THIS ROAD" : "TIME'S UP · STILL GRINDING", "#ffca28"); return true; }
        return false;
      },
    };
  }

  /* ================================================================== 2 · MARKETING: the neon city and the jump */
  function funnelCourse(choice: string): Course {
    const leak = choice === "leak", halfW = 5, RZ = 118, RL = 9, RH = 2.8, GAP0 = RZ + RL, LAND = 152, len = 330;
    const mark = (p: number) => 160 + ((p - 10) / 50) * 140;
    const ramp = (x: number, z: number) => (Math.abs(x) < 3.2 && z >= RZ && z < RZ + RL ? RH * Math.pow((z - RZ) / RL, 1.4) : 0);
    const h = (x: number, z: number) => (z > GAP0 && z < LAND ? -7 : ramp(x, z));
    const g = new THREE.Group();
    // wet street and pavements
    const asphalt = canvasTex(256, 512, (k) => { k.fillStyle = "#14121c"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 2000; i++) { k.fillStyle = `rgba(160,140,255,${Math.random() * 0.05})`; k.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
      k.fillStyle = "#ff5fb0"; k.fillRect(4, 0, 5, 512); k.fillRect(247, 0, 5, 512); k.fillStyle = "#3ad0ff"; k.fillRect(125, 0, 6, 250); });
    const wet = std(0xffffff, 0.22, 0.35, { map: asphalt });
    g.add(road(GAP0, halfW, () => 0, () => 0, wet, -40, 16));
    g.add(road(len + 40, halfW, () => 0, () => 0, wet, LAND, 16));
    const pave = std(0x2a2638, 0.6, 0.1);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, len + 80), pave); p.position.set(sx * (halfW + 4), 0.12, len / 2 - 20); p.receiveShadow = true; g.add(p); }
    // the canal under the jump
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, LAND - GAP0), std(0x0a1430, 0.08, 0.6, { emissive: 0x1a1060, emissiveIntensity: 0.4 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -4, (GAP0 + LAND) / 2); g.add(water);
    const wall = std(0x1a1626, 0.8); for (const z of [GAP0, LAND]) { const w = new THREE.Mesh(new THREE.BoxGeometry(60, 6, 1), wall); w.position.set(0, -3, z + (z === GAP0 ? 0.5 : -0.5)); g.add(w); }
    // the ramp
    {
      const rg = new THREE.BufferGeometry(), n = 12, pos: number[] = [], idx: number[] = [];
      for (let i = 0; i <= n; i++) { const z = RZ + (i / n) * RL, y = ramp(0, z) + 0.05; pos.push(-3.2, y, z, 3.2, y, z); if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
      const chev = canvasTex(256, 256, (k) => { k.fillStyle = "#f2b705"; k.fillRect(0, 0, 256, 256); k.fillStyle = "#14110e"; for (let i = 0; i < 4; i++) { k.beginPath(); k.moveTo(40, 30 + i * 60); k.lineTo(128, 60 + i * 60); k.lineTo(216, 30 + i * 60); k.lineTo(216, 52 + i * 60); k.lineTo(128, 82 + i * 60); k.lineTo(40, 52 + i * 60); k.fill(); } });
      const uv: number[] = []; for (let i = 0; i <= n; i++) uv.push(0, i / n, 1, i / n); rg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      const rm = new THREE.Mesh(track(rg), std(0xffffff, 0.5, 0.1, { map: chev, emissive: 0xf2b705, emissiveIntensity: 0.15 })); rm.castShadow = rm.receiveShadow = true; g.add(rm);
      const side = new THREE.Mesh(new THREE.BoxGeometry(6.4, RH, 0.3), std(0x14110e)); side.position.set(0, RH / 2, RZ + RL); g.add(side);
    }
    // the conversion scale: neon gates over the landing strip
    for (let p = 10; p <= 60; p += 10) {
      const z = mark(p), target = p === 50, col = target ? 0x2bff88 : 0x3ad0ff;
      const gm = std(col, 0.4, 0, { emissive: col, emissiveIntensity: target ? 1.3 : 0.8 });
      const sw = target ? 0.35 : 0.18;
      for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(sw, target ? 7 : 4.5, sw), gm); post.position.set(sx * (halfW + 0.3), target ? 3.5 : 2.25, z); g.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, sw, sw), gm); bar.position.set(0, target ? 7 : 4.5, z); g.add(bar);
      const lb = label(target ? "TARGET 50%" : `${p}%`, target ? "#2bff88" : "#3ad0ff", "#04101a", target ? 1.6 : 1); lb.position.set(0, target ? 8.6 : 5.6, z); g.add(lb);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 0.25), gm); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, z); g.add(line);
    }
    { const lb = label("CONVERSION →", "#ff5fb0", "#14110e", 1.1); lb.position.set(-halfW - 2, 3, LAND + 3); g.add(lb); }
    // the city
    const winTex = canvasTex(128, 256, (k) => { k.fillStyle = "#0b0818"; k.fillRect(0, 0, 128, 256); for (let y = 6; y < 256; y += 14) for (let x = 6; x < 128; x += 14) { if (Math.random() < 0.55) { k.fillStyle = ["#ffd9a0", "#9fe8ff", "#ffb0e0", "#ffffff"][Math.floor(Math.random() * 4)]; k.globalAlpha = 0.5 + Math.random() * 0.5; k.fillRect(x, y, 8, 9); } } k.globalAlpha = 1; }, [2, 4]);
    const bm = std(0xffffff, 0.6, 0.2, { map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.1 });
    const br = rng(21);
    const bGeo = track(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const bIM = new THREE.InstancedMesh(bGeo, bm, low ? 70 : 140); let bk = 0; const m4 = new THREE.Matrix4();
    for (let i = 0; i < (low ? 70 : 140); i++) { const side = i % 2 ? 1 : -1, x = side * (halfW + 10 + br() * 50), z = -40 + br() * (len + 120), w = 8 + br() * 10, d = 8 + br() * 12, hh = 18 + br() * 70; m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, hh, d)); bIM.setMatrixAt(bk++, m4); }
    bIM.count = bk; g.add(bIM);
    // neon strips and street lamps
    const neons = [0xff5fb0, 0x3ad0ff, 0xc56bff];
    for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, z = i * 12 - 10, c = neons[i % 3]; const n = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3 + (i % 3), 0.15), std(c, 0.4, 0, { emissive: c, emissiveIntensity: 4 })); n.position.set(side * (halfW + 6.5), 4, z); g.add(n);
      if (i % 2 === 0) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5, 0.12), std(0x222230, 0.5, 0.5)); lamp.position.set(side * (halfW + 1), 2.5, z); g.add(lamp); const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.3), std(0xffffff, 0.4, 0, { emissive: 0xffe6c0, emissiveIntensity: 5 })); head.position.set(side * (halfW + 0.5), 5, z); g.add(head); } }
    // the boosters (found leaks) or ad screens
    const pads = [32, 62, 92], padObjs: THREE.Object3D[] = [];
    const padNames = ["FOLLOW UP FAST", "SALES DASHBOARD", "AUTO LEAD FLOW"];
    pads.forEach((z, k) => {
      if (leak) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), std(0xff7043, 0.3, 0, { emissive: 0xff7043, emissiveIntensity: 2.5 })); pad.position.set(0, 0.08, z); g.add(pad); padObjs.push(pad);
        for (let a = 0; a < 3; a++) { const ar = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 3), std(0xffffff, 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 2 })); ar.rotation.x = Math.PI / 2; ar.position.set(0, 0.2, z - 0.9 + a * 0.9); g.add(ar); }
        const lb = label(padNames[k], "#ff7043", "#14110e", 1.1, "a leak, fixed"); lb.position.set(0, 3.2, z); g.add(lb);
      } else {
        for (const sx of [-1, 1]) { const scr = canvasTex(256, 160, (c2) => { c2.fillStyle = "#ff5fb0"; c2.fillRect(0, 0, 256, 160); c2.fillStyle = "#fff"; c2.font = `56px ${STENCIL}`; c2.textAlign = "center"; c2.fillText("BUY NOW!", 128, 80); c2.font = `24px ${MONO}`; c2.fillText("more leads, same leak", 128, 124); });
          const b = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4), std(0xffffff, 0.5, 0, { map: scr, emissive: 0xffffff, emissiveMap: scr, emissiveIntensity: 1.4 })); b.position.set(sx * (halfW + 3), 6, z); b.rotation.y = -sx * 0.5; g.add(b); }
        padObjs.push(new THREE.Object3D());
      }
    });
    let conv = 10, hit = 0, launched = false, landed = false;
    hooks?.onScore({ conv });
    return {
      group: g, len, halfW, vmax: 13, acc: 7, dust: 0x7a6aa8,
      roadX: () => 0, h,
      aim: () => 0,
      tick(dt, t, c) {
        if (hit < pads.length && c.z >= pads[hit]) {
          if (leak) { conv = [23, 36, 50][hit]; c.boostT = 1.3; c.v += 3.5; shake = 0.15; hooks?.onPop(`${padNames[hit]} · CONVERSION ${conv}%`, "#ff7043"); }
          else { conv = Math.min(16, conv + 2); for (let k = 0; k < 40; k++) emit(c.x + (Math.random() - 0.5) * 8, 2 + Math.random() * 5, c.z + 4, (Math.random() - 0.5) * 8, Math.random() * 4, -4 - Math.random() * 6, 0xffffff); hooks?.onPop("MORE LEADS IN · MOST LEAK OUT", "#ff5fb0"); }
          hit++; hooks?.onScore({ conv });
        }
        if (!launched && c.z >= RZ + RL - 0.2) {
          launched = true;
          const th = 0.42, target = mark(conv), y0 = RH;
          let lo = 5, hi = 60;
          for (let i = 0; i < 40; i++) { const vz = (lo + hi) / 2, vy = vz * Math.tan(th), tt = (vy + Math.sqrt(vy * vy + 2 * GRAV * y0)) / GRAV; if (c.z + vz * tt < target) lo = vz; else hi = vz; }
          c.v = lo; c.vy = lo * Math.tan(th); c.air = true; c.yaw = 0; c.x = 0; hooks?.onPop(leak ? "LAUNCH!" : "LAUNCH…", "#ffca28");
        }
        if (launched && !c.air && !landed) { landed = true; hooks?.onPop(conv >= 50 ? `${conv}% · TARGET HIT` : `${conv}% · SAME LEAK, SHORT OF 50%`, conv >= 50 ? "#2bff88" : "#ffca28"); if (conv >= 50) burst(0, 4, c.z + 4, 120); c.v *= 0.6; }
        if (landed) { c.cap = Math.max(0, c.cap === 99 ? c.v : c.cap - 14 * dt); c.v = Math.min(c.v, c.cap); if (c.v < 0.3) return true; }
        void t; return false;
      },
      frame(t) { padObjs.forEach((p, k) => { const m = (p as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && "emissiveIntensity" in m) m.emissiveIntensity = k < hit ? 0.3 : 2 + Math.sin(t * 8) * 0.8; }); },
    };
  }

  /* ================================================================== 3 · OPS: the container yard */
  function opsCourse(choice: string): Course {
    const fire = choice === "fire", halfW = 6.6, len = 175, LANES = [-3.8, 0, 3.8];
    const PROB = [{ z: 32, l: 1, n: "LATE TRUCK" }, { z: 56, l: 0, n: "STOCK-OUT" }, { z: 80, l: 2, n: "BAD DATA" }, { z: 104, l: 1, n: "MISSED HANDOFF" }, { z: 128, l: 0, n: "FAILED PAYMENT" }, { z: 152, l: 2, n: "LATE TRUCK" }];
    const g = new THREE.Group();
    const conc = canvasTex(512, 512, (k) => { k.fillStyle = "#9a9b9c"; k.fillRect(0, 0, 512, 512); for (let i = 0; i < 6000; i++) { const v = 120 + Math.random() * 70; k.fillStyle = `rgba(${v},${v},${v},.35)`; k.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } k.strokeStyle = "rgba(60,60,60,.4)"; k.lineWidth = 3; k.strokeRect(0, 0, 512, 512); }, [40, 60]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 400), std(0xffffff, 0.95, 0, { map: conc })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, len / 2); ground.receiveShadow = true; g.add(ground);
    const lanes = canvasTex(256, 512, (k) => { k.fillStyle = "#3b3e44"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 2500; i++) { k.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; k.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
      k.fillStyle = "#f2b705"; k.fillRect(4, 0, 8, 512); k.fillRect(244, 0, 8, 512); k.fillStyle = "#f4efe2"; for (const x of [84, 168]) k.fillRect(x, 0, 5, 260); });
    g.add(road(len + 60, halfW, () => 0, () => 0, std(0xffffff, 0.8, 0, { map: lanes }), -40, 14));
    // container walls
    const corr = canvasTex(256, 128, (k) => { k.fillStyle = "#fff"; k.fillRect(0, 0, 256, 128); for (let x = 0; x < 256; x += 16) { k.fillStyle = "rgba(0,0,0,.22)"; k.fillRect(x, 0, 6, 128); } k.fillStyle = "rgba(0,0,0,.35)"; k.fillRect(0, 0, 256, 6); k.fillRect(0, 122, 256, 6); });
    const cm = std(0xffffff, 0.6, 0.35, { map: corr, vertexColors: false });
    const cGeo = track(new THREE.BoxGeometry(2.5, 2.6, 6.1).translate(0, 1.3, 0));
    const cIM = new THREE.InstancedMesh(cGeo, cm, 260), cr = rng(33), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let ck = 0;
    const palette = [0xc0392b, 0x1f6fb2, 0x2e8b57, 0xe67e22, 0x7d3c98, 0xd4ac0d, 0x95a5a6];
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let z = -30; z < len + 60; z += 6.4) {
      const stack = 1 + Math.floor(cr() * (row === 0 ? 2 : 4)); if (row === 0 && cr() < 0.25) continue;
      for (let s = 0; s < stack && ck < 260; s++) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cr() < 0.1 ? Math.PI / 2 : 0); m4.compose(new THREE.Vector3(side * (halfW + 3.5 + row * 3), s * 2.62, z), q, new THREE.Vector3(1, 1, 1)); cIM.setMatrixAt(ck, m4); cIM.setColorAt(ck, new THREE.Color(palette[Math.floor(cr() * palette.length)])); ck++; }
    }
    cIM.count = ck; cIM.castShadow = true; cIM.receiveShadow = true; g.add(cIM);
    // a gantry crane over the road
    const yel = std(0xf2b705, 0.5, 0.3);
    for (const zc of [70, 140]) { const cg = new THREE.Group(); cg.position.z = zc;
      for (const sx of [-1, 1]) for (const dz of [-3, 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 0.6), yel); leg.position.set(sx * (halfW + 1.5), 8, dz); leg.castShadow = true; cg.add(leg); }
      for (const dz of [-3, 3]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 4, 1, 0.8), yel); beam.position.set(0, 16, dz); beam.castShadow = true; cg.add(beam); }
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 7), std(0x333333, 0.5, 0.5)); trolley.position.set(-2, 15, 0); cg.add(trolley);
      g.add(cg); }
    // a warehouse with roller doors in the distance
    const wh = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 20), std(0xd8d4cc, 0.8)); wh.position.set(0, 7, len + 45); wh.castShadow = true; g.add(wh);
    const whSign = label("DISPATCH", "#f2b705", "#14110e", 3); whSign.position.set(0, 16, len + 34); g.add(whSign);
    g.add(arch(len, 0, halfW, "ORDERS OUT", "#f2b705", "#14110e"));
    // the problems: hazard blocks that drop into your lane
    const hazTex = canvasTex(256, 256, (k) => { k.fillStyle = "#f2b705"; k.fillRect(0, 0, 256, 256); k.fillStyle = "#14110e"; for (let i = -4; i < 8; i++) { k.beginPath(); k.moveTo(i * 64, 0); k.lineTo(i * 64 + 32, 0); k.lineTo(i * 64 + 288, 256); k.lineTo(i * 64 + 256, 256); k.fill(); } });
    const hzM = std(0xffffff, 0.5, 0.1, { map: hazTex });
    const crate = std(0xc8a06a, 0.85);
    const probs = PROB.map((p) => {
      const o = new THREE.Group(); o.position.set(LANES[p.l], 22, p.z);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.5), hzM); bar.position.y = 0.9; o.add(bar);
      for (const [cx, cy] of [[-0.9, 0.5], [0.9, 0.5], [0, 1.4]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crate); b.position.set(cx, cy + 0.0, 0.9); o.add(b); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), std(0xff3020, 0.3, 0, { emissive: 0xff2010, emissiveIntensity: 3 })); lamp.position.set(0, 1.6, 0); o.add(lamp);
      o.traverse((x) => { (x as THREE.Mesh).castShadow = true; });
      const lb = label(p.n, "#ef5350", "#ffffff", 0.95); lb.position.set(0, 3.2, 0); o.add(lb);
      g.add(o); return { ...p, o, lb, lamp, state: "wait" as "wait" | "drop" | "ahead" | "fixing" | "gone" | "dodged", y: 22, vy: 0 };
    });
    let sop = false, hits = 0, dodged = 0;
    const wrench = label("FIXING BY HAND", "#ef5350", "#ffffff", 0.6); wrench.visible = false; g.add(wrench);
    let fixing: (typeof probs)[number] | null = null;
    return {
      group: g, len, halfW, vmax: 15, acc: 10, dust: 0x8a8a8a,
      roadX: () => 0, h: () => 0,
      aim(c) {
        const nx = probs.find((p) => (p.state === "ahead" || p.state === "drop") && p.z > c.z - 1);
        if (!nx) return 0;
        if (fire || !sop) return LANES[nx.l];
        if (nx.z - c.z < 26) { const cur = LANES.reduce((a, b) => (Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a)); return cur === LANES[nx.l] ? (nx.l === 1 ? (c.x < 0 ? LANES[0] : LANES[2]) : LANES[1]) : cur; }
        return null;
      },
      tick(dt, t, c) {
        for (const p of probs) {
          if (p.state === "wait" && c.z > p.z - 30) { p.state = "drop"; }
          if (p.state === "drop") { p.vy -= 40 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.state = "ahead"; shake = Math.max(shake, 0.12); for (let k = 0; k < 14; k++) emit(p.o.position.x + (Math.random() - 0.5) * 3, 0.3, p.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 2, (Math.random() - 0.5) * 6, 0xbbbbbb); } p.o.position.y = p.y; }
          if ((p.state === "ahead" || p.state === "drop") && Math.abs(p.z - 1.2 - c.z) < 1.1 && Math.abs(p.o.position.x - c.x) < 2.3) {
            p.state = "fixing"; fixing = p; hits++; p.lb.visible = false; c.z = p.z - 2.4; c.v = 0;
            c.stopT = !fire && !sop ? 1.1 : 0.65;
            if (!fire && !sop) { sop = true; hooks?.onPop("FIXED ONCE · SOP WRITTEN · AUTOMATED", "#ffca28"); hooks?.onScore({ auto: true }); }
            else hooks?.onPop(`${p.n} · FIXING BY HAND`, "#ef5350");
            hooks?.onScore({ orders: hits }); shake = 0.25;
          } else if ((p.state === "ahead") && c.z > p.z + 1.5) { p.state = "dodged"; dodged++; hooks?.onPop(sop ? `${p.n} · AUTO-ROUTED` : `${p.n} · DODGED`, "#ffca28"); hooks?.onScore({ dodged }); p.lb.visible = false; p.lamp.visible = false; }
        }
        if (fixing && c.stopT <= 0) { fixing.state = "gone"; fixing.o.visible = false; fixing = null; c.v = Math.max(c.v, 9); }
        wrench.visible = !!fixing; if (fixing) { wrench.position.set(c.x, c.y + 2.6 + Math.sin(t * 10) * 0.08, c.z + 0.6); }
        hooks?.onScore({ prog: clamp(c.z / len, 0, 1) });
        if (c.z >= len) { burst(0, 3, len, 70); return true; }
        return false;
      },
      frame(t) { probs.forEach((p) => { (p.lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(t * 12) * 1.5; if (p.state === "fixing") p.o.rotation.z = Math.sin(t * 40) * 0.04; }); },
    };
  }

  /* ================================================================== 4 · FINANCE: the desert run */
  function desertCourse(choice: string): Course {
    const burnIt = choice === "burn", halfW = 3.8, len = 215;
    const roadX = (z: number) => 6 * Math.sin(z / 38) + 2.5 * Math.sin(z / 15);
    const prof = (z: number) => 1.4 * Math.sin(z / 19) + 0.7 * Math.sin(z / 7.5 + 1) + 1.4;
    const h = (x: number, z: number) => { const d = Math.max(0, Math.abs(x - roadX(z)) - halfW - 0.5); return prof(z) + d * 0.08 + (Math.sin(x * 0.06 + z * 0.02) * 0.5 + 0.5) * Math.min(d, 30) * 0.35 + fbm(x * 0.03, z * 0.03) * Math.min(d, 20) * 0.5; };
    const g = new THREE.Group();
    g.add(terrain(-180, 180, -60, len + 200, low ? 3 : 2, h, (x, z, y, c) => {
      const n = fbm(x * 0.08, z * 0.08); c.setRGB(0.86, 0.62, 0.38).lerp(new THREE.Color(0.95, 0.74, 0.5), n).lerp(new THREE.Color(0.7, 0.45, 0.28), smooth((y - prof(z) - 6) / 8) * 0.5);
      if (Math.abs(x - roadX(z)) < halfW + 1) c.lerp(new THREE.Color(0.62, 0.42, 0.26), 0.55);
    }, std(0xffffff, 1, 0, { vertexColors: true })));
    const track2 = canvasTex(256, 512, (k) => { k.fillStyle = "#9c6b40"; k.fillRect(0, 0, 256, 512); for (let i = 0; i < 3500; i++) { const v = 120 + Math.random() * 70; k.fillStyle = `rgba(${v},${v * 0.72},${v * 0.48},.45)`; k.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
      k.strokeStyle = "rgba(70,45,25,.45)"; k.lineWidth = 12; k.setLineDash([22, 14]); for (const x of [70, 186]) { k.beginPath(); k.moveTo(x, 0); k.lineTo(x, 512); k.stroke(); } });
    g.add(road(len + 80, halfW, roadX, (x, z) => prof(z), std(0xffffff, 0.95, 0, { map: track2 }), -40, 10));
    // mesas
    const mesaM = std(0xb8643a, 0.95, 0, { flatShading: true }), capM = std(0xd08050, 0.9, 0, { flatShading: true });
    const mr = rng(12);
    for (let i = 0; i < 12; i++) { const side = i % 2 ? 1 : -1, x = side * (70 + mr() * 160), z = mr() * (len + 260) - 20, hh = 25 + mr() * 45, r = 14 + mr() * 22;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 1.1, hh, 8, 3), mesaM); m.position.set(x, hh / 2 + h(x, z) - 3, z); m.castShadow = true; g.add(m);
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.86, 1.5, 8), capM); cp.position.set(x, h(x, z) - 3 + hh + 0.6, z); g.add(cp); }
    // cacti
    const cParts = [new THREE.CylinderGeometry(0.28, 0.32, 3.2, 8).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8).translate(0.55, 2.2, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).rotateZ(Math.PI / 2).translate(0.3, 1.7, 0), new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8).translate(-0.55, 1.9, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).rotateZ(Math.PI / 2).translate(-0.3, 1.45, 0)];
    const cactus = track(mergeGeometries(cParts)!);
    g.add(scatter(cactus, std(0x3f7a3a, 0.8), low ? 70 : 140, (r) => { const z = -30 + r() * (len + 120), side = r() < 0.5 ? -1 : 1, x = roadX(z) + side * (halfW + 3 + r() * 50); return [x, h(x, z) - 0.1, z, 0.7 + r() * 0.8, r() * 6]; }, 15));
    const rockG = track(new THREE.DodecahedronGeometry(1, 0));
    g.add(scatter(rockG, std(0x8a6a50, 0.95, 0, { flatShading: true }), 50, (r) => { const z = r() * len, side = r() < 0.5 ? -1 : 1, x = roadX(z) + side * (halfW + 1.5 + r() * 20); return [x, h(x, z), z, 0.3 + r() * 0.9, r() * 6]; }, 19));
    // the oasis and the goal
    const oz = len + 14, ox = roadX(oz);
    const water = new THREE.Mesh(new THREE.CircleGeometry(14, 40), std(0x2c8ab8, 0.08, 0.3, { emissive: 0x0a3050, emissiveIntensity: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.set(ox + 12, prof(oz) + 0.1, oz + 8); g.add(water);
    const palmLeaf = std(0x2e7d32, 0.7, 0, { side: THREE.DoubleSide }), palmTrunk = std(0x8a6a40, 0.9);
    for (const [px, pz] of [[-6, 0], [22, 2], [8, 20], [26, 14]]) { const pg2 = new THREE.Group(); pg2.position.set(ox + px, prof(oz), oz + pz);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), palmTrunk); tr.position.y = 3.5; tr.rotation.z = 0.12; pg2.add(tr);
      for (let k = 0; k < 7; k++) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4), palmLeaf); lf.position.set(0.4, 7, 0); lf.rotation.set(1.1, (k / 7) * Math.PI * 2, 0); lf.translateY(1.6); pg2.add(lf); }
      pg2.traverse((o) => { (o as THREE.Mesh).castShadow = true; }); g.add(pg2); }
    const goal = arch(len, prof(len), halfW, "₹2.5 CR · AUM", "#2bff88", "#04140a"); goal.position.x = roadX(len); g.add(goal);
    // fuel cans
    const canM = std(0xd32f2f, 0.4, 0.3), capM2 = std(0x222222, 0.5, 0.5);
    const cans = [28, 66, 104, 142, 180].map((z, k) => {
      const o = new THREE.Group(); const x = roadX(z) + (k % 2 ? 1.2 : -1.2); o.position.set(x, prof(z) + 0.1, z);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), canM); b.position.y = 0.6; o.add(b);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), capM2); sp.position.set(0.25, 1.2, 0); sp.rotation.z = -0.5; o.add(sp);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), std(burnIt ? 0x888888 : 0x66bb6a, 0.5, 0, { emissive: burnIt ? 0x000000 : 0x66bb6a, emissiveIntensity: 1.5, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; o.add(glow);
      o.traverse((x2) => { (x2 as THREE.Mesh).castShadow = true; });
      if (!burnIt) { const lb = label("+₹48L", "#66bb6a", "#08140a", 0.9); lb.position.y = 2.4; o.add(lb); }
      g.add(o); return { z, o, got: false };
    });
    let fuel = 30, aum = 10, dry = false;
    hooks?.onScore({ fuel, aum, prog: 0 });
    return {
      group: g, len, halfW, vmax: burnIt ? 23 : 15.5, acc: burnIt ? 11 : 8, dust: 0xd8b080,
      roadX, h: (x, z) => prof(z) + (Math.abs(x - roadX(z)) > halfW ? h(x, z) - prof(z) : 0),
      aim: (c) => { const nx = cans.find((k) => !k.got && k.z > c.z); return nx && nx.z - c.z < 20 && !burnIt ? nx.o.position.x : null; },
      tick(dt, t, c) {
        if (!dry) { fuel = Math.max(0, fuel - (burnIt ? 6 : 3.2) * dt); if (fuel <= 0) { dry = true; hooks?.onPop("OUT OF RUNWAY · TANK DRY", "#ef5350"); } }
        if (dry) { c.cap = Math.max(0, Math.min(c.cap, c.v) - 7 * dt); }
        for (const k of cans) if (!k.got && Math.abs(k.z - c.z) < 1.6 && (burnIt || Math.abs(k.o.position.x - c.x) < 2.2)) {
          k.got = true; k.o.visible = false;
          if (burnIt) hooks?.onPop("SPENT · NOTHING BANKED", "#ef5350");
          else { fuel = Math.min(100, fuel + 20); aum = Math.min(250, aum + 48); hooks?.onPop("+₹48L MANAGED · TANK UP", "#66bb6a"); for (let i = 0; i < 20; i++) emit(c.x, c.y + 1, c.z + 1, (Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5, 0x66ff88); }
        }
        hooks?.onScore({ fuel, aum, prog: clamp(c.z / len, 0, 1) });
        if (c.z >= len) { hooks?.onPop("₹2.5 CR IN ASSETS · ARRIVED", "#2bff88"); burst(roadX(len), prof(len) + 4, len, 110); return true; }
        if (dry && c.v < 0.2) return true;
        void t; return false;
      },
      frame(t) { cans.forEach((k) => { k.o.rotation.y = t * 1.5; k.o.position.y = prof(k.z) + 0.1 + Math.sin(t * 3 + k.z) * 0.12; }); },
    };
  }

  return {
    preview(k) { mode = "preview"; running = false; hooks = null; load(k, k === "road" ? "mountain" : k === "funnel" ? "leak" : k === "orders" ? "auto" : "aum"); camera.fov = 52; camera.updateProjectionMatrix(); },
    start(k, choice, h) {
      hooks = h; load(k, choice); mode = "run"; running = true; keys.clear();
      h.onAuto?.(auto);
      // start the chase camera from the preview position for a smooth swoop in
      camPos.copy(camera.position);
    },
    setAuto(on) { auto = on; hooks?.onAuto?.(on); },
    setSteer(v) { touchSteer = v; if (v !== 0 && auto && running) { auto = false; hooks?.onAuto?.(false); } },
    setPaused(p) { paused = p; },
    dispose() { alive = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("resize", onResize); clear(); envTex?.dispose(); pmrem.dispose(); composer?.dispose(); renderer.dispose(); renderer.domElement.remove(); if ((window as unknown as Record<string, unknown>).__game === dbg) delete (window as unknown as Record<string, unknown>).__game; },
  };
}
