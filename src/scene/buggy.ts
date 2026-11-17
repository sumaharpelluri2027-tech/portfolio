import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural BAJA SAE buggy.
 * Root origin = floor centre under the car, nose facing +Z, driver's right = -X.
 * Units: metres. ~2.25 L x 1.46 W x 1.45 H, tyres 0.58 m dia.
 */

export type PartId = "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "cluster";
export interface Buggy {
  root: THREE.Group; // whole buggy, origin at floor centre under the car, facing +Z
  parts: Record<PartId, THREE.Group>; // each a child (direct or nested) of root
  chassis: THREE.Group; // everything not clickable (frame, wheels, seat, body panels, suspension)
  update(dt: number, t: number): void; // idle life: subtle; can be empty
}

/* ------------------------------------------------------------------ */
/* small math helpers                                                  */
/* ------------------------------------------------------------------ */

type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);
const Y_AXIS = V(0, 1, 0);

function M(pos?: V3, rot?: THREE.Euler, scale?: V3): THREE.Matrix4 {
  const q = rot ? new THREE.Quaternion().setFromEuler(rot) : new THREE.Quaternion();
  return new THREE.Matrix4().compose(pos ?? V(0, 0, 0), q, scale ?? V(1, 1, 1));
}
const E = (x: number, y: number, z: number, order: THREE.EulerOrder = "XYZ") => new THREE.Euler(x, y, z, order);

/** Matrix that maps local +Y (length 1) onto the segment a->b, centred at its midpoint. */
function alongMatrix(a: V3, b: V3): { m: THREE.Matrix4; len: number } {
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d.normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return { m: new THREE.Matrix4().compose(mid, q, V(1, 1, 1)), len };
}

/* ------------------------------------------------------------------ */
/* Geometry bucket: collects transformed geometries per material and   */
/* merges them into one mesh per material.                             */
/* ------------------------------------------------------------------ */

class Bucket {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>();
  base = new THREE.Matrix4();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, local?: THREE.Matrix4): void {
    const m = local ? new THREE.Matrix4().multiplyMatrices(this.base, local) : this.base;
    geo.applyMatrix4(m);
    let list = this.map.get(mat);
    if (!list) {
      list = [];
      this.map.set(mat, list);
    }
    list.push(geo);
  }

  with(m: THREE.Matrix4, fn: () => void): void {
    const prev = this.base;
    this.base = prev.clone().multiply(m);
    fn();
    this.base = prev;
  }

  flush(parent: THREE.Object3D, receive = true): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.map.forEach((geos, mat) => {
      const norm = geos.map(normalizeGeo);
      const merged = mergeGeometries(norm, false);
      norm.forEach((g) => g.dispose());
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      out.push(mesh);
    });
    this.map.clear();
    return out;
  }
}

function normalizeGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g.clone();
  n.clearGroups();
  for (const name of Object.keys(n.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") n.deleteAttribute(name);
  }
  if (!n.getAttribute("normal")) n.computeVertexNormals();
  if (!n.getAttribute("uv")) {
    const count = n.getAttribute("position").count;
    n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* primitive helpers (all push into a bucket)                          */
/* ------------------------------------------------------------------ */

function cyl(b: Bucket, a: V3, c: V3, r: number, mat: THREE.Material, seg = 12, open = false, r2?: number): void {
  const { m, len } = alongMatrix(a, c);
  b.add(new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1, open), mat, m);
}

/** Cylinder of given length centred at p, axis along dir. */
function cylAt(b: Bucket, p: V3, dir: V3, len: number, r: number, mat: THREE.Material, seg = 12, r2?: number): void {
  const d = dir.clone().normalize().multiplyScalar(len / 2);
  cyl(b, p.clone().sub(d), p.clone().add(d), r, mat, seg, false, r2);
}

function sph(b: Bucket, p: V3, r: number, mat: THREE.Material, w = 10, h = 8): void {
  b.add(new THREE.SphereGeometry(r, w, h), mat, M(p));
}

function rbox(b: Bucket, sx: number, sy: number, sz: number, pos: V3, mat: THREE.Material, rot?: THREE.Euler, radius = 0.01, seg = 2): void {
  const r = Math.min(radius, Math.min(sx, sy, sz) / 2 - 1e-4);
  b.add(new RoundedBoxGeometry(sx, sy, sz, seg, Math.max(r, 0.0005)), mat, M(pos, rot));
}

/** Rounded box stretched along a->b (length axis = local Y), sx/sz cross-section. */
function boxAlong(b: Bucket, a: V3, c: V3, sx: number, sz: number, mat: THREE.Material, radius = 0.006): void {
  const { m, len } = alongMatrix(a, c);
  const r = Math.min(radius, Math.min(sx, sz) / 2 - 1e-4);
  b.add(new RoundedBoxGeometry(sx, len, sz, 1, Math.max(r, 0.0005)), mat, m);
}

/** Hex bolt head sitting on a surface at p, axis along n. */
function bolt(b: Bucket, p: V3, n: V3, mat: THREE.Material, r = 0.0065, h = 0.006): void {
  const nn = n.clone().normalize();
  cyl(b, p.clone(), p.clone().addScaledVector(nn, h), r, mat, 6);
}

function filletPath(pts: V3[], R: number): THREE.CurvePath<V3> {
  const path = new THREE.CurvePath<V3>();
  let cur = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dIn = p.clone().sub(pts[i - 1]);
    const lin = dIn.length();
    dIn.normalize();
    const dOut = pts[i + 1].clone().sub(p);
    const lout = dOut.length();
    dOut.normalize();
    const d = Math.min(R, lin * 0.45, lout * 0.45);
    const a = p.clone().addScaledVector(dIn, -d);
    const c = p.clone().addScaledVector(dOut, d);
    if (cur.distanceTo(a) > 1e-5) path.add(new THREE.LineCurve3(cur, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), c));
    cur = c;
  }
  path.add(new THREE.LineCurve3(cur, pts[pts.length - 1].clone()));
  return path;
}

class Helix extends THREE.Curve<V3> {
  constructor(private r: number, private h: number, private turns: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): V3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

/* ------------------------------------------------------------------ */
/* Frame builder with snapping to existing tube centre lines           */
/* ------------------------------------------------------------------ */

class Frame {
  samples: V3[] = [];
  nodes: { p: V3; r: number }[] = [];
  tubeCount = 0;
  constructor(private b: Bucket, private mat: THREE.Material) {}

