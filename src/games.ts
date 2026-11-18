/**
 * Four small 2D games, one per business function. Each is its own world with its own camera and rule:
 *  road    · Strategy  · side-view hill climb in a mountain forest
 *  funnel  · Marketing · side-view boosters and a ramp jump onto a conversion scale, neon city
 *  orders  · Ops       · top-down yard: problems land in your lane
 *  runway  · Finance   · overhead desert route where fuel is runway
 * Every game runs 10–15 s and calls onDone once.
 */
export type GameKind = "road" | "funnel" | "orders" | "runway";
export interface GameScore { road?: string; conv: number; orders: number; auto: boolean; fuel: number; aum: number; rivals: number; dodged: number; prog: number }
export interface GameHooks { onPop(t: string, c: string): void; onScore(p: Partial<GameScore>): void; onTel(kmh: number, prog: number): void; onDone(): void }
export interface GameInput { left: boolean; right: boolean }

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FONT = '"Saira Stencil One", Impact, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
type G = CanvasRenderingContext2D;

function tag(g: G, text: string, x: number, y: number, bg: string, fg = "#14110e", size = 15) {
  g.save(); g.font = `700 ${size}px ${MONO}`; const w = g.measureText(text).width + size * 1.2, h = size * 1.9;
  g.fillStyle = bg; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, x, y + 1); g.restore();
}
function wheel(g: G, x: number, y: number, r: number, rot: number) {
  g.fillStyle = "#151515"; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = "#c9ced6"; g.beginPath(); g.arc(x, y, r * 0.48, 0, TAU); g.fill();
  g.strokeStyle = "#5a5f66"; g.lineWidth = 2.2;
  for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.46, y + Math.sin(a) * r * 0.46); g.stroke(); }
}
/** the BAJA buggy, side view; (x, y) is the ground under its middle */
function buggySide(g: G, x: number, y: number, ang: number, s: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(0, 1, 52, 6, 0, 0, TAU); g.fill();
  wheel(g, -34, -17, 17, rot); wheel(g, 36, -17, 17, rot);
  g.strokeStyle = "#1e1e1e"; g.lineWidth = 4.5; g.lineJoin = "round";
  g.beginPath(); g.moveTo(-34, -17); g.lineTo(-22, -30); g.moveTo(36, -17); g.lineTo(26, -30); g.stroke();
  g.fillStyle = "#f2b705"; g.beginPath(); g.moveTo(-46, -26); g.lineTo(48, -26); g.lineTo(42, -40); g.lineTo(-38, -42); g.closePath(); g.fill();
  g.fillStyle = "#14110e"; g.fillRect(-20, -38, 22, 9);
  g.beginPath(); g.moveTo(-32, -40); g.lineTo(-22, -74); g.lineTo(8, -76); g.lineTo(30, -40); g.stroke();
  g.beginPath(); g.moveTo(-22, -74); g.lineTo(-10, -40); g.stroke();
  g.fillStyle = "#f4f1ea"; g.beginPath(); g.arc(-4, -55, 10, 0, TAU); g.fill();
  g.fillStyle = "#14110e"; g.beginPath(); g.arc(-1, -55, 6, -0.9, 0.9); g.fill();
  g.fillStyle = "#ef5350"; g.fillRect(-14, -62, 20, 3);
  g.restore();
}
/** the buggy from above; (x, y) is its centre, heading 0 = up the screen */
function buggyTop(g: G, x: number, y: number, head: number, s = 1) {
  g.save(); g.translate(x, y); g.rotate(head); g.scale(s, s);
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.roundRect(-20, -28, 44, 62, 10); g.fill();
  g.fillStyle = "#151515"; for (const [wx, wy] of [[-24, -20], [14, -20], [-24, 12], [14, 12]]) { g.beginPath(); g.roundRect(wx, wy, 10, 18, 3); g.fill(); }
  g.fillStyle = "#f2b705"; g.beginPath(); g.roundRect(-14, -30, 28, 60, 9); g.fill();
  g.strokeStyle = "#1e1e1e"; g.lineWidth = 3; g.strokeRect(-11, -12, 22, 26);
  g.fillStyle = "#f4f1ea"; g.beginPath(); g.arc(0, 2, 7, 0, TAU); g.fill();
  g.fillStyle = "#14110e"; g.fillRect(-9, -28, 18, 6);
  g.restore();
}

