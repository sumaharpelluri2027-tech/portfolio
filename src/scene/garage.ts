import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Buggy } from "./buggyTypes";
import type { CarPart, StationId } from "../content";
import { ASSETS } from "virtual:assets";
const asset = (p: string) => ASSETS[p] ?? BASE + p;

const BASE = "./";
// test-only: ?qa slows the render loop so automated UI checks aren't starved by software rendering
const QA = typeof location !== "undefined" && /[?&]qa\b/.test(location.search);
const STENCIL = '"Saira Stencil One", "Impact", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface GarageOptions {
  container: HTMLElement;
  createBuggy: () => Buggy;
  images: Record<string, string>;         // crew wall photos + driver portrait
  boardColumns?: { title: string; color: string; items: string[] }[];
  onHover: (id: StationId | null) => void;
  onSelect: (id: StationId) => void;
  onReady: () => void;
  onProgress?: (p: number) => void;
  quality?: "high" | "low";
}

export type ZoneId = "car" | "bench" | "wall" | "shelf" | "board";
export interface GarageAPI {
  focus(id: StationId | null): void;
  goZone(z: ZoneId): void;
  setXray(on: boolean): void;
  bindLabel(id: string, el: HTMLElement | null): void;
  startIntro(): void;
  dispose(): void;
}

type Station = { id: StationId; object: THREE.Object3D; anchor: THREE.Vector3; view?: { pos: THREE.Vector3; target: THREE.Vector3 } };