  snap(p: V3, maxDist = 0.07): V3 {
    let best: V3 | null = null;
    let bd = maxDist;
    for (const s of this.samples) {
      const d = s.distanceTo(p);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best ? best.clone() : p.clone();
  }

  private node(p: V3, r: number): void {
    for (const n of this.nodes) if (n.p.distanceTo(p) < 0.004) {
      n.r = Math.max(n.r, r);
      return;
    }
    this.nodes.push({ p: p.clone(), r });
  }

  path(pts: V3[], r: number, bend = 0.1): void {
    const curve = filletPath(pts, bend);
    const len = curve.getLength();
    const segs = Math.max(4, Math.ceil(len / 0.028));
    this.b.add(new THREE.TubeGeometry(curve, segs, r, r > 0.015 ? 14 : 12, false), this.mat);
    for (let i = 0; i <= Math.ceil(len / 0.008); i++) this.samples.push(curve.getPointAt(Math.min(1, i / Math.ceil(len / 0.008))));
    this.node(pts[0], r);
    this.node(pts[pts.length - 1], r);
    this.tubeCount++;
  }

  line(a: V3, c: V3, r: number): void {
    cyl(this.b, a, c, r, this.mat, r > 0.015 ? 14 : 12, true);
    const n = Math.ceil(a.distanceTo(c) / 0.008);
    for (let i = 0; i <= n; i++) this.samples.push(a.clone().lerp(c, i / n));
    this.node(a, r);
    this.node(c, r);
    this.tubeCount++;
  }

  welds(): void {
    for (const n of this.nodes) sph(this.b, n.p, n.r * 1.04, this.mat, 12, 8);
  }
}

/* ------------------------------------------------------------------ */
/* Canvas textures                                                     */
/* ------------------------------------------------------------------ */

const FONT = `"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function stencilTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 512);
  ctx.clearRect(0, 0, 1024, 512);
  // stencil word
  ctx.fillStyle = "#e8b400";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const word = "SUMAHAR";
  ctx.font = `900 190px ${FONT}`;
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  const gap = 14;
  const total = widths.reduce((a, w) => a + w, 0) + gap * (word.length - 1);
  const scale = Math.min(1, 960 / total);
  ctx.save();
  ctx.translate(512, 215);
  ctx.scale(scale, 1);
  let x = -total / 2;
  word.split("").forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, 0);
    x += widths[i] + gap;
  });
  ctx.restore();
  // stencil bridges: one horizontal break + vertical breaks in each glyph
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(0, 212, 1024, 11);
  x = -total / 2;
  word.split("").forEach((_, i) => {
    const cx = 512 + (x + widths[i] / 2) * scale;
    ctx.fillRect(cx - 4, 120, 8, 92);
    x += widths[i] + gap;
  });
  ctx.globalCompositeOperation = "source-over";
  // underline stripe + small text
  ctx.fillStyle = "#e8b400";
  ctx.fillRect(40, 345, 600, 10);
  ctx.fillStyle = "#ff6a1a";
  ctx.fillRect(650, 345, 120, 10);
  ctx.fillStyle = "#d9dde2";
  ctx.font = `700 46px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("BAJA SAE INDIA  ·  AIR 08", 40, 410);
  ctx.font = `600 30px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#8d949c";
  ctx.fillText("BRAKES & VEHICLE DYNAMICS", 40, 462);
  // hazard chevrons right end
  ctx.fillStyle = "#e8b400";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const bx = 800 + i * 50;
    ctx.moveTo(bx, 380);
    ctx.lineTo(bx + 28, 380);
    ctx.lineTo(bx + 48, 425);
    ctx.lineTo(bx + 28, 470);
    ctx.lineTo(bx, 470);
    ctx.lineTo(bx + 20, 425);
    ctx.closePath();
    ctx.fill();
  }
  return tex(c);
}

function numberTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 384);
  const g = ctx.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, "#f4f4f2");
  g.addColorStop(1, "#dcdcd8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 484, 356);
  ctx.fillStyle = "#e8b400";
  ctx.fillRect(28, 300, 456, 56);
  ctx.fillStyle = "#101010";
  ctx.font = `900 270px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("08", 256, 160);
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText("AIR 08", 256, 330);
  return tex(c);
}

function gaugeTexture(kind: "rpm" | "speed" | "temp"): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const cx = S / 2;
  const cy = S / 2;
  const bg = ctx.createRadialGradient(cx, cy * 0.8, 10, cx, cy, S / 2);
  bg.addColorStop(0, "#1a1e24");
  bg.addColorStop(1, "#06070a");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, S / 2, 0, Math.PI * 2);
  ctx.fill();
  const max = kind === "rpm" ? 8 : kind === "speed" ? 60 : 4;
  const majors = kind === "rpm" ? 8 : kind === "speed" ? 6 : 4;
  const accent = kind === "temp" ? "#38d0ff" : "#ff7a1a";
  const ang = (f: number) => ((-135 + 270 * f) * Math.PI) / 180;
  const pt = (f: number, r: number): [number, number] => [cx + Math.sin(ang(f)) * r, cy - Math.cos(ang(f)) * r];
  // red zone
  ctx.lineWidth = 12;
  ctx.strokeStyle = kind === "temp" ? "#ff3b2f" : "#ff3b2f";
  ctx.beginPath();
  ctx.arc(cx, cy, 104, ang(0.8) - Math.PI / 2, ang(1) - Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 104, ang(0) - Math.PI / 2, ang(0.8) - Math.PI / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // ticks
  ctx.strokeStyle = "#e9edf2";
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = 4;
  const minorPer = 4;
  for (let i = 0; i <= majors * minorPer; i++) {
    const f = i / (majors * minorPer);
    const major = i % minorPer === 0;
    const [x0, y0] = pt(f, major ? 82 : 90);
    const [x1, y1] = pt(f, 98);
    ctx.lineWidth = major ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = "#f2f4f7";
  ctx.font = `700 26px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= majors; i++) {
    const f = i / majors;
    const [x, y] = pt(f, 64);
    const label = kind === "temp" ? ["C", "", "", "", "H"][i] : String(Math.round((max / majors) * i));
    ctx.fillText(label, x, y);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  ctx.font = `800 18px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(kind === "rpm" ? "x1000 RPM" : kind === "speed" ? "KM/H" : "CVT °C", cx, cy + 50);
  if (kind === "rpm") {
    ctx.fillStyle = "#cfd6de";
    ctx.font = `600 14px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText("SP · BAJA 08", cx, cy + 74);
  }
  // outer ring
  ctx.strokeStyle = "#3a4048";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, S / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();
  return tex(c);
}

function navTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 320;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = "#07111c";
  ctx.fillRect(0, 0, W, H);
  // terrain blobs
  const rnd = mulberry(8);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 3 === 0 ? "rgba(40,90,70,0.35)" : "rgba(30,55,85,0.35)";
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 30 + rnd() * 70, 20 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // river
  ctx.strokeStyle = "rgba(40,120,200,0.55)";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(-10, 250);
  ctx.bezierCurveTo(120, 210, 200, 300, 330, 240);
  ctx.bezierCurveTo(420, 200, 470, 260, 530, 230);
  ctx.stroke();
  // street grid
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(140,170,200,0.28)";
  for (let i = -12; i <= 12; i++) {
    ctx.lineWidth = i % 4 === 0 ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(i * 34, -400);
    ctx.lineTo(i * 34, 400);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-400, i * 30);
    ctx.lineTo(400, i * 30);
    ctx.stroke();
  }
  ctx.restore();
  // route
  const route: [number, number][] = [
    [70, 280], [110, 230], [150, 215], [190, 170], [240, 160], [280, 120], [330, 118], [370, 86], [420, 70],
  ];
  const drawRoute = (w: number, col: string, blur: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  drawRoute(14, "rgba(0,200,255,0.35)", 18);
  drawRoute(6, "#22d3ff", 6);
  // destination pin
  ctx.fillStyle = "#ff7a1a";
  ctx.beginPath();
  ctx.arc(420, 62, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(409, 68);
  ctx.lineTo(431, 68);
  ctx.lineTo(420, 86);
  ctx.fill();
  ctx.fillStyle = "#07111c";
  ctx.beginPath();
  ctx.arc(420, 62, 5, 0, Math.PI * 2);
  ctx.fill();
  // current position arrow
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.translate(70, 280);
  ctx.rotate(0.65);
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(11, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-11, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // header bar
  ctx.fillStyle = "rgba(4,10,18,0.85)";
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = "#22d3ff";
  ctx.font = `800 26px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("↗  1.2 km", 16, 24);
  ctx.fillStyle = "#cfe3f2";
  ctx.font = `600 20px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("ENDURO · LAP 3", W - 16, 24);
  // footer
  ctx.fillStyle = "rgba(4,10,18,0.85)";
  ctx.fillRect(0, H - 36, W, 36);
  ctx.fillStyle = "#ff9a4a";
  ctx.textAlign = "left";
  ctx.font = `700 18px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText("ETA 04:12", 16, H - 18);
  ctx.fillStyle = "#9fb3c4";
  ctx.textAlign = "right";
  ctx.fillText("GPS ●●●●○", W - 16, H - 18);
  return tex(c);
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

function makeMaterials() {
  const std = (color: number, roughness: number, metalness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    frame: new THREE.MeshPhysicalMaterial({
      color: 0xe8b400,
      roughness: 0.34,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    panel: std(0x2b2f35, 0.82, 0.15),
    panelDS: std(0x2b2f35, 0.82, 0.15, { side: THREE.DoubleSide }),
    carbon: std(0x18191c, 0.45, 0.3),
    rubber: std(0x151515, 0.92, 0),
    rubberSoft: std(0x202020, 0.75, 0),
    rim: std(0x2c2f34, 0.38, 1, { side: THREE.DoubleSide }),
    alu: std(0xc9ccd1, 0.32, 1),
    steel: std(0x9da3aa, 0.42, 1),
    darkMetal: std(0x3a3d42, 0.45, 1),
    blackAnod: std(0x1a1b1e, 0.4, 1),
    chrome: std(0xe8eaec, 0.14, 1),
    plastic: std(0x121315, 0.55, 0),
    whitePlastic: std(0xe9e7e2, 0.45, 0),
    gold: std(0xc99a3b, 0.33, 1),
    spring: std(0x141518, 0.32, 0.8),
    accent: new THREE.MeshPhysicalMaterial({ color: 0xff6a00, roughness: 0.35, metalness: 0.1, clearcoat: 0.6 }),
    caliper: new THREE.MeshPhysicalMaterial({ color: 0xff3412, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 }),
    disc: std(0xb9bcc0, 0.28, 1),
    discHat: std(0x2a2c30, 0.35, 1),
    seat: std(0x1c1d20, 0.95, 0),
    seatInsert: std(0x3a3d42, 0.9, 0),
    harness: std(0x2347b0, 0.7, 0),
    exhaust: std(0x7a5a46, 0.42, 1),
    filter: std(0x35383d, 0.9, 0),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd2231b, roughness: 0.3, metalness: 0.1, clearcoat: 1 }),
    lens: std(0x330000, 0.2, 0, { emissive: 0xff1a0a, emissiveIntensity: 2.2 }),
    led: std(0x222222, 0.2, 0, { emissive: 0xfff2dc, emissiveIntensity: 2.5 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      clearcoat: 1,
      depthWrite: false,
    }),
  };
}
type Mats = ReturnType<typeof makeMaterials>;

/* ------------------------------------------------------------------ */
/* sub-assemblies                                                      */
/* ------------------------------------------------------------------ */

const WHEEL_R = 0.29;

/** Wheel in local coords: axis = X, outer face toward +X, centre at origin. */
function buildWheel(b: Bucket, mt: Mats): void {
  // tyre carcass (lathe around Y, then rotated so axis = X)
  const prof: [number, number][] = [
    [0.172, 0.098], [0.195, 0.11], [0.235, 0.114], [0.255, 0.108], [0.266, 0.094], [0.271, 0.07],
    [0.273, 0.035], [0.274, 0], [0.273, -0.035], [0.271, -0.07], [0.266, -0.094], [0.255, -0.108],
    [0.235, -0.114], [0.195, -0.11], [0.172, -0.098],
  ];
  const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 56);
  b.add(lathe, mt.rubber, M(undefined, E(0, 0, -Math.PI / 2)));

  // knobby lugs
  const N = 22;
  for (let i = 0; i < N; i++) {
    for (let row = 0; row < 2; row++) {
      const a = ((i + (row ? 0.5 : 0)) / N) * Math.PI * 2;
      const ax = row ? -0.048 : 0.048;
      const r = 0.278;
      const q = new THREE.Quaternion().setFromEuler(E(a, 0, 0));
      q.multiply(new THREE.Quaternion().setFromEuler(E(0, row ? 0.32 : -0.32, 0)));
      const pos = V(ax, Math.cos(a) * r, Math.sin(a) * r);
      const m = new THREE.Matrix4().compose(pos, q, V(1, 1, 1));
      b.add(new RoundedBoxGeometry(0.075, 0.026, 0.042, 1, 0.006), mt.rubber, m);
    }
    // shoulder lugs both sides
    for (const side of [-1, 1]) {
      const a = ((i + (side > 0 ? 0.25 : 0.75)) / N) * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(E(a, 0, 0));
      q.multiply(new THREE.Quaternion().setFromEuler(E(0, 0, side * 0.55)));
      const pos = V(side * 0.1, Math.cos(a) * 0.255, Math.sin(a) * 0.255);
      b.add(new THREE.BoxGeometry(0.028, 0.034, 0.034), mt.rubber, new THREE.Matrix4().compose(pos, q, V(1, 1, 1)));
    }
  }

  // rim barrel
  const rimProf: [number, number][] = [
    [0.158, -0.1], [0.176, -0.1], [0.179, -0.094], [0.17, -0.084], [0.16, -0.065], [0.158, -0.02],
    [0.158, 0.02], [0.16, 0.065], [0.17, 0.084], [0.179, 0.094], [0.176, 0.1], [0.158, 0.1],
  ];
  b.add(new THREE.LatheGeometry(rimProf.map(([r, y]) => new THREE.Vector2(r, y)), 56), mt.rim, M(undefined, E(0, 0, -Math.PI / 2)));

  // rim face with 6 lightening holes
  const face = new THREE.Shape();
  const segs = 64;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * 0.16;
    const y = Math.sin(a) * 0.16;
    if (i === 0) face.moveTo(x, y);
    else face.lineTo(x, y);
  }
  for (let h = 0; h < 6; h++) {
    const a0 = (h / 6) * Math.PI * 2;
    const hole = new THREE.Path();
    // rounded-trapezoid window
    const pts: [number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const a = a0 - 0.36 + (k / 10) * 0.72;
      pts.push([Math.cos(a) * 0.138, Math.sin(a) * 0.138]);
    }
    for (let k = 10; k >= 0; k--) {
      const a = a0 - 0.28 + (k / 10) * 0.56;
      pts.push([Math.cos(a) * 0.068, Math.sin(a) * 0.068]);
    }
    pts.forEach(([x, y], k) => (k ? hole.lineTo(x, y) : hole.moveTo(x, y)));
    hole.closePath();
    face.holes.push(hole);
  }
  const faceGeo = new THREE.ExtrudeGeometry(face, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 8,
  });
  b.add(faceGeo, mt.rim, M(V(0.035, 0, 0), E(0, Math.PI / 2, 0)));

  // hub + center cap + lug nuts
  cyl(b, V(-0.02, 0, 0), V(0.07, 0, 0), 0.048, mt.darkMetal, 20);
  cyl(b, V(0.07, 0, 0), V(0.085, 0, 0), 0.03, mt.alu, 20, false, 0.022);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = V(0.07, Math.cos(a) * 0.036, Math.sin(a) * 0.036);
    cyl(b, p, p.clone().add(V(0.016, 0, 0)), 0.0095, mt.chrome, 6);
  }
  // beadlock ring + bolts
  b.add(new THREE.TorusGeometry(0.172, 0.009, 6, 56), mt.alu, M(V(0.1, 0, 0), E(0, Math.PI / 2, 0)));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = V(0.106, Math.cos(a) * 0.172, Math.sin(a) * 0.172);
    cyl(b, p, p.clone().add(V(0.007, 0, 0)), 0.0048, mt.steel, 6);
  }
  // valve stem
  cyl(b, V(0.05, 0.15, 0.03), V(0.075, 0.148, 0.03), 0.004, mt.chrome, 6);
}

