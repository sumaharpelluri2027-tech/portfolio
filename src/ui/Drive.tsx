import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LayoutGrid, Music2, RotateCcw, VolumeX } from "lucide-react";
import { createTrack, type GateId, type GateSpec, type Telemetry, type TrackAPI } from "../scene/track";
import { createBuggy } from "../scene/buggyEntry";
import { createMusic } from "../scene/music";
import { JOBS, type CarPart } from "../content";
import { A } from "../data";
import { STAGES, ROLES, type RoleId, type Stage } from "../stages";
import { JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";
import Projects from "./Projects";
import Bot from "./Bot";

const SLOTS: GateId[] = ["steering", "accelerator", "brakes"];
const specsFor = (st: Stage): GateSpec[] => [
  ...st.points.map((c, i) => ({ id: SLOTS[i], label: c.kicker, sub: c.head, color: st.color })),
  { id: "pit" as GateId, label: st.n < STAGES.length ? `STAGE ${st.n} DONE` : "FINISH · HIRE", sub: st.n < STAGES.length ? `Next: ${STAGES[st.n].title.toLowerCase()}` : "Your reward", color: "#f2b705" },
];
const isPart = (g: GateId | null): g is GateId & CarPart => !!g && g in JOBS;
type Beat = { stage: Stage; i: number };

/** The test track: four laps, four chapters of my career. Three checkpoints a lap, then the line where the chapter is summed up for the role you're hiring for. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<TrackAPI | null>(null);
  const music = useRef(createMusic());
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(true);
  const [tel, setTel] = useState<Telemetry | null>(null);
  const [beat, setBeat] = useState<Beat | null>(null);
  const [detail, setDetail] = useState<GateId | null>(null);
  const [board, setBoard] = useState(false);
  const [ask, setAsk] = useState<{ q?: string; n: number } | null>(null);
  const [award, setAward] = useState<null | undefined>(undefined);
  const [finale, setFinale] = useState(false);
  const [auto, setAuto] = useState(false);
  const [role, setRole] = useState<RoleId>("founders");
  const [si, setSi] = useState(0);                      // current stage index
  const [seen, setSeen] = useState<number[]>([]);       // checkpoints seen this stage
  const [done, setDone] = useState<number[]>([]);       // stages completed
  const [between, setBetween] = useState<Stage | null>(null);
  const siRef = useRef(0); siRef.current = si;
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const input = useRef({ throttle: 0, steer: 0, brake: false });
  const stage = STAGES[si];

  const onGate = useCallback((id: GateId) => {
    const st = STAGES[siRef.current];
    if (id === "pit") {
      setBeat(null);
      setDone((d) => (d.includes(st.n) ? d : [...d, st.n]));
      if (st.n === STAGES.length) {
        api.current?.celebrate(); music.current.sting("finish"); setFinale(true);
        window.setTimeout(() => { setFinale(false); api.current?.setPaused(true); setAward(null); }, 3200);
      } else { music.current.sting("all"); api.current?.setPaused(true); setBetween(st); }
      return;
    }
    const i = SLOTS.indexOf(id); if (i < 0) return;
    setSeen((v) => (v.includes(i) ? v : [...v, i]));
    music.current.sting("gate");
    setBeat({ stage: st, i });
  }, []);
  const onGateRef = useRef(onGate); onGateRef.current = onGate;

  useEffect(() => {
    if (!host.current) return;
    const t = createTrack({
      container: host.current, createBuggy, gates: specsFor(STAGES[0]),
      onGate: (id) => onGateRef.current(id),
      onTelemetry: (x) => setTel(x),
      onReady: () => setReady(true),
      quality: coarse.current || window.innerWidth < 760 || /[?&]low\b/.test(location.search) ? "low" : "high",
    });
    api.current = t;
    t.setPaused(true); t.setStage(specsFor(STAGES[0]), STAGES[0].theme);
    const m = music.current;
    return () => { t.dispose(); api.current = null; m.dispose(); };
  }, []);

  const applySound = (on: boolean) => {
    setSound(on); api.current?.setSound(on);
    music.current.setOn(on); if (on) music.current.start();
  };
  const start = (self = false) => { setStarted(true); applySound(sound); setAuto(self); api.current?.setAuto(self); api.current?.setPaused(false); };
  const resume = useCallback(() => { setDetail(null); setBoard(false); setAsk(null); api.current?.setPaused(false); }, []);
  const nextStage = useCallback(() => {
    const n = siRef.current + 1; if (n >= STAGES.length) return;
    setBetween(null); setSi(n); setSeen([]); setBeat(null);
    api.current?.setStage(specsFor(STAGES[n]), STAGES[n].theme); api.current?.setPaused(false);
  }, []);

  // start screen: Enter starts
  useEffect(() => {
    if (!ready || started) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(false); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [ready, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: "throttle" | "steer" | "brake", v: number | boolean) => { (input.current as Record<string, number | boolean>)[k] = v; api.current?.setInput({ ...input.current }); };
  const nextId = (tel?.nextGate ?? "pit") as GateId;
  const nextI = SLOTS.indexOf(nextId);
  const busy = !!detail || board || !!ask || award !== undefined || !!between;
  const known = Math.round(((done.length * 3 + (done.includes(stage.n) ? 0 : seen.length)) / (STAGES.length * 3)) * 100);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a1030]">
      <div ref={host} className="absolute inset-0" role="application" aria-label="A drivable test track. Each gate unlocks one thing I bring to a team. Use Skip to the work for a non-driving view." />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-4 md:px-7" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onExit} className="mr-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><ArrowLeft size={14} /> GARAGE</button>
        <button type="button" onClick={() => applySound(!sound)} aria-label={sound ? "Mute music and sound" : "Turn music and sound on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard">{sound ? <Music2 size={15} /> : <VolumeX size={15} />}</button>
        {started && <button type="button" onClick={() => { const v = !auto; setAuto(v); api.current?.setAuto(v); }} aria-pressed={auto} className={`rounded-full border px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider backdrop-blur ${auto ? "border-hazard bg-hazard text-ink" : "border-white/25 bg-black/45 hover:border-hazard"}`}>AUTOPILOT {auto ? "ON" : "OFF"}</button>}
        <button type="button" onClick={() => api.current?.resetCar()} aria-label="Reset the car to the start" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => { api.current?.setPaused(true); setBoard(true); }} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink"><LayoutGrid size={14} /><span className="hidden sm:inline">SKIP TO THE WORK</span><span className="sm:hidden">WORK</span></button>
      </header>

      {/* driver card: which chapter you're in, and what you've learned so far */}
      {ready && started && (
        <div className="pointer-events-none absolute left-4 top-[74px] z-10 w-[min(310px,calc(100vw-32px))] rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur md:left-7">
          <div className="flex items-center gap-2.5">
            <img src={A("me/avatar.webp")} alt="" className="h-10 w-10 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: stage.color }} />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold tracking-[0.2em]" style={{ color: stage.color }}>STAGE {stage.n}/{STAGES.length} · {stage.themeName.toUpperCase()}</div>
              <div className="font-cond text-[19px] font-bold leading-tight">{stage.emoji} {stage.title}</div>
            </div>
          </div>
          <div className="mt-2 flex gap-1">
            {STAGES.map((st) => (
              <div key={st.n} className="flex flex-1 gap-0.5">
                {[0, 1, 2].map((k) => { const lit = done.includes(st.n) || (st.n === stage.n && seen.includes(k)); return <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: lit ? st.color : "rgba(255,255,255,.12)" }} />; })}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9.5px] tracking-[0.15em] text-paper/55"><span>HOW WELL YOU KNOW ME</span><motion.span key={known} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="font-bold text-hazard">{known}%</motion.span></div>
          <div className="mt-2 hidden md:block">
            <div className="font-mono text-[9.5px] tracking-[0.18em] text-paper/45">THIS LAP</div>
            <ul className="mt-1 space-y-1">
              {stage.points.map((c, k) => {
                const on = seen.includes(k);
                return (
                  <li key={c.kicker} className="flex items-center gap-2 text-[12.5px] leading-tight" style={{ opacity: on ? 1 : 0.45 }}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold text-ink" style={{ background: on ? stage.color : "rgba(255,255,255,.15)" }}>{on ? "✓" : k + 1}</span>
                    <span>{on ? c.head : c.kicker.toLowerCase()}</span>
                    {on && <span className="ml-auto font-stencil text-[11px]" style={{ color: stage.color }}>{c.stat}</span>}
                  </li>
                );
              })}
            </ul>
            {done.length > 0 && (
              <>
                <div className="mt-2 font-mono text-[9.5px] tracking-[0.18em] text-paper/45">SO FAR, I'M SOMEONE WHO</div>
                <ul className="mt-1 space-y-0.5">{STAGES.filter((st) => done.includes(st.n)).map((st) => <li key={st.n} className="text-[12px] text-paper/85">{st.emoji} {st.trait.toLowerCase()}</li>)}</ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* where to go next */}
      {ready && started && !busy && (
        <motion.div key={nextId + si} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute left-1/2 top-[74px] z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border-2 bg-black/55 px-4 py-2 font-mono text-[11.5px] font-bold tracking-wider backdrop-blur lg:flex"
          style={{ borderColor: nextI < 0 ? "#f2b705" : stage.color }}>
          {nextI < 0 ? <>🏁 {stage.n < STAGES.length ? `CROSS THE LINE TO FINISH STAGE ${stage.n}` : "CROSS THE FINISH FOR YOUR REWARD"}</> : <>NEXT CHECKPOINT <span style={{ color: stage.color }}>{nextI + 1} · {stage.points[nextI].kicker}</span></>}
        </motion.div>
      )}

      {/* small speed pill */}
      {ready && started && (
        <div className="pointer-events-none absolute bottom-[112px] right-4 z-10 rounded-xl md:bottom-auto md:top-[74px] border border-white/15 bg-black/50 px-3 py-2 text-right font-mono backdrop-blur md:right-7" aria-hidden="true">
          <div><span className="font-stencil text-[28px] leading-none tabular-nums">{Math.round(tel?.speedKmh ?? 0)}</span><span className="ml-1 text-[10px] text-paper/60">KM/H</span></div>
        </div>
      )}

      {ready && started && !busy && !coarse.current && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 text-center font-mono text-[11px] tracking-[0.16em] text-paper/80" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>W A S D OR ARROWS · SPACE HANDBRAKE · R RESET · 4 LAPS · 3 CHECKPOINTS EACH</p>
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
              <div className="mx-auto mt-3 h-1 w-48 overflow-hidden rounded bg-white/15"><motion.div className="h-full bg-hazard" animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.2 }} /></div>
            </div>
          </motion.div>
        )}
        {ready && !started && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="w-full max-w-[460px] rounded-2xl border-2 border-hazard bg-oil/95 p-6 text-center shadow-[0_0_60px_rgba(242,183,5,.3)]">
              <img src={A("me/avatar.webp")} alt="" className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-hazard" />
              <h2 className="mt-3 font-stencil text-[34px] leading-none">TEST-DRIVE ME</h2>
              <p className="mt-2 text-[15px] text-paper/80">Four laps, four chapters of my career, from dawn to night. Each lap has three checkpoints, then I tell you why it matters for your team.</p>
              <div className="mt-4 text-left font-mono text-[10.5px] tracking-[0.18em] text-paper/60">WHAT ARE YOU HIRING FOR?</div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Role you are hiring for">
                {ROLES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)} className={`rounded-full px-3 py-1.5 text-[13px] ${role === r.id ? "bg-hazard font-semibold text-ink" : "border border-white/20 text-paper/75 hover:border-white/50"}`}>{r.label}</button>)}
              </div>
              <div className="mt-4 flex justify-center gap-1.5">{STAGES.map((st) => <span key={st.n} title={st.title} className="grid h-9 w-9 place-items-center rounded-lg text-[17px]" style={{ background: st.color + "33", border: `1px solid ${st.color}` }}>{st.emoji}</span>)}</div>
              <div className="mt-4 font-mono text-[11px] text-paper/60">{coarse.current ? "Use the on-screen GAS and arrows" : "W A S D or arrow keys to drive"}</div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => start(false)} className="inline-flex items-center gap-2 rounded-full bg-hazard px-6 py-3 font-mono text-[13px] font-bold tracking-wider text-ink hover:brightness-110">I'LL DRIVE <ArrowRight size={16} /></button>
                <button type="button" onClick={() => start(true)} className="inline-flex items-center gap-2 rounded-full border-2 border-hazard px-5 py-3 font-mono text-[13px] font-bold tracking-wider text-hazard hover:bg-hazard/10">AUTOPILOT · JUST SHOW ME</button>
              </div>
              <label className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-paper/60"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-[#f2b705]" /> Music and engine sound</label>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* a checkpoint: slides in beside the road while you keep driving */}
      <AnimatePresence>
        {beat && !detail && !board && !between && (
          <BeatCard key={`${beat.stage.n}-${beat.i}`} b={beat} onDone={() => setBeat(null)}
            onMore={() => { const c = beat.stage.points[beat.i].card; api.current?.setPaused(true); if (c) setDetail(c as GateId); else setBoard(true); }} />
        )}
      </AnimatePresence>

      {/* end of a lap: the chapter, summed up for the role you're hiring for */}
      <AnimatePresence>
        {between && <StageCard st={between} role={role} auto={auto} onNext={nextStage} />}
      </AnimatePresence>

      <Sheet open={isPart(detail)} onClose={resume} label="The full story">{isPart(detail) && <JobCardView id={detail} onBonnet={resume} />}</Sheet>
      <AnimatePresence>{board && <Projects onClose={resume} onAsk={(q) => { setBoard(false); setAsk({ q, n: Date.now() }); }} />}</AnimatePresence>
      <Sheet open={!!ask} onClose={resume} label="Ask Sumahar" tone="dark">{ask && <Bot key={ask.n} initialQuestion={ask.q} />}</Sheet>
      <AnimatePresence>{finale && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <motion.div initial={{ scale: 2.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.3 }}
            className="rounded-2xl border-[6px] border-hazard bg-black/70 px-8 py-5 text-center shadow-[0_0_80px_rgba(242,183,5,.6)] backdrop-blur">
            <div className="font-stencil text-[clamp(44px,8vw,88px)] leading-none text-hazard">100% MATCH</div>
            <div className="mt-1 font-mono text-[12px] tracking-[0.3em] text-paper">YOU KNOW THE DRIVER NOW</div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <AnimatePresence>{award !== undefined && <Achievement how="track" role={role} onClose={() => { setAward(undefined); api.current?.setPaused(false); }} />}</AnimatePresence>
    </div>
  );
}