/* ======================================================================= the runner */
export function runGame(cv: HTMLCanvasElement, kind: GameKind, choice: string, hooks: GameHooks, input: GameInput) {
  const g = cv.getContext("2d")!;
  let W = 0, H = 0, raf = 0, last = performance.now(), dead = false, done = false, endT = -1, t = 0;
  const fit = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  fit(); window.addEventListener("resize", fit);
  const game = kind === "road" ? hillClimb(choice, hooks) : kind === "funnel" ? rampJump(choice, hooks) : kind === "orders" ? opsYard(choice, hooks, input) : desertRun(choice, hooks);
  const finish = () => { if (endT < 0) endT = t; };
  const step = (dt: number) => {
    t += dt; game.step(dt, t, finish);
    if (endT >= 0 && !done && t - endT > 1.1) { done = true; hooks.onDone(); }
  };
  const frame = (now: number) => {
    if (dead) return;
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    step(dt); game.draw(g, W, H, t);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const dbg = { advance: (sec: number) => { for (let k = 0; k < Math.round(sec * 60); k++) step(1 / 60); game.draw(g, W, H, t); } };
  (window as unknown as Record<string, unknown>).__game = dbg;
  return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener("resize", fit); if ((window as unknown as Record<string, unknown>).__game === dbg) delete (window as unknown as Record<string, unknown>).__game; };
}
interface Game { step(dt: number, t: number, finish: () => void): void; draw(g: G, W: number, H: number, t: number): void }