/** Coil-over shock from a (lower eye) to c (upper eye). */
function coilover(b: Bucket, a: V3, c: V3, mt: Mats): void {
  const { len } = alongMatrix(a, c);
  const d = c.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d);
  const m = new THREE.Matrix4().compose(a, q, V(1, 1, 1));
  b.with(m, () => {
    const L = len;
    // eyes (cross bushings)
    cyl(b, V(-0.014, 0, 0), V(0.014, 0, 0), 0.012, mt.darkMetal, 12);
    cyl(b, V(-0.014, L, 0), V(0.014, L, 0), 0.012, mt.darkMetal, 12);
    // shaft
    cyl(b, V(0, 0.01, 0), V(0, L * 0.5, 0), 0.0075, mt.chrome, 10);
    // body
    cyl(b, V(0, L * 0.42, 0), V(0, L * 0.97, 0), 0.021, mt.alu, 16);
    cyl(b, V(0, L * 0.9, 0), V(0, L * 0.97, 0), 0.025, mt.blackAnod, 16);
    // piggyback reservoir
    cyl(b, V(0.034, L * 0.6, 0), V(0.034, L * 0.92, 0), 0.0135, mt.gold, 12);
    cyl(b, V(0.012, L * 0.93, 0), V(0.034, L * 0.93, 0), 0.006, mt.gold, 8);
    // spring perches
    cyl(b, V(0, L * 0.1, 0), V(0, L * 0.12, 0), 0.034, mt.blackAnod, 18);
    cyl(b, V(0, L * 0.8, 0), V(0, L * 0.82, 0), 0.036, mt.gold, 18);
    // spring
    const springLen = L * 0.68;
    const helix = new Helix(0.029, springLen, 7);
    b.add(new THREE.TubeGeometry(helix, 112, 0.0052, 6, false), mt.spring, M(V(0, L * 0.12, 0)));
  });
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

interface PartBuild {
  group: THREE.Group;
  content: THREE.Group;
  contentBase: V3;
}