/** A checkpoint card: one fact from this chapter, readable at a glance, while the car keeps going. */
function BeatCard({ b, onDone, onMore }: { b: Beat; onDone: () => void; onMore: () => void }) {
  const [hold, setHold] = useState(false);
  const c = b.stage.points[b.i], col = b.stage.color;
  useEffect(() => { if (hold) return; const id = window.setTimeout(onDone, 8000); return () => window.clearTimeout(id); }, [hold, onDone]);
  return (
    <>
      <motion.div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: `inset 0 0 140px ${col}` }} initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 1.1 }} />
      <motion.aside role="status" aria-label={`Checkpoint: ${c.head}`} onPointerEnter={() => setHold(true)} onPointerDown={() => setHold(true)}
        initial={{ x: 60, opacity: 0, scale: 0.92 }} animate={{ x: 0, opacity: 1, scale: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="absolute right-4 top-[150px] z-30 w-[min(350px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-oil/95 backdrop-blur md:right-7 md:top-1/2 md:-translate-y-1/2"
        style={{ boxShadow: `0 0 0 2px ${col}, 0 0 50px ${col}55` }}>
        <div className="p-4" style={{ background: `radial-gradient(circle at 15% 0%, ${col}44, transparent 65%)` }}>
          <div className="flex items-start justify-between">
            <div className="font-mono text-[10px] font-bold tracking-[0.2em]" style={{ color: col }}>{b.stage.emoji} STAGE {b.stage.n} · CHECKPOINT {b.i + 1}/3 · {c.kicker}</div>
            <button type="button" onClick={onDone} aria-label="Dismiss" className="-mt-1 rounded-full px-1.5 text-paper/50 hover:text-paper">×</button>
          </div>
          <div className="mt-1 font-cond text-[22px] font-bold leading-tight">{c.head}</div>
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }} className="mt-1 origin-left font-stencil text-[34px] leading-none" style={{ color: col }}>{c.stat}</motion.div>
          <p className="mt-2 text-[14px] leading-snug text-paper/85">{c.line}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-paper/50">{b.i < 2 ? "KEEP DRIVING FOR THE NEXT ONE" : "NEXT: THE STAGE LINE 🏁"}</span>
            <button type="button" onClick={onMore} className="font-mono text-[10.5px] font-bold tracking-wider hover:underline" style={{ color: col }}>{c.card ? "FULL STORY →" : "SEE PROJECTS →"}</button>
          </div>
        </div>
        {!hold && <motion.div className="h-1" style={{ background: col }} initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 8, ease: "linear" }} />}
      </motion.aside>
    </>
  );
}