/* ------------------------------------------------------------------ helpers */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function fitHeight(o: THREE.Object3D, h: number) {
  const b = new THREE.Box3().setFromObject(o); const s = h / (b.max.y - b.min.y || 1);
  o.scale.multiplyScalar(s);
}
function sitOnFloor(o: THREE.Object3D, y = 0) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o); o.position.y += y - b.min.y;
}
function shadows(o: THREE.Object3D, cast = true, receive = true) {
  o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
}
function tag(o: THREE.Object3D, id: StationId) {
  o.userData.station = id; o.traverse((m) => { m.userData.station = id; });
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ main */
export function createGarage(opt: GarageOptions): GarageAPI {
  const { container } = opt;
  const low = opt.quality === "low";
  const W = () => container.clientWidth || window.innerWidth, H = () => container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 1.75));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x0c0b0a);
  scene.background = BG.clone();
  scene.fog = new THREE.Fog(0x0c0b0a, 9, 22);

  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.05, 60);
  const narrow = () => W() / H() < 0.85;
  const HOME = () => narrow()
    ? { pos: new THREE.Vector3(3.6, 2.5, 6.6), target: new THREE.Vector3(-0.2, 0.85, -0.6) }
    : { pos: new THREE.Vector3(3.9, 2.05, 4.7), target: new THREE.Vector3(-0.55, 0.95, -0.9) };
  camera.position.set(7.5, 3.4, 10.5);
  camera.lookAt(HOME().target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false; controls.minDistance = 2.2; controls.maxDistance = 10;
  controls.minPolarAngle = 0.75; controls.maxPolarAngle = 1.5;
  controls.minAzimuthAngle = -1.1; controls.maxAzimuthAngle = 1.35;
  controls.target.copy(HOME().target);
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7;
  controls.enabled = false;

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x8fa6c0, 0x1a140e, 0.0);
  scene.add(hemi);
  const lamp = new THREE.SpotLight(0xffc98a, 0, 14, 0.62, 0.55, 1.4);
  lamp.position.set(0, 4.05, 0); lamp.target.position.set(0, 0, -0.2);
  lamp.castShadow = true; lamp.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); lamp.shadow.bias = -0.0004; lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);
  const benchLight = new THREE.RectAreaLight(0xcfe3ff, 0, 1.6, 0.4);
  const fill = new THREE.PointLight(0xffb36b, 0, 9, 1.8); fill.position.set(-3.6, 2.4, -2.6); scene.add(fill);
  const shelfFill = new THREE.PointLight(0xffd59a, 0, 7, 1.8); shelfFill.position.set(4.2, 2.6, -2.4); scene.add(shelfFill);
  const rim = new THREE.DirectionalLight(0x6f8fbf, 0); rim.position.set(6, 5, 8); scene.add(rim);
  void benchLight;

  /* ---------- environment ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const manager = new THREE.LoadingManager();
  let loaded = 0, total = 0;
  manager.onStart = (_u, l, t) => { loaded = l; total = t; };
  manager.onProgress = (_u, l, t) => { loaded = l; total = t; opt.onProgress?.(t ? l / t : 0); };
  new RGBELoader(manager).load(asset("hdr/small_workshop_512.hdr"), (hdr) => {
    const env = pmrem.fromEquirectangular(hdr).texture; scene.environment = env; hdr.dispose();
  });
  (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.0;

  const texLoader = new THREE.TextureLoader(manager);
  function pbr(name: string, repeat: [number, number], extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const ld = (k: string, srgb = false) => {
      const t = texLoader.load(`${BASE}tex/${name}_${k}.webp`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const arm = ld("arm");
    return new THREE.MeshStandardMaterial({ map: ld("diff", true), normalMap: ld("nor"), aoMap: arm, roughnessMap: arm, metalnessMap: arm, metalness: 1, ...extra });
  }

  let scanTex: THREE.CanvasTexture | null = null;
  let bulbMat: THREE.MeshStandardMaterial | null = null;
  /* ---------- room ---------- */
  const room = new THREE.Group(); scene.add(room);
  const floorMat = pbr("concrete_floor_worn_001", [5, 4], { metalness: 0, roughness: 1, color: 0x9a9690 });
  floorMat.metalnessMap = null;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.z = 1.5; floor.receiveShadow = true; room.add(floor);

  const wallMat = pbr("concrete_brick_wall_001", [4, 1.4], { metalness: 0, color: 0x8c8a86 }); wallMat.metalnessMap = null;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.2), wallMat);
  back.position.set(0, 2.6, -4.3); back.receiveShadow = true; room.add(back);
  const ironMat = pbr("corrugated_iron_02", [3, 1.4], { color: 0x8a8f94 });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.2), ironMat);
  left.rotation.y = Math.PI / 2; left.position.set(-6.4, 2.6, 1.5); left.receiveShadow = true; room.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.2), wallMat.clone());
  right.rotation.y = -Math.PI / 2; right.position.set(6.4, 2.6, 1.5); right.receiveShadow = true; room.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.2, 1.5); room.add(ceil);
  // painted skirting band
  const band = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.9), new THREE.MeshStandardMaterial({ color: 0x23302b, roughness: 0.85 }));
  band.position.set(0, 0.45, -4.29); room.add(band);

  // floor markings: lift bay outline with hazard corners, oil stains
  const markTex = canvasTex(1024, 1024, (g) => {
    g.clearRect(0, 0, 1024, 1024);
    g.strokeStyle = "rgba(240,190,20,0.85)"; g.lineWidth = 16; g.setLineDash([60, 28]);
    g.strokeRect(60, 60, 904, 904); g.setLineDash([]);
    const stripe = (x: number, y: number, w: number, h: number) => {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      for (let i = -h; i < w + h; i += 44) { g.fillStyle = "rgba(240,190,20,0.9)"; g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + 22, y); g.lineTo(x + i + 22 - h, y + h); g.lineTo(x + i - h, y + h); g.fill(); }
      g.restore();
    };
    stripe(60, 980 - 60, 904, 40);
    g.font = `bold 64px ${STENCIL}`; g.fillStyle = "rgba(240,190,20,0.75)"; g.textAlign = "center";
    g.fillText("BAY 08", 512, 160);
    for (const [x, y, r] of [[300, 640, 120], [700, 380, 90], [560, 760, 60]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(10,8,6,0.55)"); gr.addColorStop(1, "rgba(10,8,6,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ map: markTex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  marks.rotation.x = -Math.PI / 2; marks.position.set(0, 0.005, -0.35); marks.receiveShadow = true; room.add(marks);

  // wall stencil
  const sign = canvasTex(2048, 360, (g) => {
    g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, 2048, 360);
    g.font = `200px ${STENCIL}`; g.fillStyle = "rgba(236,226,206,0.88)"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText("SUMAHAR'S GARAGE", 20, 150);
    g.font = `500 44px ${MONO}`; g.fillStyle = "rgba(240,190,20,0.95)";
    g.fillText("SYSTEMS · DATA · OPERATIONS — EST. VIT VELLORE", 26, 300);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.98), new THREE.MeshStandardMaterial({ map: sign, transparent: true, roughness: 0.95, depthWrite: false }));
  signMesh.position.set(-1.2, 3.35, -4.27); room.add(signMesh);

  /* ---------- the lift and the buggy ---------- */
  const buggy = opt.createBuggy();
  const car = new THREE.Group(); car.add(buggy.root); scene.add(car);
  car.rotation.y = 1.3; car.position.set(-0.2, 0, -0.55);
  const LIFT_H = 0.32;
  buggy.root.position.y = LIFT_H;
  // low scissor lift: a deck on crossed legs, nothing between the visitor and the car
  const liftMat = new THREE.MeshStandardMaterial({ color: 0x2a5fb8, metalness: 0.45, roughness: 0.42 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b8f94, metalness: 1, roughness: 0.35 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b400, metalness: 0.2, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 2.7), liftMat); deck.position.set(s * 0.62, LIFT_H - 0.035, 0); car.add(deck);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 2.72), yellow); lip.position.set(s * 0.62, LIFT_H - 0.075, 0); car.add(lip);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 2.4), steel); base.position.set(s * 0.62, 0.025, 0); car.add(base);
    for (const z of [-0.55, 0.55]) {
      for (const d of [-1, 1]) {
        const len = Math.hypot(1.0, LIFT_H - 0.1);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), steel);
        leg.position.set(s * 0.62 + d * 0.12, (LIFT_H - 0.05) / 2, z); leg.rotation.x = d * Math.atan2(LIFT_H - 0.1, 1.0); car.add(leg);
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), yellow); pin.rotation.z = Math.PI / 2; pin.position.set(s * 0.62, (LIFT_H - 0.05) / 2, z); car.add(pin);
    }
    const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 14), steel); ram.rotation.x = 1.25; ram.position.set(s * 0.62, 0.15, -0.95); car.add(ram);
    for (const z of [-1.28, 1.28]) { const stop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.08), rubber); stop.position.set(s * 0.62, LIFT_H + 0.03, z); car.add(stop); }
  }
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.3), liftMat); pump.position.set(-1.25, 0.25, -1.1); car.add(pump);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.1, 0.35, -1.1), new THREE.Vector3(-0.95, 0.03, -1.05), new THREE.Vector3(-0.7, 0.05, -0.95)]), 20, 0.015, 6), rubber); car.add(hose);
  shadows(car);

  /* ---------- stations ---------- */
  const stations = new Map<StationId, Station>();
  const parts = buggy.parts;
  (Object.keys(parts) as CarPart[]).forEach((id) => {
    const g = parts[id];
    tag(g, id);
    g.userData.rest = g.position.clone();
    stations.set(id, { id, object: g, anchor: (g.userData.anchor as THREE.Vector3)?.clone() ?? new THREE.Vector3() });
  });

  const loader = new GLTFLoader(manager); loader.setMeshoptDecoder(MeshoptDecoder);
  const props = new THREE.Group(); scene.add(props);
  const load = (n: string) => new Promise<THREE.Group>((res) => loader.load(asset(`models/${n}.glb`), (g) => { shadows(g.scene); res(g.scene); }, undefined, () => res(new THREE.Group())));

  const ray = new THREE.Raycaster();
  /** drop an object straight down onto whatever is below (x,z) inside `on` */
  function dropOnto(o: THREE.Object3D, on: THREE.Object3D, x: number, z: number, fallbackY: number) {
    on.updateMatrixWorld(true);
    ray.set(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(on, true)[0];
    o.position.set(x, 0, z);
    sitOnFloor(o, hit ? hit.point.y : fallbackY);
  }
  function addStation(id: StationId, obj: THREE.Object3D, view?: { pos: [number, number, number]; target: [number, number, number] }) {
    tag(obj, id);
    const b = new THREE.Box3().setFromObject(obj);
    const anchor = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.08, (b.min.z + b.max.z) / 2);
    stations.set(id, { id, object: obj, anchor, view: view && { pos: new THREE.Vector3(...view.pos), target: new THREE.Vector3(...view.target) } });
  }

  // simple procedural trophy
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 1, roughness: 0.25 });
  const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.6 });
  function trophy(h = 0.32) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), plaqueMat); base.position.y = 0.03; g.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, h * 0.35, 12), gold); stem.position.y = 0.06 + h * 0.175; g.add(stem);
    const cupPts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.03, 0.01), new THREE.Vector2(0.06, 0.06), new THREE.Vector2(0.075, h * 0.5)];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 24), gold); cup.position.y = 0.06 + h * 0.35; g.add(cup);
    for (const s of [-1, 1]) { const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 16, Math.PI), gold); handle.position.set(s * 0.075, 0.06 + h * 0.6, 0); handle.rotation.z = s * -Math.PI / 2; g.add(handle); }
    shadows(g); return g;
  }
  function labelPlate(text: string, w = 0.5, h = 0.16, color = "#e8b400") {
    const t = canvasTex(512, Math.round(512 * h / w), (g) => {
      g.fillStyle = "#151311"; g.fillRect(0, 0, 512, 512);
      g.fillStyle = color; g.font = `${Math.round(140 * h / w)}px ${STENCIL}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, 256, Math.round(256 * h / w) + 4);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  }

  const ready = (async () => {
    if (document.fonts?.load) { try { await Promise.all([document.fonts.load(`80px ${STENCIL}`), document.fonts.load(`40px ${MONO}`)]); } catch { /* ignore */ } }
    const names = ["metal_tool_chest", "boombox", "hanging_industrial_lamp", "steel_frame_shelves_01", "classic_laptop", "clipboard", "old_tyre", "metal_jerrycan", "oil_tin", "metal_stool_01", "ratchet_wrench", "adjustable_wrench", "cardboard_box_01", "korean_fire_extinguisher_01", "power_box_01", "industrial_storage_cart", "mounted_fluorescent_lights"];
    const M: Record<string, THREE.Group> = {};
    await Promise.all(names.map(async (n) => { M[n] = await load(n); }));

    // hanging lamp over the car
    const lampModel = M.hanging_industrial_lamp; lampModel.position.set(0, 5.2, 0); props.add(lampModel);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 0 }));
    bulb.position.set(0, 3.95, 0); props.add(bulb); bulbMat = bulb.material as THREE.MeshStandardMaterial;
    // ceiling tubes
    for (const [x, z] of [[-3.6, -2.6], [3.8, -2.4], [-2.2, 2.2]]) {
      const t = M.mounted_fluorescent_lights.clone(); t.position.set(x, 5.15, z); props.add(t);
    }

    // workbench (cart) on the back-left with laptop, radio and oil
    const bench = M.industrial_storage_cart; bench.position.set(-3.5, 0, -3.55); props.add(bench); sitOnFloor(bench);
    const benchTop = (x: number, z: number, fallback: number) => ({ x, z, fallback });
    const laptop = M.classic_laptop; laptop.rotation.y = 0.35; props.add(laptop);
    const lt = benchTop(-3.85, -3.45, 1.0); dropOnto(laptop, bench, lt.x, lt.z, lt.fallback);
    addStation("laptop", laptop, { pos: [-2.6, 1.9, -1.6], target: [-3.7, 1.1, -3.5] });
    const radio = M.boombox; radio.rotation.y = -0.25; fitHeight(radio, 0.36); props.add(radio);
    dropOnto(radio, bench, -3.05, -3.6, 1.0);
    addStation("radio", radio, { pos: [-2.4, 1.8, -1.8], target: [-3.1, 1.1, -3.6] });
    for (const [x, z] of [[-4.15, -3.75], [-4.0, -3.78]]) { const tin = M.oil_tin.clone(); props.add(tin); dropOnto(tin, bench, x, z, 1.0); }

    // clipboard hung on the wall by the bench
    const clip = M.clipboard; fitHeight(clip, 0.06); clip.scale.multiplyScalar(1.6);
    clip.rotation.x = Math.PI / 2; clip.position.set(-2.62, 1.72, -4.22); props.add(clip);
    const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8), steel); nail.rotation.x = Math.PI / 2; nail.position.set(-2.62, 2.0, -4.22); props.add(nail);
    addStation("clipboard", clip, { pos: [-2.1, 1.7, -2.5], target: [-2.62, 1.6, -4.2] });

    // power box on the wall (the X-ray switch)
    const pbox = M.power_box_01; pbox.rotation.y = 0; pbox.position.set(-0.9, 1.55, -4.08); props.add(pbox);
    const plate = labelPlate("LIFT THE BONNET", 0.6, 0.11); plate.position.set(-0.9, 1.88, -4.27); props.add(plate);
    addStation("powerbox", pbox, { pos: [-0.2, 1.7, -2.2], target: [-0.9, 1.5, -4.1] });

    // ---- boards made from cork with pinned photos ----
    const imgLoader = new THREE.TextureLoader(manager);
    const corkTex = canvasTex(1024, 640, (g) => {
      g.fillStyle = "#a97c4f"; g.fillRect(0, 0, 1024, 640);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 40},${20},${Math.random() * 0.35})`; g.fillRect(Math.random() * 1024, Math.random() * 640, 2, 2); }
      g.strokeStyle = "#3a2a1c"; g.lineWidth = 26; g.strokeRect(0, 0, 1024, 640);
    });
    const corkFace = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 1 });
    function photo(src: string, w: number, aspect = 0.66) {
      const t = imgLoader.load(src); t.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group();
      const border = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, w * aspect + 0.05), new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.8 }));
      const ph = new THREE.Mesh(new THREE.PlaneGeometry(w, w * aspect), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 })); ph.position.z = 0.003;
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd2261b, roughness: 0.3 })); pin.position.set(0, w * aspect * 0.45, 0.03);
      g.add(border, ph, pin); return g;
    }
    function board(w: number, h: number, title: string, shots: [string, number, number, number, number][]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [plaqueMat, plaqueMat, plaqueMat, plaqueMat, corkFace, plaqueMat]));
      const tt = labelPlate(title, Math.min(w * 0.7, 1.1), 0.13); tt.position.set(-w / 2 + Math.min(w * 0.7, 1.1) / 2 + 0.08, h / 2 - 0.12, 0.025); g.add(tt);
      for (const [key, x, y, pw, rot] of shots) { const src = opt.images[key]; if (!src) continue; const p = photo(src, pw); p.position.set(x, y, 0.025); p.rotation.z = rot; g.add(p); }
      shadows(g, false, true); return g;
    }
    const crew = board(1.55, 1.25, "PIT CREW · THE WING", [["aiaw-event", -0.27, -0.02, 0.86, -0.04], ["aiaw-team", 0.42, -0.3, 0.58, 0.06]]);
    crew.position.set(1.25, 1.95, -4.25); props.add(crew);
    addStation("crew", crew, { pos: [1.3, 1.9, -1.7], target: [1.25, 1.9, -4.2] });
    const decco = board(1.3, 1.1, "DECCO STORE", [["decco-stall", -0.26, -0.06, 0.62, 0.05], ["decco-team", 0.3, -0.22, 0.56, -0.05], ["decco-shot", 0.32, 0.2, 0.42, 0.02]]);
    decco.position.set(2.95, 1.8, -4.25); props.add(decco);
    addStation("decco", decco, { pos: [2.8, 1.8, -1.9], target: [2.95, 1.8, -4.2] });

    // driver poster: a racing-licence style print with the portrait
    const poster = new THREE.Group(); poster.position.set(-1.72, 2.15, -4.24); props.add(poster);
    const portrait = await new Promise<HTMLImageElement | null>((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = opt.images.driver || ""; });
    const posterTex = canvasTex(720, 1000, (g) => {
      g.fillStyle = "#14110e"; g.fillRect(0, 0, 720, 1000);
      if (portrait) { const s = Math.max(720 / portrait.width, 760 / portrait.height); const w = portrait.width * s, h = portrait.height * s; g.drawImage(portrait, (720 - w) / 2, 70, w, h); }
      const gr = g.createLinearGradient(0, 560, 0, 1000); gr.addColorStop(0, "rgba(20,17,14,0)"); gr.addColorStop(0.45, "rgba(20,17,14,0.92)"); gr.addColorStop(1, "#14110e");
      g.fillStyle = gr; g.fillRect(0, 560, 720, 440);
      g.fillStyle = "#f2b705"; g.fillRect(0, 0, 720, 70);
      g.fillStyle = "#14110e"; g.font = `52px ${STENCIL}`; g.textBaseline = "middle"; g.fillText("DRIVER LICENCE · Nº 08", 26, 38);
      g.fillStyle = "#efe9dc"; g.font = `112px ${STENCIL}`; g.textBaseline = "alphabetic"; g.fillText("SUMAHAR", 26, 850);
      g.fillStyle = "#f2b705"; g.font = `64px ${STENCIL}`; g.fillText("PELLURI", 30, 920);
      g.fillStyle = "rgba(239,233,220,0.8)"; g.font = `500 26px ${MONO}`; g.fillText("CLASS: OPERATIONS · GROWTH · DATA", 30, 968);
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b1916, metalness: 0.6, roughness: 0.4 });
    const pf = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.34, 0.04), frameMat); poster.add(pf);
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.45, emissive: 0xffffff, emissiveMap: posterTex, emissiveIntensity: 0.06 })); pp.position.z = 0.022; poster.add(pp);
    const posterLight = new THREE.SpotLight(0xffd9a0, 6, 4, 0.45, 0.6, 1.5); posterLight.position.set(-1.72, 3.4, -3.3); posterLight.target = poster; scene.add(posterLight);
    shadows(poster, false, true);
    addStation("driver", poster, { pos: [-1.5, 2.0, -2.2], target: [-1.72, 2.1, -4.2] });

    // build board on the left wall: every project, as index cards
    const bb = new THREE.Group(); bb.position.set(-6.36, 2.05, 0.95); bb.rotation.y = Math.PI / 2; props.add(bb);
    const bbTex = canvasTex(1600, 900, (g) => {
      g.fillStyle = "#e9e5dc"; g.fillRect(0, 0, 1600, 900);
      g.strokeStyle = "rgba(0,0,0,0.06)"; for (let x = 0; x < 1600; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 900); g.stroke(); } for (let y = 0; y < 900; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1600, y); g.stroke(); }
      g.fillStyle = "#14110e"; g.font = `86px ${STENCIL}`; g.fillText("BUILD BOARD", 40, 104);
      g.fillStyle = "#c8261b"; g.font = `600 30px ${MONO}`; g.fillText("MASTERS' UNION · LIVE · CASES · COURSEWORK", 600, 96);
      const cols = (opt.boardColumns ?? []);
      cols.forEach((col, ci) => {
        const x = 40 + ci * 390;
        g.fillStyle = col.color; g.fillRect(x, 150, 360, 56); g.fillStyle = "#14110e"; g.font = `34px ${STENCIL}`; g.fillText(col.title, x + 14, 192);
        col.items.slice(0, 7).forEach((it, k) => {
          const y = 222 + k * 92; const r = (Math.sin(ci * 7 + k * 3) * 0.02);
          g.save(); g.translate(x + 180, y + 40); g.rotate(r);
          g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(-176, -34, 360, 80);
          g.fillStyle = "#fffdf6"; g.fillRect(-180, -40, 360, 80);
          g.fillStyle = col.color; g.fillRect(-180, -40, 10, 80);
          g.fillStyle = "#14110e"; g.font = `600 27px ${MONO}`; g.fillText(it.length > 24 ? it.slice(0, 23) + "…" : it, -160, 8);
          g.restore();
        });
      });
    });
    bb.add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.55, 0.05), frameMat));
    const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.46), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.6 })); bbFace.position.z = 0.027; bb.add(bbFace);
    const bbLight = new THREE.SpotLight(0xfff1d6, 9, 6, 0.6, 0.6, 1.5); bbLight.position.set(-4.6, 4.2, 0.95); bbLight.target = bb; scene.add(bbLight);
    shadows(bb, false, true);
    addStation("board", bb, { pos: [-3.2, 2.0, 0.95], target: [-6.3, 1.95, 0.95] });

    // trophy shelf on the back-right
    const shelf = M.steel_frame_shelves_01; fitHeight(shelf, 2.15); shelf.rotation.y = -0.1; shelf.position.set(4.7, 0, -3.6); props.add(shelf); sitOnFloor(shelf);
    const tro = new THREE.Group(); props.add(tro);
    const shelfB = new THREE.Box3().setFromObject(shelf);
    const sx = [shelfB.min.x + 0.2, (shelfB.min.x + shelfB.max.x) / 2, shelfB.max.x - 0.25];
    const levels: number[] = [];
    for (const yy of [0.9, 1.3, 1.75, 2.2]) {
      ray.set(new THREE.Vector3((shelfB.min.x + shelfB.max.x) / 2, yy, -3.6), new THREE.Vector3(0, -1, 0));
      const h = ray.intersectObject(shelf, true)[0]; if (h && !levels.some((l) => Math.abs(l - h.point.y) < 0.15)) levels.push(h.point.y);
    }
    const L = levels.length ? levels : [0.75, 1.2, 1.65];
    let k = 0;
    for (const y of L.slice(-3)) for (const x of sx) {
      if (k++ % 2) { const t = trophy(0.22 + Math.random() * 0.12); t.position.set(x, y, -3.6); tro.add(t); }
      else { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.03), gold); p.position.set(x, y + 0.14, -3.65); p.rotation.x = -0.12; p.castShadow = true; tro.add(p); }
    }
    const trophyGroup = new THREE.Group(); props.add(trophyGroup); trophyGroup.add(shelf, tro);
    const shelfPlate = labelPlate("WINS", 0.36, 0.12); shelfPlate.position.set(4.62, 2.32, -3.25); trophyGroup.add(shelfPlate);
    addStation("trophies", trophyGroup, { pos: [3.4, 1.8, -0.9], target: [4.7, 1.3, -3.6] });

    // tool chest on the left wall
    const chest = M.metal_tool_chest; fitHeight(chest, 1.05); chest.rotation.y = Math.PI / 2; chest.position.set(-5.85, 0, -1.3); props.add(chest); sitOnFloor(chest);
    const chestPlate = labelPlate("TOOLS", 0.4, 0.12); chestPlate.rotation.y = Math.PI / 2; chestPlate.position.set(-5.5, 1.2, -1.3); props.add(chestPlate);
    const chestG = new THREE.Group(); props.add(chestG); chestG.add(chest, chestPlate);
    addStation("toolchest", chestG, { pos: [-3.6, 1.6, 0.4], target: [-5.8, 0.7, -1.3] });

    // crates: shipped (stack of 3) and prototypes
    const shippedG = new THREE.Group(); props.add(shippedG);
    const boxB = new THREE.Box3().setFromObject(M.cardboard_box_01); const bh = boxB.max.y - boxB.min.y;
    [[0, 0, 0.05], [0.04, 1, -0.12], [-0.02, 2, 0.2]].forEach(([dx, lvl, rot]) => {
      const b = M.cardboard_box_01.clone(); b.scale.multiplyScalar(1.5); b.rotation.y = rot; b.position.set(5.2 + dx, lvl * bh * 1.5, -0.6); shippedG.add(b); sitOnFloor(b, lvl * bh * 1.5);
    });
    const shipPlate = labelPlate("SHIPPED · 6", 0.5, 0.13); shipPlate.rotation.y = -Math.PI / 2 + 0.35; shipPlate.position.set(4.82, bh * 1.5 * 2.4, -0.45); shippedG.add(shipPlate);
    addStation("shipped", shippedG, { pos: [3.1, 1.6, 1.4], target: [5.2, 0.8, -0.6] });

    const protoG = new THREE.Group(); props.add(protoG);
    for (const [dx, dz, r] of [[0, 0, 0.3], [0.5, 0.25, -0.2]]) { const b = M.cardboard_box_01.clone(); b.scale.multiplyScalar(1.3); b.rotation.y = r; b.position.set(4.6 + dx, 0, 1.0 + dz); protoG.add(b); sitOnFloor(b); }
    const protoPlate = labelPlate("PROTOTYPES", 0.46, 0.11); protoPlate.rotation.y = -Math.PI / 2 + 0.6; protoPlate.position.set(4.45, 0.55, 1.25); protoG.add(protoPlate);
    addStation("prototypes", protoG, { pos: [2.8, 1.4, 2.6], target: [4.8, 0.4, 1.1] });

    // diagnostic scanner cart (procedural) at the front-right of the car
    const scanner = new THREE.Group(); scanner.position.set(2.55, 0, 0.35); scanner.rotation.y = -0.85; props.add(scanner);
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.45), new THREE.MeshStandardMaterial({ color: 0xc8261b, metalness: 0.5, roughness: 0.4 })); cartBody.position.y = 0.52; scanner.add(cartBody);
    for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x111111 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.05, z); scanner.add(w); }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.08), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.4, roughness: 0.5 })); head.position.set(0, 1.18, 0.02); head.rotation.x = -0.35; scanner.add(head);
    scanTex = canvasTex(512, 320, (g) => drawScan(g, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.27), new THREE.MeshStandardMaterial({ map: scanTex, emissive: 0xffffff, emissiveMap: scanTex, emissiveIntensity: 1.1, roughness: 0.3 }));
    screen.position.set(0, 1.18, 0.065); screen.rotation.x = -0.35; scanner.add(screen);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.9 })); paper.position.set(0.12, 0.98, 0.235); paper.rotation.x = 0.25; scanner.add(paper);
    const scanPlate = labelPlate("RUN A DIAGNOSTIC", 0.5, 0.08, "#ffffff"); scanPlate.position.set(0, 0.8, 0.228); scanner.add(scanPlate);
    // cable from scanner to the car
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.35, 0.9, 0.35), new THREE.Vector3(2.0, 0.04, 0.4), new THREE.Vector3(1.2, 0.03, 0.3), new THREE.Vector3(0.7, 0.55, 0.25)]), 40, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }));
    props.add(cable);
    shadows(scanner);
    addStation("scanner", scanner, { pos: [4.0, 1.7, 2.0], target: [2.55, 1.0, 0.35] });

    // dressing
    for (const [x, y, z, rx, ry] of [[-5.3, 0.3, 2.2, 0, 0.3], [-5.3, 0.3, 2.45, 0, -0.1], [-5.35, 0.66, 2.3, Math.PI / 2, 0]]) { const t = M.old_tyre.clone(); t.position.set(x, y, z); t.rotation.set(rx, ry, 0); props.add(t); }
    const can = M.metal_jerrycan; can.position.set(-2.5, 0, -3.95); can.rotation.y = 0.4; props.add(can); sitOnFloor(can);
    const ext = M.korean_fire_extinguisher_01; ext.position.set(6.1, 0, -2.4); ext.rotation.y = -Math.PI / 2; props.add(ext); sitOnFloor(ext);
    const stool = M.metal_stool_01; stool.position.set(-2.4, 0, -2.6); props.add(stool); sitOnFloor(stool);
    const r1 = M.ratchet_wrench; r1.rotation.set(Math.PI / 2, 0, 0.6); r1.position.set(1.3, 0.02, 0.9); props.add(r1);
    const r2 = M.adjustable_wrench; r2.rotation.set(Math.PI / 2, 0, -1.1); r2.position.set(1.45, 0.02, 1.05); props.add(r2);
    props.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  })();

  /* ---------- scanner screen ---------- */
  function drawScan(g: CanvasRenderingContext2D, t: number) {
    g.fillStyle = "#06140b"; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = "rgba(80,255,140,0.25)"; g.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 320); g.stroke(); }
    for (let y = 0; y < 320; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.strokeStyle = "#5dff9a"; g.lineWidth = 4; g.beginPath();
    for (let x = 0; x < 512; x += 4) { const y = 190 + Math.sin(x * 0.045 + t * 3) * 30 * Math.sin(t * 0.7 + x * 0.01) + Math.sin(x * 0.2 + t * 7) * 4; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = "#5dff9a"; g.font = `bold 34px ${MONO}`; g.fillText("OBD · SUMAHAR-08", 22, 52);
    g.font = `26px ${MONO}`; g.fillText(Math.floor(t * 2) % 2 ? "TAP TO SCAN ▮" : "TAP TO SCAN", 22, 296);
  }

  /* ---------- x-ray (lift the bonnet) ---------- */
  const xrayMat = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, wireframe: true, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
  const xrayHot = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const xrayFaint = new THREE.MeshBasicMaterial({ color: 0x2c6e9e, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending });
  const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const grid = new THREE.GridHelper(16, 64, 0x1f6fa8, 0x123a5c); grid.position.set(0, 0.01, 1.5); grid.visible = false;
  (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.5; scene.add(grid);
  const wires = new THREE.Group(); wires.visible = false; scene.add(wires);
  const wireMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, color: { value: new THREE.Color(0xffd23a) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform float t; uniform vec3 color; varying vec2 vUv; void main(){ float d=fract(vUv.x*14.-t*1.6); float a=smoothstep(0.,.15,d)*smoothstep(.6,.45,d); gl_FragColor=vec4(color*(1.4+a*2.),.35+a*.65); }",
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const wireTargets = new Map<string, THREE.Vector3>();
  let xray = false;
  function buildWires() {
    wires.clear(); wireTargets.clear();
    const ids = Object.keys(parts) as CarPart[];
    ids.forEach((id, i) => {
      const from = worldAnchor(id);
      const a = (i / (ids.length - 1)) * Math.PI - Math.PI;   // arc behind/above the car
      const to = new THREE.Vector3(-0.2 + Math.cos(a) * 2.5, 2.05 + (i % 2) * 0.42, -0.9 + Math.sin(a) * 1.3);
      const mid = from.clone().lerp(to, 0.5); mid.y += 0.5;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 60, 0.012, 6), wireMat);
      wires.add(tube);
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
      node.position.copy(to); wires.add(node);
      wireTargets.set("wire-" + id, to);
    });
  }
  function setXray(on: boolean) {
    if (on === xray) return; xray = on;
    if (on) {
      if (!wires.children.length) buildWires();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || wires.children.includes(m) || o === grid) return;
        saved.set(m, m.material);
        const isPart = !!m.userData.partId;
        let inCar = false; for (let q: THREE.Object3D | null = m; q; q = q.parent) if (q === car) { inCar = true; break; }
        m.material = isPart ? xrayHot : inCar ? xrayMat : xrayFaint;
      });
      scene.background = new THREE.Color(0x041224); (scene.fog as THREE.Fog).color.set(0x041224);
      grid.visible = true; wires.visible = true; floor.visible = false; marks.visible = false;
    } else {
      saved.forEach((mat, m) => { m.material = mat; }); saved.clear();
      scene.background = BG.clone(); (scene.fog as THREE.Fog).color.copy(BG);
      grid.visible = false; wires.visible = false; floor.visible = true; marks.visible = true;
    }
  }

  /* ---------- post-processing ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(W(), H()), scene, camera);
  outline.edgeStrength = 4; outline.edgeGlow = 0.6; outline.edgeThickness = 1.6; outline.pulsePeriod = 2.4;
  outline.visibleEdgeColor.set(0xffc21a); outline.hiddenEdgeColor.set(0x6b4d00);
  composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.45, 0.5, 0.86);
  if (!low) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- picking ---------- */
  const pointer = new THREE.Vector2(); let pointerIn = false, hovered: StationId | null = null;
  const pickables = () => [...stations.values()].map((s) => s.object);
  function pick(): StationId | null {
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(pickables(), true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.station) o = o.parent;
    return (o?.userData.station as StationId) ?? null;
  }
  const el = renderer.domElement;
  let down: { x: number; y: number; t: number } | null = null;
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); pointerIn = e.pointerType === "mouse";
  };
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; onMove(e); };
  const onUp = (e: PointerEvent) => {
    if (!down || !introDone) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 8) return;
    onMove(e);
    const id = pick(); if (id) opt.onSelect(id);
  };
  const onLeave = () => { pointerIn = false; };
  el.addEventListener("pointermove", onMove); el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp); el.addEventListener("pointerleave", onLeave);

  /* ---------- camera moves + exploded parts ---------- */
  type Tween = { from: { pos: THREE.Vector3; target: THREE.Vector3 }; to: { pos: THREE.Vector3; target: THREE.Vector3 }; t: number; dur: number };
  let tween: Tween | null = null;
  let focused: StationId | null = null;
  function flyTo(to: { pos: THREE.Vector3; target: THREE.Vector3 }, dur = 1.3) {
    tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t: 0, dur };
  }
  function worldAnchor(id: StationId) {
    const s = stations.get(id)!;
    if (parts[id as CarPart]) { const v = (parts[id as CarPart].userData.anchor as THREE.Vector3).clone(); return buggy.root.localToWorld(v); }
    return s.anchor.clone();
  }
  function partView(id: CarPart) {
    const g = parts[id];
    const rest = (g.userData.rest as THREE.Vector3).clone().add(g.userData.explode as THREE.Vector3);
    const centre = buggy.root.localToWorld(rest.clone());
    const out = buggy.root.localToWorld(rest.clone().multiplyScalar(1).add(new THREE.Vector3(0, 0, 0)));
    const carCentre = buggy.root.localToWorld(new THREE.Vector3(0, 0.8, 0));
    const dir = out.clone().sub(carCentre).setY(0).normalize();
    if (dir.lengthSq() < 0.01) dir.set(0.6, 0, 0.8).normalize();
    // keep the camera on the visitor's side of the car
    const toCam = HOME().pos.clone().sub(carCentre).setY(0).normalize();
    dir.lerp(toCam, 0.45).normalize();
    const pos = centre.clone().add(dir.multiplyScalar(narrow() ? 2.6 : 1.85)); pos.y = centre.y + 0.6;
    // shift target so the part sits left of the side panel on desktop
    const side = new THREE.Vector3().subVectors(pos, centre).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const target = centre.clone().add(side.multiplyScalar(narrow() ? 0 : -0.45));
    if (narrow()) target.y -= 0.35;
    return { pos, target };
  }
  function focus(id: StationId | null) {
    focused = id;
    if (!id) { flyTo(HOME()); return; }
    const s = stations.get(id); if (!s) return;
    if (parts[id as CarPart]) flyTo(partView(id as CarPart));
    else if (s.view) {
      const v = { pos: s.view.pos.clone(), target: s.view.target.clone() };
      if (!narrow()) { const side = new THREE.Vector3().subVectors(v.pos, v.target).cross(new THREE.Vector3(0, 1, 0)).normalize(); v.target.add(side.multiplyScalar(-0.5)); }
      flyTo(v);
    }
  }

  /* ---------- zones: walk around the garage ---------- */
  function goZone(z: ZoneId) {
    focused = null;
    if (z === "car") { flyTo(HOME()); return; }
    const n = narrow();
    const Z: Record<Exclude<ZoneId, "car">, { pos: [number, number, number]; target: [number, number, number] }> = {
      bench: { pos: n ? [-1.0, 2.0, 1.0] : [-1.3, 1.85, -0.4], target: [-3.3, 1.2, -3.6] },
      wall: { pos: n ? [0.6, 2.0, 2.4] : [0.6, 1.95, 0.9], target: [0.6, 1.95, -4.2] },
      shelf: { pos: n ? [2.2, 1.9, 1.4] : [2.5, 1.8, 0.1], target: [4.7, 1.35, -3.6] },
      board: { pos: n ? [-2.2, 2.0, 2.6] : [-2.9, 2.0, 1.4], target: [-6.3, 1.9, 0.9] },
    };
    flyTo({ pos: new THREE.Vector3(...Z[z].pos), target: new THREE.Vector3(...Z[z].target) }, 1.4);
  }

  /* ---------- labels ---------- */
  const labels = new Map<string, HTMLElement>();
  function bindLabel(id: string, node: HTMLElement | null) { if (node) labels.set(id, node); else labels.delete(id); }
  const tmp = new THREE.Vector3();
  function placeLabels() {
    const w = W(), h = H();
    labels.forEach((node, id) => {
      let p: THREE.Vector3 | undefined;
      if (id.startsWith("wire-")) p = wireTargets.get(id);
      else if (stations.has(id as StationId)) p = worldAnchor(id as StationId);
      if (!p) { node.style.opacity = "0"; return; }
      tmp.copy(p).project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      node.style.transform = `translate3d(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px, 0)`;
      node.dataset.vis = vis ? "1" : "0";
    });
  }

  /* ---------- intro ---------- */
  let introStart = -1, introDone = false;
  function startIntro() { introStart = clock.getElapsedTime(); }
  function lightLevel(k: number) {
    lamp.intensity = 46 * k; if (bulbMat) bulbMat.emissiveIntensity = 7 * k;
    hemi.intensity = 0.32 * k; fill.intensity = 6 * k; shelfFill.intensity = 4.5 * k; rim.intensity = 0.55 * k;
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.22 * k;
  }
  lightLevel(0);

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0, running = true, lastScan = 0;

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    // intro: flicker, then dolly in
    if (introStart >= 0 && !introDone) {
      const it = t - introStart;
      const flick = it < 0.35 ? 0 : it < 0.5 ? 0.7 : it < 0.62 ? 0.05 : it < 0.75 ? 0.9 : it < 0.85 ? 0.2 : Math.min(1, 0.6 + (it - 0.85) * 1.2);
      lightLevel(flick);
      const k = ease(Math.min(1, Math.max(0, (it - 0.3) / 2.6)));
      const H0 = HOME(); const start = new THREE.Vector3(7.5, 3.4, 10.5);
      camera.position.lerpVectors(start, H0.pos, k); controls.target.copy(H0.target);
      if (it > 2.95) { introDone = true; controls.enabled = true; lightLevel(1); opt.onReady(); }
    }

    // camera tween
    if (tween) {
      tween.t += dt / tween.dur; const k = ease(Math.min(1, tween.t));
      camera.position.lerpVectors(tween.from.pos, tween.to.pos, k);
      controls.target.lerpVectors(tween.from.target, tween.to.target, k);
      if (tween.t >= 1) tween = null;
    }
    // exploded parts
    (Object.keys(parts) as CarPart[]).forEach((id) => {
      const g = parts[id]; const rest = g.userData.rest as THREE.Vector3; const ex = g.userData.explode as THREE.Vector3;
      const target = focused === id ? rest.clone().add(ex) : rest;
      g.position.lerp(target, 1 - Math.pow(0.0015, dt));
      if (focused === id) g.rotation.y += dt * 0.35; else g.rotation.y += (0 - g.rotation.y) * Math.min(1, dt * 4);
    });

    // hover
    if (introDone && pointerIn && !tween) {
      const id = pick();
      if (id !== hovered) {
        hovered = id; opt.onHover(id); el.style.cursor = id ? "pointer" : "grab";
        outline.selectedObjects = id ? [stations.get(id)!.object] : [];
      }
    } else if (!pointerIn && hovered && !focused) { hovered = null; opt.onHover(null); outline.selectedObjects = []; }
    if (focused && stations.has(focused)) outline.selectedObjects = [stations.get(focused)!.object];
    else if (!hovered) outline.selectedObjects = [];


    // lamp sway + flicker
    if (introDone) {
      const f = 1 - (Math.random() < 0.004 ? 0.35 : 0) - Math.sin(t * 50) * 0.01;
      lamp.intensity = 46 * f; if (bulbMat) bulbMat.emissiveIntensity = 7 * f;
    }
    if (scanTex && t - lastScan > 0.08) { lastScan = t; drawScan(scanTex.image.getContext("2d"), t); scanTex.needsUpdate = true; }
    wireMat.uniforms.t.value = t;
    buggy.update(dt, t);
    controls.update();
    composer.render();
    placeLabels();
    raf = QA ? (window.setTimeout(frame, 1500) as unknown as number) : requestAnimationFrame(frame);
  }
  frame(); // start drawing immediately; props stream in as they load
  void ready;
  // render a black first frame immediately
  renderer.render(scene, camera);

  const onResize = () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H()); composer.setSize(W(), H()); outline.setSize(W(), H());
    if (!focused && introDone) flyTo(HOME(), 0.6);
  };
  window.addEventListener("resize", onResize);
  const onVis = () => { const was = running; running = !document.hidden; if (running && !was) { clock.getDelta(); frame(); } };
  document.addEventListener("visibilitychange", onVis);
  void loaded; void total;

  return {
    focus, setXray, bindLabel, startIntro, goZone,
    dispose() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointerleave", onLeave);
      controls.dispose(); composer.dispose(); pmrem.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); } });
      renderer.dispose(); el.remove();
    },
  };
}