export function createBuggy(): Buggy {
  const mt = makeMaterials();
  const root = new THREE.Group();
  root.name = "buggy";

  const chassis = new THREE.Group();
  chassis.name = "chassis";
  root.add(chassis);

  const cb = new Bucket(); // chassis bucket

  /* ------------------------------ frame ------------------------------ */
  const fr = new Frame(cb, mt.frame);
  const P = 0.0165; // primary tube radius (1.3")
  const S = 0.0125; // secondary

  const sides = [1, -1];
  // primary members first (so later members can snap onto them)
  for (const s of sides) {
    fr.path([V(0.22 * s, 0.34, 1.0), V(0.34 * s, 0.3, 0.45), V(0.36 * s, 0.3, -0.3), V(0.3 * s, 0.36, -0.88)], P, 0.14); // LFS
  }
  // rear roll hoop
  fr.path(
    [V(0.36, 0.3, -0.3), V(0.37, 1.0, -0.31), V(0.33, 1.42, -0.34), V(-0.33, 1.42, -0.34), V(-0.37, 1.0, -0.31), V(-0.36, 0.3, -0.3)],
    P,
    0.13,
  );
  for (const s of sides) {
    const top = fr.snap(V(0.33 * s, 1.42, -0.34));
    fr.path([top, V(0.3 * s, 1.4, 0.28), V(0.26 * s, 0.7, 0.92)], P, 0.11); // RHO + FBM
    fr.path([fr.snap(V(0.38 * s, 0.64, -0.3)), V(0.375 * s, 0.66, 0.3), V(0.26 * s, 0.7, 0.92)], P, 0.12); // SIM
  }
  // primary crosses
  fr.line(V(0.22, 0.34, 1.0), V(-0.22, 0.34, 1.0), P);
  fr.line(V(0.26, 0.7, 0.92), V(-0.26, 0.7, 0.92), P);
  fr.line(fr.snap(V(0.3, 1.4, 0.28)), fr.snap(V(-0.3, 1.4, 0.28)), P);

  for (const s of sides) {
    fr.line(V(0.22 * s, 0.34, 1.0), V(0.26 * s, 0.7, 0.92), S); // front bulkhead upright
    fr.line(fr.snap(V(0.375 * s, 0.66, 0.3)), fr.snap(V(0.34 * s, 0.3, 0.45)), S); // side diagonal
    fr.line(fr.snap(V(0.294 * s, 0.315, 0.66)), fr.snap(V(0.317 * s, 0.681, 0.62)), S); // susp mount
    fr.line(fr.snap(V(0.37 * s, 1.0, -0.31)), V(0.3 * s, 0.8, -0.88), S); // rear upper
    fr.line(V(0.3 * s, 0.36, -0.88), V(0.3 * s, 0.8, -0.88), S); // rear upright
    fr.line(fr.snap(V(0.345 * s, 1.3, -0.33)), V(0.3 * s, 0.8, -0.88), S); // rear bracing
    fr.line(fr.snap(V(0.38 * s, 0.64, -0.3)), V(0.3 * s, 0.36, -0.88), S); // rear diagonal
  }
  fr.line(V(0.22, 0.34, 1.0), V(-0.26, 0.7, 0.92), S); // bulkhead diagonal
  const crossPairs: [V3, number][] = [
    [V(0.277, 1.0, 0.646), S], // dash bar
    [V(0.37, 1.0, -0.31), S], // harness bar
    [V(0.38, 0.64, -0.3), S], // RRH lateral
    [V(0.352, 0.3, 0.05), S], // under seat
    [V(0.34, 0.3, 0.45), S], // LFS front cross
    [V(0.36, 0.3, -0.3), S], // RRH base
    [V(0.334, 0.326, -0.55), S], // engine cross
    [V(0.31, 0.35, -0.78), S], // engine cross rear
    [V(0.353, 0.951, -0.45), S], // tank cross
    [V(0.294, 0.315, 0.66), S], // A-arm cross
  ];
  for (const [p, r] of crossPairs) fr.line(fr.snap(p), fr.snap(V(-p.x, p.y, p.z)), r);
  fr.line(V(0.3, 0.36, -0.88), V(-0.3, 0.36, -0.88), S);
  fr.line(V(0.3, 0.8, -0.88), V(-0.3, 0.8, -0.88), S);
  fr.welds();

  /* --------------------------- mounting tabs -------------------------- */
  const tab = (p: V3, n: V3) => {
    rbox(cb, 0.004, 0.035, 0.035, p, mt.frame, E(0, Math.atan2(n.x, n.z) + Math.PI / 2, 0), 0.002, 1);
  };

  /* ------------------------------ wheels ------------------------------ */
  const FRONT_Z = 0.78;
  const REAR_Z = -0.8;
  const TRACK = 0.62;
  const wheelMat = (s: number, z: number) => M(V(TRACK * s, WHEEL_R, z), E(0, s > 0 ? 0 : Math.PI, 0));
  for (const s of sides) {
    for (const z of [FRONT_Z, REAR_Z]) {
      cb.with(wheelMat(s, z), () => buildWheel(cb, mt));
    }
  }

  /* -------------------------- front suspension ------------------------ */
  for (const s of sides) {
    const lA = fr.snap(V(0.294 * s, 0.315, 0.66));
    const lB = fr.snap(V(0.237 * s, 0.334, 0.92));
    const uA = fr.snap(V(0.304 * s, 0.48, 0.642));
    const uB = fr.snap(V(0.238 * s, 0.5, 0.965));
    const lbj = V(0.42 * s, 0.2, FRONT_Z);
    const ubj = V(0.41 * s, 0.4, FRONT_Z);
    for (const [a, c] of [[lA, lbj], [lB, lbj], [uA, ubj], [uB, ubj]] as [V3, V3][]) {
      cyl(cb, a, c, 0.0105, mt.blackAnod, 10);
      cylAt(cb, a, V(0, 0, 1), 0.04, 0.015, mt.darkMetal, 12); // pivot bushing
      tab(a.clone().add(V(0, 0.0, 0.025)), V(1, 0, 0));
      tab(a.clone().add(V(0, 0.0, -0.025)), V(1, 0, 0));
    }
    sph(cb, lbj, 0.017, mt.steel);
    sph(cb, ubj, 0.015, mt.steel);
    // gusset plates on arms
    boxAlong(cb, lbj.clone().lerp(lA, 0.05), lbj.clone().lerp(lB, 0.35), 0.004, 0.03, mt.blackAnod, 0.002);
    // knuckle / upright
    boxAlong(cb, lbj.clone().add(V(0.0, -0.005, 0)), ubj.clone().add(V(0, 0.01, 0)), 0.03, 0.05, mt.alu, 0.01);
    rbox(cb, 0.04, 0.09, 0.075, V(0.425 * s, WHEEL_R, FRONT_Z), mt.alu, undefined, 0.012);
    cyl(cb, V(0.425 * s, WHEEL_R, FRONT_Z), V(0.56 * s, WHEEL_R, FRONT_Z), 0.02, mt.steel, 14); // spindle
    // steering arm + tie rod
    const arm = V(0.415 * s, 0.47, 0.875);
    boxAlong(cb, ubj.clone().add(V(0, 0.02, 0.02)), arm, 0.014, 0.022, mt.alu, 0.005);
    const rackEnd = V(0.17 * s, 0.52, 0.93);
    cyl(cb, rackEnd, arm, 0.0075, mt.steel, 8);
    sph(cb, arm, 0.012, mt.darkMetal);
    cyl(cb, rackEnd, rackEnd.clone().add(V(0.06 * s, -0.004, -0.002)), 0.0115, mt.rubber, 10); // boot
    // coil-over
    const shLow = lbj.clone().lerp(lA.clone().lerp(lB, 0.5), 0.17).add(V(0, 0.025, 0));
    const shTop = fr.snap(V(0.3 * s, 0.7, 0.72));
    coilover(cb, shLow, shTop, mt);
    tab(shTop.clone().add(V(0, -0.02, 0)), V(0, 0, 1));
    // brake disc on the front-left (plain, chassis); front-right is the clickable brake part
    if (s > 0) {
      cb.with(wheelMat(s, FRONT_Z), () => {
        buildDisc(cb, mt, false);
      });
    }
  }
  // steering rack
  cyl(cb, V(-0.17, 0.52, 0.93), V(0.17, 0.52, 0.93), 0.018, mt.alu, 16);
  rbox(cb, 0.08, 0.05, 0.06, V(0, 0.52, 0.93), mt.alu, undefined, 0.012);
  for (const s of sides) rbox(cb, 0.03, 0.05, 0.03, V(0.12 * s, 0.5, 0.95), mt.blackAnod, undefined, 0.004);

  /* --------------------------- rear suspension ------------------------ */
  for (const s of sides) {
    const piv = fr.snap(V(0.36 * s, 0.33, -0.12));
    const hub = V(0.45 * s, WHEEL_R, REAR_Z);
    // trailing arm (box section, slight taper via two boxes)
    boxAlong(cb, piv, hub.clone().add(V(0, 0.02, 0.05)), 0.035, 0.07, mt.blackAnod, 0.01);
    cylAt(cb, piv, V(1, 0, 0), 0.06, 0.02, mt.darkMetal, 14);
    // hub carrier
    rbox(cb, 0.05, 0.2, 0.1, hub.clone().add(V(0, 0.01, 0)), mt.alu, undefined, 0.015);
    cyl(cb, hub, V(0.56 * s, WHEEL_R, REAR_Z), 0.02, mt.steel, 14);
    // camber links
    const ul = fr.snap(V(0.31 * s, 0.62, -0.73));
    cyl(cb, ul, V(0.44 * s, 0.38, -0.74), 0.009, mt.steel, 10);
    sph(cb, V(0.44 * s, 0.38, -0.74), 0.013, mt.darkMetal);
    cyl(cb, fr.snap(V(0.31 * s, 0.35, -0.72)), V(0.43 * s, 0.205, -0.74), 0.009, mt.steel, 10);
    sph(cb, V(0.43 * s, 0.205, -0.74), 0.013, mt.darkMetal);
    // drive shaft + CV boots
    const gb = V(0.1 * s, 0.4, REAR_Z);
    cyl(cb, gb, hub, 0.011, mt.steel, 10);
    cyl(cb, gb, gb.clone().lerp(hub, 0.22), 0.026, mt.rubber, 14, false, 0.014);
    cyl(cb, hub.clone().lerp(gb, 0.2), hub, 0.026, mt.rubber, 14, false, 0.014);
    // coil-over
    coilover(cb, V(0.43 * s, 0.37, -0.66), fr.snap(V(0.35 * s, 0.93, -0.5)), mt);
    // rear fender
    const fender = new THREE.CylinderGeometry(0.33, 0.33, 0.27, 40, 1, true, Math.PI * 0.3, Math.PI * 0.62);
    cb.add(fender, mt.panelDS, M(V(TRACK * s, WHEEL_R, REAR_Z), E(0, 0, Math.PI / 2)));
    // fender stays
    cyl(cb, V(0.5 * s, WHEEL_R + 0.31, REAR_Z + 0.06), fr.snap(V(0.33 * s, 0.86, -0.75)), 0.007, mt.darkMetal, 8);
    cyl(cb, V(0.5 * s, WHEEL_R + 0.18, REAR_Z - 0.27), V(0.3 * s, 0.55, -0.88), 0.007, mt.darkMetal, 8);
  }
  // gearbox
  rbox(cb, 0.21, 0.19, 0.17, V(0.025, 0.42, REAR_Z), mt.darkMetal, undefined, 0.03);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bolt(cb, V(0.025 + Math.cos(a) * 0.07, 0.42 + Math.sin(a) * 0.07, REAR_Z - 0.085), V(0, 0, -1), mt.steel);
  }
  // engine mount plate
  rbox(cb, 0.5, 0.012, 0.42, V(0, 0.345, -0.62), mt.alu, undefined, 0.004, 1);

  /* ------------------------------ body ------------------------------- */
  // skid plate
  {
    const sh = new THREE.Shape();
    const outline: [number, number][] = [
      [0.21, 1.0], [0.335, 0.45], [0.355, -0.3], [0.3, -0.88], [-0.3, -0.88], [-0.355, -0.3], [-0.335, 0.45], [-0.21, 1.0],
    ];
    outline.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.003, bevelSegments: 2 });
    cb.add(g, mt.alu, M(V(0, 0.29, 0), E(Math.PI / 2, 0, 0)));
  }
  // firewall
  rbox(cb, 0.7, 0.78, 0.004, V(0, 0.7, -0.335), mt.alu, undefined, 0.002, 1);
  // side panels (with stencil decals)
  const stTex = stencilTexture();
  const decalMat = new THREE.MeshStandardMaterial({ map: stTex, transparent: true, roughness: 0.6, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const decals: THREE.Mesh[] = [];
  for (const s of sides) {
    const x = 0.398 * s;
    rbox(cb, 0.008, 0.33, 0.66, V(x, 0.475, 0.04), mt.panel, undefined, 0.004, 1);
    // panel bolts
    for (let i = 0; i < 6; i++) {
      const z = -0.27 + i * 0.124;
      bolt(cb, V(x + 0.004 * s, 0.31, z), V(s, 0, 0), mt.steel, 0.005, 0.004);
      bolt(cb, V(x + 0.004 * s, 0.638, z), V(s, 0, 0), mt.steel, 0.005, 0.004);
    }
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), decalMat);
    d.position.set(x + 0.0052 * s, 0.475, 0.04);
    d.rotation.y = (Math.PI / 2) * s;
    d.renderOrder = 2;
    decals.push(d);
  }
  // front number plate
  const numMat = new THREE.MeshStandardMaterial({ map: numberTexture(), roughness: 0.5, metalness: 0 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), numMat);
  plate.position.set(0, 0.52, 0.997);
  plate.rotation.x = -0.22;
  plate.position.addScaledVector(V(0, Math.sin(0.22), Math.cos(0.22)), 0.022);
  rbox(cb, 0.33, 0.25, 0.012, V(0, 0.52, 0.997).addScaledVector(V(0, Math.sin(0.22), Math.cos(0.22)), 0.014), mt.panel, E(-0.22, 0, 0), 0.006, 1);
  for (const [bx, by] of [[-0.14, 0.1], [0.14, 0.1], [-0.14, -0.1], [0.14, -0.1]]) {
    const p = V(bx, 0.52 + by * Math.cos(0.22), 0.997 - by * Math.sin(0.22)).addScaledVector(V(0, Math.sin(0.22), Math.cos(0.22)), 0.022);
    bolt(cb, p, V(0, Math.sin(0.22), Math.cos(0.22)), mt.steel, 0.006, 0.004);
  }
  // dash panel
  rbox(cb, 0.3, 0.07, 0.008, V(0, 0.995, 0.668), mt.carbon, E(0.4, 0, 0), 0.004, 1);

  /* ------------------------------ seat ------------------------------- */
  rbox(cb, 0.44, 0.05, 0.4, V(0, 0.335, 0.12), mt.seat, undefined, 0.02);
  rbox(cb, 0.34, 0.05, 0.34, V(0, 0.375, 0.12), mt.seatInsert, undefined, 0.02);
  for (const s of sides) rbox(cb, 0.055, 0.1, 0.38, V(0.195 * s, 0.395, 0.12), mt.seat, undefined, 0.025);
  cb.with(M(V(0, 0.36, -0.07), E(-0.22, 0, 0)), () => {
    rbox(cb, 0.44, 0.76, 0.05, V(0, 0.38, -0.03), mt.seat, undefined, 0.02);
    rbox(cb, 0.32, 0.56, 0.035, V(0, 0.34, 0.012), mt.seatInsert, undefined, 0.015);
    for (const s of sides) {
      rbox(cb, 0.06, 0.52, 0.13, V(0.2 * s, 0.3, 0.035), mt.seat, undefined, 0.025);
      rbox(cb, 0.055, 0.16, 0.13, V(0.19 * s, 0.68, 0.035), mt.seat, undefined, 0.025);
    }
    // harness slots
    for (const s of sides) rbox(cb, 0.06, 0.015, 0.06, V(0.085 * s, 0.7, -0.01), mt.plastic, undefined, 0.004, 1);
  });
  // harness straps
  const strap = (a: V3, c: V3, w = 0.048) => boxAlong(cb, a, c, w, 0.004, mt.harness, 0.0015);
  for (const s of sides) {
    const bar = V(0.09 * s, 1.0, -0.325);
    const over = V(0.085 * s, 1.1, -0.24);
    const chest = V(0.08 * s, 0.83, -0.095);
    const bk = V(0.03 * s, 0.47, 0.085);
    strap(bar.clone().add(V(0, 0.01, 0.0)), over);
    strap(over, chest);
    strap(chest, bk);
    rbox(cb, 0.055, 0.02, 0.012, chest.clone().lerp(bk, 0.25), mt.steel, E(-0.8, 0, 0), 0.003, 1); // adjuster
    strap(V(0.215 * s, 0.415, -0.02), V(0.04 * s, 0.455, 0.09));
    cylAt(cb, bar, V(1, 0, 0), 0.06, 0.016, mt.harness, 10); // wrap around bar
  }
  strap(V(0, 0.405, 0.28), V(0, 0.45, 0.11));
  cylAt(cb, V(0, 0.468, 0.1), V(0, 0.75, 0.66), 0.012, 0.032, mt.alu, 20); // camlock buckle
  cylAt(cb, V(0, 0.476, 0.105), V(0, 0.75, 0.66), 0.006, 0.014, mt.red, 16);

  /* ------------------------------ details ---------------------------- */
  // tow hook
  cb.add(new THREE.TorusGeometry(0.032, 0.009, 8, 20, Math.PI), mt.accent, M(V(0, 0.42, -0.905), E(Math.PI / 2, 0, Math.PI)));
  rbox(cb, 0.1, 0.05, 0.008, V(0, 0.42, -0.893), mt.accent, undefined, 0.003, 1);
  // external kill switch on RRH
  rbox(cb, 0.05, 0.05, 0.035, V(0.39, 1.12, -0.33), mt.frame, undefined, 0.006);
  cylAt(cb, V(0.418, 1.12, -0.33), V(1, 0, 0), 0.016, 0.018, mt.red, 16);
  cylAt(cb, V(0.428, 1.12, -0.33), V(1, 0, 0), 0.008, 0.021, mt.red, 16);
  // dash kill switch
  cylAt(cb, V(-0.2, 0.98, 0.63), V(0, 0.39, -0.92), 0.018, 0.016, mt.red, 16);
  // brake light under rear roof
  rbox(cb, 0.16, 0.05, 0.03, V(0, 1.36, -0.37), mt.plastic, undefined, 0.008);
  rbox(cb, 0.14, 0.035, 0.006, V(0, 1.36, -0.386), mt.lens, undefined, 0.003, 1);
  // LED light bar on front roof
  rbox(cb, 0.34, 0.045, 0.045, V(0, 1.44, 0.315), mt.blackAnod, undefined, 0.01);
  for (let i = 0; i < 6; i++) rbox(cb, 0.045, 0.026, 0.004, V(-0.135 + i * 0.054, 1.44, 0.339), mt.led, undefined, 0.002, 1);
  for (const s of sides) cyl(cb, V(0.15 * s, 1.415, 0.31), V(0.15 * s, 1.4, 0.29), 0.006, mt.darkMetal, 8);
  // fire extinguisher (left inner, beside seat)
  cylAt(cb, V(0.29, 0.5, -0.2), V(0, 1, 0), 0.24, 0.033, mt.red, 18);
  cylAt(cb, V(0.29, 0.635, -0.2), V(0, 1, 0), 0.04, 0.014, mt.chrome, 10);
  for (const y of [0.42, 0.58]) cylAt(cb, V(0.29, y, -0.2), V(0, 1, 0), 0.018, 0.036, mt.darkMetal, 18);
  // brake line from master cylinders area along frame to front-right (static)
  cb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.04, 0.42, 0.95), V(-0.1, 0.4, 0.92), V(-0.25, 0.36, 0.86), V(-0.33, 0.32, 0.8)]), 30, 0.0035, 6), mt.plastic);
  cb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.08, 0.42, 0.95), V(0.2, 0.38, 0.9), V(0.3, 0.33, 0.8)]), 24, 0.0035, 6), mt.plastic);

  cb.flush(chassis, true);
  decals.forEach((d) => {
    d.castShadow = false;
    d.receiveShadow = true;
    chassis.add(d);
  });
  plate.receiveShadow = true;
  chassis.add(plate);

  /* =========================== PARTS =========================== */

  const parts = {} as Record<PartId, THREE.Group>;
  const builds = {} as Record<PartId, PartBuild>;
  const partMatCache = new Map<string, THREE.Material>();

  function makePart(id: PartId, explode: V3, fn: (b: Bucket, g: THREE.Group) => void): PartBuild {
    const group = new THREE.Group();
    group.name = id;
    const content = new THREE.Group();
    content.name = id + "-content";
    group.add(content);
    const b = new Bucket();
    fn(b, content);
    b.flush(content, true);
    // per-part material instances so a part can be highlighted on its own
    content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const repl = mats.map((m) => {
        const key = id + ":" + m.uuid;
        let c = partMatCache.get(key);
        if (!c) {
          c = m.clone();
          partMatCache.set(key, c);
        }
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? repl : repl[0];
      mesh.castShadow = true;
    });
    content.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(content);
    const center = box.getCenter(new THREE.Vector3());
    group.position.copy(center);
    content.position.copy(center).multiplyScalar(-1);
    group.userData.partId = id;
    group.userData.explode = explode.clone();
    group.userData.anchor = V(center.x, box.max.y + 0.03, center.z);
    group.traverse((o) => {
      o.userData.partId = id;
    });
    root.add(group);
    parts[id] = group;
    const pb = { group, content, contentBase: content.position.clone() };
    builds[id] = pb;
    return pb;
  }

  /* ----------------------------- steering ---------------------------- */
  makePart("steering", V(0, 0.36, 0.72), (b) => {
    b.with(M(V(0, 0.88, 0.42), E(0.57, 0, 0)), () => {
      // grip (local XY plane, facing -Z toward driver)
      b.add(new THREE.TorusGeometry(0.135, 0.017, 14, 72), mt.rubberSoft);
      // grip ridges
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        if (Math.abs(Math.sin(a)) > 0.92 && Math.cos(a) > -2) continue;
        b.add(new THREE.TorusGeometry(0.0172, 0.0016, 4, 14), mt.plastic, M(V(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0), E(Math.PI / 2, 0, a, "ZXY")));
      }
      // 3 spokes: left, right, bottom (plate alu with flats)
      for (const a of [0, Math.PI, -Math.PI / 2]) {
        const end = V(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0);
        boxAlong(b, V(0, 0, 0.005), end.clone().add(V(0, 0, 0.002)), 0.036, 0.007, mt.alu, 0.003);
      }
      // button pods on side spokes
      for (const sx of [-1, 1]) {
        cylAt(b, V(sx * 0.075, 0.0, -0.006), V(0, 0, 1), 0.006, 0.0085, sx > 0 ? mt.red : mt.accent, 14);
        cylAt(b, V(sx * 0.075, -0.024, -0.006), V(0, 0, 1), 0.006, 0.006, mt.plastic, 12);
      }
      // centre boss + quick release
      cylAt(b, V(0, 0, 0.004), V(0, 0, 1), 0.016, 0.038, mt.blackAnod, 24);
      cylAt(b, V(0, 0, -0.008), V(0, 0, 1), 0.006, 0.02, mt.alu, 20);
      cylAt(b, V(0, 0, 0.03), V(0, 0, 1), 0.032, 0.026, mt.gold, 24); // QR collar
      b.add(new THREE.TorusGeometry(0.027, 0.004, 6, 24), mt.gold, M(V(0, 0, 0.018)));
      cylAt(b, V(0, 0, 0.056), V(0, 0, 1), 0.02, 0.02, mt.blackAnod, 6, 0.017); // hex spline
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bolt(b, V(Math.cos(a) * 0.026, Math.sin(a) * 0.026, -0.0035), V(0, 0, -1), mt.steel, 0.0035, 0.003);
      }
      // column
      cyl(b, V(0, 0, 0.066), V(0, 0, 0.59), 0.0135, mt.steel, 14);
      // column support bearing (meets dash bar)
      cylAt(b, V(0, 0, 0.24), V(0, 0, 1), 0.05, 0.024, mt.blackAnod, 18);
      rbox(b, 0.06, 0.012, 0.04, V(0, 0.025, 0.24), mt.alu, undefined, 0.003, 1);
      // lower U-joint
      sph(b, V(0, 0, 0.59), 0.02, mt.darkMetal, 12, 10);
      cylAt(b, V(0, 0, 0.59), V(1, 0, 0), 0.048, 0.008, mt.steel, 10);
    });
  });

  /* ---------------------------- accelerator --------------------------- */
  makePart("accelerator", V(0.32, 0.02, 0.85), (b) => {
    // pedal tray
    rbox(b, 0.3, 0.012, 0.26, V(-0.02, 0.322, 0.82), mt.alu, undefined, 0.004, 1);
    for (let i = 0; i < 4; i++) bolt(b, V(-0.15 + (i % 2) * 0.26, 0.328, 0.71 + Math.floor(i / 2) * 0.22), V(0, 1, 0), mt.steel, 0.005, 0.004);
    const pedal = (x: number, top: V3, padW: number, padH: number, hero: boolean) => {
      const piv = V(x, 0.35, 0.9);
      // pivot clevis
      for (const dx of [-0.018, 0.018]) rbox(b, 0.005, 0.04, 0.04, V(x + dx, 0.345, 0.9), mt.alu, undefined, 0.003, 1);
      cylAt(b, piv, V(1, 0, 0), 0.05, 0.006, mt.steel, 8);
      boxAlong(b, piv, top, 0.016, 0.026, hero ? mt.alu : mt.darkMetal, 0.005);
      const rot = E(0.5, 0, 0);
      rbox(b, padW, padH, 0.014, top, hero ? mt.alu : mt.darkMetal, rot, 0.005);
      const n = V(0, Math.sin(0.5), -Math.cos(0.5));
      if (hero) {
        // orange grip insert + grip studs
        rbox(b, padW * 0.78, padH * 0.78, 0.005, top.clone().addScaledVector(n, 0.008), mt.accent, rot, 0.002, 1);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const up = V(0, Math.cos(0.5), Math.sin(0.5));
          const p = top.clone().addScaledVector(n, 0.011).addScaledVector(up, (i - 1) * padH * 0.28).add(V((j - 0.5) * padW * 0.42, 0, 0));
          cylAt(b, p, n, 0.004, 0.0045, mt.plastic, 8);
        }
      } else {
        for (let i = 0; i < 3; i++) rbox(b, padW * 0.8, 0.006, 0.004, top.clone().addScaledVector(n, 0.008).add(V(0, (i - 1) * 0.022 * Math.cos(0.5), (i - 1) * 0.022 * Math.sin(0.5))), mt.rubber, rot, 0.001, 1);
      }
      return { piv, top };
    };
    pedal(0.05, V(0.05, 0.55, 0.785), 0.065, 0.085, false); // brake
    const th = pedal(-0.09, V(-0.09, 0.575, 0.775), 0.075, 0.12, true); // throttle (hero)
    // throttle return spring + stop
    const sp = new Helix(0.007, 0.09, 9);
    b.add(new THREE.TubeGeometry(sp, 60, 0.0016, 5), mt.chrome, (() => {
      const { m } = alongMatrix(V(-0.09, 0.33, 0.83), V(-0.09, 0.42, 0.83));
      return m.multiply(M(V(0, -0.045, 0)));
    })());
    rbox(b, 0.03, 0.02, 0.02, V(-0.09, 0.338, 0.74), mt.rubber, undefined, 0.005);
    // throttle cable
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      th.piv.clone().lerp(th.top, 0.4).add(V(-0.014, 0, 0)), V(-0.15, 0.38, 0.86), V(-0.2, 0.34, 0.76), V(-0.25, 0.33, 0.62),
    ]), 24, 0.004, 6), mt.plastic);
    // master cylinders + reservoirs + balance bar
    for (const x of [0.02, 0.08]) {
      cyl(b, V(x, 0.405, 0.9), V(x, 0.405, 0.99), 0.0135, mt.alu, 16);
      cyl(b, V(x, 0.405, 0.985), V(x, 0.405, 1.0), 0.018, mt.blackAnod, 6);
      cyl(b, V(x, 0.42, 0.95), V(x, 0.455, 0.95), 0.016, mt.whitePlastic, 14);
      cyl(b, V(x, 0.455, 0.95), V(x, 0.466, 0.95), 0.0175, mt.plastic, 14);
      cyl(b, V(x, 0.405, 0.9), V(x, 0.405, 0.87), 0.004, mt.chrome, 6); // pushrod
    }
    cyl(b, V(0.0, 0.405, 0.868), V(0.1, 0.405, 0.868), 0.005, mt.steel, 8);
    cylAt(b, V(0.05, 0.405, 0.868), V(1, 0, 0), 0.02, 0.012, mt.gold, 12);
    // pedal stops
    rbox(b, 0.22, 0.03, 0.01, V(-0.02, 0.345, 0.7), mt.alu, undefined, 0.003, 1);
  });

  /* ------------------------------ engine ------------------------------ */
  const ENG = V(0, 0, -0.62);
  makePart("engine", V(0, 0.36, -0.88), (b) => {
    const z0 = ENG.z;
    // crankcase
    rbox(b, 0.26, 0.2, 0.28, V(0, 0.455, z0), mt.darkMetal, undefined, 0.04);
    rbox(b, 0.3, 0.025, 0.32, V(0, 0.37, z0), mt.darkMetal, undefined, 0.008);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      bolt(b, V(Math.cos(a) * 0.12, 0.383, z0 + Math.sin(a) * 0.13), V(0, 1, 0), mt.steel, 0.006, 0.005);
    }
    // oil fill cap (yellow)
    cyl(b, V(-0.09, 0.55, z0 + 0.1), V(-0.09, 0.585, z0 + 0.12), 0.016, mt.frame, 14);
    // cylinder (leaning toward +X) with cooling fins
    const lean = -0.32;
    b.with(M(V(0.03, 0.545, z0), E(0, 0, lean)), () => {
      cyl(b, V(0, 0, 0), V(0, 0.27, 0), 0.058, mt.alu, 24);
      for (let i = 0; i < 11; i++) {
        const w = 0.19 - i * 0.003;
        rbox(b, w, 0.0065, w * 0.92, V(0, 0.03 + i * 0.017, 0), mt.alu, undefined, 0.003, 1);
      }
      // head
      rbox(b, 0.18, 0.07, 0.17, V(0, 0.24, 0), mt.alu, undefined, 0.02);
      for (let i = 0; i < 4; i++) rbox(b, 0.008, 0.04, 0.15, V(-0.06 + i * 0.04, 0.29, 0), mt.alu, undefined, 0.003, 1);
      rbox(b, 0.16, 0.025, 0.15, V(0, 0.278, 0), mt.blackAnod, undefined, 0.008); // valve cover
      for (const [x, z] of [[-0.065, -0.06], [0.065, -0.06], [-0.065, 0.06], [0.065, 0.06]]) bolt(b, V(x, 0.29, z), V(0, 1, 0), mt.steel, 0.006, 0.005);
      // spark plug + boot
      cyl(b, V(-0.045, 0.27, 0.05), V(-0.07, 0.33, 0.05), 0.008, mt.whitePlastic, 10);
      cyl(b, V(-0.07, 0.33, 0.05), V(-0.08, 0.36, 0.05), 0.012, mt.accent, 12);
      // intake port forward (+Z), exhaust port back (-Z)
      cyl(b, V(0.0, 0.21, 0.08), V(0.0, 0.21, 0.12), 0.024, mt.alu, 14);
      cyl(b, V(0.0, 0.21, -0.08), V(0.0, 0.21, -0.11), 0.026, mt.alu, 14);
    });
    // blower shroud with recoil starter on -X side
    rbox(b, 0.05, 0.26, 0.28, V(-0.16, 0.5, z0), mt.plastic, undefined, 0.03);
    cylAt(b, V(-0.19, 0.5, z0), V(1, 0, 0), 0.03, 0.07, mt.blackAnod, 28);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rbox(b, 0.006, 0.008, 0.035, V(-0.206, 0.5 + Math.sin(a) * 0.045, z0 + Math.cos(a) * 0.045), mt.darkMetal, E(a, 0, 0), 0.002, 1);
    }
    rbox(b, 0.02, 0.025, 0.08, V(-0.2, 0.6, z0 + 0.02), mt.plastic, undefined, 0.008); // pull handle
    // carb + air filter (pleated)
    const head = V(0.03 + Math.sin(-lean) * 0.21, 0.545 + Math.cos(lean) * 0.21, z0); // approx
    const carb = V(head.x + 0.0, head.y - 0.005, z0 + 0.17);
    rbox(b, 0.06, 0.06, 0.06, carb, mt.alu, undefined, 0.01);
    cyl(b, carb.clone().add(V(0, -0.03, 0)), carb.clone().add(V(0, -0.06, 0.0)), 0.012, mt.blackAnod, 10);
    const filter = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 64, 1, false);
    const fp = filter.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i);
      const z = fp.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.001) continue;
      const a = Math.atan2(z, x);
      const k = 1 + 0.07 * Math.cos(a * 32);
      fp.setX(i, x * k);
      fp.setZ(i, z * k);
    }
    filter.computeVertexNormals();
    const fc = V(carb.x, carb.y + 0.01, z0 + 0.27);
    b.add(filter, mt.filter, M(fc, E(Math.PI / 2, 0, 0)));
    cylAt(b, fc.clone().add(V(0, 0, 0.064)), V(0, 0, 1), 0.01, 0.066, mt.chrome, 28);
    cylAt(b, fc.clone().add(V(0, 0, -0.064)), V(0, 0, 1), 0.01, 0.066, mt.chrome, 28);
    cylAt(b, fc.clone().add(V(0, 0, 0.07)), V(0, 0, 1), 0.008, 0.012, mt.alu, 12);
    cyl(b, carb.clone().add(V(0, 0, 0.03)), fc.clone().add(V(0, 0, -0.065)), 0.026, mt.rubber, 14);
    // CVT cover on +X side
    {
      const drive = { z: z0, y: 0.455, r: 0.105 };
      const driven = { z: -0.82, y: 0.44, r: 0.095 };
      const sh = new THREE.Shape();
      const pts: [number, number][] = [];
      // hull of two circles (in u=-z, v=y)
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI / 2 + (i / steps) * Math.PI;
        pts.push([-drive.z + Math.cos(a) * drive.r * -1, drive.y + Math.sin(a) * drive.r]);
      }
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + (i / steps) * Math.PI;
        pts.push([-driven.z + Math.cos(a) * driven.r * -1, driven.y + Math.sin(a) * driven.r]);
      }
      pts.forEach(([u, v], i) => (i ? sh.lineTo(u, v) : sh.moveTo(u, v)));
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6 });
      // shape u -> world -z ; extrude -> +x
      b.add(g, mt.plastic, M(V(0.155, 0, 0), E(0, Math.PI / 2, 0)));
      const xo = 0.155 + 0.055 + 0.014;
      // vents + bolts + label strip
      for (let i = 0; i < 5; i++) rbox(b, 0.006, 0.012, 0.09, V(xo, 0.43 + i * 0.022, -0.72), mt.darkMetal, undefined, 0.003, 1);
      for (let i = 0; i < 14; i++) {
        const t = i / 14;
        const a = t * Math.PI * 2;
        const c = t < 0.5 ? drive : driven;
        const ang = t < 0.5 ? Math.PI / 2 + t * 2 * Math.PI : -Math.PI / 2 + (t - 0.5) * 2 * Math.PI;
        void a;
        const zz = c.z - Math.cos(ang) * -1 * (c.r - 0.005) * -1;
        bolt(b, V(xo - 0.004, c.y + Math.sin(ang) * (c.r - 0.005), zz), V(1, 0, 0), mt.steel, 0.0055, 0.005);
      }
      rbox(b, 0.004, 0.035, 0.11, V(xo + 0.001, 0.5, -0.6), mt.accent, undefined, 0.002, 1);
    }
    // exhaust header + muffler on -X rear
    const exStart = V(head.x + 0.005, head.y - 0.0, z0 - 0.12);
    const exPath = new THREE.CatmullRomCurve3([
      exStart, V(exStart.x - 0.02, exStart.y + 0.01, z0 - 0.2), V(-0.06, 0.69, -0.86), V(-0.17, 0.62, -0.86), V(-0.215, 0.6, -0.8),
    ], false, "centripetal");
    b.add(new THREE.TubeGeometry(exPath, 60, 0.019, 14), mt.exhaust);
    cylAt(b, exStart, V(0, 0, 1), 0.012, 0.034, mt.steel, 12); // flange
    // muffler
    cyl(b, V(-0.215, 0.6, -0.8), V(-0.215, 0.6, -0.46), 0.055, mt.steel, 28);
    cyl(b, V(-0.215, 0.6, -0.81), V(-0.215, 0.6, -0.79), 0.058, mt.darkMetal, 28);
    cyl(b, V(-0.215, 0.6, -0.47), V(-0.215, 0.6, -0.45), 0.058, mt.darkMetal, 28);
    for (const z of [-0.74, -0.53]) b.add(new THREE.TorusGeometry(0.057, 0.004, 6, 28), mt.darkMetal, M(V(-0.215, 0.6, z)));
    // tailpipe out the back... actually forward-down then turning back
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.215, 0.64, -0.46), V(-0.22, 0.68, -0.43), V(-0.25, 0.7, -0.48), V(-0.26, 0.71, -0.56)]), 16, 0.013, 10), mt.exhaust);
    cyl(b, V(-0.26, 0.71, -0.56), V(-0.262, 0.712, -0.6), 0.016, mt.chrome, 14);
  });

  /* ------------------------------ brakes ------------------------------ */
  makePart("brakes", V(-0.66, 0.4, 0.2), (b) => {
    b.with(wheelMat(-1, FRONT_Z), () => {
      buildDisc(b, mt, true);
    });
  });

  /* ------------------------------- fuel ------------------------------- */
  makePart("fuel", V(0.36, 0.74, -0.24), (b) => {
    const c = V(0.105, 1.115, -0.445);
    rbox(b, 0.22, 0.2, 0.17, c, mt.alu, undefined, 0.035, 3);
    // weld seam ridge
    rbox(b, 0.226, 0.008, 0.176, c.clone().add(V(0, -0.02, 0)), mt.steel, undefined, 0.003, 1);
    // straps
    for (const dx of [-0.06, 0.06]) {
      rbox(b, 0.022, 0.212, 0.182, c.clone().add(V(dx, 0, 0)), mt.plastic, undefined, 0.02, 2);
      bolt(b, c.clone().add(V(dx, -0.106, 0.07)), V(0, -1, 0), mt.steel, 0.005, 0.004);
    }
    // filler neck + cap
    const top = c.clone().add(V(0.04, 0.1, 0.0));
    cyl(b, top, top.clone().add(V(0, 0.025, 0)), 0.025, mt.alu, 20);
    cyl(b, top.clone().add(V(0, 0.025, 0)), top.clone().add(V(0, 0.047, 0)), 0.034, mt.red, 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rbox(b, 0.008, 0.02, 0.012, top.clone().add(V(Math.cos(a) * 0.034, 0.036, Math.sin(a) * 0.034)), mt.red, E(0, -a, 0), 0.003, 1);
    }
    rbox(b, 0.05, 0.008, 0.01, top.clone().add(V(0, 0.051, 0)), mt.alu, undefined, 0.003, 1);
    // vent line + fuel line to engine
    cyl(b, c.clone().add(V(-0.07, 0.1, -0.03)), c.clone().add(V(-0.07, 0.125, -0.03)), 0.006, mt.alu, 8);
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      c.clone().add(V(-0.07, 0.125, -0.03)), c.clone().add(V(-0.1, 0.17, -0.06)), c.clone().add(V(-0.14, 0.12, -0.09)), c.clone().add(V(-0.15, 0.02, -0.1)),
    ]), 20, 0.0045, 6), mt.plastic);
    cyl(b, c.clone().add(V(0.0, -0.1, 0.03)), c.clone().add(V(0.0, -0.13, 0.03)), 0.008, mt.gold, 10);
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      c.clone().add(V(0.0, -0.13, 0.03)), c.clone().add(V(0.0, -0.18, 0.06)), c.clone().add(V(-0.03, -0.22, 0.1)),
    ]), 16, 0.005, 6), mt.whitePlastic);
    // level window
    rbox(b, 0.004, 0.13, 0.025, c.clone().add(V(0.111, 0, 0.04)), mt.accent, undefined, 0.002, 1);
  });

  /* ----------------------------- cluster ------------------------------ */
  const needles: { obj: THREE.Object3D; base: number; amp: number; f: number; ph: number }[] = [];
  makePart("cluster", V(0, 0.72, 0.55), (b, g) => {
    const pod = new THREE.Group();
    pod.position.set(0, 1.04, 0.62);
    pod.rotation.set(0.4, 0, 0);
    g.add(pod);
    // housing in pod-local coords -> bucket with pod matrix
    pod.updateMatrix();
    b.with(pod.matrix.clone(), () => {
      rbox(b, 0.25, 0.1, 0.05, V(0, 0, 0.012), mt.blackAnod, undefined, 0.016);
      rbox(b, 0.25, 0.012, 0.06, V(0, 0.054, -0.006), mt.plastic, undefined, 0.005); // visor
      // mounts to dash bar
      for (const sx of [-0.08, 0.08]) cyl(b, V(sx, -0.03, 0.035), V(sx, -0.045, 0.05), 0.008, mt.alu, 8);
      // warning LEDs
      const ledCols = [mt.lens, mt.led, mt.accent];
      for (let i = 0; i < 3; i++) cylAt(b, V(-0.02 + i * 0.02, -0.038, -0.014), V(0, 0, 1), 0.004, 0.004, ledCols[i], 10);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) bolt(b, V(sx * 0.11, sy * 0.035, -0.0135), V(0, 0, -1), mt.steel, 0.004, 0.003);
      // back: connector + wiring loom down to the dash bar
      rbox(b, 0.07, 0.03, 0.012, V(0.0, -0.005, 0.042), mt.darkMetal, undefined, 0.004, 1);
      for (let i = 0; i < 3; i++) {
        const x0 = -0.02 + i * 0.02;
        b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x0, -0.005, 0.048), V(x0 * 1.4, -0.03, 0.07), V(x0 * 2, -0.075, 0.06)]), 12, 0.0032, 6), i === 1 ? mt.accent : mt.plastic);
      }
    });
    const gauges: { x: number; r: number; kind: "rpm" | "speed" | "temp" }[] = [
      { x: -0.078, r: 0.031, kind: "speed" },
      { x: 0, r: 0.041, kind: "rpm" },
      { x: 0.078, r: 0.031, kind: "temp" },
    ];
    for (const ga of gauges) {
      const gg = new THREE.Group();
      gg.position.set(ga.x, -0.002, -0.0145);
      gg.rotation.y = Math.PI; // local +Z faces driver
      pod.add(gg);
      const t = gaugeTexture(ga.kind);
      const faceMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0 });
      const face = new THREE.Mesh(new THREE.CircleGeometry(ga.r, 48), faceMat);
      gg.add(face);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(ga.r + 0.002, 0.0035, 8, 48), mt.chrome);
      bezel.position.z = 0.002;
      gg.add(bezel);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(ga.r, 32), mt.glass);
      glass.position.z = 0.004;
      gg.add(glass);
      const pivot = new THREE.Group();
      pivot.position.z = 0.0025;
      gg.add(pivot);
      const ng = new THREE.BoxGeometry(0.0022, ga.r * 0.86, 0.0008);
      ng.translate(0, ga.r * 0.36, 0);
      const needleMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff5a10, emissiveIntensity: 1.6 });
      pivot.add(new THREE.Mesh(ng, needleMat));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 14), mt.blackAnod);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.001;
      pivot.add(cap);
      const frac = ga.kind === "rpm" ? 0.22 : ga.kind === "speed" ? 0.08 : 0.45;
      const base = (135 - 270 * frac) * (Math.PI / 180);
      pivot.rotation.z = base;
      needles.push({ obj: pivot, base, amp: ga.kind === "rpm" ? 0.06 : 0.015, f: ga.kind === "rpm" ? 2.3 : 0.6, ph: ga.x * 10 });
    }
  });

  /* -------------------------------- nav -------------------------------- */
  let navMat: THREE.MeshStandardMaterial | null = null;
  makePart("nav", V(0.72, 0.5, 0.42), (b, g) => {
    const unit = new THREE.Group();
    unit.position.set(0.19, 1.115, 0.6);
    unit.rotation.set(0.38, 0.32, 0, "YXZ");
    g.add(unit);
    unit.updateMatrix();
    b.with(unit.matrix.clone(), () => {
      rbox(b, 0.17, 0.112, 0.03, V(0, 0, 0.008), mt.blackAnod, undefined, 0.012);
      rbox(b, 0.172, 0.012, 0.028, V(0, 0.058, 0.0), mt.plastic, undefined, 0.004); // sun lip
      for (let i = 0; i < 3; i++) cylAt(b, V(0.087, -0.025 + i * 0.022, 0.008), V(1, 0, 0), 0.004, 0.0055, i === 0 ? mt.accent : mt.plastic, 10);
      // RAM mount: ball + arm + ball + clamp
      sph(b, V(0, -0.01, 0.034), 0.012, mt.plastic, 12, 10);
      rbox(b, 0.022, 0.012, 0.075, V(0, -0.022, 0.065), mt.blackAnod, E(-0.5, 0, 0), 0.005);
      sph(b, V(0, -0.045, 0.1), 0.012, mt.plastic, 12, 10);
    });
    const navTex = navTexture();
    navMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: navTex, emissiveIntensity: 1.15, roughness: 0.18, metalness: 0 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.094), navMat);
    screen.position.set(0, 0, -0.0075);
    screen.rotation.y = Math.PI;
    unit.add(screen);
    // clamp onto dash bar (root coords)
    const bar = fr.snap(V(0.19, 1.0, 0.646));
    cylAt(b, bar, V(1, 0, 0), 0.03, 0.02, mt.blackAnod, 14);
  });

  /* --------------------------- idle update --------------------------- */
  const eng = builds.engine;
  const engBaseY = eng.contentBase.y;
  const engBaseX = eng.contentBase.x;
  const navM = navMat as THREE.MeshStandardMaterial | null;

  function update(_dt: number, t: number): void {
    for (let i = 0; i < needles.length; i++) {
      const n = needles[i];
      n.obj.rotation.z = n.base + Math.sin(t * n.f + n.ph) * n.amp + Math.sin(t * n.f * 3.1 + n.ph) * n.amp * 0.35;
    }
    // idle engine shake on the inner content group (part group itself stays free for the caller)
    eng.content.position.y = engBaseY + Math.sin(t * 71) * 0.0006;
    eng.content.position.x = engBaseX + Math.sin(t * 53 + 1.3) * 0.0004;
    if (navM) navM.emissiveIntensity = 1.1 + Math.sin(t * 1.4) * 0.06;
  }

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) mesh.castShadow = true;
  });
  root.userData.triangleCount = countTriangles(root);

  return { root, parts, chassis, update };
}