/* ======================================================================= 1 · STRATEGY: hill climb */
function hillClimb(choice: string, hk: GameHooks): Game {
  const FIN = 2800, LIMIT = 13;
  const mountain = choice === "mountain", mud = choice === "mud", flat = choice === "flat";
  const h = (x: number) => {
    if (!mountain) return 6 * Math.sin(x * 0.012) + 3 * Math.sin(x * 0.041);
    if (x < 300) return 0;
    if (x < 1350) { const u = (x - 300) / 1050; return 540 * smooth(u) + 22 * Math.sin(x * 0.03) * Math.sin(u * Math.PI); }
    if (x < 1550) return 540 + 5 * Math.sin(x * 0.05);
    if (x < 2200) return 540 * (1 - smooth((x - 1550) / 650));
    return 0;
  };
  const slope = (x: number) => (h(x + 2) - h(x - 2)) / 4;
  let x = 40, v = 0, rot = 0, camH = 0, rivalX = 260, blocked = false, popped = new Set<string>(), splash: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
  const r = rng(7);
  const peaks = Array.from({ length: 16 }, (_, k) => ({ x: k * 260 + r() * 120, h: 160 + r() * 170, w: 220 + r() * 160 }));
  const pines = Array.from({ length: 70 }, (_, k) => ({ x: k * 70 + r() * 50, s: 0.6 + r() * 0.7 }));
  const near = Array.from({ length: 40 }, (_, k) => ({ x: k * 140 + r() * 90, s: 0.8 + r() * 0.6 }));
  const pop = (k: string, txt: string, c: string) => { if (!popped.has(k)) { popped.add(k); hk.onPop(txt, c); } };
  hk.onScore({ road: choice, rivals: 0 });
  return {
    step(dt, t, finish) {
      const sl = slope(x), sin = sl / Math.sqrt(1 + sl * sl);
      const vmax = mud ? 120 : 520;
      let a = (mud ? 160 : 380) - 900 * sin - (mud ? 1.6 : 0.35) * v;
      v = clamp(v + a * dt, mountain && sin > 0.2 ? 80 : 0, vmax);
      if (flat) {
        rivalX += 105 * dt;
        blocked = rivalX - x < 150;
        if (blocked) { v = Math.min(v, 105); x = Math.min(x, rivalX - 140); pop("rival", "BLOCKED BY FUNDED RIVALS", "#ef5350"); hk.onScore({ rivals: 3 }); }
      }
      x += v * dt; rot += (v * dt) / 17;
      if (mud) {
        if (Math.random() < 0.6) splash.push({ x: x - 30, y: 0, vx: -60 - Math.random() * 80, vy: 120 + Math.random() * 160, l: 0.7 });
        if (t > 1.2) pop("mud", "WHEELS SPINNING · SLOW GRIND", "#a1764a");
        if (t > 6) pop("mud2", "STILL IN THE MUD", "#a1764a");
      }
      splash.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 600 * dt; p.l -= dt; }); splash = splash.filter((p) => p.l > 0 && p.y > -5);
      if (mountain) {
        if (x > 330) pop("climb", "HARD CLIMB", "#4fc3f7");
        if (x > 1360) pop("top", "OVER THE TOP", "#4fc3f7");
        if (x > 1900) pop("road", "THE ROAD IS YOURS", "#2bff88");
      }
      camH = lerp(camH, h(x), clamp(dt * 3, 0, 1));
      const prog = clamp(x / FIN, 0, 1);
      hk.onTel(v / 6, prog); hk.onScore({ prog });
      if (x >= FIN) { pop("win", "MARKET LEADER 🏁", "#2bff88"); finish(); }
      else if (t >= LIMIT) { pop("end", flat ? "TIME'S UP · RIVALS OWN THIS ROAD" : "TIME'S UP · STILL GRINDING", "#ffca28"); finish(); }
    },
    draw(g, W, H) {
      const camX = x - W * 0.33, base = H * 0.74, sy = (wh: number) => base - (wh - camH);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#34488f"); sky.addColorStop(0.5, "#e58fb0"); sky.addColorStop(0.85, "#ffc38f"); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,240,200,.9)"; g.beginPath(); g.arc(W * 0.78, H * 0.36 + camH * 0.05, 46, 0, TAU); g.fill();
      for (const p of peaks) { const px = p.x - camX * 0.12, by = H * 0.62 + camH * 0.12; const xx = ((px % (16 * 260)) + 16 * 260) % (16 * 260) - 300;
        g.fillStyle = "#6f7fb0"; g.beginPath(); g.moveTo(xx - p.w / 2, by); g.lineTo(xx, by - p.h); g.lineTo(xx + p.w / 2, by); g.fill();
        g.fillStyle = "#f4f6ff"; g.beginPath(); g.moveTo(xx - p.w * 0.12, by - p.h * 0.76); g.lineTo(xx, by - p.h); g.lineTo(xx + p.w * 0.12, by - p.h * 0.76); g.fill(); }
      const pine = (px: number, by: number, s: number, c: string) => { g.fillStyle = c; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(px - 26 * s + k * 5 * s, by - k * 22 * s); g.lineTo(px, by - (48 + k * 22) * s); g.lineTo(px + 26 * s - k * 5 * s, by - k * 22 * s); g.fill(); } };
      for (const p of pines) { const px = ((p.x - camX * 0.35) % 4900 + 4900) % 4900 - 100; pine(px, H * 0.7 + camH * 0.35 - 20, p.s * 1.2, "#2c5a46"); }
      // ground
      g.beginPath(); g.moveTo(0, H);
      for (let sx = 0; sx <= W + 8; sx += 8) g.lineTo(sx, sy(h(camX + sx)));
      g.lineTo(W, H); g.closePath();
      g.fillStyle = mud ? "#5a3d22" : flat ? "#3b3f45" : "#4a3524"; g.fill();
      g.lineWidth = 14; g.strokeStyle = mud ? "#7a5530" : flat ? "#585e66" : "#3f7a3a";
      g.beginPath(); for (let sx = 0; sx <= W + 8; sx += 8) { const yy = sy(h(camX + sx)) + 6; if (sx === 0) g.moveTo(sx, yy); else g.lineTo(sx, yy); } g.stroke();
      if (flat) { g.setLineDash([30, 26]); g.lineWidth = 3; g.strokeStyle = "#f4efe2"; g.beginPath(); for (let sx = 0; sx <= W + 8; sx += 8) { const yy = sy(h(camX + sx)) + 22; if (sx === 0) g.moveTo(sx - (camX % 56), yy); else g.lineTo(sx, yy); } g.stroke(); g.setLineDash([]); }
      if (mud) { g.fillStyle = "rgba(40,25,10,.55)"; for (let k = 0; k < 30; k++) { const px = k * 120 - (camX % 120); g.beginPath(); g.ellipse(px, sy(h(camX + px)) + 10, 34, 5, 0, 0, TAU); g.fill(); } }
      // signs
      const sign = (wx: number, txt: string, c: string) => { const px = wx - camX; if (px < -200 || px > W + 200) return; const yy = sy(h(wx)); g.fillStyle = "#4a3020"; g.fillRect(px - 3, yy - 70, 6, 70); tag(g, txt, px, yy - 82, c, "#14110e", 13); };
      if (mountain) { sign(200, "MOUNTAIN PASS ↗", "#4fc3f7"); sign(1440, "SUMMIT · B2B2C", "#ffe2a8"); }
      if (flat) sign(140, "HIGHWAY · EVERYONE'S HERE", "#9fb4c8");
      if (mud) sign(140, "SAME OLD ROAD", "#a1764a");
      // finish flag
      { const px = FIN - camX, yy = sy(h(FIN)); if (px > -80 && px < W + 80) { g.fillStyle = "#ddd"; g.fillRect(px, yy - 110, 5, 110); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#fff"; g.fillRect(px + 5 + i * 12, yy - 110 + j * 12, 12, 12); } } }
      // rivals
      if (flat) for (let k = 0; k < 3; k++) { const rx = rivalX + k * 95 - camX, yy = sy(h(rivalX + k * 95));
        g.save(); g.translate(rx, yy); g.rotate(Math.atan(slope(rivalX + k * 95)));
        g.fillStyle = ["#c62828", "#6a1b9a", "#1565c0"][k]; g.beginPath(); g.roundRect(-38, -40, 76, 26, 8); g.fill(); g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(-18, -54, 34, 16);
        wheel(g, -24, -12, 12, 0); wheel(g, 24, -12, 12, 0); g.restore(); if (k === 1) tag(g, "FUNDED RIVALS · ₹₹₹", rx, yy - 78, "#ef5350", "#fff", 12); }
      splash.forEach((p) => { g.fillStyle = `rgba(90,60,30,${p.l})`; g.beginPath(); g.arc(p.x - camX, sy(h(p.x) + p.y), 4, 0, TAU); g.fill(); });
      buggySide(g, x - camX, sy(h(x)) + 2, -Math.atan(slope(x)), 1.15, rot);
      for (const p of near) { const px = ((p.x - camX * 1.25) % 5600 + 5600) % 5600 - 200; pine(px, H + 30, p.s * 2.2, "rgba(20,40,28,.85)"); }
    },
  };
}

