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
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { Buggy } from "./buggyTypes";
import { A } from "../data";

export type GameKind = "road" | "funnel" | "orders" | "runway";
export interface GameScore { road?: string; conv: number; orders: number; auto: boolean; fuel: number; aum: number; rivals: number; dodged: number; prog: number }
export interface LaneRow { id: string; label: string; me: boolean; text: string; color: string; t?: number }
export interface GameHooks { onPop(t: string, c: string): void; onScore(p: Partial<GameScore>): void; onTel(kmh: number, prog: number): void; onDone(): void; onAuto?(on: boolean): void; onCompare?(rows: LaneRow[]): void }
export interface ForkOption { id: string; label: string; sub: string }
export interface ArenaAPI {
  /** drive up to a fork: one lane per option, signed overhead, barriers down until openGates(); steering into a lane is the choice */
  decide(kind: GameKind, options: ForkOption[], onChoose: (id: string) => void): void;
  openGates(): void;
  /** choose a lane without the keyboard (index into options) */
  pick(i: number): void;
  /** build a course's world with its best road and slowly orbit the buggy (behind the decision card) */
  preview(kind: GameKind, options: ForkOption[]): void;
  start(kind: GameKind, choice: string, hooks: GameHooks): void;
  setAuto(on: boolean): void;
  /** touch steering, -1..1 */
  setSteer(v: number): void;
  setPaused(p: boolean): void;
  /** chase → driver's seat → wide; returns the new view */
  cycleView(): "chase" | "driver" | "wide";
  onViewChange(f: (v: string) => void): void;
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
const cr = (lakh: number) => (lakh >= 100 ? `₹${(lakh / 100).toFixed(1)} Cr` : `₹${Math.round(lakh)}L`);
const MONO = '"JetBrains Mono", ui-monospace, monospace', STENCIL = '"Saira Stencil One", Impact, sans-serif';

/* -------------------------------------------------------------------- the four skies */
interface Theme { top: number; mid: number; hor: number; sun: number; sunDir: [number, number, number]; fog: number; fogN: number; fogF: number; hemiS: number; hemiG: number; hemiI: number; key: number; keyI: number; exp: number; bloom: number; stars: boolean }
const THEMES: Record<GameKind, Theme> = {
  road: { top: 0x3a5aa8, mid: 0xb7a6d8, hor: 0xffd0a0, sun: 0xffe2b0, sunDir: [-0.35, 0.16, 0.92], fog: 0xc9c2cf, fogN: 70, fogF: 430, hemiS: 0xdde4ff, hemiG: 0x4a5a3a, hemiI: 1.0, key: 0xffe0b8, keyI: 2.6, exp: 0.88, bloom: 0.25, stars: false },
  funnel: { top: 0x03051a, mid: 0x1a1450, hor: 0x5a2a8a, sun: 0xff5fb0, sunDir: [0.0, 0.08, 1.0], fog: 0x1a1430, fogN: 40, fogF: 300, hemiS: 0x6a70ff, hemiG: 0x180c28, hemiI: 0.7, key: 0x9ab0ff, keyI: 1.1, exp: 0.95, bloom: 0.4, stars: true },
  orders: { top: 0x2a6fd8, mid: 0x7fb4f0, hor: 0xdcecff, sun: 0xffffff, sunDir: [0.45, 0.75, 0.35], fog: 0xbfd2e6, fogN: 90, fogF: 480, hemiS: 0xe4f0ff, hemiG: 0x6a6a60, hemiI: 1.35, key: 0xfff6e6, keyI: 3.4, exp: 1.0, bloom: 0.12, stars: false },
  runway: { top: 0x3a2a78, mid: 0xc4508a, hor: 0xffa060, sun: 0xffc070, sunDir: [-0.2, 0.1, 0.97], fog: 0xd99a80, fogN: 80, fogF: 480, hemiS: 0xffc8a8, hemiG: 0x8a5a3a, hemiI: 1.2, key: 0xffb070, keyI: 3.0, exp: 1.05, bloom: 0.3, stars: false },
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
  /** the lateral limits for this car right now (its lane), or null for the road's own edges */
  bounds?: (car: Car) => [number, number] | null;
  laneOf?: () => { vmax: number; acc: number; crawl?: (c: Car) => number; dust: number } | null;
}

/* ==================================================================== the arena */
export function createArena(opts: { container: HTMLElement; createBuggy: () => Buggy; quality: "high" | "low" }): ArenaAPI {
  const { container } = opts, low = opts.quality === "low";
  const W = () => container.clientWidth || window.innerWidth, H = () => container.clientHeight || window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 50, 300);
  const camera = new THREE.PerspectiveCamera(58, W() / H(), 0.05, 2000);
  const composer = low ? null : new EffectComposer(renderer, new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) }));
  let bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null;
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), 0.4, 0.5, 0.82); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // the racing-game finish: radial speed blur, a touch of contrast and saturation, and a vignette
    grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uVig: { value: 0.32 }, uSat: { value: 1.12 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlur, uVig, uSat; varying vec2 vUv;
        void main(){ vec3 col = texture2D(tDiffuse, vUv).rgb; float l = dot(col, vec3(.299,.587,.114)); col = mix(vec3(l), col, uSat); col = (col - .5) * 1.06 + .5;
          col *= 1. - uVig * smoothstep(.35, .95, length((vUv - .5) * vec2(1.25, 1.)));
          gl_FragColor = vec4(col, 1.); }`,
    });
    composer.addPass(grade);
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
  const skies = new Map<GameKind, Promise<{ bg: THREE.Texture; env: THREE.Texture }>>();
  const SKY_I: Record<GameKind, number> = { road: 0.5, funnel: 0.3, orders: 0.85, runway: 0.75 };
  function loadSky(k: GameKind) {
    if (!skies.has(k)) skies.set(k, new Promise((res, rej) => new RGBELoader().load(A(`drive/sky-${k}.hdr`), (t) => { t.mapping = THREE.EquirectangularReflectionMapping; res({ bg: t, env: pmrem.fromEquirectangular(t).texture }); }, undefined, rej)));
    return skies.get(k)!;
  }
  function applyTheme(k: GameKind) {
    loadSky(k).then(({ bg, env }) => { if (kind !== k || !alive) return; scene.background = bg; scene.environment = env; scene.backgroundIntensity = SKY_I[k]; sky.visible = false; (scene as unknown as { environmentIntensity: number }).environmentIntensity = k === "funnel" ? 0.3 : 0.75; }).catch(() => {});
    sky.visible = true;
    const th = THEMES[k], u = skyMat.uniforms;
    u.top.value.set(th.top); u.mid.value.set(th.mid); u.hor.value.set(th.hor); u.sun.value.set(th.sun); u.sunDir.value.set(...th.sunDir).normalize(); u.stars.value = th.stars ? 1 : 0;
    const f = scene.fog as THREE.Fog; f.color.set(th.fog); f.near = th.fogN; f.far = th.fogF; scene.background = null;
    hemi.color.set(th.hemiS); hemi.groundColor.set(th.hemiG); hemi.intensity = th.hemiI;
    key.color.set(th.key); key.intensity = th.keyI; renderer.toneMappingExposure = th.exp;
    if (bloom) { bloom.strength = th.bloom; bloom.enabled = k === "funnel"; }
    // reflections for the buggy's metal, taken from this sky
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat));
    const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: th.hemiG })); g.rotation.x = -Math.PI / 2; g.position.y = -2; envScene.add(g);
    envTex?.dispose(); envTex = pmrem.fromScene(envScene, 0, 0.1, 200).texture; if (sky.visible) scene.environment = envTex;
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = k === "funnel" ? 0.9 : 0.6;
  }

  /* --- the buggy --- */
  const buggy = opts.createBuggy();
  const carG = new THREE.Group(); carG.rotation.order = "YXZ"; carG.add(buggy.root); scene.add(carG);
  let helmet: THREE.Object3D | null = null; buggy.root.traverse((o) => { if (!helmet && /helmet|driver|head/i.test(o.name)) helmet = o; });
  buggy.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.receiveShadow = true; } });
  // nitro: two exhaust flames and a warm light, shown while boosting
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flames: THREE.Mesh[] = [];
  for (const sx of [-0.18, 0.18]) for (const [m, r, l] of [[flameMat, 0.13, 0.9], [flameCore, 0.06, 0.5]] as const) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, l, 10, 1, true), m); f.rotation.x = -Math.PI / 2; f.position.set(sx, 0.55, -1.05 - l / 2); f.visible = false; carG.add(f); flames.push(f);
  }
  const nitroL = new THREE.PointLight(0xff8a30, 0, 8, 2); nitroL.position.set(0, 0.6, -1.4); carG.add(nitroL);
  // spinning-wheel blur discs (the wheels are part of the merged chassis)
  const spinTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!; g.translate(64, 64);
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, "rgba(200,200,200,.0)"); gr.addColorStop(1, "rgba(220,220,220,.5)"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 58, -0.25, 0.25); g.fill(); }
    g.strokeStyle = "rgba(20,20,20,.7)"; g.lineWidth = 14; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); })();
  const spinMat = new THREE.MeshBasicMaterial({ map: spinTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const spins: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) for (const z of [0.78, -0.8]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), spinMat); d.position.set(sx * 0.77, 0.29, z); d.rotation.y = Math.PI / 2; carG.add(d); spins.push(d); }
  // speed lines streaming past the camera
  const SL = 0, slPos = new Float32Array(SL * 6), slSeed = new Float32Array(SL * 3);
  for (let i = 0; i < SL; i++) { const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 3.5; slSeed.set([Math.cos(a) * r, Math.sin(a) * r * 0.7, Math.random()], i * 3); }
  const slGeo = new THREE.BufferGeometry(); slGeo.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
  const slMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const speedLines = new THREE.LineSegments(slGeo, slMat); speedLines.frustumCulled = false; camera.add(speedLines); scene.add(camera);
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
  const texL = new THREE.TextureLoader(), pbrTex = new Map<string, [THREE.Texture, THREE.Texture]>();
  function pbrMaps(name: string): [THREE.Texture, THREE.Texture] {
    if (!pbrTex.has(name)) {
      const d = texL.load(A(`drive/${name}-diff.webp`)), n = texL.load(A(`drive/${name}-nor.webp`));
      d.colorSpace = THREE.SRGBColorSpace; for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
      pbrTex.set(name, [d, n]);
    }
    return pbrTex.get(name)!;
  }
  /** a real-world surface: asphalt, forest floor, sand, mud, dirt, concrete or rock */
  const pbr = (name: string, color = 0xffffff, rough = 0.9, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) => { const [map, normalMap] = pbrMaps(name); return std(color, rough, metal, { map, normalMap, normalScale: new THREE.Vector2(1, 1), ...extra }); };
  /** painted lines on a road: a thin ribbon at a lateral offset, optionally dashed */
  function stripe(g: THREE.Group, len: number, roadX: (z: number) => number, h: (x: number, z: number) => number, off: number, w: number, color: string, dashed = false, z0 = -40, glow = 0) {
    const tex = canvasTex(8, 64, (c) => { c.fillStyle = color; if (dashed) c.fillRect(0, 0, 8, 30); else c.fillRect(0, 0, 8, 64); }, [1, 1]);
    const m = std(0xffffff, 0.6, 0, { map: tex, transparent: dashed, alphaTest: dashed ? 0.5 : 0, emissive: glow ? new THREE.Color(color) : 0x000000, emissiveIntensity: glow, polygonOffset: true, polygonOffsetFactor: -2 });
    if (dashed) { const a = canvasTex(8, 64, (c) => { c.fillStyle = "#fff"; c.fillRect(0, 0, 8, 30); }, [1, 1]); m.alphaMap = a; }
    const r = road(len, w / 2, (z) => roadX(z) + off, (x, z) => h(x, z) + 0.012, m, z0, 6); r.receiveShadow = true; g.add(r);
  }

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
  /* --- my brands along the road: race-style hoardings with real logos, and billboards with my photo --- */
  const imgCache = new Map<string, Promise<HTMLImageElement>>();
  const loadImg = (p: string) => { if (!imgCache.has(p)) imgCache.set(p, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = A(p); })); return imgCache.get(p)!; };
  function liveTex(w: number, h: number, imgs: string[], draw: (g: CanvasRenderingContext2D, im: (HTMLImageElement | null)[]) => void) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; track(t);
    draw(g, imgs.map(() => null));
    Promise.all(imgs.map((p) => loadImg(p).catch(() => null))).then((ims) => { draw(g, ims); t.needsUpdate = true; });
    return t;
  }
  const fitImg = (g: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number, cover = false) => {
    const s = cover ? Math.max(w / im.width, h / im.height) : Math.min(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); g.restore();
  };
  const LOGOS = ["rabbit-invest", "myntra", "wipro", "masters-union", "vit", "ai-analytics-wing"];
  const NAMES: Record<string, string> = { "rabbit-invest": "RABBIT INVEST", myntra: "MYNTRA", wipro: "WIPRO", "masters-union": "MASTERS' UNION", vit: "VIT VELLORE", "ai-analytics-wing": "AI & ANALYTICS WING" };
  const logoMats = new Map<string, THREE.Material>();
  function logoMat(name: string, accent: string) {
    const k = name + accent; if (logoMats.has(k)) return logoMats.get(k)!;
    const t = liveTex(512, 144, [`logos/${name}.png`], (g, [im]) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 144); g.fillStyle = accent; g.fillRect(0, 0, 512, 10); g.fillRect(0, 134, 512, 10);
      if (im) fitImg(g, im, 22, 22, 150, 100); g.fillStyle = "#14110e"; g.font = `700 34px ${MONO}`; g.textBaseline = "middle"; g.fillText(NAMES[name], im ? 190 : 30, 74);
    });
    const m = std(0xffffff, 0.55, 0, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: kind === "funnel" ? 0.55 : 0.08 }); logoMats.set(k, m); return m;
  }
  /** a line of sponsor boards along both road edges, like a race circuit */
  /** each vertical's boards: [logo file or "#NAME" for a project without a logo, the fact] */
  const STORY: Record<GameKind, [string, string][]> = {
    road: [["rabbit-invest", "B2C → B2B2C, PROPOSED"], ["masters-union", "THE KEN · ROUND 2"], ["#IKSHANA Z INC", "DELAWARE CALL ADOPTED"], ["rabbit-invest", "COST vs REVENUE MODEL"], ["masters-union", "VANTAGE · GAMBIT CASES"], ["rabbit-invest", "COMPETITOR TEARDOWN"]],
    funnel: [["rabbit-invest", "CONVERSION 10% → 50%"], ["myntra", "FUNNEL → CEO-LEVEL CALL"], ["#DECCO STORE", "₹3L SALES IN 30 DAYS"], ["rabbit-invest", "LEADS ON AUTOPILOT"], ["#DECCO STORE", "I SOLD AT THE STALL"], ["myntra", "DATA ANALYST INTERN"]],
    orders: [["rabbit-invest", "80% MANUAL WORK AUTOMATED"], ["wipro", "CRM FOR 100+ ACCOUNTS"], ["ai-analytics-wing", "RECRUITMENT WORKBOOK"], ["rabbit-invest", "OPS BUILT FROM ZERO"], ["wipro", "+40% PIPELINE VISIBILITY"], ["rabbit-invest", "SENIOR ASSOCIATE → LEAD"]],
    runway: [["rabbit-invest", "₹2.5 CR AUM, YEAR ONE"], ["rabbit-invest", "FUND ENGINE IN 2–3 DAYS"], ["#BOARDIQ", "AI FOR INVESTORS · LIVE"], ["rabbit-invest", "MVP WITH THE FOUNDER"], ["#KINFOLIO", "BUSINESS MODEL"], ["rabbit-invest", "EXCHANGE · KYC · APIs"]],
  };
  const factMats = new Map<string, THREE.Material>();
  function factMat(logo: string, fact: string, accent: string) {
    const k = logo + fact + accent; if (factMats.has(k)) return factMats.get(k)!;
    const named = logo.startsWith("#");
    const t = liveTex(768, 200, named ? [] : [`logos/${logo}.png`], (g, [im]) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 768, 200); g.fillStyle = accent; g.fillRect(0, 0, 768, 12); g.fillRect(0, 188, 768, 12);
      let x = 28;
      if (named) { g.fillStyle = "#14110e"; g.font = `700 30px ${MONO}`; g.textBaseline = "middle"; const w = g.measureText(logo.slice(1)).width + 30; g.beginPath(); g.roundRect(24, 66, w, 68, 12); g.fill(); g.fillStyle = "#ffffff"; g.fillText(logo.slice(1), 39, 101); x = 24 + w + 22; }
      else if (im) { fitImg(g, im, 24, 30, 170, 140); x = 214; }
      g.fillStyle = "#14110e"; g.textBaseline = "middle"; let fs = 46; g.font = `${fs}px ${STENCIL}`; while (g.measureText(fact).width > 768 - x - 24 && fs > 24) { fs -= 2; g.font = `${fs}px ${STENCIL}`; }
      g.fillText(fact, x, 104);
    });
    const m = std(0xffffff, 0.55, 0, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: kind === "funnel" ? 0.55 : 0.08 }); factMats.set(k, m); return m;
  }
  function hoardings(g: THREE.Group, len: number, halfW: number, roadX: (z: number) => number, h: (x: number, z: number) => number, accent: string, skip: (z: number) => boolean = () => false, every = 11) {
    const back = std(0x1b1d22, 0.6, 0.4), boardG = new THREE.BoxGeometry(3.8, 1.0, 0.08), postG = new THREE.BoxGeometry(0.08, 0.6, 0.08);
    const story = STORY[kind];
    let k = 0;
    for (let z = 6; z < len; z += every) for (const sx of [-1, 1]) {
      if (skip(z)) continue;
      const x = roadX(z) + sx * (halfW + 0.7), y = h(x, z), yaw = Math.atan2(roadX(z + 1) - roadX(z - 1), 2);
      const [lg, fact] = story[(k++ + (sx > 0 ? 3 : 0)) % story.length];
      const fm = factMat(lg, fact, accent);
      const b = new THREE.Mesh(boardG, [back, back, back, back, fm, fm]);
      b.position.set(x, y + 0.95, z); b.rotation.y = yaw + sx * (Math.PI / 2 - 0.35); b.castShadow = true; g.add(b);
      for (const px of [-1.4, 1.4]) { const p = new THREE.Mesh(postG, back); p.position.set(px, -0.75, 0); b.add(p); }
    }
  }
  /** a big billboard: my photo, a headline and the company behind it */
  function billboard(g: THREE.Group, x: number, y: number, z: number, yaw: number, photo: string, logo: string, head: string, sub: string, accent: string, scale = 1) {
    const src = photo.includes("/") ? photo : `me/${photo}.webp`, kicker = logo.startsWith("#") ? logo.slice(1) : "";
    const t = liveTex(1280, 560, kicker ? [src] : [src, `logos/${logo}.png`], (k, [ph, lg]) => {
      k.fillStyle = "#0d0f13"; k.fillRect(0, 0, 1280, 560);
      if (ph) { fitImg(k, ph, 0, 0, 560, 560, true); const fade = k.createLinearGradient(380, 0, 560, 0); fade.addColorStop(0, "rgba(13,15,19,0)"); fade.addColorStop(1, "rgba(13,15,19,1)"); k.fillStyle = fade; k.fillRect(380, 0, 180, 560); }
      const glow = k.createRadialGradient(1100, 80, 10, 1100, 80, 700); glow.addColorStop(0, accent + "40"); glow.addColorStop(1, "rgba(0,0,0,0)"); k.fillStyle = glow; k.fillRect(560, 0, 720, 560);
      k.textBaseline = "alphabetic";
      if (kicker) { k.fillStyle = accent; k.font = `700 28px ${MONO}`; k.fillText(kicker, 600, 96); }
      else if (lg) { k.fillStyle = "#ffffff"; k.beginPath(); k.roundRect(600, 44, 240, 96, 14); k.fill(); fitImg(k, lg, 614, 52, 212, 80); }
      let fs = 120; k.font = `${fs}px ${STENCIL}`; while (k.measureText(head).width > 640 && fs > 64) { fs -= 6; k.font = `${fs}px ${STENCIL}`; }
      k.fillStyle = "#ffffff"; k.fillText(head, 600, 280);
      k.fillStyle = accent; k.fillRect(600, 312, 120, 8);
      k.fillStyle = "rgba(239,233,220,.88)"; k.font = `500 36px ${MONO}`; sub.split("|").forEach((l, i) => k.fillText(l, 600, 384 + i * 50));
      k.fillStyle = "rgba(255,255,255,.45)"; k.font = `700 22px ${MONO}`; k.fillText("SUMAHAR PELLURI", 600, 520);
    });
    const bb = new THREE.Group(); bb.position.set(x, y, z); bb.rotation.y = yaw; bb.scale.setScalar(scale);
    const steelM = std(0x1b1e24, 0.35, 0.8), W2 = 11.5, H2 = 5.0;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W2, H2), std(0xffffff, 0.45, 0, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: kind === "funnel" ? 0.85 : 0.25 }));
    face.position.set(0, 7, 0.17); bb.add(face);
    const box = new THREE.Mesh(new THREE.BoxGeometry(W2 + 0.5, H2 + 0.5, 0.3), steelM); box.position.y = 7; box.castShadow = true; bb.add(box);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(W2 + 0.5, 0.1, 0.34), std(0xffffff, 0.3, 0, { emissive: new THREE.Color(accent), emissiveIntensity: 2.2 })); trim.position.set(0, 7 - H2 / 2 - 0.25, 0.02); bb.add(trim);
    // a single sturdy pole and two lamp arms lighting the face
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.6, 16), steelM); pole.position.y = 2.3; pole.castShadow = true; bb.add(pole);
    for (const px of [-3.4, 3.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.3), steelM); arm.position.set(px, 9.75, 0.6); bb.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), std(0xffffff, 0.3, 0, { emissive: 0xfff2d6, emissiveIntensity: 3 })); lamp.position.set(px, 9.7, 1.25); lamp.rotation.x = 0.6; bb.add(lamp);
    }
    g.add(bb); return bb;
  }

  /** a rival's car: a sleek coupe in its brand colour with its name on the back and roof */
  const RIVALS: [string, number][] = [["GROWW", 0x00b386], ["ZERODHA", 0x387ed1], ["UPSTOX", 0x5a2e8a], ["PAYTM MONEY", 0x00baf2], ["INDMONEY", 0x2b2b2b], ["ET MONEY", 0xe8483f], ["KUVERA", 0x1e88e5], ["COIN", 0xff8f00]];
  function rivalCar(i: number) {
    const [name, col] = RIVALS[i % RIVALS.length];
    const rv = new THREE.Group();
    const paint = track(new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.06 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.3), paint); body.position.y = 0.62; rv.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), paint); nose.position.set(0, 0.42, 2.4); rv.add(nose);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.9), track(new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, roughness: 0.04, metalness: 0.2, clearcoat: 1 }))); cab.position.set(0, 1.18, -0.3); rv.add(cab);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.45), std(0x111111, 0.4, 0.4)); wing.position.set(0, 1.25, -2.0); rv.add(wing);
    for (const sx of [-0.8, 0.8]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.1), std(0x111111)); st.position.set(sx, 1.05, -2.0); rv.add(st); }
    const tyre = std(0x111111, 0.8);
    const rim = std(0xc8ccd2, 0.25, 0.9);
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20), tyre); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.4, wz); rv.add(w); const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 16), rim); rr.rotation.z = Math.PI / 2; rr.position.set(wx, 0.4, wz); rv.add(rr); }
    for (const sx of [-0.6, 0.6]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), std(0xffffff, 0.2, 0, { emissive: 0xfff4dd, emissiveIntensity: 2 })); hl.position.set(sx, 0.55, 2.9); rv.add(hl); }
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.05), std(0xff2020, 0.5, 0, { emissive: 0xff2020, emissiveIntensity: 2.5 })); tl.position.set(0, 0.8, -2.16); rv.add(tl);
    const plate = canvasTex(512, 128, (c) => { c.fillStyle = "#" + col.toString(16).padStart(6, "0"); c.fillRect(0, 0, 512, 128); c.fillStyle = "#ffffff"; c.font = `86px ${STENCIL}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(name, 256, 70); });
    const pm = std(0xffffff, 0.4, 0, { map: plate, emissive: 0xffffff, emissiveMap: plate, emissiveIntensity: 0.35 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), pm); back.position.set(0, 0.58, -2.17); back.rotation.y = Math.PI; rv.add(back);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), pm); roof.position.set(0, 1.47, -0.3); roof.rotation.x = -Math.PI / 2; roof.rotation.z = Math.PI; rv.add(roof);
    for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), pm); side.position.set(sx * 0.96, 0.62, 0); side.rotation.y = sx * Math.PI / 2; rv.add(side); }
    rv.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    return { g: rv, name };
  }

  /** a live product of mine, playing on a skyscraper screen */
  function megaScreen(g: THREE.Group, x: number, z: number, yaw: number, img: string, title: string, sub: string, accent: string) {
    const t = liveTex(1024, 640, [img], (k, [im]) => { k.fillStyle = "#05030c"; k.fillRect(0, 0, 1024, 640); if (im) fitImg(k, im, 0, 0, 1024, 520, true);
      k.fillStyle = accent; k.fillRect(0, 520, 1024, 120); k.fillStyle = "#05030c"; k.font = `64px ${STENCIL}`; k.textBaseline = "middle"; k.fillText(title, 30, 566); k.font = `500 28px ${MONO}`; k.fillText(sub, 30, 614); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), std(0xffffff, 0.4, 0, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 }));
    m.position.set(x, 13, z); m.rotation.y = yaw; g.add(m);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.6, 10.6, 0.4), std(0x0b0818, 0.5, 0.5)); frame.position.set(x, 13, z); frame.rotation.y = yaw; frame.translateZ(-0.25); g.add(frame);
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
    for (let k = 0; k < 5; k++) { const c = new THREE.ConeGeometry(1.8 - k * 0.3, 2.0, 11, 1, false); c.translate(0, 1.7 + k * 0.85, 0); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 1.6 + k * 0.85) { p.setX(i, p.getX(i) * (0.85 + Math.random() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + Math.random() * 0.3)); p.setY(i, y - Math.random() * 0.25); } } c.computeVertexNormals(); parts.push(c); }
    const cols = [0x3e2c1e, 0x17291b, 0x1b3020, 0x203824, 0x24402a, 0x2a4830];
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
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 9, uv.getY(i) * (z1 - z0) / 9);
    const m = new THREE.Mesh(track(geo), mat); m.receiveShadow = true; return m;
  }
  /** the driving surface: a ribbon that follows the road's line and height */
  function road(len: number, halfW: number, roadX: (z: number) => number, h: (x: number, z: number) => number, mat: THREE.Material, z0 = -20, vRepeat = 8) {
    const n = Math.ceil((len - z0) / 1.0), pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 + i, cx = roadX(z);
      for (const sx of [-1, 1]) { const x = cx + sx * halfW; pos.push(x, h(x, z) + 0.04, z); uv.push(sx < 0 ? 0 : (halfW * 2) / vRepeat, (z - z0) / vRepeat); }
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(track(geo), mat); m.receiveShadow = true; return m;
  }

  /* --- effects: dust/spray, confetti --- */
  const DN = low ? 90 : 160;
  const dPos = new Float32Array(DN * 3), dVel = new Float32Array(DN * 3), dAge = new Float32Array(DN).fill(9), dCol = new Float32Array(DN * 3);
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute("color", new THREE.BufferAttribute(dCol, 3));
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.7, map: puffTex, vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false })); dust.frustumCulled = false; scene.add(dust);
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
  let touchSteer = 0, auto = false, hooks: GameHooks | null = null, onView: ((v: string) => void) | null = null;
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const t = e.target as HTMLElement | null; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    if (down && k === "c" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) { const v = view === "chase" ? "driver" : view === "driver" ? "wide" : "chase"; view = v; onView?.(v); return; }
    if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(k)) return;
    if (down && mode === "decide") { forkKey(k); e.preventDefault(); return; }
    if (down) { keys.add(k); if (running && auto) { auto = false; hooks?.onAuto?.(false); } } else keys.delete(k);
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  /* --- state --- */
  let course: Course | null = null, kind: GameKind = "road";
  const car: Car = { x: 0, y: 0, z: 0, yaw: 0, v: 0, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0, pitch: 0, roll: 0 };
  let running = false, finished = false, endT = -1, t = 0, paused = false, mode: "preview" | "decide" | "run" = "preview", orbit = 0, introT = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  /* ================================================================== the parallel world
   * One world per vertical. You drive up to a fork; each option is its own lane, side by side.
   * You steer into one; the buggies on the other lanes run the roads you didn't pick, at the same time,
   * so you see what each road gains and loses. */
  type Lane = {
    id: string; label: string; x: number; vmax: number; acc: number; dust: number;
    car: Car; obj: THREE.Object3D | null; me: boolean; done: boolean; doneT: number;
    tag: { c: HTMLCanvasElement; t: THREE.CanvasTexture; s: THREE.Sprite } | null; last: string;
    crawl?: (c: Car) => number; aim?: (c: Car) => number | null; tick?: (dt: number, c: Car, L: Lane) => void; stat: () => [string, string];
    st: Record<string, number>;
  };
  let fork: { opts: ForkOption[]; xs: number[]; laneW: number; sel: number; open: boolean; chosen: boolean; onChoose: (id: string) => void; arms: THREE.Object3D[]; signs: THREE.MeshStandardMaterial[]; openT: number } | null = null;
  let lanes: Lane[] = [], goT = -1;
  const GATE = 22;
  function forkKey(k: string) {
    if (!fork || !fork.open || fork.chosen) return;
    const n = fork.opts.length;
    if (k === "arrowleft" || k === "a") fork.sel = fork.sel < 0 ? 0 : Math.max(0, fork.sel - 1);
    else if (k === "arrowright" || k === "d") fork.sel = fork.sel < 0 ? n - 1 : Math.min(n - 1, fork.sel + 1);
    else if ((k === "arrowup" || k === "w") && n === 3) fork.sel = fork.sel < 0 ? 1 : fork.sel;
  }
  const EDGE: Record<GameKind, string> = { road: "#f4efe2", funnel: "#ff5fb0", orders: "#f2b705", runway: "#f4efe2" };
  const KEYS3 = ["←", "↑", "→"], KEYS2 = ["←", "→"];
  const ghosts: Buggy[] = [opts.createBuggy(), opts.createBuggy()];
  const ghostG = ghosts.map((b) => { const g = new THREE.Group(); g.rotation.order = "YXZ"; g.add(b.root); g.visible = false; scene.add(g); return g; });
  function laneTag(L: Lane, color: string) {
    const c = document.createElement("canvas"); c.width = 640; c.height = 150;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false })); s.scale.set(3.0, 0.7, 1); s.renderOrder = 9;
    L.tag = { c, t, s }; scene.add(s); void color;
  }
  function drawTag(L: Lane) {
    if (!L.tag) return; const [txt, col] = L.stat(); const key = txt + col; if (key === L.last) return; L.last = key;
    const g = L.tag.c.getContext("2d")!; g.clearRect(0, 0, 640, 150);
    g.fillStyle = "rgba(10,10,14,.82)"; g.beginPath(); g.roundRect(4, 4, 632, 142, 26); g.fill(); g.fillStyle = col; g.fillRect(4, 4, 14, 142);
    g.fillStyle = "#ffffff"; g.font = `700 34px ${MONO}`; g.textBaseline = "middle"; g.fillText(L.label.toUpperCase(), 36, 46);
    g.fillStyle = col; g.font = `52px ${STENCIL}`; g.fillText(txt, 36, 106); L.tag.t.needsUpdate = true;
  }
  const newCar = (x: number, z: number): Car => ({ x, y: 0, z, yaw: 0, v: 0, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0, pitch: 0, roll: 0 });

  function parallelWorld(k: GameKind, options: ForkOption[]): Course {
    const n = options.length, laneW = n === 3 ? 6.2 : 7.6, xs = n === 3 ? [laneW, 0, -laneW] : [laneW / 2, -laneW / 2];
    const outer = (n * laneW) / 2, apHalf = outer + 0.4;
    const LEN = k === "road" ? 66 : k === "funnel" ? 150 : k === "orders" ? 56 : 70, END = GATE + LEN;
    const g = new THREE.Group();
    const laneOf = (x: number) => { let best = -1, d = 1e9; xs.forEach((lx, i) => { const e = Math.abs(x - lx); if (e < d) { d = e; best = i; } }); return d <= laneW / 2 + 0.6 ? best : -1; };
    const idIdx = (id: string) => options.findIndex((o) => o.id === id);
    // --- lane height profiles
    const climb = k === "road" ? idIdx("mountain") : -1;
    const RZ = GATE + 38, RL = 6, RH = 2.2, GAP0 = RZ + RL, LAND = GAP0 + 13;
    const mark = (p: number) => LAND + 6 + ((p - 10) / 50) * 54;
    const laneH = (li: number, z: number) => {
      if (li === climb && li >= 0) { const u = z - GATE; return u < 3 ? 0 : u < 26 ? 7 * smooth((u - 3) / 23) : u < 33 ? 7 : u < 50 ? 7 * (1 - smooth((u - 33) / 17)) : 0; }
      return 0;
    };
    const rolling = k === "road" || k === "runway";
    const base = (z: number) => (rolling ? 1.1 * Math.sin(z / 15) + 0.55 * Math.sin(z / 7 + 1.3) + 1.6 : 0);
    const hills = (x: number, z: number) => { const d = Math.max(0, Math.abs(x) - outer - 2.5); if (!rolling || d <= 0) return base(z); const n = fbm(x * 0.025 + 3, z * 0.025); return base(z) + d * 0.18 + d * d * 0.006 * (k === "road" ? 1.3 : 0.7) + n * Math.min(d, 40) * (k === "road" ? 0.75 : 0.45); };
    const h = (x: number, z: number) => {
      if (rolling) { const li = z >= GATE ? laneOf(x) : -1; if (Math.abs(x) <= outer + 0.8) return base(z) + (li >= 0 ? laneH(li, z) : 0); return hills(x, z); }
      if (k === "funnel") { if (z > GAP0 && z < LAND) return Math.abs(x) < outer + 2 ? -7 : 0; if (z >= RZ && z < RZ + RL && Math.abs(x) < outer) return RH * Math.pow((z - RZ) / RL, 1.4); return 0; }
      if (z < GATE) return 0; const li = laneOf(x); return li >= 0 ? laneH(li, z) : 0;
    };
    // --- ground and dressing
    const fg = new THREE.PlaneGeometry(500, 500); { const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 55, uv.getY(i) * 55); }
    const groundTex = k === "road" ? "forest" : k === "funnel" ? "asphalt" : k === "orders" ? "concrete" : "sand";
    if (rolling) {
      g.add(terrain(-220, 220, -70, END + 280, low ? 4 : 3, (x, z) => hills(x, z) - 0.06, (x, z, y, c) => {
        const n = fbm(x * 0.06, z * 0.06), hgt = y - base(z);
        if (k === "road") c.setRGB(0.95, 1.05, 0.9).multiplyScalar(0.8 + n * 0.4).lerp(new THREE.Color(0.8, 0.78, 0.76), smooth((hgt - 14) / 10)).lerp(new THREE.Color(2.1, 2.1, 2.2), smooth((hgt - 30) / 8));
        else c.setRGB(1.2, 1.0, 0.8).multiplyScalar(0.85 + n * 0.3).lerp(new THREE.Color(1.05, 0.72, 0.55), smooth((hgt - 8) / 10) * 0.6);
      }, pbr(groundTex, 0xffffff, 1, 0, { vertexColors: true })));
    } else { const ground = new THREE.Mesh(fg, pbr(groundTex, k === "funnel" ? 0x2e2a3a : 0xffffff, 1)); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, 100); ground.receiveShadow = true; g.add(ground); }
    if (k === "funnel") { // the canal under the jump
      const hole = new THREE.Mesh(new THREE.BoxGeometry((outer + 2) * 2, 7.2, LAND - GAP0), std(0x05030c, 0.9)); hole.position.set(0, -3.5, (GAP0 + LAND) / 2); g.add(hole);
      const water = new THREE.Mesh(new THREE.PlaneGeometry((outer + 2) * 2, LAND - GAP0), std(0x0a1430, 0.08, 0.6, { emissive: 0x1a1060, emissiveIntensity: 0.5 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -0.15, (GAP0 + LAND) / 2); g.add(water);
    }
    const roadTex = k === "runway" ? "dirt" : "asphalt", roadCol = k === "funnel" ? 0x4a4860 : k === "runway" ? 0xe0b890 : 0xa8a8a8;
    g.add(road(GATE + 2, apHalf, () => 0, (x, z) => base(z), pbr(roadTex, roadCol, k === "funnel" ? 0.3 : 0.85, k === "funnel" ? 0.15 : 0), -40, 6));
    for (const sx of [-1, 1]) stripe(g, GATE + 1, () => 0, (x, z) => base(z), sx * (apHalf - 0.3), 0.2, EDGE[k], false, -40, k === "funnel" ? 2.5 : 0);
    // each lane: its own surface, in the colour of what's on it
    const laneTex: Record<string, string> = { flat: "asphalt", mud: "mud", mountain: "dirt", ads: "asphalt", leak: "asphalt", fire: "asphalt", auto: "asphalt", burn: "dirt", aum: "dirt" };
    const laneTint: Record<string, number> = { flat: 0xa8a8a8, mud: 0x9a8a7a, mountain: 0xd8c8b0, ads: 0x4a4860, leak: 0x4a4860, fire: 0xb09090, auto: 0x98a898, burn: 0xd8a080, aum: 0xd8c098 };
    options.forEach((o, i) => {
      const lh = (x: number, z: number) => laneH(i, z) + base(z);
      const zEnd = k === "funnel" ? RZ : END + 30;
      g.add(road(zEnd, laneW / 2, () => xs[i], lh, pbr(laneTex[o.id] ?? roadTex, laneTint[o.id] ?? roadCol, o.id === "mud" ? 0.28 : k === "funnel" ? 0.3 : 0.85, k === "funnel" ? 0.15 : 0), GATE, 5));
      for (const sx of [-1, 1]) stripe(g, zEnd, () => xs[i], lh, sx * (laneW / 2 - 0.2), 0.16, EDGE[k], false, GATE, k === "funnel" ? 2.5 : 0);
      if (i === climb) { // rock walls under the climbing road
        const pos: number[] = [], idx: number[] = []; let v = 0;
        for (const sx of [-1, 1]) { const x = xs[i] + sx * laneW / 2; for (let z = GATE; z <= GATE + 52; z += 1) { pos.push(x, laneH(i, z) + base(z) + 0.03, z, x, base(z) - 0.5, z); if (z > GATE) { idx.push(v - 2, v, v - 1, v - 1, v, v + 1); } v += 2; } }
        const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
        const uv: number[] = []; for (let j = 0; j < pos.length / 3; j++) uv.push(pos[j * 3 + 2] / 4, pos[j * 3 + 1] / 4); sg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        const wall = new THREE.Mesh(track(sg), pbr("rock", 0x9a9690, 1, 0, { side: THREE.DoubleSide })); wall.castShadow = wall.receiveShadow = true; g.add(wall);
        const rail = std(0xd8d4cc, 0.5, 0.6);
        for (const sx of [-1, 1]) for (let z = GATE + 3; z < GATE + 50; z += 2.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), rail); p.position.set(xs[i] + sx * (laneW / 2 - 0.05), laneH(i, z) + base(z) + 0.35, z); g.add(p); }
      }
    });
    if (k !== "funnel") {
      const kerbT = canvasTex(16, 64, (c) => { c.fillStyle = "#c62828"; c.fillRect(0, 0, 16, 32); c.fillStyle = "#f4f4f4"; c.fillRect(0, 32, 16, 32); }, [1, 1]);
      const kerbM = std(0xffffff, 0.6, 0, { map: kerbT, polygonOffset: true, polygonOffsetFactor: -3 });
      options.forEach((_, i) => { for (const sx of [-1, 1]) { const off = sx * (laneW / 2 - 0.3); g.add(road(END + 30, 0.3, () => xs[i] + off, (x, z) => laneH(i, z) + base(z) + 0.02, kerbM, GATE, 2)); } });
      for (const sx of [-1, 1]) g.add(road(GATE + 1, 0.3, () => sx * (apHalf - 0.3), (x, z) => base(z) + 0.02, kerbM, -40, 2));
    }
    // dividers between lanes
    const jersey = pbr("concrete", 0xe0dcd4, 0.85), divEnd = k === "funnel" ? RZ - 2 : END + 6;
    for (let i = 0; i < n - 1; i++) { const x = (xs[i] + xs[i + 1]) / 2; for (let z = GATE; z < divEnd; z += 3) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 3.05), jersey); d.position.set(x, base(z + 1.5) + 0.47, z + 1.5); d.rotation.x = -Math.atan2(base(z + 3) - base(z), 3); d.castShadow = d.receiveShadow = true; g.add(d); }
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 16), std(0xf2b705, 0.6)); nose.position.set(x, 0.55, GATE); g.add(nose); }
    // gantry, signs and barrier arms at the fork
    const steel = std(0x2a2d33, 0.45, 0.6);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.6, 0.5), steel); post.position.set(sx * (outer + 0.8), 4.8, GATE + 1); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(outer * 2 + 2.1, 0.45, 0.45), steel); beam.position.set(0, 9.4, GATE + 1); g.add(beam);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(outer * 2 + 2.1, 0.3, 0.3), steel); beam2.position.set(0, 5.4, GATE + 1); g.add(beam2);
    const signs: THREE.MeshStandardMaterial[] = [], arms: THREE.Object3D[] = [];
    const keysFor = n === 3 ? KEYS3 : KEYS2;
    options.forEach((o, i) => {
      const SIGN: Record<GameKind, string> = { road: "#0e6b3b", funnel: "#3a1450", orders: "#174a9c", runway: "#7a3e1d" };
      const tex = canvasTex(640, 400, (c) => {
        c.fillStyle = SIGN[k]; c.beginPath(); c.roundRect(0, 0, 640, 400, 28); c.fill();
        c.strokeStyle = "#ffffff"; c.lineWidth = 10; c.beginPath(); c.roundRect(14, 14, 612, 372, 20); c.stroke();
        c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle";
        const words = o.label.toUpperCase().split(" "); let lines: string[] = [], fs = 84;
        for (; fs >= 44; fs -= 6) { c.font = `700 ${fs}px "Saira Condensed", "Arial Narrow", sans-serif`; lines = []; let line = ""; for (const w of words) { if (c.measureText(line + w).width > 540 && line) { lines.push(line.trim()); line = ""; } line += w + " "; } lines.push(line.trim()); if (lines.length <= 2) break; }
        const y0 = lines.length > 1 ? 92 : 120; lines.slice(0, 2).forEach((l, j) => c.fillText(l, 320, y0 + j * fs * 0.95));
        c.font = `500 30px ${MONO}`; c.globalAlpha = 0.85; c.fillText(o.sub, 320, 248); c.globalAlpha = 1;
        // the arrow down to this lane, and the key that takes it
        c.beginPath(); c.moveTo(300, 290); c.lineTo(340, 290); c.lineTo(340, 330); c.lineTo(368, 330); c.lineTo(320, 382); c.lineTo(272, 330); c.lineTo(300, 330); c.closePath(); c.fill();
        c.fillStyle = "#f2b705"; c.beginPath(); c.roundRect(470, 300, 120, 70, 14); c.fill(); c.fillStyle = "#14110e"; c.font = `700 46px ${MONO}`; c.fillText(keysFor[i], 530, 337);
      });
      const mat = std(0xffffff, 0.35, 0, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }); signs.push(mat);
      const sw = Math.min(laneW - 0.6, 5.6), sign = new THREE.Mesh(new THREE.BoxGeometry(sw, sw * 0.625, 0.16), [steel, steel, steel, steel, steel, mat]); sign.position.set(xs[i], 5.6 + sw * 0.31, GATE + 1); g.add(sign);
      const pivot = new THREE.Group(); pivot.position.set(xs[i] + laneW / 2 - 0.4, 1.0, GATE); pivot.rotation.y = Math.PI;
      const stripeT = canvasTex(256, 32, (c) => { for (let j = 0; j < 8; j++) { c.fillStyle = j % 2 ? "#ffffff" : "#e53935"; c.fillRect(j * 32, 0, 32, 32); } });
      const arm = new THREE.Mesh(new THREE.BoxGeometry(laneW - 0.9, 0.18, 0.12), std(0xffffff, 0.5, 0, { map: stripeT })); arm.position.x = (laneW - 0.9) / 2; arm.castShadow = true; pivot.add(arm);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), std(0xf2b705, 0.6)); box.position.set(xs[i] + laneW / 2 - 0.4, 0.55, GATE); g.add(box);
      g.add(pivot); arms.push(pivot);
    });
    const finishZ = k === "funnel" ? mark(60) + 8 : END;
    const archG = arch(finishZ, 0, outer, k === "road" ? "MARKET LEAD" : k === "orders" ? "ORDERS OUT" : k === "runway" ? "₹2.5 CR · AUM" : "TARGET 50%", k === "runway" ? "#2bff88" : "#f2b705", "#14110e"); if (k !== "funnel") g.add(archG);
    // theme dressing either side
    const side = outer + 6;
    if (k === "road") {
      const pg = pineGeo(), pm = std(0xffffff, 0.95, 0, { vertexColors: true });
      g.add(scatter(pg, pm, low ? 200 : 420, (r) => { const sx = r() < 0.5 ? -1 : 1, x = sx * (side + Math.pow(r(), 1.5) * 70), z = -40 + r() * 200; const y = hills(x, z); if (y - base(z) > 26) return null; return [x, y - 0.1, z, 0.9 + r() * 1.3, r() * 6]; }, 31));
      const peakMat = pbr("rock", 0x8a90a0, 1), snowMat = std(0xf6f8ff, 0.55), pr = rng(4);
      for (let i = 0; i < 12; i++) { const ang = -1.1 + (i / 11) * 2.2, dist = 300 + pr() * 140, ph = 70 + pr() * 80, rad = 55 + pr() * 45;
        const cg = new THREE.ConeGeometry(rad, ph, 24, 6); { const pp = cg.attributes.position; for (let j = 0; j < pp.count; j++) { const a = Math.atan2(pp.getZ(j), pp.getX(j)), f = 1 + (fbm(a * 3 + i, pp.getY(j) * 0.03) - 0.5) * 0.5; pp.setX(j, pp.getX(j) * f); pp.setZ(j, pp.getZ(j) * f); } cg.computeVertexNormals(); }
        const p = new THREE.Mesh(cg, peakMat); p.position.set(Math.sin(ang) * dist, ph / 2 - 10, Math.cos(ang) * dist + 60); g.add(p);
        const s2 = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.36, ph * 0.36, 24), snowMat); s2.position.set(p.position.x, ph - 10 - ph * 0.18 + 0.5, p.position.z); g.add(s2); }
    }
    if (k === "funnel") {
      const winTex = canvasTex(128, 256, (c) => { c.fillStyle = "#0b0818"; c.fillRect(0, 0, 128, 256); for (let y = 6; y < 256; y += 14) for (let x = 6; x < 128; x += 14) if (Math.random() < 0.55) { c.fillStyle = ["#ffd9a0", "#9fe8ff", "#ffb0e0"][Math.floor(Math.random() * 3)]; c.globalAlpha = 0.5 + Math.random() * 0.5; c.fillRect(x, y, 8, 9); } c.globalAlpha = 1; }, [2, 4]);
      const bm = std(0xffffff, 0.6, 0.2, { map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.0 }); const r = rng(5), m4 = new THREE.Matrix4(), N = low ? 70 : 120; const im = new THREE.InstancedMesh(track(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), bm, N);
      for (let i = 0; i < N; i++) { const sx = i % 2 ? 1 : -1; m4.compose(new THREE.Vector3(sx * (side + 8 + r() * 45), 0, -40 + r() * 260), new THREE.Quaternion(), new THREE.Vector3(8 + r() * 9, 18 + r() * 65, 8 + r() * 10)); im.setMatrixAt(i, m4); } g.add(im);
      const neons = [0xff5fb0, 0x3ad0ff, 0xc56bff];
      for (let i = 0; i < 22; i++) { const sx = i % 2 ? 1 : -1, z = i * 9 - 10, c = neons[i % 3]; const nn = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3 + (i % 3), 0.15), std(c, 0.4, 0, { emissive: c, emissiveIntensity: 3 })); nn.position.set(sx * (outer + 4.5), 2.5, z); g.add(nn); }
      megaScreen(g, side + 14, 50, -Math.PI / 2 + 0.35, "img/boardiq.webp", "LIVE · BOARDIQ", "AI decisions you can inspect · built solo", "#f2b705");
      megaScreen(g, -side - 14, 110, Math.PI / 2 - 0.35, "img/nutrisathi.webp", "LIVE · NUTRISATHI", "food-label AI at nutrisathi.app · built solo", "#c6f24e");
      // the ramp across all lanes and the conversion scale beyond the canal
      const rg = new THREE.BufferGeometry(), N2 = 12, pos: number[] = [], idx: number[] = [], uv: number[] = [];
      for (let i = 0; i <= N2; i++) { const z = RZ + (i / N2) * RL, y = RH * Math.pow(i / N2, 1.4) + 0.05; pos.push(-outer, y, z, outer, y, z); uv.push(0, i / N2, n, i / N2); if (i < N2) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
      const chev = canvasTex(256, 256, (c) => { c.fillStyle = "#f2b705"; c.fillRect(0, 0, 256, 256); c.fillStyle = "#14110e"; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(40, 30 + i * 60); c.lineTo(128, 60 + i * 60); c.lineTo(216, 30 + i * 60); c.lineTo(216, 52 + i * 60); c.lineTo(128, 82 + i * 60); c.lineTo(40, 52 + i * 60); c.fill(); } }, [1, 1]);
      const rm = new THREE.Mesh(track(rg), std(0xffffff, 0.5, 0.1, { map: chev, emissive: 0xf2b705, emissiveIntensity: 0.12 })); rm.castShadow = rm.receiveShadow = true; g.add(rm);
      g.add(road(mark(60) + 30, outer, () => 0, () => 0, pbr("asphalt", 0x4a4860, 0.3, 0.15), LAND, 6));
      for (let p = 10; p <= 60; p += 10) {
        const z = mark(p), target = p === 50, col = target ? 0x2bff88 : 0x3ad0ff, gm = std(col, 0.4, 0, { emissive: col, emissiveIntensity: target ? 1.3 : 0.7 }), sw = target ? 0.35 : 0.16;
        for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(sw, target ? 7 : 4.5, sw), gm); post.position.set(sx * (outer + 0.3), target ? 3.5 : 2.25, z); g.add(post); }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(outer * 2 + 0.6, sw, sw), gm); bar.position.set(0, target ? 7 : 4.5, z); g.add(bar);
        const lb = label(target ? "TARGET 50%" : `${p}%`, target ? "#2bff88" : "#3ad0ff", "#04101a", target ? 1.4 : 0.9); lb.position.set(0, target ? 8.4 : 5.5, z); g.add(lb);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(outer * 2, 0.25), gm); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, z); g.add(line);
      }
    }
    if (k === "orders") {
      const r = rng(9), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const corr = canvasTex(256, 128, (c) => { c.fillStyle = "#fff"; c.fillRect(0, 0, 256, 128); for (let x = 0; x < 256; x += 16) { c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(x, 0, 6, 128); } });
      const cm = std(0xffffff, 0.55, 0.35, { map: corr }); const im = new THREE.InstancedMesh(track(new THREE.BoxGeometry(2.5, 2.6, 6.1).translate(0, 1.3, 0)), cm, 200); let c = 0; const pal = [0xc0392b, 0x1f6fb2, 0x2e8b57, 0xe67e22, 0x7d3c98, 0x95a5a6];
      for (const sx of [-1, 1]) for (let row = 0; row < 3; row++) for (let z = -30; z < END + 50; z += 6.4) for (let sk = 0; sk < 1 + Math.floor(r() * (row ? 4 : 2)) && c < 200; sk++) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0); m4.compose(new THREE.Vector3(sx * (side + row * 3), sk * 2.62, z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(c, m4); im.setColorAt(c, new THREE.Color(pal[Math.floor(r() * pal.length)])); c++; }
      im.count = c; im.castShadow = true; im.receiveShadow = true; g.add(im);
      const yel = std(0xf2b705, 0.5, 0.3);
      for (const zc of [GATE + 20, GATE + 44]) { const cg = new THREE.Group(); cg.position.z = zc;
        for (const sx of [-1, 1]) for (const dz of [-3, 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 0.6), yel); leg.position.set(sx * (outer + 2.5), 8, dz); leg.castShadow = true; cg.add(leg); }
        for (const dz of [-3, 3]) { const bm2 = new THREE.Mesh(new THREE.BoxGeometry(outer * 2 + 6, 1, 0.8), yel); bm2.position.set(0, 16, dz); bm2.castShadow = true; cg.add(bm2); }
        g.add(cg); }
      const wh = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 20), std(0xd8d4cc, 0.8)); wh.position.set(0, 7, END + 40); wh.castShadow = true; g.add(wh);
    }
    if (k === "runway") {
      const cParts = [new THREE.CylinderGeometry(0.28, 0.32, 3.2, 10).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10).translate(0.55, 2.2, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10).rotateZ(Math.PI / 2).translate(0.3, 1.7, 0), new THREE.CylinderGeometry(0.2, 0.2, 1.0, 10).translate(-0.55, 1.9, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10).rotateZ(Math.PI / 2).translate(-0.3, 1.45, 0)];
      g.add(scatter(track(mergeGeometries(cParts)!), std(0x4a6b3a, 0.85), low ? 60 : 110, (r) => { const sx = r() < 0.5 ? -1 : 1; const x = sx * (side + r() * 50), z = -30 + r() * 200; return [x, hills(x, z) - 0.1, z, 0.8 + r() * 0.7, r() * 6]; }, 17));
      const mesa = pbr("rock", 0xd08a60, 1), mr = rng(12);
      for (let i = 0; i < 10; i++) { const r = 14 + mr() * 22, hh = 25 + mr() * 40;
        const mg = new THREE.CylinderGeometry(r * 0.85, r * 1.1, hh, 28, 6); { const pp = mg.attributes.position; for (let j = 0; j < pp.count; j++) { const a = Math.atan2(pp.getZ(j), pp.getX(j)), f = 1 + (fbm(a * 2.5 + i, pp.getY(j) * 0.08) - 0.5) * 0.35; pp.setX(j, pp.getX(j) * f); pp.setZ(j, pp.getZ(j) * f); } mg.computeVertexNormals(); }
        const m = new THREE.Mesh(mg, mesa); m.position.set((i % 2 ? 1 : -1) * (70 + mr() * 150), hh / 2 - 2, -20 + mr() * 300); m.castShadow = true; g.add(m); }
      const dune = pbr("sand", 0xffffff, 1);
      for (let i = 0; i < 18; i++) { const sx = i % 2 ? 1 : -1, d = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), dune); d.scale.set(10 + (i * 37 % 14), 2 + (i * 13 % 4), 7 + (i * 7 % 9)); d.position.set(sx * (side + 10 + (i * 29 % 40)), -0.5, -20 + i * 14); d.receiveShadow = true; g.add(d); }
      // the oasis past the finish
      const water = new THREE.Mesh(new THREE.CircleGeometry(12, 40), std(0x2c8ab8, 0.08, 0.3)); water.rotation.x = -Math.PI / 2; water.position.set(-outer - 10, 0.05, END + 14); g.add(water);
      const leaf = std(0x2e6d32, 0.7, 0, { side: THREE.DoubleSide }), trunk = std(0x8a6a40, 0.9);
      for (const [px, pz] of [[-6, 4], [-20, 8], [-12, 24], [4, 18]]) { const pg2 = new THREE.Group(); pg2.position.set(-outer + px, 0, END + pz);
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), trunk); tr.position.y = 3.5; tr.rotation.z = 0.12; pg2.add(tr);
        for (let j = 0; j < 7; j++) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4), leaf); lf.position.set(0.4, 7, 0); lf.rotation.set(1.1, (j / 7) * Math.PI * 2, 0); lf.translateY(1.6); pg2.add(lf); }
        pg2.traverse((o) => { (o as THREE.Mesh).castShadow = true; }); g.add(pg2); }
    }
    if (false) hoardings(g, END, outer + 0.5, () => 0, () => 0, k === "road" ? "#4fc3f7" : k === "funnel" ? "#ff5fb0" : k === "orders" ? "#f2b705" : "#66bb6a", (z) => k === "funnel" && z > RZ - 4 && z < LAND + 4, 9);
    // billboards: the work behind this vertical
    const B = side + 6;
    if (k === "road") {
      billboard(g, B, 0, GATE + 6, -2.25, "cover", "rabbit-invest", "B2C → B2B2C", "The pivot I proposed|and modelled at Rabbit Invest", "#4fc3f7");
      billboard(g, -B, 0, GATE + 62, 2.25, "studio-smile", "masters-union", "THINK LIKE A FOUNDER", "PGP-TBM, Masters' Union|VP, AI & Analytics Wing", "#f2b705");
    } else if (k === "funnel") {
      billboard(g, B, 0, GATE + 8, -2.25, "cover", "rabbit-invest", "10% → 50%", "Lead conversion|I found and fixed the leak", "#ff7043", 1.1);
      billboard(g, B, 0, mark(45), -2.25, "img/decco-stall.webp", "#SALES · DECCO STORE", "₹3L IN 30 DAYS", "Our D2C brand: I sold|at the stall, ran the store", "#ff8a65", 1.1);
    } else if (k === "orders") {
      billboard(g, B + 3, 7.9, GATE + 6, -2.25, "clean", "rabbit-invest", "80% AUTOMATED", "Ops built from zero|Senior Associate → Lead", "#f2b705");
      billboard(g, -B - 3, 7.9, GATE + 28, 2.25, "studio-smile", "wipro", "100+ ACCOUNTS", "CRM reporting rebuilt|+40% pipeline visibility", "#3ad0ff");
    } else {
      billboard(g, B, 0, GATE + 6, -2.25, "cover", "rabbit-invest", "₹2.5 CR AUM", "Year one, investing app|fund engine in 2–3 days", "#66bb6a");
      billboard(g, -B, 0, GATE + 30, 2.25, "img/boardiq.webp", "#LIVE · AI FOR INVESTORS", "BOARDIQ", "Checks the data first,|then shows the AI's working", "#f2b705");
    }

    /* --- the rules of each road --- */
    const pct = (c: Car) => Math.round(clamp((c.z - GATE) / LEN, 0, 1) * 100);
    const mkLane = (o: ForkOption, i: number): Lane => ({ id: o.id, label: o.label, x: xs[i], vmax: 14, acc: 9, dust: 0x9a8a7a, car: newCar(xs[i], GATE), obj: null, me: false, done: false, doneT: 0, tag: null, last: "", stat: () => ["", "#fff"], st: {} });
    const said = new Set<string>(); const pop = (key: string, txt: string, col: string, L: Lane) => { if (L.me && !said.has(key)) { said.add(key); hooks?.onPop(txt, col); } };
    const extras = new THREE.Group(); g.add(extras);
    const L: Lane[] = options.map((o, i) => {
      const ln = mkLane(o, i), x0 = xs[i];
      if (k === "road") {
        if (o.id === "flat") {
          ln.vmax = 15; ln.dust = 0x9a9a9a;
          const cars = [0, 1, 2].map((j) => { const r = rivalCar(j * 2 + 1); r.g.position.set(x0, base(GATE + 9 + j * 7), GATE + 9 + j * 7); extras.add(r.g); return r.g; });
          const tag = label("FUNDED RIVALS · ₹₹₹", "#ef5350", "#ffffff", 0.9); tag.position.set(0, 3.4, 0); cars[0].add(tag);
          ln.st.rz = GATE + 9;
          ln.tick = (dt, c, l) => { if (goT < 0) return; l.st.rz += 5.2 * dt; cars.forEach((cg, j) => { cg.position.z = l.st.rz + j * 7; cg.position.x = x0 + Math.sin(t * 1.4 + j) * 0.4; cg.position.y = base(cg.position.z); cg.rotation.x = -Math.atan2(base(cg.position.z + 1) - base(cg.position.z - 1), 2); }); if (c.z > l.st.rz - 6.2) { c.z = Math.min(c.z, l.st.rz - 6); c.v = Math.min(c.v, 5.2); c.cap = 5.4; l.st.boxed = 1; pop("box", "BOXED IN BY FUNDED RIVALS", "#ef5350", l); } };
          ln.stat = () => [ln.done ? `${pct(ln.car)}% · STILL BEHIND` : ln.st.boxed ? `${pct(ln.car)}% · BOXED IN` : `${pct(ln.car)}% · CROWDED`, "#ef5350"];
        } else if (o.id === "mud") {
          ln.vmax = 5.2; ln.acc = 3.5; ln.dust = 0x3a2614;
          ln.tick = (dt, c, l) => { if (goT >= 0 && c.v > 1 && Math.random() < 0.6) for (const sx of [-0.7, 0.7]) emit(c.x + sx, c.y + 0.3, c.z - 1, sx * 3, 3 + Math.random() * 3, -2 - Math.random() * 2, 0x3a2614); if (t - goT > 0.6) pop("mud", "WHEELS SPINNING · SLOW GRIND", "#a1764a", l); };
          ln.stat = () => [`${pct(ln.car)}% · STUCK IN MUD`, "#c08a50"];
        } else {
          ln.vmax = 16; ln.dust = 0x9a7a5a;
          ln.crawl = (c) => (c.z > GATE + 3 && c.z < GATE + 26 ? 6.5 : 0);
          ln.tick = (dt, c, l) => { if (c.z > GATE + 5 && c.z < GATE + 12) pop("climb", "HARD CLIMB", "#4fc3f7", l); if (c.z > GATE + 27) pop("top", "OVER THE TOP · THE ROAD IS YOURS", "#2bff88", l); };
          ln.stat = () => [ln.done ? "MARKET LEAD ✓" : ln.car.z > GATE + 27 ? `${pct(ln.car)}% · OPEN ROAD` : `${pct(ln.car)}% · CLIMBING`, "#4fc3f7"];
        }
      } else if (k === "funnel") {
        ln.vmax = 13; ln.acc = 8; ln.dust = 0x7a6aa8; ln.st.conv = 10; ln.st.hit = 0; ln.st.fixes = 0; ln.st.launched = 0; ln.st.landed = 0;
        const pads = [GATE + 8, GATE + 18, GATE + 28], names = ["FOLLOW UP FAST", "SALES DASHBOARD", "AUTO LEAD FLOW"];
        pads.forEach((z, j) => {
          if (o.id === "leak") { const pad = new THREE.Mesh(new THREE.BoxGeometry(laneW - 2, 0.1, 2.6), std(0xff7043, 0.3, 0, { emissive: 0xff7043, emissiveIntensity: 1.1 })); pad.position.set(x0, 0.08, z); extras.add(pad);
            const lb = label(names[j], "#ff7043", "#14110e", 0.42); lb.position.set(x0, 1.7, z + 1.2); extras.add(lb); }
          else { const scr = canvasTex(256, 160, (c2) => { c2.fillStyle = "#ff5fb0"; c2.fillRect(0, 0, 256, 160); c2.fillStyle = "#fff"; c2.font = `56px ${STENCIL}`; c2.textAlign = "center"; c2.fillText("BUY NOW!", 128, 80); c2.font = `24px ${MONO}`; c2.fillText("more leads, same leak", 128, 124); });
            const b = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.8), std(0xffffff, 0.5, 0, { map: scr, emissive: 0xffffff, emissiveMap: scr, emissiveIntensity: 1.1 })); b.position.set(x0 + Math.sign(x0) * (laneW / 2 + 1.6), 3.4, z); b.rotation.y = Math.PI - Math.sign(x0) * 0.6; extras.add(b); }
        });
        ln.aim = () => x0;
        ln.tick = (dt, c, l) => {
          const s = l.st;
          if (s.hit < pads.length && c.z >= pads[s.hit]) {
            const onIt = Math.abs(c.x - x0) < laneW / 2 - 0.6;
            if (o.id === "leak") { if (onIt) { s.fixes++; s.conv = [10, 23, 36, 50][s.fixes]; c.boostT = 1.2; c.v += 3; pop("pad" + s.hit, `${names[s.hit]} · CONVERSION ${s.conv}%`, "#ff7043", l); } else pop("miss" + s.hit, "MISSED IT · THAT LEAK STAYS OPEN", "#9e9e9e", l); }
            else { s.conv = Math.min(16, s.conv + 2); for (let q = 0; q < 16; q++) emit(c.x + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, c.z + 3, (Math.random() - 0.5) * 6, Math.random() * 3, -3 - Math.random() * 4, 0xffffff); pop("ad" + s.hit, "MORE LEADS IN · MOST LEAK OUT", "#ff5fb0", l); }
            s.hit++; if (l.me) hooks?.onScore({ conv: s.conv });
          }
          if (!s.launched && c.z >= RZ + RL - 0.2) {
            s.launched = 1; const th = 0.42, target = mark(s.conv); let lo = 5, hi = 60;
            for (let q = 0; q < 40; q++) { const vz = (lo + hi) / 2, vy = vz * Math.tan(th), tt = (vy + Math.sqrt(vy * vy + 2 * GRAV * RH)) / GRAV; if (c.z + vz * tt < target) lo = vz; else hi = vz; }
            c.v = lo; c.vy = lo * Math.tan(th); c.air = true; c.yaw = 0; c.x = x0;
          }
          if (s.launched && !c.air && !s.landed) { s.landed = 1; c.v *= 0.6; c.cap = c.v; if (l.me) { hooks?.onPop(s.conv >= 50 ? `${s.conv}% · TARGET HIT` : `${s.conv}% · SHORT OF 50%`, s.conv >= 50 ? "#2bff88" : "#ffca28"); if (s.conv >= 50) burst(x0, 4, c.z + 4, 100); } }
          if (s.landed) { c.cap = Math.max(0, c.cap - 16 * dt); if (c.v < 0.3) l.st.stop = 1; }
        };
        ln.stat = () => [ln.st.landed ? (ln.st.conv >= 50 ? `LANDED ${ln.st.conv}% ✓` : `LANDED ${ln.st.conv}%`) : `${ln.st.conv}% CONVERSION`, o.id === "leak" ? "#2bff88" : "#ff5fb0"];
      } else if (k === "orders") {
        ln.vmax = 13; ln.acc = 10; ln.dust = 0x8a8a8a; ln.st.fixed = 0; ln.st.routed = 0; ln.st.sop = 0;
        const sub = [-1.9, 1.9, -1.9], probs = [GATE + 12, GATE + 26, GATE + 40].map((z, j) => {
          const ob = new THREE.Group(); ob.position.set(x0 + sub[j], 18, z);
          const hz = canvasTex(256, 256, (c2) => { c2.fillStyle = "#f2b705"; c2.fillRect(0, 0, 256, 256); c2.fillStyle = "#14110e"; for (let q = -4; q < 8; q++) { c2.beginPath(); c2.moveTo(q * 64, 0); c2.lineTo(q * 64 + 32, 0); c2.lineTo(q * 64 + 288, 256); c2.lineTo(q * 64 + 256, 256); c2.fill(); } });
          const bar = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.5), std(0xffffff, 0.5, 0.1, { map: hz })); bar.position.y = 0.8; ob.add(bar);
          for (const [cx, cy] of [[-0.8, 0.5], [0.8, 0.5], [0, 1.4]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), pbr("dirt", 0xd0a070, 0.9)); b.position.set(cx, cy, 0.8); ob.add(b); }
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std(0xff3020, 0.3, 0, { emissive: 0xff2010, emissiveIntensity: 3 })); lamp.position.set(0, 1.5, 0); ob.add(lamp);
          ob.traverse((x) => { (x as THREE.Mesh).castShadow = true; }); extras.add(ob);
          return { z, x: x0 + sub[j], ob, y: 18, vy: 0, state: "wait" as "wait" | "drop" | "on" | "fixing" | "gone" | "routed" };
        });
        // lane lighting tells the story: red strobes for firefighting, green guide lights once the SOP is in
        const strip = (col: number) => { const ms: THREE.MeshStandardMaterial[] = []; for (const sx of [-1, 1]) for (let z = GATE + 2; z < END; z += 3) { const m = std(col, 0.4, 0, { emissive: col, emissiveIntensity: 0 }); ms.push(m); const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.4), m); b.position.set(x0 + sx * (laneW / 2 - 0.35), 0.08, z); extras.add(b); } return ms; };
        const lights = strip(o.id === "auto" ? 0x2bff88 : 0xff3020);
        const banner = label(o.id === "auto" ? "SOP ON · SYSTEM STEERS" : "EVERY FIX BY HAND", o.id === "auto" ? "#2bff88" : "#ef5350", "#14110e", 0.8); banner.visible = false; void banner;
        ln.aim = (c) => { const nx = probs.find((p) => (p.state === "on" || p.state === "drop" || p.state === "wait") && p.z > c.z - 1); if (!nx) return x0; if (o.id === "fire" || !ln.st.sop) return nx.x; return nx.z - c.z < 16 ? x0 - (nx.x - x0) : x0; };
        ln.tick = (dt, c, l) => {
          if (goT < 0) return;
          for (const p of probs) {
            if (p.state === "wait" && c.z > p.z - 16) p.state = "drop";
            if (p.state === "drop") { p.vy -= 40 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.state = "on"; if (l.me) shake = Math.max(shake, 0.1); } p.ob.position.y = p.y; }
            if ((p.state === "on" || p.state === "drop") && Math.abs(p.z - 1.2 - c.z) < 1.1 && Math.abs(p.x - c.x) < 2.0) {
              p.state = "fixing"; c.z = p.z - 2.4; c.v = 0; l.st.fixed++; l.st.fixing = 1;
              c.stopT = o.id === "auto" && !l.st.sop ? 1.0 : 0.75;
              if (o.id === "auto" && !l.st.sop) { l.st.sop = 1; pop("sop", "SOP WRITTEN · THE SYSTEM TAKES THE WHEEL", "#ffca28", l); if (l.me) { hooks?.onScore({ auto: true }); if (!auto) { auto = true; hooks?.onAuto?.(true); } } }
              else pop("fix" + p.z, "FIXING BY HAND", "#ef5350", l);
              if (l.me) hooks?.onScore({ orders: l.st.fixed });
            } else if (p.state === "on" && c.z > p.z + 1.5) { p.state = "routed"; l.st.routed++; pop("r" + p.z, l.st.sop ? "AUTO-ROUTED" : "DODGED", "#ffca28", l); if (l.me) hooks?.onScore({ dodged: l.st.routed }); }
            if (p.state === "fixing") { p.ob.rotation.z = Math.sin(t * 40) * 0.05; if (c.stopT <= 0) { p.state = "gone"; p.ob.visible = false; c.v = Math.max(c.v, 7); } }
          }
          if (o.id === "fire") { lights.forEach((m, j) => { m.emissiveIntensity = c.stopT > 0 ? (Math.sin(t * 16 + j) > 0 ? 3 : 0.2) : 0.15; }); }
          else lights.forEach((m, j) => { m.emissiveIntensity = l.st.sop ? 1.2 + Math.sin(t * 6 - j * 0.5) * 0.8 : 0.1; });
        };
        ln.stat = () => o.id === "fire" ? [ln.done ? `DONE · ${ln.st.fixed} FIXED BY HAND` : `${ln.st.fixed} FIXED BY HAND`, "#ef5350"] : [ln.done ? `DONE · ${ln.st.routed} AUTO-ROUTED` : ln.st.sop ? `SOP ON · ${ln.st.routed} AUTO-ROUTED` : "WRITING THE SOP…", "#2bff88"];
      } else {
        const burn = o.id === "burn"; ln.vmax = burn ? 21 : 14; ln.acc = burn ? 12 : 8; ln.dust = 0xd8b080; ln.st.fuel = 30; ln.st.aum = 10; ln.st.dry = 0;
        const cans = burn ? [] : [GATE + 12, GATE + 28, GATE + 44].map((z) => {
          const ob = new THREE.Group(); ob.position.set(x0, base(z) + 0.1, z);
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), std(0xd32f2f, 0.35, 0.3)); b.position.y = 0.6; ob.add(b);
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), std(0x66bb6a, 0.5, 0, { emissive: 0x66bb6a, emissiveIntensity: 1.5, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ob.add(ring);
          const lb = label("+₹80L", "#66bb6a", "#08140a", 0.75); lb.position.y = 2.2; ob.add(lb); ob.traverse((x) => { (x as THREE.Mesh).castShadow = true; }); extras.add(ob); return { z, ob, got: false };
        });
        ln.aim = () => x0;
        ln.tick = (dt, c, l) => {
          if (goT < 0) return; const s = l.st;
          if (!s.dry) { s.fuel = Math.max(0, s.fuel - (burn ? 12 : 4) * dt); if (s.fuel <= 0) { s.dry = 1; pop("dry", "OUT OF RUNWAY · TANK DRY", "#ef5350", l); } }
          if (s.dry) c.cap = Math.max(0, Math.min(c.cap, c.v) - 13 * dt);
          if (burn && !s.dry) { if (l.me) flamesOn = true; if (Math.random() < 0.5) emit(c.x + (Math.random() - 0.5) * 0.6, c.y + 0.7, c.z - 1.4, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, -4, Math.random() < 0.5 ? 0xffd54f : 0x7cb342); pop("burn", "BURNING CASH FOR SPEED", "#ef5350", l); }
          if (l.me && (s.dry || !burn)) flamesOn = false;
          for (const cn of cans) if (!cn.got && Math.abs(cn.z - c.z) < 1.6 && Math.abs(x0 - c.x) < 2.4) { cn.got = true; cn.ob.visible = false; s.fuel = Math.min(100, s.fuel + 22); s.aum = Math.min(250, s.aum + 80); pop("can" + cn.z, "+₹80L MANAGED · TANK UP", "#66bb6a", l); for (let q = 0; q < 16; q++) emit(c.x, c.y + 1, c.z + 1, (Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5, 0x66ff88); }
          cans.forEach((cn) => { cn.ob.rotation.y = t * 1.5; });
          if (l.me) hooks?.onScore({ fuel: s.fuel, aum: s.aum });
          if (s.dry && c.v < 0.2) s.stop = 1;
        };
        ln.stat = () => burn ? [ln.st.dry ? `TANK DRY AT ${pct(ln.car)}%` : `FUEL ${Math.round(ln.st.fuel)}% · BURNING`, "#ef5350"] : [ln.done ? "₹2.5 CR · ARRIVED ✓" : `${cr(ln.st.aum)} · FUEL ${Math.round(ln.st.fuel)}%`, "#66bb6a"];
      }
      return ln;
    });
    lanes = L;
    fork = { ...fork!, xs, laneW, arms, signs };
    const LIMIT = k === "road" ? 6.5 : k === "funnel" ? 12 : k === "orders" ? 9 : 8;
    const laneDone = (l: Lane) => (k === "funnel" ? !!l.st.stop : k === "runway" ? l.car.z >= END || !!l.st.stop : l.car.z >= END) || (goT >= 0 && t - goT > LIMIT);
    return {
      group: g, len: END, halfW: apHalf, vmax: 12, acc: 8, dust: k === "funnel" ? 0x7a6aa8 : k === "orders" ? 0x8a8a8a : k === "runway" ? 0xd8b080 : 0x9a7a5a,
      roadX: () => 0, h,
      bounds: (c) => { if (!fork || fork.sel < 0 || c.z < GATE - 0.5 || (k === "funnel" && c.z > RZ - 1)) return k === "funnel" && c.z > RZ - 1 ? [-outer + 0.9, outer - 0.9] : null; const x = xs[fork.sel]; return [x - laneW / 2 + 0.9, x + laneW / 2 - 0.9]; },
      aim: (c) => { if (!fork) return 0; if (!fork.chosen) return fork.sel >= 0 && fork.open ? xs[fork.sel] : 0; const me = lanes.find((l) => l.me); return me?.aim ? me.aim(c) : me ? me.x : null; },
      laneOf: () => lanes.find((l) => l.me) ?? null,
      tick(dt, tt, c) {
        if (!fork) return false;
        if (!fork.chosen) {
          const go = fork.open && fork.sel >= 0;
          c.cap = go ? 12 : Math.max(0, (GATE - 4 - c.z) * 1.2);
          if (fork.open) fork.openT = Math.min(1, fork.openT + dt * 1.6);
          fork.arms.forEach((a) => { a.rotation.z = -smooth(fork!.openT) * 1.45; });
          fork.signs.forEach((m, i) => { m.emissiveIntensity = i === fork!.sel ? 0.8 + Math.sin(tt * 8) * 0.2 : fork!.open ? 0.3 : 0.2; });
          if (go && c.z > GATE + 1.5) {
            fork.chosen = true; goT = tt; c.cap = 99;
            // the other roads start now, level with you
            let gi = 0;
            lanes.forEach((l, i) => {
              l.me = i === fork!.sel; l.car = l.me ? c : newCar(xs[i], c.z); l.car.v = c.v;
              if (!l.me) { const gg = ghostG[gi++]; gg.visible = true; l.obj = gg; laneTag(l, "#fff"); }
            });
            fork.onChoose(fork.opts[fork.sel].id);
          }
          return false;
        }
        // every road runs its own rules; the buggies you didn't pick drive themselves
        let all = true;
        for (const l of lanes) {
          if (!l.me && !l.done) simulate(l, dt);
          l.tick?.(dt, l.car, l);
          if (!l.done && laneDone(l)) { l.done = true; l.doneT = tt - goT; if (l.me && l.car.z >= END && k !== "funnel") burst(l.x, h(l.x, END) + 4, END, 80); }
          if (!l.done) all = false;
          if (l.obj) { l.obj.position.set(l.car.x, l.car.y, l.car.z); l.obj.rotation.set(-l.car.pitch, l.car.yaw, l.car.roll); }
          if (l.tag) { l.tag.s.position.set(l.car.x, l.car.y + 3.2, l.car.z); drawTag(l); }
        }
        const me = lanes.find((l) => l.me)!;
        hooks?.onScore({ prog: clamp((c.z - GATE) / LEN, 0, 1) });
        hooks?.onCompare?.(lanes.map((l) => ({ id: l.id, label: l.label, me: l.me, text: l.stat()[0], color: l.stat()[1], t: l.done ? l.doneT : undefined })));
        return me.done && (all || tt - goT > LIMIT + 0.5);
      },
    };
  }
  /** drive a buggy on a road you didn't pick, by its road's rules */
  function simulate(l: Lane, dt: number) {
    const c = l.car, cs = course!;
    if (c.stopT > 0) { c.stopT -= dt; c.v = Math.max(0, c.v - 40 * dt); }
    else if (!c.air) {
      const sl = (cs.h(c.x, c.z + 0.6) - cs.h(c.x, c.z - 0.6)) / 1.2, vmax = l.vmax * (c.boostT > 0 ? 1.35 : 1);
      let a = l.acc * (1 - c.v / vmax) + (c.boostT > 0 ? 8 : 0) - GRAV * 0.55 * Math.sin(Math.atan(sl));
      c.v = clamp(c.v + a * dt, l.crawl ? l.crawl(c) : 0, Math.min(c.cap, vmax * 1.2));
    }
    c.boostT -= dt;
    const tx = l.aim ? l.aim(c) ?? l.x : l.x, want = clamp((tx - c.x) * 0.25, -0.5, 0.5);
    c.yaw += clamp((want - c.yaw) * 3, -1, 1) * 1.5 * dt * clamp(c.v / 5, 0, 1); c.yaw = clamp(c.yaw, -0.6, 0.6);
    c.x += Math.sin(c.yaw) * c.v * dt; c.z += Math.cos(c.yaw) * c.v * dt;
    const lo = l.x - (fork?.laneW ?? 6) / 2 + 0.9, hi = l.x + (fork?.laneW ?? 6) / 2 - 0.9; if (c.x < lo || c.x > hi) { c.x = clamp(c.x, lo, hi); c.yaw *= 0.5; }
    const gy = cs.h(c.x, c.z);
    if (c.air) { c.vy -= GRAV * dt; c.y += c.vy * dt; if (c.y <= gy) { c.y = gy; c.air = false; c.vy = 0; } } else c.y = gy;
    const tp = c.air ? -Math.atan2(c.vy, Math.max(4, c.v)) * 0.5 : Math.atan2(cs.h(c.x, c.z + 0.8) - cs.h(c.x, c.z - 0.8), 1.6);
    c.pitch += (tp - c.pitch) * damp(10, dt);
    if (c.v > 3 && !c.air && Math.random() < 0.3) emit(c.x, c.y + 0.25, c.z - 1.1, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 2, -c.v * 0.15, l.dust);
  }
  function clear() {
    if (course) { scene.remove(course.group); course.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) m.geometry?.dispose(); }); }
    lanes.forEach((l) => { if (l.tag) { scene.remove(l.tag.s); l.tag.t.dispose(); (l.tag.s.material as THREE.Material).dispose(); } });
    lanes = []; goT = -1; ghostG.forEach((g) => { g.visible = false; });
    disposables.splice(0).forEach((d) => d.dispose()); factMats.clear(); logoMats.clear();
    course = null;
  }
  let steerIn = 0;
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
      const raw = (kl ? 1 : 0) - (kr ? 1 : 0) + touchSteer * -1;
      steerIn += (raw - steerIn) * damp(raw === 0 ? 10 : 7, dt);
      steer = steerIn * 1.25;
      // hands off: the wheel straightens and the car follows the road, but never picks a lane for you
      if (Math.abs(raw) < 0.05) { const ahead = Math.atan2(c.roadX(car.z + 8) - c.roadX(car.z), 8); steer += clamp((ahead - car.yaw) * 2.2, -0.8, 0.8); }
    }
    if (finished) thr = -0.4;
    if (car.stopT > 0) { car.stopT -= dt; car.v = Math.max(0, car.v - 40 * dt); }
    else if (!car.air) {
      const sl = (c.h(car.x + Math.sin(car.yaw) * 0.6, car.z + Math.cos(car.yaw) * 0.6) - c.h(car.x - Math.sin(car.yaw) * 0.6, car.z - Math.cos(car.yaw) * 0.6)) / 1.2;
      const ln = c.laneOf?.() ?? null;
      const vmax = (ln?.vmax ?? c.vmax) * (car.boostT > 0 ? 1.35 : 1);
      let a = thr > 0 ? thr * (ln?.acc ?? c.acc) * (1 - car.v / vmax) : thr * 14;
      if (car.boostT > 0) a += 8;
      a -= GRAV * 0.55 * Math.sin(Math.atan(sl));
      const crawl = ln?.crawl ?? c.crawl;
      car.v = clamp(car.v + a * dt, crawl ? crawl(car) : 0, Math.min(car.cap, vmax * 1.2));
    }
    car.boostT -= dt;
    // steering (yaw follows input, softened at low speed)
    car.yaw += steer * 1.5 * dt * clamp(car.v / 5, 0, 1) * (car.air ? 0.2 : 1);
    car.yaw = clamp(car.yaw, -0.75, 0.75);
    car.x += Math.sin(car.yaw) * car.v * dt; car.z += Math.cos(car.yaw) * car.v * dt;
    // the road edges
    const bd = c.bounds?.(car);
    if (bd) { if (car.x < bd[0] || car.x > bd[1]) { car.x = clamp(car.x, bd[0], bd[1]); car.yaw *= 0.6; car.v *= 1 - damp(1.5, dt); } }
    else { const off = car.x - c.roadX(car.z); if (Math.abs(off) > c.halfW - 0.9) { car.x = c.roadX(car.z) + Math.sign(off) * (c.halfW - 0.9); car.yaw *= 0.6; car.v *= 1 - damp(1.5, dt); } }
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
      for (const sx of [-0.65, 0.65]) emit(car.x + Math.cos(car.yaw) * sx - Math.sin(car.yaw) * 1.1, car.y + 0.25, car.z - Math.cos(car.yaw) * 1.1 + Math.sin(car.yaw) * sx, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 2, -car.v * 0.15, c.laneOf?.()?.dust ?? c.dust);
    }
    if (!finished && c.tick(dt, t, car)) { finished = true; endT = t; }
    if (mode === "run" && finished && endT >= 0 && t - endT > 1.4 && running) { running = false; hooks?.onDone(); }
    if (mode === "run") hooks?.onTel(car.v * 3.6, clamp(car.z / c.len, 0, 1));
  }
  function landPuff() { for (let k = 0; k < 18; k++) emit(car.x + (Math.random() - 0.5) * 2, car.y + 0.2, car.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, course!.dust); }

  /* --- camera --- */
  let shake = 0, camSideS = 0, view: "chase" | "driver" | "wide" = "chase";
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
      const dec = mode === "decide" ? 1 : 0, wide = mode === "run" && view === "wide" ? 1 : 0, air = car.air ? 1 : 0;
      const back = (view === "chase" && !dec ? 4.4 : 5.6) + air * 2.5 + clamp(car.v / 18, 0, 1) * 0.8 + dec * 3 + wide * 1.8, up = (view === "chase" && !dec ? 1.75 : 2.3) + air * 1.8 + dec * 1.4 + wide * 1.3;
      const run = wide;
      const side = course?.camSide?.(car) ?? 0; camSideS += (side - camSideS) * damp(1.5, dt);
      const want = new THREE.Vector3(car.x - fx * back + camSideS, car.y + up + Math.abs(camSideS) * 0.25, car.z - fz * back + Math.abs(camSideS) * 0.35);
      const wantLook = new THREE.Vector3(car.x * (1 - run * 0.35) + fx * (6 + dec * 8), car.y + 1.1 + dec * 2.4, car.z + fz * (6 + dec * 8));
      const k = introT < 1.6 ? damp(2, dt) : damp(4.5, dt);
      camPos.lerp(want, k); camLook.lerp(wantLook, damp(6, dt));
      camera.position.copy(camPos);
      if (view === "driver" && mode === "run") {
        // in the seat: just behind the helmet, looking down the road through the roll cage
        const eye = new THREE.Vector3(0, 1.28, -0.05).applyEuler(new THREE.Euler(-car.pitch, car.yaw, car.roll, "YXZ")).add(new THREE.Vector3(car.x, car.y, car.z));
        camera.position.copy(eye); camPos.copy(eye); camLook.set(car.x + fx * 20, car.y + 1.0 + Math.tan(car.pitch) * 20, car.z + fz * 20);
      }
      shake = 0;
      camera.fov += ((58 + (car.boostT > 0 ? 4 : 0) + clamp(car.v / 20, 0, 1) * 3) - camera.fov) * damp(2.5, dt); camera.updateProjectionMatrix();
    }
    camera.lookAt(camLook);
    const th = THEMES[kind], sd = new THREE.Vector3(...th.sunDir).normalize();
    const sx0 = Math.round(car.x / 2) * 2, sz0 = Math.round(car.z / 2) * 2, sy0 = Math.round(car.y); key.position.set(sx0 + sd.x * 60 + 10, sy0 + 45, sz0 + sd.z * 60 - 10); key.target.position.set(sx0, sy0, sz0 + 6);
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
  let fpsT = 0, fpsN = 0, degraded = false, steerS = 0, flamesOn = false;
  function render(dt: number) {
    if (!course) return;
    carG.position.set(car.x, car.y, car.z); carG.rotation.set(-car.pitch, car.yaw, car.roll);
    if (helmet) helmet.visible = !(view === "driver" && mode === "run");
    const boosting = (car.boostT > 0 || flamesOn) && mode === "run";
    flames.forEach((f, i) => { f.visible = boosting; if (boosting) f.scale.set(1, 1, 0.8 + Math.random() * 0.6 + (i % 2) * 0.2); });
    nitroL.intensity = boosting ? 6 + Math.random() * 3 : 0;
    spinMat.opacity = clamp(car.v / 6, 0, 0.85); spins.forEach((d, i) => { d.rotation.x += car.v * dt * 3.4 * (i < 2 ? -1 : 1); });
    const sp = mode === "run" ? clamp((car.v - 9) / 10, 0, 1) + (boosting ? 0.6 : 0) : 0;
    if (SL) { slMat.opacity = sp * 0.5; for (let i = 0; i < SL; i++) { let ph = slSeed[i * 3 + 2] + dt * (1.5 + car.v * 0.12); ph -= Math.floor(ph); slSeed[i * 3 + 2] = ph; const z0 = -30 + ph * 28, L = 1.5 + sp * 4; slPos.set([slSeed[i * 3], slSeed[i * 3 + 1], z0, slSeed[i * 3] * 1.04, slSeed[i * 3 + 1] * 1.04, z0 + L], i * 6); } slGeo.attributes.position.needsUpdate = true; }
    // keep it smooth: if the device can't hold ~40 fps, drop resolution and the heaviest effects
    void degraded; void fpsT; void fpsN;
    buggy.update(dt, t); ghosts.forEach((b) => b.update(dt, t));
    updateCamera(dt);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  const onResize = () => { renderer.setSize(W(), H()); composer?.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); };
  window.addEventListener("resize", onResize);
  frame();
  const dbg = { advance(sec: number) { for (let i = 0; i < Math.round(sec * 60); i++) { if (course) { step(1 / 60); updateDust(1 / 60); course.frame?.(t, 1 / 60); updateCamera(1 / 60); } } render(0); } };
  (window as unknown as Record<string, unknown>).__game = dbg;

  return {
    decide(k, options, onChoose) {
      hooks = null; running = false; flamesOn = false;
      clear(); kind = k; applyTheme(k);
      fork = { opts: options, xs: [], laneW: 6, sel: -1, open: false, chosen: false, onChoose, arms: [], signs: [], openT: 0 };
      course = parallelWorld(k, options); scene.add(course.group);
      Object.assign(car, { x: 0, z: 4, yaw: 0, v: 6, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0, pitch: 0, roll: 0 }); car.y = 0;
      headL.intensity = k === "funnel" ? 12 : 0; dAge.fill(9); t = 0; endT = -1; finished = false;
      mode = "decide"; introT = 2; camPos.set(0, 4, -24); camLook.set(0, 1, 0); camera.fov = 58; camera.updateProjectionMatrix();
    },
    openGates() { if (fork) fork.open = true; },
    pick(i) { if (fork && fork.open && !fork.chosen) fork.sel = i; },
    preview(k, options) {
      hooks = null; running = false; clear(); kind = k; applyTheme(k);
      fork = { opts: options, xs: [], laneW: 6, sel: -1, open: false, chosen: false, onChoose: () => {}, arms: [], signs: [], openT: 0 };
      course = parallelWorld(k, options); scene.add(course.group);
      Object.assign(car, { x: 0, z: 10, yaw: 0, v: 0, vy: 0, air: false, stopT: 0, cap: 99, boostT: 0, pitch: 0, roll: 0 }); car.y = 0;
      mode = "preview"; camera.fov = 52; camera.updateProjectionMatrix();
    },
    start(_k, _choice, h) { hooks = h; mode = "run"; running = true; keys.clear(); h.onAuto?.(auto); },
    cycleView() { view = view === "chase" ? "driver" : view === "driver" ? "wide" : "chase"; onView?.(view); return view; },
    onViewChange(f) { onView = f; },
    setAuto(on) { auto = on; hooks?.onAuto?.(on); },
    setSteer(v) { if (mode === "decide") { if (v) forkKey(v < 0 ? "arrowleft" : "arrowright"); return; } touchSteer = v; if (v !== 0 && auto && running) { auto = false; hooks?.onAuto?.(false); } },
    setPaused(p) { paused = p; },
    dispose() { alive = false; cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("resize", onResize); clear(); envTex?.dispose(); pmrem.dispose(); composer?.dispose(); renderer.dispose(); renderer.domElement.remove(); if ((window as unknown as Record<string, unknown>).__game === dbg) delete (window as unknown as Record<string, unknown>).__game; },
  };
}