/** Brake disc assembly in wheel-local coords (axis X, outer face +X). */
function buildDisc(b: Bucket, mt: Mats, hero: boolean): void {
  const AX = -0.15; // disc centre plane (inboard of rim)
  const R = hero ? 0.142 : 0.12;
  const RI = 0.062;
  const plateShape = (drill: boolean) => {
    const sh = new THREE.Shape();
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (i === 0) sh.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      else sh.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    const inner = new THREE.Path();
    for (let i = 0; i <= 36; i++) {
      const a = -(i / 36) * Math.PI * 2;
      if (i === 0) inner.moveTo(Math.cos(a) * RI, Math.sin(a) * RI);
      else inner.lineTo(Math.cos(a) * RI, Math.sin(a) * RI);
    }
    sh.holes.push(inner);
    if (drill) {
      for (const [rr, cnt, off] of [[0.095, 14, 0], [0.114, 14, 0.5], [0.13, 14, 0.25]] as [number, number, number][]) {
        for (let k = 0; k < cnt; k++) {
          const a0 = ((k + off) / cnt) * Math.PI * 2;
          const cx = Math.cos(a0) * rr;
          const cy = Math.sin(a0) * rr;
          const hp = new THREE.Path();
          for (let j = 0; j <= 10; j++) {
            const a = -(j / 10) * Math.PI * 2;
            if (j === 0) hp.moveTo(cx + Math.cos(a) * 0.0055, cy + Math.sin(a) * 0.0055);
            else hp.lineTo(cx + Math.cos(a) * 0.0055, cy + Math.sin(a) * 0.0055);
          }
          sh.holes.push(hp);
        }
      }
    }
    return sh;
  };
  const T = 0.0062;
  const GAP = 0.0075;
  const discMat = hero ? mt.disc : mt.steel;
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(plateShape(hero), { depth: T, bevelEnabled: false, curveSegments: 4 });
    // extrude along +z -> map to +x
    const x = AX + side * (GAP / 2 + T / 2) - T / 2;
    b.add(g, discMat, M(V(x, 0, 0), E(0, Math.PI / 2, 0)).multiply(M(V(0, 0, 0), E(0, 0, 0))));
  }
  // vanes between plates
  const vanes = hero ? 36 : 24;
  for (let i = 0; i < vanes; i++) {
    const a = (i / vanes) * Math.PI * 2;
    const rm = (R + RI + 0.012) / 2;
    b.add(new THREE.BoxGeometry(GAP, R - RI - 0.016, 0.005), mt.darkMetal, M(V(AX, Math.cos(a) * rm, Math.sin(a) * rm), E(a + 0.25, 0, 0)));
  }
  // hat / bell connecting to hub (outboard)
  cyl(b, V(AX - 0.002, 0, 0), V(AX + 0.05, 0, 0), RI + 0.004, hero ? mt.discHat : mt.darkMetal, 32, true);
  cyl(b, V(AX + 0.049, 0, 0), V(AX + 0.053, 0, 0), RI + 0.004, hero ? mt.discHat : mt.darkMetal, 32);
  // floating bobbins
  const nb = hero ? 8 : 6;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    const p = V(AX, Math.cos(a) * (RI + 0.006), Math.sin(a) * (RI + 0.006));
    cylAt(b, p, V(1, 0, 0), GAP + T * 2 + 0.006, 0.0075, hero ? mt.gold : mt.steel, 10);
  }
  // caliper (radial at angle phi from +Y toward +Z => toward vehicle rear for both sides after wheel transform)
  const phi = hero ? -1.05 : 1.05; // both end up at the front-top of their wheel
  const calMat = hero ? mt.caliper : mt.darkMetal;
  b.with(M(V(0, 0, 0), E(phi, 0, 0)), () => {
    const rc = R - 0.03;
    const L = hero ? 0.13 : 0.1;
    const halfW = hero ? 0.028 : 0.02;
    // two halves (curved approx: 3 blocks along arc each)
    for (const side of [-1, 1]) {
      const xh = AX + side * (GAP / 2 + T + 0.004 + halfW / 2);
      for (let k = -1; k <= 1; k++) {
        const a = (k * L) / 3 / rc;
        rbox(b, halfW, 0.066, L / 3 + 0.006, V(xh, Math.cos(a) * rc, Math.sin(a) * rc), calMat, E(a, 0, 0), 0.009, 2);
      }
    }
    // bridge over disc edge
    rbox(b, GAP + 2 * T + 0.016 + halfW * 2 - 0.004, 0.022, L * 0.82, V(AX, R + 0.009, 0), calMat, undefined, 0.008, 2);
    if (hero) {
      // window/pads showing
      rbox(b, GAP + 2 * T + 0.004, 0.006, L * 0.55, V(AX, R + 0.021, 0), mt.darkMetal, undefined, 0.002, 1);
      // bolts, bleed nipple, piston bumps on outer face
      for (const k of [-1, 1]) {
        bolt(b, V(AX - (GAP / 2 + T + 0.004 + halfW), rc + 0.01, k * L * 0.38), V(-1, 0, 0), mt.chrome, 0.006, 0.006);
        bolt(b, V(AX + (GAP / 2 + T + 0.004 + halfW), rc + 0.01, k * L * 0.38), V(1, 0, 0), mt.chrome, 0.006, 0.006);
        cylAt(b, V(AX - (GAP / 2 + T + 0.004 + halfW), rc - 0.005, k * 0.026), V(1, 0, 0), 0.008, 0.016, calMat, 16);
      }
      cyl(b, V(AX - 0.03, R + 0.018, L * 0.36), V(AX - 0.03, R + 0.034, L * 0.36), 0.0045, mt.chrome, 6);
      // logo strip
      rbox(b, 0.002, 0.016, L * 0.5, V(AX + (GAP / 2 + T + 0.004 + halfW) + 0.0005, rc - 0.008, 0), mt.whitePlastic, undefined, 0.001, 1);
      // brake hose (braided) out of the inboard half
      const hs = V(AX - (GAP / 2 + T + 0.004 + halfW), rc + 0.02, -L * 0.3);
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([hs, hs.clone().add(V(-0.03, 0.02, -0.01)), hs.clone().add(V(-0.07, 0.01, -0.04)), hs.clone().add(V(-0.1, -0.03, -0.05))]), 20, 0.0045, 8), mt.steel);
      cylAt(b, hs.clone().add(V(-0.004, 0, 0)), V(1, 0, 0), 0.014, 0.0075, mt.gold, 6);
      rbox(b, 0.002, 0.016, L * 0.5, V(AX - (GAP / 2 + T + 0.004 + halfW) - 0.0005, rc - 0.008, 0), mt.whitePlastic, undefined, 0.001, 1);
    }
  });
}

function countTriangles(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    n += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
  });
  return Math.round(n);
}