/* ======================================================================= 2 · MARKETING: boosters and a ramp jump */
function rampJump(choice: string, hk: GameHooks): Game {
  const leak = choice === "leak";
  const RX = 2300, RW = 170, RH = 80, L0 = RX + RW + 200, L1 = L0 + 1900;
  const mark = (p: number) => L0 + ((p - 10) / 50) * (L1 - L0);
  const pads = leak ? [{ x: 600, l: "FOLLOW UP FAST" }, { x: 1150, l: "SALES DASHBOARD" }, { x: 1700, l: "AUTO LEAD FLOW" }] : [{ x: 600, l: "+ MORE ADS" }, { x: 1150, l: "+ MORE ADS" }, { x: 1700, l: "+ MORE ADS" }];
  let x = 0, y = 0, v = 280, vy = 0, air = false, landed = false, rot = 0, conv = 10, hit = 0, ang = 0, camY = 0, boostT = 0;
  let orbs: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
  const r = rng(11);
  const bldg = Array.from({ length: 40 }, (_, k) => ({ x: k * 120 + r() * 40, w: 70 + r() * 70, h: 140 + r() * 260, c: ["#c56bff", "#3ad0ff", "#ff5fb0"][k % 3], lit: Array.from({ length: 40 }, () => r() < 0.45) }));
  const stars = Array.from({ length: 90 }, () => ({ x: r(), y: r() * 0.5, s: r() }));
  const ground = (px: number) => (px > RX && px < RX + RW ? ((px - RX) / RW) * RH : 0);
  hk.onScore({ conv });
  return {
    step(dt, t, finish) {
      if (!air && !landed) {
        for (const p of pads) if (x < p.x && x + v * dt >= p.x) {
          hit++;
          if (leak) { conv = [23, 36, 50][hit - 1]; v += 120; boostT = 0.8; hk.onPop(`${p.l} · CONVERSION ${conv}%`, "#ff7043"); }
          else { conv = Math.min(16, conv + 2); for (let k = 0; k < 14; k++) orbs.push({ x: p.x + r() * 60, y: 160 + r() * 80, vx: -40 + r() * 80, vy: -30 - r() * 60, l: 1.6 }); hk.onPop("MORE LEADS IN · MOST LEAK OUT", "#ff7043"); }
          hk.onScore({ conv });
        }
        x += v * dt; y = ground(x); ang = x > RX && x < RX + RW ? -Math.atan(RH / RW) : 0;
        if (x >= RX + RW) {
          air = true; const th = 0.55; const dist = mark(conv) - x; const vv = Math.sqrt((dist * 900) / Math.sin(2 * th));
          v = vv * Math.cos(th); vy = vv * Math.sin(th); hk.onPop(leak ? "LAUNCH!" : "LAUNCH…", "#ffca28");
        }
      } else if (air) {
        x += v * dt; y += vy * dt; vy -= 900 * dt; ang = -Math.atan2(vy, v) * 0.6;
        if (y <= 0) { y = 0; air = false; landed = true; ang = 0; hk.onPop(conv >= 50 ? `${conv}% · TARGET HIT 🎯` : `${conv}% · SAME LEAK, SHORT OF 50%`, conv >= 50 ? "#2bff88" : "#ffca28"); }
      } else { v = Math.max(0, v - 1400 * dt); x += v * dt; if (v === 0) finish(); }
      boostT -= dt; rot += (v * dt) / 17;
      orbs.forEach((o) => { o.x += o.vx * dt; o.y += o.vy * dt; o.vy -= 120 * dt; o.l -= dt; }); orbs = orbs.filter((o) => o.l > 0);
      camY = lerp(camY, y, clamp(dt * 2.5, 0, 1));
      const prog = clamp(x / mark(50), 0, 1);
      hk.onTel(v / 6, prog); void t;
    },
    draw(g, W, H, t) {
      const camX = x - W * 0.35, base = H * 0.76 + camY * 0.6, sx = (wx: number) => wx - camX, sy = (wy: number) => base - wy;
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#040822"); sky.addColorStop(0.6, "#2a1858"); sky.addColorStop(1, "#5a3b9a"); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const s of stars) { g.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 2 + s.s * 9))})`; g.fillRect(s.x * W, s.y * H, 2, 2); }
      for (const b of bldg) { const px = ((b.x - camX * 0.3) % 4800 + 4800) % 4800 - 200, by = base - 40 + camY * 0.1;
        g.fillStyle = "#120a28"; g.fillRect(px, by - b.h, b.w, b.h); g.fillStyle = b.c; g.fillRect(px, by - b.h, b.w, 4);
        for (let i = 0; i < 40; i++) if (b.lit[i]) { const cx = px + 8 + (i % 4) * (b.w - 16) / 4, cy = by - b.h + 16 + Math.floor(i / 4) * 22; if (cy < by - 10) { g.fillStyle = b.c + "aa"; g.fillRect(cx, cy, 8, 10); } } }
      // road
      g.fillStyle = "#16131f"; g.fillRect(0, sy(0), W, H);
      g.fillStyle = "#ff5fb0"; g.fillRect(0, sy(0), W, 3); g.shadowColor = "#ff5fb0"; g.shadowBlur = 14; g.fillRect(0, sy(0), W, 3); g.shadowBlur = 0;
      g.setLineDash([40, 30]); g.strokeStyle = "#3ad0ff88"; g.lineWidth = 3; g.beginPath(); g.moveTo(-(camX % 70), sy(0) + 30); g.lineTo(W, sy(0) + 30); g.stroke(); g.setLineDash([]);
      // the gap and the landing scale
      g.fillStyle = "#05030c"; g.fillRect(sx(RX + RW), sy(0), L0 - RX - RW - 40, H);
      for (let p = 10; p <= 60; p += 5) { const px = sx(mark(p)); if (px < -40 || px > W + 40) continue; g.fillStyle = p === 50 ? "#2bff88" : "#ffffff55"; g.fillRect(px - 1, sy(0) - (p % 10 ? 10 : 22), 3, p % 10 ? 10 : 22); if (p % 10 === 0) { g.font = `700 14px ${MONO}`; g.textAlign = "center"; g.fillStyle = p === 50 ? "#2bff88" : "#ffffffaa"; g.fillText(`${p}%`, px, sy(0) + 22); } }
      { const px = sx(mark(50)); if (px > -100 && px < W + 100) { g.fillStyle = "#ddd"; g.fillRect(px - 2, sy(0) - 120, 4, 100); g.fillStyle = "#2bff88"; g.beginPath(); g.moveTo(px + 2, sy(0) - 120); g.lineTo(px + 56, sy(0) - 105); g.lineTo(px + 2, sy(0) - 90); g.fill(); tag(g, "TARGET 50%", px, sy(0) - 140, "#2bff88", "#04140a", 13); } }
      tag(g, "CONVERSION →", sx(L0) + 70, sy(0) - 30, "#3ad0ff", "#04101a", 12);
      // ramp
      { const a = sx(RX); g.fillStyle = "#f2b705"; g.beginPath(); g.moveTo(a, sy(0)); g.lineTo(a + RW, sy(RH)); g.lineTo(a + RW, sy(0)); g.closePath(); g.fill();
        g.fillStyle = "#14110e"; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(a + RW - 4, sy(RH) + 10 + k * 14); g.lineTo(a + RW - 14, sy(RH) + 17 + k * 14); g.lineTo(a + RW - 4, sy(RH) + 24 + k * 14); g.fill(); } }
      // pads
      for (const p of pads) { const px = sx(p.x); if (px < -120 || px > W + 120) continue;
        if (leak) { g.fillStyle = "#ff7043"; g.shadowColor = "#ff7043"; g.shadowBlur = 20; g.beginPath(); g.roundRect(px - 50, sy(0) - 6, 100, 10, 4); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "#fff"; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(px - 26 + k * 18, sy(0) - 5); g.lineTo(px - 18 + k * 18, sy(0) - 1); g.lineTo(px - 26 + k * 18, sy(0) + 3); g.fill(); } tag(g, p.l, px, sy(0) - 96, "#ff7043", "#14110e", 13); }
        else { g.fillStyle = "#2a1858"; g.fillRect(px - 4, sy(0) - 140, 8, 140); g.fillStyle = "#ff5fb0"; g.fillRect(px - 60, sy(0) - 190, 120, 54); g.fillStyle = "#fff"; g.font = `22px ${FONT}`; g.textAlign = "center"; g.fillText("BUY NOW!", px, sy(0) - 156); } }
      orbs.forEach((o) => { g.fillStyle = `rgba(255,255,255,${clamp(o.l, 0, 1)})`; g.beginPath(); g.arc(sx(o.x), sy(o.y), 4, 0, TAU); g.fill(); });
      if (boostT > 0) { g.strokeStyle = `rgba(255,112,67,${boostT})`; g.lineWidth = 3; for (let k = 0; k < 6; k++) { const yy = sy(y) - 20 - k * 9; g.beginPath(); g.moveTo(sx(x) - 70 - k * 12, yy); g.lineTo(sx(x) - 160 - k * 12, yy); g.stroke(); } }
      buggySide(g, sx(x), sy(y), ang, 1.1, rot);
    },
  };
}