/** The line at the end of each lap: what you just learned, and why it matters for the role you're hiring for. */
function StageCard({ st, role, auto, onNext }: { st: Stage; role: RoleId; auto: boolean; onNext: () => void }) {
  const nx = STAGES[st.n];
  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? "your team";
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNext(); } };
    window.addEventListener("keydown", k); const id = auto ? window.setTimeout(onNext, 12000) : 0;
    return () => { window.removeEventListener("keydown", k); window.clearTimeout(id); };
  }, [auto, onNext]);
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/45 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label={`Stage ${st.n} complete`} initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="relative w-full max-w-[520px] overflow-hidden rounded-3xl bg-oil" style={{ boxShadow: `0 0 0 2px ${st.color}, 0 0 80px ${st.color}55` }}>
        <div className="p-5 md:p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${st.color}44, transparent 70%)` }}>
          <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em]" style={{ color: st.color }}>STAGE {st.n} OF {STAGES.length} COMPLETE</div>
          <div className="mt-1 text-center font-stencil text-[38px] leading-none">{st.emoji} {st.title}</div>
          <div className="mt-1 text-center text-[14.5px] text-paper/70">I'm someone who <b className="text-paper">{st.trait.toLowerCase()}</b>.</div>
          <ul className="mt-4 space-y-1.5">
            {st.points.map((c, k) => (
              <motion.li key={c.kicker} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + k * 0.12 }} className="flex items-center gap-3 rounded-lg bg-white/[.04] px-3 py-2">
                <span className="w-[84px] shrink-0 font-stencil text-[18px] leading-none" style={{ color: st.color }}>{c.stat}</span>
                <span className="text-[13.5px] leading-snug text-paper/85">{c.head}</span>
              </motion.li>
            ))}
          </ul>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-4 rounded-xl border-l-4 bg-white/[.05] p-3" style={{ borderColor: st.color }}>
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-hazard">WHY THIS MATTERS FOR {roleLabel.toUpperCase()}</div>
            <p className="mt-1 text-[15px] leading-snug">{st.fit[role]}</p>
          </motion.div>
          <div className="mt-5 flex flex-col items-center gap-2">
            <button type="button" onClick={onNext} autoFocus className="relative overflow-hidden rounded-full px-6 py-3 font-mono text-[12.5px] font-bold tracking-wider text-ink" style={{ background: nx.color }}>
              {auto && <motion.span className="absolute inset-y-0 left-0 bg-white/35" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 12, ease: "linear" }} />}
              <span className="relative">STAGE {nx.n}: {nx.emoji} {nx.title} · {nx.themeName.toUpperCase()} →</span>
            </button>
            <span className="text-[12.5px] text-paper/55">{nx.intro}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
