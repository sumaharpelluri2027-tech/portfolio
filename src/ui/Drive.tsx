import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LayoutGrid, Music2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { createTrack, type GateId, type GateSpec, type Pickup, type Telemetry, type TrackAPI } from "../scene/track";
import { createBuggy } from "../scene/buggyEntry";
import { createMusic } from "../scene/music";
import { JOBS, type CarPart } from "../content";
import { A } from "../data";
import { DATA_FINALE, ROLES, STAGES, type RoleId, type Stage } from "../stages";
import * as voice from "../narrate";
import { JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";
import Projects from "./Projects";
import Bot from "./Bot";

const SLOTS: GateId[] = ["steering", "accelerator", "brakes"];
const specsFor = (st: Stage): GateSpec[] => [
  ...SLOTS.map((id, i) => ({ id, label: st.title, sub: `Sector ${i + 1} of 3 · ${st.vertical}`, color: st.color })),
  { id: "pit" as GateId, label: st.n < STAGES.length ? `LAP ${st.n} DONE` : "FINISH", sub: st.n < STAGES.length ? `Next: ${STAGES[st.n].title.toLowerCase()}` : "Data gets the last word", color: "#f2b705" },
];
const isPart = (g: GateId | null): g is GateId & CarPart => !!g && g in JOBS;

/* ---------------------------------------------------------------- the four laps, laid out on the track */
const FORKS: { q: string; good: string; bad: string }[] = [
  { q: "A consumer app growing slowly against funded rivals. Which way?", good: "B2B2C", bad: "STAY B2C" },
  { q: "The MVP needs an exchange, KYC and payments. Build or buy?", good: "BUY THE APIs", bad: "BUILD IT ALL" },
  { q: "Is the new model worth it?", good: "MODEL IT", bad: "GUT FEEL" },
];
const FORK_F = [0.08, 0.45, 0.8];
const BOOSTS = 5, ORDERS = 10, BY_HAND = 2;
/** spread things over the lap, skipping the jump (s 60–100) and the start/finish straight */
const lapS = (f: number, L: number) => { const a = 16, gap0 = 60, gap1 = 100, b = L - 20; const use = (gap0 - a) + (b - gap1); const x = a + Math.max(0, Math.min(1, f)) * use; return x > gap0 ? x + (gap1 - gap0) : x; };
function layout(st: Stage, L: number): Pickup[] {
  const at = (f: number) => lapS(f, L);
  const out: Pickup[] = [];
  if (st.key === "decide") {
    FORK_F.forEach((f, k) => {
      const goodRight = k % 2 === 0, s = at(f);
      out.push({ id: `fork${k}-good`, kind: "good", s, lat: goodRight ? 2.2 : -2.2, w: 1.9, label: FORKS[k].good, color: "#4fc3f7", aim: true });
      out.push({ id: `fork${k}-bad`, kind: "good", s, lat: goodRight ? -2.2 : 2.2, w: 1.9, label: FORKS[k].bad, color: "#4fc3f7", aim: false, costly: true });
    });
    [0.27, 0.62, 0.95].forEach((f, k) => out.push({ id: `hurdle${k}`, kind: "hurdle", s: at(f), lat: k % 2 ? -1.7 : 1.7, w: 1.4, label: ["COMPETITION", "BURN RATE", "SKEPTICS"][k] }));
  } else if (st.key === "boost") {
    [0.05, 0.27, 0.5, 0.72, 0.94].forEach((f, k) => out.push({ id: `boost${k}`, kind: "boost", s: at(f), lat: [-1.8, 1.8, 0, -1.8, 1.8][k], w: 1.5, label: ["FIND THE LEAK", "DASHBOARD", "FOLLOW-UP", "AUTO LEADS", "CLOSE"][k], aim: true }));
  } else if (st.key === "deliver") {
    for (let k = 0; k < ORDERS; k++) out.push({ id: `order${k}`, kind: "drop", s: at(0.02 + (k * 0.96) / (ORDERS - 1)), lat: k % 2 ? 1.4 : -1.4, w: 2.1, label: `ORDER #${String(k + 1).padStart(2, "0")}`, aim: true });
  } else {
    [0.04, 0.22, 0.4, 0.58, 0.76, 0.94].forEach((f, k) => out.push({ id: `can${k}`, kind: "can", s: at(f), lat: [1.6, -1.6, 0, 1.6, -1.6, 0][k], w: 1.3, label: "+₹40L", aim: true }));
  }
  return out;
}

type Run = { forks: (boolean | null)[]; hurdles: number; conv: number; boosts: number; orders: number; auto: boolean; fuel: number; aum: number; cans: number };
const fresh = (): Run => ({ forks: [null, null, null], hurdles: 0, conv: 10, boosts: 0, orders: 0, auto: false, fuel: 70, aum: 10, cans: 0 });
const cr = (lakh: number) => (lakh >= 100 ? `₹${(lakh / 100).toFixed(1)} Cr` : `₹${Math.round(lakh)}L`);

/** The test track: four laps, four business functions, data under all of them. You learn what I did at the end of each lap. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<TrackAPI | null>(null);
  const music = useRef(createMusic());
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(true);
  const [talk, setTalk] = useState(true);
  const [tel, setTel] = useState<Telemetry | null>(null);
  const [detail, setDetail] = useState<GateId | null>(null);
  const [board, setBoard] = useState(false);
  const [ask, setAsk] = useState<{ q?: string; n: number } | null>(null);
  const [award, setAward] = useState<null | undefined>(undefined);
  const [finale, setFinale] = useState(false);
  const [dataCard, setDataCard] = useState(false);
  const [auto, setAuto] = useState(false);
  const [role, setRole] = useState<RoleId>("founders");
  const [si, setSi] = useState(0);
  const [run, setRun] = useState<Run>(fresh());
  const [runs, setRuns] = useState<Run[]>([]);
  const [between, setBetween] = useState<Stage | null>(null);
  const [pop, setPop] = useState<{ t: string; c: string; k: number } | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const siRef = useRef(0); siRef.current = si;
  const runRef = useRef(run);
  const talkRef = useRef(talk); talkRef.current = talk;
  const userAuto = useRef(false);
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const input = useRef({ throttle: 0, steer: 0, brake: false });
  const stage = STAGES[si];

  useEffect(() => voice.onCaption(setCap), []);
  useEffect(() => { if (!pop) return; const id = window.setTimeout(() => setPop(null), 1800); return () => window.clearTimeout(id); }, [pop]);
  const flash = (t: string, c: string) => setPop({ t, c, k: Date.now() });
  const upd = (f: (r: Run) => Run) => { const n = f(runRef.current); runRef.current = n; setRun(n); };

  const onPickup = useCallback((p: Pickup) => {
    const st = STAGES[siRef.current];
    if (st.key === "decide") {
      if (p.kind === "hurdle") { upd((r) => ({ ...r, hurdles: r.hurdles + 1 })); flash(`HURDLE: ${p.label}`, "#ef5350"); return; }
      const k = Number(p.id[4]); const good = p.id.endsWith("good");
      if (runRef.current.forks[k] !== null) return;
      upd((r) => { const f = [...r.forks]; f[k] = good; return { ...r, forks: f }; });
      if (good) api.current?.boost(3); // a right call pays off straight away
      flash(good ? `RIGHT CALL · BOOST: ${p.label}` : `COSTLY CALL: ${p.label}`, good ? "#2bff88" : "#ef5350");
    } else if (st.key === "boost") {
      upd((r) => ({ ...r, boosts: r.boosts + 1, conv: Math.min(50, r.conv + 8) })); flash("BOOST · +8% CONVERSION", "#ff7043");
    } else if (st.key === "deliver") {
      const n = runRef.current.orders + 1;
      upd((r) => ({ ...r, orders: n }));
      if (n === BY_HAND && !runRef.current.auto) {
        upd((r) => ({ ...r, auto: true })); api.current?.setAuto(true); setAuto(true);
        flash("AUTOMATION ON", "#ffca28");
        if (talkRef.current) voice.say("You did two by hand. That's the work I automated. Watch the rest run themselves.");
      } else flash(`${p.label} ${n > BY_HAND ? "· AUTOMATED" : "· BY HAND"}`, "#ffca28");
    } else {
      upd((r) => ({ ...r, cans: r.cans + 1, aum: Math.min(250, r.aum + 40), fuel: Math.min(100, r.fuel + 28) })); flash("+₹40L · RUNWAY UP", "#66bb6a");
    }
  }, []);
  const onPickupRef = useRef(onPickup); onPickupRef.current = onPickup;

  const onGate = useCallback((id: GateId) => {
    if (id !== "pit") return;
    const st = STAGES[siRef.current];
    const snap = runRef.current;
    setRuns((rs) => { const c = [...rs]; c[st.n - 1] = snap; return c; });
    api.current?.setPaused(true);
    if (st.key === "deliver") { api.current?.setAuto(userAuto.current); setAuto(userAuto.current); }
    if (st.key === "fuel") api.current?.setSpeedScale(1);
    music.current.sting(st.n === STAGES.length ? "finish" : "all");
    if (st.n === STAGES.length) { api.current?.celebrate(); setFinale(true); window.setTimeout(() => { setFinale(false); setDataCard(true); }, 2600); }
    else setBetween(st);
  }, []);
  const onGateRef = useRef(onGate); onGateRef.current = onGate;

  useEffect(() => {
    if (!host.current) return;
    const t = createTrack({
      container: host.current, createBuggy, gates: specsFor(STAGES[0]),
      onGate: (id) => onGateRef.current(id), onPickup: (p) => onPickupRef.current(p),
      onTelemetry: (x) => setTel(x), onReady: () => setReady(true),
      quality: coarse.current || window.innerWidth < 760 || /[?&]low\b/.test(location.search) ? "low" : "high",
    });
    api.current = t;
    t.setPaused(true);
    const m = music.current;
    return () => { t.dispose(); api.current = null; m.dispose(); voice.stop(); };
  }, []);
  useEffect(() => { if (ready && api.current) { const st = STAGES[0]; api.current.setStage(specsFor(st), st.theme, st.decor); api.current.setPickups(layout(st, api.current.length)); } }, [ready]);

  // fuel burns while you drive; low fuel caps the speed
  const speedRef = useRef(0); speedRef.current = tel?.speedKmh ?? 0;
  useEffect(() => {
    if (stage.key !== "fuel" || between || !started) return;
    const id = window.setInterval(() => {
      const sp = speedRef.current; if (sp < 3) return;
      upd((r) => { const f = Math.max(0, r.fuel - 0.9 * (sp / 50)); api.current?.setSpeedScale(f < 12 ? 0.5 : 1); return { ...r, fuel: f }; });
    }, 250);
    return () => window.clearInterval(id);
  }, [stage.key, between, started]);

  const applySound = (on: boolean) => { setSound(on); api.current?.setSound(on); music.current.setOn(on); if (on) music.current.start(); };
  const applyTalk = (on: boolean) => { setTalk(on); voice.setMuted(!on); if (!on) voice.stop(); };
  const narrateIntro = (st: Stage) => { if (talkRef.current) voice.say(st.intro, `lap${st.n}-intro`); };
  const start = (self = false) => {
    setStarted(true); applySound(sound); voice.setMuted(!talk);
    userAuto.current = self; setAuto(self); api.current?.setAuto(self); api.current?.setPaused(false); narrateIntro(STAGES[0]);
  };
  const resume = useCallback(() => { setDetail(null); setBoard(false); setAsk(null); if (!between && !dataCard && award === undefined) api.current?.setPaused(false); }, [between, dataCard, award]);
  const nextStage = useCallback(() => {
    const n = siRef.current + 1; if (n >= STAGES.length) return;
    voice.stop(); setBetween(null); setSi(n); const f = fresh(); runRef.current = f; setRun(f);
    const st = STAGES[n];
    api.current?.setStage(specsFor(st), st.theme, st.decor); api.current?.setPickups(layout(st, api.current.length)); api.current?.setPaused(false);
    window.setTimeout(() => narrateIntro(st), 600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleAuto = () => { const v = !auto; userAuto.current = v; setAuto(v); api.current?.setAuto(v); };

  useEffect(() => {
    if (!ready || started) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); start(true); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [ready, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: "throttle" | "steer" | "brake", v: number | boolean) => { (input.current as Record<string, number | boolean>)[k] = v; api.current?.setInput({ ...input.current }); };
  const busy = !!detail || board || !!ask || award !== undefined || !!between || dataCard;
  const L = api.current?.length ?? 1;
  const carS = tel?.s ?? 0;
  const prog = Math.max(0, Math.min(1, (((carS + 5) % L) + L) % L / L));
  const lapsDone = si + (between ? 1 : 0);
  const nextFork = stage.key === "decide" ? FORK_F.findIndex((f, k) => { if (run.forks[k] !== null) return false; const d = lapS(f, L) - carS; return d > 0 && d < 60; }) : -1;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a1030]">
      <div ref={host} className="absolute inset-0" role="application" aria-label="A drivable test track: four laps, four business functions. Use Skip to the work for a non-driving view." />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-4 md:px-7" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onExit} className="mr-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><ArrowLeft size={14} /> GARAGE</button>
        <button type="button" onClick={() => applyTalk(!talk)} aria-label={talk ? "Mute the narrator" : "Turn the narrator on"} title="Narrator" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard">{talk ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
        <button type="button" onClick={() => applySound(!sound)} aria-label={sound ? "Mute music" : "Turn music on"} title="Music" className={`grid h-10 w-10 place-items-center rounded-full border bg-black/45 backdrop-blur hover:border-hazard ${sound ? "border-white/25" : "border-white/10 opacity-50"}`}><Music2 size={15} /></button>
        {started && <button type="button" onClick={toggleAuto} aria-pressed={auto} className={`rounded-full border px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider backdrop-blur ${auto ? "border-hazard bg-hazard text-ink" : "border-white/25 bg-black/45 hover:border-hazard"}`}>AUTOPILOT {auto ? "ON" : "OFF"}</button>}
        <button type="button" onClick={() => api.current?.resetCar()} aria-label="Put the car back on the track" className="hidden h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard sm:grid"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => { api.current?.setPaused(true); setBoard(true); }} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink"><LayoutGrid size={14} /><span className="hidden sm:inline">SKIP TO THE WORK</span><span className="sm:hidden">WORK</span></button>
      </header>

      {/* the lap's mission */}
      {ready && started && !busy && (
        <div className="pointer-events-none absolute inset-x-0 top-[74px] z-10 hidden justify-center lg:flex"><motion.div key={si} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="w-[min(500px,calc(100vw-700px))] min-w-[300px] rounded-2xl border-2 bg-black/60 px-4 py-2.5 text-center backdrop-blur" style={{ borderColor: stage.color }}>
          <div className="font-mono text-[10.5px] font-bold tracking-[0.2em]" style={{ color: stage.color }}>LAP {stage.n}/{STAGES.length} · {stage.emoji} {stage.title} · {stage.themeName.toUpperCase()}</div>
          <div className="mt-0.5 text-[14px] leading-snug text-paper/90">{nextFork >= 0 ? <><b className="text-paper">Decision {nextFork + 1}:</b> {FORKS[nextFork].q}</> : stage.mission}</div>
        </motion.div></div>
      )}

      {/* the lap's scoreboard: one challenge per business function */}
      {ready && started && (
        <div className="pointer-events-none absolute left-4 top-[74px] z-10 w-[min(290px,calc(100vw-32px))] rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur md:left-7">
          <div className="flex items-center gap-2.5">
            <img src={A("me/avatar.webp")} alt="" className="h-9 w-9 rounded-full object-cover" />
            <div className="min-w-0"><div className="font-mono text-[10px] font-bold tracking-[0.18em]" style={{ color: stage.color }}>LAP {stage.n}/{STAGES.length} · {stage.vertical.toUpperCase()}</div><div className="font-cond text-[17px] font-bold leading-tight">{stage.emoji} {stage.title}</div></div>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-paper/65 lg:hidden">{nextFork >= 0 ? FORKS[nextFork].q : stage.mission}</p>
          <Score st={stage} r={run} />
          <div className="mt-2.5 flex gap-1">{STAGES.map((s2, k) => <span key={s2.n} title={s2.title} className="h-1.5 flex-1 rounded-full" style={{ background: k < lapsDone ? s2.color : k === si ? `${s2.color}88` : "rgba(255,255,255,.12)" }} />)}</div>
          <div className="mt-1 flex justify-between font-mono text-[9.5px] tracking-[0.15em] text-paper/50"><span>LAP {stage.n} OF {STAGES.length}</span><span>{Math.round(prog * 100)}% ROUND</span></div>
        </div>
      )}

      {/* data, always on: the gauges are part of the story */}
      {ready && started && <Gauges tel={tel} st={stage} r={run} />}

      {/* a short pop when something happens on track */}
      <AnimatePresence>
        {pop && !busy && (
          <div key={pop.k} className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center"><motion.div initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="whitespace-nowrap rounded-full px-5 py-2 font-stencil text-[22px] text-ink shadow-xl" style={{ background: pop.c }}>{pop.t}</motion.div></div>
        )}
      </AnimatePresence>

      {/* the narrator's caption */}
      <AnimatePresence>
        {cap && started && (
          <motion.div key={cap} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-[54px] z-40 mx-auto w-[min(720px,calc(100vw-32px))] rounded-xl bg-black/75 px-4 py-2.5 text-center text-[15px] leading-snug text-paper backdrop-blur md:bottom-[60px]">
            <span className="mr-2 font-mono text-[10px] font-bold tracking-[0.2em] text-hazard">SUMAHAR</span>{cap}
          </motion.div>
        )}
      </AnimatePresence>

      {ready && started && !busy && !coarse.current && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-center font-mono text-[11px] tracking-[0.16em] text-paper/75" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>W A S D OR ARROWS · SPACE HANDBRAKE · AUTOPILOT DRIVES FOR YOU</p>
      )}
      {ready && started && coarse.current && !busy && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-4" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
          <div className="flex gap-2">
            {([["◀", -1], ["▶", 1]] as const).map(([l, v]) => (
              <button key={l} type="button" aria-label={v < 0 ? "Steer left" : "Steer right"} className="grid h-16 w-16 select-none place-items-center rounded-full border border-white/30 bg-black/50 text-2xl active:bg-hazard active:text-ink"
                onPointerDown={() => press("steer", v)} onPointerUp={() => press("steer", 0)} onPointerLeave={() => press("steer", 0)} onPointerCancel={() => press("steer", 0)}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Brake and reverse" className="h-16 w-14 select-none rounded-xl border border-white/30 bg-black/50 font-mono text-[10px] active:bg-rust"
              onPointerDown={() => press("throttle", -1)} onPointerUp={() => press("throttle", 0)} onPointerLeave={() => press("throttle", 0)} onPointerCancel={() => press("throttle", 0)}>BRAKE</button>
            <button type="button" aria-label="Accelerate" className="h-20 w-16 select-none rounded-xl border-2 border-hazard bg-hazard/20 font-mono text-[11px] font-bold text-hazard active:bg-hazard active:text-ink"
              onPointerDown={() => press("throttle", 1)} onPointerUp={() => press("throttle", 0)} onPointerLeave={() => press("throttle", 0)} onPointerCancel={() => press("throttle", 0)}>GAS</button>
          </div>
        </div>
      )}

      {/* loading, then the start screen */}
      <AnimatePresence>
        {!ready && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-[#2a1450] to-[#ff7a45]/40">
            <div className="text-center">
              <motion.div animate={{ x: [-60, 60, -60] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }} className="text-5xl">🏎️</motion.div>
              <div className="mt-4 font-mono text-[11px] tracking-[0.3em] text-paper/80">ROLLING THE BUGGY OUT…</div>
            </div>
          </motion.div>
        )}
        {ready && !started && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="w-full max-w-[580px] rounded-2xl border-2 border-hazard bg-oil/95 p-5 text-center shadow-[0_0_60px_rgba(242,183,5,.3)] md:p-6">
              <h2 className="font-stencil text-[32px] leading-none">DRIVE TO LEARN WHAT I DO</h2>
              <p className="mt-2 text-[14.5px] text-paper/80">Four laps, four business functions. Each lap is a small challenge built on something I actually did, and I tell you what it was at the finish line.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {STAGES.map((st) => (
                  <div key={st.n} className="rounded-xl p-2.5" style={{ background: st.color + "1f", border: `1px solid ${st.color}66` }}>
                    <div className="text-[20px] leading-none">{st.emoji}</div>
                    <div className="mt-1 font-mono text-[10px] font-bold tracking-wider" style={{ color: st.color }}>LAP {st.n}</div>
                    <div className="font-cond text-[15px] font-bold leading-tight">{st.vertical}</div>
                    <div className="mt-0.5 text-[11.5px] leading-tight text-paper/60">{({ decide: "Right call = a boost; wrong call = a hurdle", boost: "Hit boosters to reach the target", deliver: "Deliver by hand, then automate", fuel: "Fuel is runway: collect cans" } as const)[st.key]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 font-mono text-[10.5px] tracking-wider text-[#36c8ff]">📊 DATA RUNS UNDER ALL FOUR · WATCH THE GAUGES</div>
              <div className="mt-4 text-left font-mono text-[10.5px] tracking-[0.18em] text-paper/60">WHAT ARE YOU HIRING FOR?</div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role you are hiring for">
                {ROLES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)} className={`rounded-full px-3 py-1.5 text-[13px] ${role === r.id ? "bg-hazard font-semibold text-ink" : "border border-white/20 text-paper/75 hover:border-white/50"}`}>{r.label}</button>)}
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => start(true)} className="inline-flex items-center gap-2 rounded-full bg-hazard px-6 py-3 font-mono text-[13px] font-bold tracking-wider text-ink hover:brightness-110">AUTO-RUN · JUST WATCH <ArrowRight size={16} /></button>
                <button type="button" onClick={() => start(false)} className="inline-flex items-center gap-2 rounded-full border-2 border-hazard px-5 py-3 font-mono text-[13px] font-bold tracking-wider text-hazard hover:bg-hazard/10">I'LL DRIVE</button>
              </div>
              <div className="mt-3 flex justify-center gap-4 text-[12.5px] text-paper/60">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} className="accent-[#f2b705]" /> Narrate my story</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-[#f2b705]" /> Music</label>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{between && <LapCard st={between} r={runs[between.n - 1] ?? run} role={role} auto={auto} talk={talk} onNext={nextStage} onMore={() => setDetail(between.card as GateId)} />}</AnimatePresence>
      <AnimatePresence>{dataCard && <DataCard runs={runs} talk={talk} onDone={() => { voice.stop(); setDataCard(false); setAward(null); }} />}</AnimatePresence>

      <Sheet open={isPart(detail)} onClose={resume} label="The full story">{isPart(detail) && <JobCardView id={detail} onBonnet={resume} />}</Sheet>
      <AnimatePresence>{board && <Projects onClose={resume} onAsk={(q) => { setBoard(false); setAsk({ q, n: Date.now() }); }} />}</AnimatePresence>
      <Sheet open={!!ask} onClose={resume} label="Ask Sumahar" tone="dark">{ask && <Bot key={ask.n} initialQuestion={ask.q} />}</Sheet>
      <AnimatePresence>{finale && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <motion.div initial={{ scale: 2.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.3 }}
            className="rounded-2xl border-[6px] border-hazard bg-black/70 px-8 py-5 text-center shadow-[0_0_80px_rgba(242,183,5,.6)] backdrop-blur">
            <div className="font-stencil text-[clamp(40px,8vw,84px)] leading-none text-hazard">4 / 4 LAPS</div>
            <div className="mt-1 font-mono text-[12px] tracking-[0.3em] text-paper">ONE MORE THING…</div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <AnimatePresence>{award !== undefined && <Achievement how="track" role={role} onClose={() => { setAward(undefined); }} />}</AnimatePresence>
    </div>
  );
}

/** The scoreboard for the current lap's challenge. */
function Score({ st, r }: { st: Stage; r: Run }) {
  const bar = (v: number, max: number, c: string, mark?: number) => (
    <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-white/10">
      <motion.div className="h-full rounded-full" style={{ background: c }} animate={{ width: `${(v / max) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 15 }} />
      {mark !== undefined && <span className="absolute inset-y-0 w-[2px] bg-white" style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  );
  const row = "mt-2.5 flex items-baseline justify-between";
  if (st.key === "decide") return (
    <div>
      <div className={row}><span className="font-mono text-[10px] tracking-[0.15em] text-paper/60">DECISIONS</span><span className="font-stencil text-[18px]" style={{ color: st.color }}>{r.forks.filter(Boolean).length}/3 RIGHT</span></div>
      <div className="mt-1 flex gap-1.5">{r.forks.map((f, k) => <span key={k} className="grid h-7 flex-1 place-items-center rounded-md font-mono text-[11px] font-bold" style={{ background: f === null ? "rgba(255,255,255,.08)" : f ? "#2bff88" : "#ef5350", color: f === null ? "rgba(255,255,255,.5)" : "#14110e" }}>{f === null ? `#${k + 1}` : f ? "✓" : "✗"}</span>)}</div>
      <div className="mt-1.5 text-[11.5px] text-paper/55">Hurdles hit: {r.hurdles}</div>
    </div>
  );
  if (st.key === "boost") return (
    <div>
      <div className={row}><span className="font-mono text-[10px] tracking-[0.15em] text-paper/60">CONVERSION · TARGET 50%</span><span className="font-stencil text-[20px]" style={{ color: st.color }}>{r.conv}%</span></div>
      {bar(r.conv, 60, st.color, 50)}
      <div className="mt-1.5 text-[11.5px] text-paper/55">Boosters hit: {r.boosts}/{BOOSTS}</div>
    </div>
  );
  if (st.key === "deliver") return (
    <div>
      <div className={row}><span className="font-mono text-[10px] tracking-[0.15em] text-paper/60">ORDERS DELIVERED</span><span className="font-stencil text-[20px]" style={{ color: st.color }}>{r.orders}/{ORDERS}</span></div>
      <div className="mt-1 grid grid-cols-10 gap-0.5">{Array.from({ length: ORDERS }).map((_, k) => <span key={k} className="h-3 rounded-sm" style={{ background: k < r.orders ? (k < BY_HAND ? "#ffffff" : st.color) : "rgba(255,255,255,.1)" }} />)}</div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-paper/55"><span>white: by hand · yellow: automated</span>{r.auto && <b className="text-hazard">AUTO ON</b>}</div>
    </div>
  );
  return (
    <div>
      <div className={row}><span className="font-mono text-[10px] tracking-[0.15em] text-paper/60">AUM · GOAL ₹2.5 CR</span><span className="font-stencil text-[20px]" style={{ color: st.color }}>{cr(r.aum)}</span></div>
      {bar(r.aum, 250, st.color)}
      <div className={row}><span className="font-mono text-[10px] tracking-[0.15em] text-paper/60">FUEL = RUNWAY</span><span className={`font-mono text-[12px] font-bold ${r.fuel < 12 ? "text-rust" : "text-paper"}`}>{Math.round(r.fuel)}%{r.fuel < 12 ? " · ON FUMES" : ""}</span></div>
      {bar(r.fuel, 100, r.fuel < 12 ? "#ef5350" : r.fuel < 30 ? "#ffca28" : "#66bb6a")}
    </div>
  );
}

/** The data layer: always on screen, because data is under every lap. */
function Gauges({ tel, st, r }: { tel: Telemetry | null; st: Stage; r: Run }) {
  const sp = tel?.speedKmh ?? 0;
  const kpi: [number, string, string] = st.key === "decide" ? [r.forks.filter(Boolean).length / 3, `${r.forks.filter(Boolean).length}/3`, "RIGHT CALLS"]
    : st.key === "boost" ? [r.conv / 50, `${r.conv}%`, "CONVERSION"]
    : st.key === "deliver" ? [Math.max(0, r.orders - BY_HAND) / ORDERS, `${Math.round((Math.max(0, r.orders - BY_HAND) / ORDERS) * 100)}%`, "AUTOMATED"]
    : [r.fuel / 100, `${Math.round(r.fuel)}%`, "RUNWAY"];
  const dial = (frac: number, c: string, label: string, val: string) => {
    const f = Math.max(0, Math.min(1, frac)), a = f * 240 - 120;
    return (
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 80 62" className="h-[52px] w-[66px]" aria-hidden="true">
          <path d="M12 54 A32 32 0 1 1 68 54" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" strokeLinecap="round" />
          <path d="M12 54 A32 32 0 1 1 68 54" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" pathLength={100} strokeDasharray={`${f * 100} 100`} />
          <line x1="40" y1="38" x2={40 + Math.sin((a * Math.PI) / 180) * 22} y2={38 - Math.cos((a * Math.PI) / 180) * 22} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="38" r="3.5" fill="#fff" />
        </svg>
        <div className="-mt-1 font-stencil text-[15px] leading-none">{val}</div>
        <div className="font-mono text-[8.5px] tracking-wider text-paper/55">{label}</div>
      </div>
    );
  };
  return (
    <div className="pointer-events-none absolute bottom-[120px] right-4 z-10 rounded-2xl border border-[#36c8ff55] bg-black/60 px-3 pb-2 pt-1.5 backdrop-blur md:bottom-auto md:right-7 md:top-[74px]" aria-hidden="true">
      <div className="text-center font-mono text-[9px] font-bold tracking-[0.2em] text-[#36c8ff]">📊 THE DATA I WATCH</div>
      <div className="mt-1 flex gap-1">
        {dial(sp / 90, "#36c8ff", "KM/H", String(Math.round(sp)))}
        {dial(kpi[0], st.color, kpi[2], kpi[1])}
      </div>
    </div>
  );
}

/** The line at the end of each lap: what you just did, what I actually did, and why it matters to you. */
function LapCard({ st, r, role, auto, talk, onNext, onMore }: { st: Stage; r: Run; role: RoleId; auto: boolean; talk: boolean; onNext: () => void; onMore: () => void }) {
  const nx = STAGES[st.n];
  const roleLabel = ROLES.find((x) => x.id === role)?.label ?? "your team";
  const [said, setSaid] = useState(!talk);
  useEffect(() => { let alive = true; if (talk) voice.sayAll([{ text: st.outro, key: `lap${st.n}-outro` }, { text: st.fit[role] }]).then(() => { if (alive) setSaid(true); }); return () => { alive = false; }; }, [st, role, talk]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } };
    window.addEventListener("keydown", k);
    const id = auto && said ? window.setTimeout(onNext, talk ? 2500 : 12000) : 0;
    return () => { window.removeEventListener("keydown", k); window.clearTimeout(id); };
  }, [auto, said, talk, onNext]);
  const yours = st.key === "decide" ? `You made ${r.forks.filter(Boolean).length} of 3 right calls and hit ${r.hurdles} hurdle${r.hurdles === 1 ? "" : "s"}.`
    : st.key === "boost" ? `You lifted conversion to ${r.conv}% with ${r.boosts} booster${r.boosts === 1 ? "" : "s"}.`
    : st.key === "deliver" ? `You delivered ${r.orders} orders: ${Math.min(r.orders, BY_HAND)} by hand, ${Math.max(0, r.orders - BY_HAND)} on their own.`
    : `You grew assets to ${cr(r.aum)} and finished with ${Math.round(r.fuel)}% fuel.`;
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label={`Lap ${st.n} complete`} initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="relative w-full max-w-[560px] overflow-hidden rounded-3xl bg-oil" style={{ boxShadow: `0 0 0 2px ${st.color}, 0 0 80px ${st.color}55` }}>
        <div className="p-5 md:p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${st.color}44, transparent 70%)` }}>
          <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em]" style={{ color: st.color }}>LAP {st.n} OF {STAGES.length} · {st.vertical.toUpperCase()}</div>
          <div className="mt-1 text-center text-[13.5px] text-paper/60">{yours}</div>
          <div className="mt-3 text-center font-mono text-[10px] tracking-[0.2em] text-paper/50">NOW, WHAT I ACTUALLY DID</div>
          <div className="mt-1 text-center font-stencil text-[clamp(34px,6vw,44px)] leading-none" style={{ color: st.color }}>{st.result[0]}</div>
          <div className="text-center text-[14px] text-paper/75">{st.result[1]}</div>
          <p className="mt-3 text-[14.5px] leading-snug text-paper/90">{st.outro}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {st.proof.map(([b, l], k) => (
              <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.12 }} className="rounded-lg bg-white/[.05] p-2 text-center">
                <div className="font-stencil text-[15px] leading-tight" style={{ color: st.color }}>{b}</div><div className="mt-0.5 text-[11px] leading-tight text-paper/60">{l}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border-l-4 bg-white/[.05] p-3" style={{ borderColor: st.color }}>
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-hazard">WHY THIS MATTERS FOR {roleLabel.toUpperCase()}</div>
            <p className="mt-1 text-[14.5px] leading-snug">{st.fit[role]}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={onMore} className="rounded-full border border-white/25 px-4 py-2.5 font-mono text-[11px] hover:border-hazard">THE FULL STORY</button>
            <button type="button" onClick={onNext} autoFocus className="rounded-full px-5 py-2.5 font-mono text-[12px] font-bold tracking-wider text-ink" style={{ background: nx.color }}>LAP {nx.n}: {nx.emoji} {nx.title} →</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** After four laps: data was under all of it. */
function DataCard({ runs, talk, onDone }: { runs: Run[]; talk: boolean; onDone: () => void }) {
  useEffect(() => { if (talk) voice.sayAll([{ text: DATA_FINALE.intro, key: "data-intro" }, { text: DATA_FINALE.outro, key: "data-outro" }]); }, [talk]);
  const r = (k: number) => runs[k] ?? fresh();
  const tiles: [string, string, string][] = [
    ["🧭", `${r(0).forks.filter(Boolean).length}/3`, "right calls"], ["🚀", `${r(1).conv}%`, "conversion"],
    ["⚙️", `${Math.round((Math.max(0, r(2).orders - BY_HAND) / ORDERS) * 100)}%`, "automated"], ["⛽", cr(r(3).aum), "AUM"],
  ];
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label="Data ran every lap" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-[560px] rounded-3xl border-2 border-[#36c8ff] bg-[#07111c] p-5 shadow-[0_0_80px_rgba(54,200,255,.35)] md:p-6">
        <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em] text-[#36c8ff]">📊 THE LAST WORD</div>
        <div className="mt-1 text-center font-stencil text-[clamp(28px,6vw,38px)] leading-none">{DATA_FINALE.title}</div>
        <div className="mt-1 text-center text-[13.5px] text-paper/60">Your drive, as a dashboard:</div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {tiles.map(([e, v, l], k) => (
            <motion.div key={l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.12 }} className="rounded-lg border border-[#36c8ff33] bg-[#0c1a2a] p-2 text-center">
              <div className="text-[16px]">{e}</div><div className="font-stencil text-[17px] text-[#36c8ff]">{v}</div><div className="text-[10.5px] text-paper/55">{l}</div>
            </motion.div>
          ))}
        </div>
        <p className="mt-4 text-[14.5px] leading-snug text-paper/90">{DATA_FINALE.outro}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DATA_FINALE.proof.map(([b, l]) => <div key={l} className="rounded-lg bg-white/[.05] p-2 text-center"><div className="font-stencil text-[15px] text-[#2bff88]">{b}</div><div className="mt-0.5 text-[11px] leading-tight text-paper/60">{l}</div></div>)}
        </div>
        <div className="mt-5 text-center">
          <button type="button" onClick={onDone} autoFocus className="rounded-full bg-hazard px-6 py-3 font-mono text-[12.5px] font-bold tracking-wider text-ink">SEE WHY I FIT YOUR TEAM →</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