/* ======================================================================= 3 · OPS: top-down yard, problems land in your lane */
function opsYard(choice: string, hk: GameHooks, input: GameInput): Game {
  const fire = choice === "fire", LANE = 116, END = 3800;
  const PROB = [{ d: 520, k: 1, l: "LATE TRUCK" }, { d: 1100, k: 0, l: "STOCK-OUT" }, { d: 1680, k: 2, l: "BAD DATA" }, { d: 2260, k: 1, l: "MISSED HANDOFF" }, { d: 2840, k: 0, l: "FAILED PAYMENT" }, { d: 3420, k: 2, l: "LATE TRUCK" }]
    .map((p) => ({ ...p, state: "ahead" as "ahead" | "fixing" | "fixed" | "dodged" }));
  let dist = 0, lane = 1, lx = 1, fixT = 0, sop = false, hits = 0, dodged = 0, manualT = 0, orders = 0, prevL = false, prevR = false;
  const r = rng(5);
  const side = Array.from({ length: 60 }, (_, k) => ({ d: k * 140 + r() * 60, left: r() < 0.5, kind: Math.floor(r() * 3), c: ["#d84315", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a"][Math.floor(r() * 5)] }));
  const next = () => PROB.find((p) => p.state === "ahead" && p.d > dist - 30);
  return {
    step(dt, t, finish) {
      if (input.left && !prevL) { lane = Math.max(0, lane - 1); manualT = 1.5; } if (input.right && !prevR) { lane = Math.min(2, lane + 1); manualT = 1.5; }
      prevL = input.left; prevR = input.right; manualT -= dt;
      const n = next();
      if (manualT <= 0 && n) {
        if (fire || !sop) lane = n.k;                                 // firefighting: meet each problem head on
        else if (n.d - dist < 420) lane = n.k === 1 ? (lx < 1 ? 0 : 2) : 1; // the system routes around it
      }
      lx += (lane - lx) * clamp(dt * 7, 0, 1);
      const speed = fixT > 0 ? 0 : sop ? 400 : 340;
      if (fixT > 0) { fixT -= dt; if (fixT <= 0) { const p = PROB.find((q) => q.state === "fixing"); if (p) p.state = "fixed"; } }
      dist += speed * dt;
      for (const p of PROB) {
        if (p.state !== "ahead") continue;
        if (Math.abs(p.d - dist) < 40 && Math.abs(p.k - lx) < 0.55) {
          p.state = "fixing"; hits++; fixT = !fire && !sop ? 1.2 : 0.8;
          if (!fire && !sop) { sop = true; hk.onPop("FIXED ONCE · SOP WRITTEN · AUTOMATED", "#ffca28"); hk.onScore({ auto: true }); }
          else hk.onPop(`${p.l} · FIXING BY HAND 🔧`, "#ef5350");
          hk.onScore({ orders: hits });
        } else if (dist - p.d > 40) { p.state = "dodged"; dodged++; hk.onPop(sop ? `${p.l} · AUTO-ROUTED` : `${p.l} · DODGED`, "#ffca28"); hk.onScore({ dodged }); }
      }
      const o = Math.floor(dist / 500); if (o > orders) { orders = o; }
      const prog = clamp(dist / END, 0, 1); hk.onTel(speed / 6, prog); hk.onScore({ prog });
      if (dist >= END) finish();
      void t;
    },
    draw(g, W, H, t) {
      const cx = W / 2, carY = H * 0.74, sy = (d: number) => carY - (d - dist);
      g.fillStyle = "#8d8f92"; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(0,0,0,.06)"; for (let yy = -((dist * 1) % 80); yy < H; yy += 80) g.fillRect(0, yy + 80 - ((-dist) % 80 + 80) % 80, W, 2);
      // the road
      g.fillStyle = "#3b3e44"; g.fillRect(cx - LANE * 1.6, 0, LANE * 3.2, H);
      g.fillStyle = "#f2b705"; g.fillRect(cx - LANE * 1.6, 0, 6, H); g.fillRect(cx + LANE * 1.6 - 6, 0, 6, H);
      g.fillStyle = "#f4efe2"; for (const lxx of [-0.5, 0.5]) for (let k = -1; k < H / 60 + 2; k++) { const yy = k * 60 + (dist % 60); g.fillRect(cx + lxx * LANE - 2, yy, 4, 30); }
      // yard scenery
      for (const s of side) { const yy = sy(s.d % 8400); if (yy < -120 || yy > H + 120) continue; const xx = s.left ? cx - LANE * 1.6 - 90 : cx + LANE * 1.6 + 90;
        if (s.kind === 0) { g.fillStyle = s.c; g.fillRect(xx - 36, yy - 70, 72, 140); g.fillStyle = "rgba(0,0,0,.25)"; for (let k = 0; k < 8; k++) g.fillRect(xx - 36, yy - 70 + k * 18, 72, 3); }
        else if (s.kind === 1) { g.fillStyle = "#c8a06a"; for (let k = 0; k < 4; k++) g.fillRect(xx - 30 + (k % 2) * 32, yy - 30 + Math.floor(k / 2) * 32, 28, 28); g.strokeStyle = "#8a6a40"; g.lineWidth = 2; g.strokeRect(xx - 32, yy - 32, 64, 64); }
        else { g.fillStyle = "#ffb300"; g.beginPath(); g.roundRect(xx - 18, yy - 26, 36, 52, 6); g.fill(); g.fillStyle = "#333"; g.fillRect(xx - 14, yy - 46, 4, 22); g.fillRect(xx + 10, yy - 46, 4, 22); } }
      // conveyor along the far left
      g.fillStyle = "#2a2d33"; g.fillRect(24, 0, 40, H); g.fillStyle = "#c8a06a"; for (let k = -1; k < H / 70 + 1; k++) g.fillRect(30, k * 70 + ((dist * 0.6 + t * 40) % 70), 28, 28);
      // problems
      for (const p of PROB) { const yy = sy(p.d), xx = cx + (p.k - 1) * LANE; if (yy < -100 || yy > H + 100 || p.state === "fixed") continue;
        g.save(); g.globalAlpha = p.state === "fixing" ? 0.6 + 0.4 * Math.sin(t * 20) : 1;
        g.fillStyle = "#e65100"; g.beginPath(); g.roundRect(xx - 44, yy - 30, 88, 60, 8); g.fill();
        g.save(); g.beginPath(); g.rect(xx - 44, yy - 30, 88, 12); g.clip(); for (let k = -2; k < 10; k++) { g.fillStyle = k % 2 ? "#14110e" : "#f2b705"; g.beginPath(); g.moveTo(xx - 44 + k * 14, yy - 18); g.lineTo(xx - 36 + k * 14, yy - 30); g.lineTo(xx - 28 + k * 14, yy - 30); g.lineTo(xx - 36 + k * 14, yy - 18); g.fill(); } g.restore();
        g.fillStyle = "#fff"; g.font = `22px ${FONT}`; g.textAlign = "center"; g.fillText("!", xx, yy + 18); g.restore();
        if (p.state === "ahead") tag(g, p.l, xx, yy - 50, "#ef5350", "#fff", 12);
        if (p.state === "dodged" && sop) tag(g, "AUTO-ROUTED ✓", xx, yy - 50, "#ffca28", "#14110e", 11); }
      const carX = cx + (lx - 1) * LANE;
      buggyTop(g, carX, carY, (lane - lx) * 0.25, 1.15);
      if (fixT > 0) { g.strokeStyle = "#ef5350"; g.lineWidth = 6; g.beginPath(); g.arc(carX, carY - 70, 22, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - fixT / 1.2)); g.stroke(); g.font = "22px sans-serif"; g.textAlign = "center"; g.fillText("🔧", carX, carY - 62); }
      if (sop) tag(g, "SOP ON · SYSTEM STEERING", carX, carY + 64, "#ffca28", "#14110e", 11);
    },
  };
}

/* ======================================================================= 4 · FINANCE: desert route, fuel = runway */
function desertRun(choice: string, hk: GameHooks): Game {
  const burn = choice === "burn";
  const ctrl = [[0, 0], [420, -260], [820, 60], [1260, -180], [1700, 220], [2160, -40], [2580, -300], [3040, 0], [3420, 160]];
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) { const u = k / 24, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
  }
  pts.push(ctrl[ctrl.length - 1] as [number, number]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const LEN = cum[cum.length - 1];
  const at = (s: number) => { s = clamp(s, 0, LEN); let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); const a = pts[i - 1], b = pts[i]; return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), h: Math.atan2(b[1] - a[1], b[0] - a[0]) }; };
  const cans = [0.14, 0.3, 0.46, 0.62, 0.78].map((f, k) => ({ s: f * LEN, off: k % 2 ? 26 : -26, got: false }));
  const r = rng(3);
  const decor: { x: number; y: number; k: number; s: number }[] = [];
  for (let i = 0; i < 260; i++) { const x = -500 + r() * 4500, y = -900 + r() * 1800; let near = false; for (let j = 0; j < pts.length; j += 4) if (Math.hypot(pts[j][0] - x, pts[j][1] - y) < 90) { near = true; break; } if (!near) decor.push({ x, y, k: Math.floor(r() * 4), s: 0.7 + r() * 0.8 }); }
  let s = 0, v = burn ? 520 : 320, fuel = 30, aum = 10, dry = false;
  hk.onScore({ fuel, aum });
  return {
    step(dt, t, finish) {
      const drain = burn ? 6.5 : 4.2;
      if (!dry) fuel = Math.max(0, fuel - drain * dt);
      if (fuel <= 0 && !dry) { dry = true; hk.onPop("OUT OF RUNWAY · TANK DRY", "#ef5350"); }
      if (dry) v = Math.max(0, v - 260 * dt);
      s += v * dt;
      for (const c of cans) if (!c.got && s >= c.s) {
        c.got = true;
        if (burn) { hk.onPop("SPENT · NOTHING BANKED", "#ef5350"); }
        else { fuel = Math.min(100, fuel + 20); aum = Math.min(250, aum + 48); hk.onPop("+₹48L MANAGED · TANK UP", "#66bb6a"); }
      }
      hk.onScore({ fuel, aum, prog: s / LEN }); hk.onTel(v / 6, clamp(s / LEN, 0, 1));
      if (s >= LEN) { if (!burn) hk.onPop("₹2.5 CR IN ASSETS · ARRIVED 🏁", "#2bff88"); finish(); }
      else if (dry && v === 0) finish();
      void t;
    },
    draw(g, W, H, t) {
      const c = at(s), z = Math.min(1, W / 1100), ox = W / 2 - c.x * z, oy = H * 0.56 - c.y * z;
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e8b878"); bg.addColorStop(1, "#d79a5a"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(ox, oy); g.scale(z, z);
      g.fillStyle = "rgba(255,230,180,.35)"; for (let k = 0; k < 40; k++) { const dx = (k * 337) % 4400 - 500, dy = ((k * 211) % 1800) - 900; g.beginPath(); g.ellipse(dx, dy, 180, 40, 0.3, 0, TAU); g.fill(); g.fillStyle = "rgba(150,90,40,.18)"; g.beginPath(); g.ellipse(dx + 20, dy + 26, 170, 22, 0.3, 0, TAU); g.fill(); g.fillStyle = "rgba(255,230,180,.35)"; }
      // the route
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = "#b07a44"; g.lineWidth = 92; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.strokeStyle = "#c48d55"; g.lineWidth = 76; g.stroke();
      g.setLineDash([16, 14]); g.strokeStyle = "rgba(90,55,25,.45)"; g.lineWidth = 3;
      for (const off of [-18, 18]) { g.beginPath(); pts.forEach((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2; const x = p[0] + Math.cos(a) * off, y = p[1] + Math.sin(a) * off; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
      g.setLineDash([]);
      // scenery
      for (const d of decor) { if (Math.abs(d.x * z + ox - W / 2) > W * 0.7 / 1 + 200 || Math.abs(d.y * z + oy - H / 2) > H) continue;
        if (d.k === 0) { g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(d.x + 16, d.y + 6, 14 * d.s, 5 * d.s, 0, 0, TAU); g.fill(); g.fillStyle = "#3f7a3a"; g.beginPath(); g.arc(d.x, d.y, 9 * d.s, 0, TAU); g.fill(); g.fillStyle = "#5a9a4e"; g.beginPath(); g.arc(d.x - 2, d.y - 2, 4 * d.s, 0, TAU); g.fill(); }
        else if (d.k === 1) { g.fillStyle = "#8a7f74"; g.beginPath(); g.ellipse(d.x, d.y, 18 * d.s, 12 * d.s, 0.4, 0, TAU); g.fill(); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(d.x + 10, d.y + 8, 16 * d.s, 8 * d.s, 0.4, 0, TAU); g.fill(); }
        else if (d.k === 2) { g.fillStyle = "#a8552e"; g.beginPath(); g.roundRect(d.x - 50 * d.s, d.y - 30 * d.s, 100 * d.s, 60 * d.s, 18); g.fill(); g.fillStyle = "#c66a3a"; g.beginPath(); g.roundRect(d.x - 40 * d.s, d.y - 26 * d.s, 80 * d.s, 40 * d.s, 14); g.fill(); }
        else { g.fillStyle = "rgba(255,240,210,.5)"; g.beginPath(); g.ellipse(d.x, d.y, 30 * d.s, 8 * d.s, 0.2, 0, TAU); g.fill(); } }
      // fuel cans
      for (const cn of cans) { if (cn.got) continue; const p = at(cn.s), a = p.h + Math.PI / 2, x = p.x + Math.cos(a) * cn.off, y = p.y + Math.sin(a) * cn.off;
        g.fillStyle = "#d32f2f"; g.beginPath(); g.roundRect(x - 11, y - 14, 22, 28, 4); g.fill(); g.fillStyle = "#14110e"; g.fillRect(x - 4, y - 18, 8, 5); g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.stroke();
        if (!burn) tag(g, "+₹48L", x, y - 34, "#66bb6a", "#08140a", 12); }
      // the oasis at the end
      { const e = at(LEN); g.fillStyle = "#2c8ab8"; g.beginPath(); g.ellipse(e.x + 90, e.y, 70, 40, 0, 0, TAU); g.fill(); g.fillStyle = "#2e7d32"; for (const [dx, dy] of [[40, -40], [140, -30], [100, 46]]) { g.beginPath(); g.arc(e.x + dx, e.y + dy, 18, 0, TAU); g.fill(); }
        g.fillStyle = "#ddd"; g.fillRect(e.x + 10, e.y - 90, 4, 90); g.fillStyle = "#2bff88"; g.beginPath(); g.moveTo(e.x + 14, e.y - 90); g.lineTo(e.x + 60, e.y - 78); g.lineTo(e.x + 14, e.y - 66); g.fill(); tag(g, "₹2.5 CR", e.x + 20, e.y - 110, "#2bff88", "#04140a", 13); }
      // dust behind the buggy
      if (v > 10) for (let k = 1; k < 8; k++) { const p = at(s - k * 14); g.fillStyle = `rgba(230,200,150,${0.4 - k * 0.045})`; g.beginPath(); g.arc(p.x + Math.sin(t * 9 + k) * 4, p.y, 8 + k * 2, 0, TAU); g.fill(); }
      buggyTop(g, c.x, c.y, c.h + Math.PI / 2, 1.1);
      if (dry) tag(g, "TANK DRY", c.x, c.y - 56, "#ef5350", "#fff", 13);
      g.restore();
      const sun = g.createRadialGradient(W * 0.85, -40, 10, W * 0.85, -40, W * 0.8); sun.addColorStop(0, "rgba(255,150,80,.35)"); sun.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = sun; g.fillRect(0, 0, W, H);
    },
  };
}
