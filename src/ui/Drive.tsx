import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LayoutGrid, Music2, RotateCcw, VolumeX } from "lucide-react";
import { createTrack, type GateId, type GateSpec, type Telemetry, type TrackAPI } from "../scene/track";
import { createBuggy } from "../scene/buggyEntry";
import { JOBS, type CarPart } from "../content";
import { A } from "../data";
import { TRAITS, traitFor, type Trait } from "../traits";
import { JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";
import Projects from "./Projects";
import Bot from "./Bot";

const LABEL: Record<GateId, [string, string]> = {
  steering: ["STRATEGY", "Steering"], accelerator: ["GROWTH", "Accelerator"], engine: ["OPERATIONS", "Engine"], fuel: ["FINANCE", "Fuel tank"],
  brakes: ["DATA TRUST", "Brakes"], nav: ["AI", "Navigation"], projects: ["MU BUILDS", "Projects"], pit: ["PIT · HIRE", "The finish"],
};
const ORDER: GateId[] = ["steering", "accelerator", "engine", "fuel", "brakes", "nav", "projects", "pit"];
const GATES: GateSpec[] = ORDER.map((id) => ({ id, label: LABEL[id][0], sub: LABEL[id][1], color: traitFor(id)?.color ?? "#f2b705" }));
const isPart = (g: GateId | null): g is GateId & CarPart => !!g && g in JOBS;
const fmt = (s: number | null) => (s == null ? "--:--.-" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`);
const AUTO = 9; // seconds before a reward card lets you drive on by itself

/** The test track: each gate unlocks one thing I bring to a team; the pit is where you hire the driver. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<TrackAPI | null>(null);
  const music = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(true);
  const [tel, setTel] = useState<Telemetry | null>(null);
  const [reward, setReward] = useState<Trait | null>(null);
  const [detail, setDetail] = useState<GateId | null>(null);
  const [board, setBoard] = useState(false);
  const [ask, setAsk] = useState<{ q?: string; n: number } | null>(null);
  const [award, setAward] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [got, setGot] = useState<GateId[]>([]);
  const telRef = useRef<Telemetry | null>(null);
  const finished = useRef(false);
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const input = useRef({ throttle: 0, steer: 0, brake: false });

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2800); };
  const onGate = useCallback((id: GateId) => {
    const t = telRef.current;
    if (id === "pit") {
      const left = ORDER.filter((g) => g !== "pit" && !t?.gatesCleared.includes(g)).length;
      if (left > 0) { flash(`${left} more ${left === 1 ? "trait" : "traits"} to collect before the pit`); return; }
      if (finished.current) return;
      finished.current = true;
      api.current?.celebrate();
      const lap = fmt(t?.lapTime ?? null);
      window.setTimeout(() => { api.current?.setPaused(true); setAward(lap); }, 2600);
      return;
    }
    const tr = traitFor(id); if (!tr) return;
    api.current?.setPaused(true);
    setGot((g) => (g.includes(id) ? g : [...g, id]));
    setReward(tr);
  }, []);
  const onGateRef = useRef(onGate); onGateRef.current = onGate;

  useEffect(() => {
    if (!host.current) return;
    const t = createTrack({
      container: host.current, createBuggy, gates: GATES,
      onGate: (id) => onGateRef.current(id),
      onTelemetry: (x) => { telRef.current = x; setTel(x); },
      onReady: () => setReady(true),
      quality: coarse.current || window.innerWidth < 760 || /[?&]low\b/.test(location.search) ? "low" : "high",
    });
    api.current = t;
    t.setPaused(true);
    return () => { t.dispose(); api.current = null; music.current?.pause(); };
  }, []);

  const applySound = (on: boolean) => {
    setSound(on); api.current?.setSound(on);
    const m = music.current; if (!m) return;
    if (on) { m.volume = 0.32; m.play().catch(() => {}); } else m.pause();
  };
  const start = () => { setStarted(true); applySound(sound); api.current?.setPaused(false); };
  const resume = useCallback(() => { setReward(null); setDetail(null); setBoard(false); setAsk(null); api.current?.setPaused(false); }, []);

  // reward card: Enter or Space drives on
  useEffect(() => {
    if (!reward || detail || board) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); resume(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [reward, detail, board, resume]);
  // start screen: Enter starts
  useEffect(() => {
    if (!ready || started) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [ready, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: "throttle" | "steer" | "brake", v: number | boolean) => { (input.current as Record<string, number | boolean>)[k] = v; api.current?.setInput({ ...input.current }); };
  const next = traitFor((tel?.nextGate ?? "pit") as GateId);
  const allGot = TRAITS.every((t) => got.includes(t.gate) || tel?.gatesCleared.includes(t.gate));
  const busy = !!reward || !!detail || board || !!ask || award !== undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a1030]">
      <audio ref={music} src={A("audio/chasing-the-horizon.mp3")} loop preload="none" />
      <div ref={host} className="absolute inset-0" role="application" aria-label="A drivable test track. Each gate unlocks one thing I bring to a team. Use Skip to the work for a non-driving view." />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-4 md:px-7" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onExit} className="mr-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><ArrowLeft size={14} /> GARAGE</button>
        <button type="button" onClick={() => applySound(!sound)} aria-label={sound ? "Mute music and sound" : "Turn music and sound on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard">{sound ? <Music2 size={15} /> : <VolumeX size={15} />}</button>
        <button type="button" onClick={() => api.current?.resetCar()} aria-label="Reset the car to the start" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => { api.current?.setPaused(true); setBoard(true); }} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink"><LayoutGrid size={14} /><span className="hidden sm:inline">SKIP TO THE WORK</span><span className="sm:hidden">WORK</span></button>
      </header>

      {/* driver card + the trait tray: what you're collecting */}
      {ready && started && (
        <div className="pointer-events-none absolute left-4 top-[74px] z-10 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-white/15 bg-black/50 p-3 backdrop-blur md:left-7">
          <div className="flex items-center gap-2.5">
            <img src={A("me/avatar.webp")} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-hazard" />
            <div className="min-w-0"><div className="font-cond text-[16px] font-semibold leading-tight">Driver: Sumahar Pelluri</div><div className="truncate text-[11.5px] text-paper/60">Founder's Office · Data · Ops · PGP '27</div></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-paper/60"><span>TRAITS COLLECTED</span><span className="text-hazard">{got.length}/7</span></div>
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {TRAITS.map((t) => {
              const on = got.includes(t.gate);
              return (
                <motion.div key={t.gate} title={on ? t.trait : "Not collected yet"} animate={on ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.5 }}
                  className="grid aspect-square place-items-center rounded-lg text-[16px]" style={{ background: on ? t.color : "rgba(255,255,255,.08)", filter: on ? "none" : "grayscale(1)", opacity: on ? 1 : 0.45 }}>{t.emoji}</motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* where to go next */}
      {ready && started && !busy && (
        <motion.div key={next?.gate ?? "pit"} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute left-1/2 top-[74px] z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border-2 bg-black/55 px-4 py-2 font-mono text-[11.5px] font-bold tracking-wider backdrop-blur lg:flex"
          style={{ borderColor: allGot ? "#f2b705" : next?.color }}>
          {allGot ? <>🏁 ALL 7 COLLECTED · HEAD TO THE PIT FOR YOUR REWARD</> : <>NEXT GATE <span style={{ color: next?.color }}>{next?.emoji} {next ? LABEL[next.gate][0] : ""}</span></>}
        </motion.div>
      )}

      {/* small speed pill */}
      {ready && started && (
        <div className="pointer-events-none absolute bottom-[112px] right-4 z-10 rounded-xl md:bottom-auto md:top-[74px] border border-white/15 bg-black/50 px-3 py-2 text-right font-mono backdrop-blur md:right-7" aria-hidden="true">
          <div><span className="font-stencil text-[28px] leading-none tabular-nums">{Math.round(tel?.speedKmh ?? 0)}</span><span className="ml-1 text-[10px] text-paper/60">KM/H</span></div>
          <div className="text-[10.5px] tabular-nums text-paper/60">LAP {fmt(tel?.lapTime ?? 0)}</div>
        </div>
      )}

      {ready && started && !busy && !coarse.current && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 text-center font-mono text-[11px] tracking-[0.16em] text-paper/80" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>W A S D OR ARROWS · SPACE HANDBRAKE · R RESET · DRIVE THROUGH THE COLOURED GATES</p>
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
              <p className="mt-2 text-[15px] text-paper/80">Drive through <b className="text-paper">7 coloured gates</b>. Each one unlocks something I'd bring to your team. Finish in the pit for your reward.</p>
              <div className="mt-4 flex justify-center gap-1.5">{TRAITS.map((t) => <span key={t.gate} className="grid h-9 w-9 place-items-center rounded-lg text-[17px]" style={{ background: t.color + "33", border: `1px solid ${t.color}` }}>{t.emoji}</span>)}</div>
              <div className="mt-4 font-mono text-[11px] text-paper/60">{coarse.current ? "Use the on-screen GAS and arrows" : "W A S D or arrow keys to drive"}</div>
              <button type="button" onClick={start} className="mt-4 inline-flex items-center gap-2 rounded-full bg-hazard px-7 py-3 font-mono text-[13px] font-bold tracking-wider text-ink hover:brightness-110">START ENGINE <ArrowRight size={16} /></button>
              <label className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-paper/60"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-[#f2b705]" /> Music and engine sound</label>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the reward: one trait, one number, one line */}
      <AnimatePresence>
        {reward && !detail && !board && (
          <RewardCard key={reward.gate} t={reward} n={got.length} onGo={resume}
            onMore={() => (reward.gate === "projects" ? setBoard(true) : setDetail(reward.gate))} />
        )}
      </AnimatePresence>

      <Sheet open={isPart(detail)} onClose={resume} label="The full story">{isPart(detail) && <JobCardView id={detail} onBonnet={resume} />}</Sheet>
      <AnimatePresence>{board && <Projects onClose={resume} onAsk={(q) => { setBoard(false); setAsk({ q, n: Date.now() }); }} />}</AnimatePresence>
      <Sheet open={!!ask} onClose={resume} label="Ask Sumahar" tone="dark">{ask && <Bot key={ask.n} initialQuestion={ask.q} />}</Sheet>
      <AnimatePresence>{award !== undefined && <Achievement how="track" lap={award} onClose={() => { setAward(undefined); api.current?.setPaused(false); }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[132px] z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-paper px-4 py-2 font-mono text-[11px] text-ink">{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function RewardCard({ t, n, onGo, onMore }: { t: Trait; n: number; onGo: () => void; onMore: () => void }) {
  const [hold, setHold] = useState(false);
  const last = n >= 7;
  useEffect(() => { if (hold) return; const id = window.setTimeout(onGo, AUTO * 1000); return () => window.clearTimeout(id); }, [hold, onGo]);
  return (
    <motion.div role="dialog" aria-label={`Trait unlocked: ${t.trait}`} className="absolute inset-0 z-30 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/35" onClick={onGo} />
      <motion.div onPointerEnter={() => setHold(true)} onPointerDown={() => setHold(true)}
        initial={{ scale: 0.7, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-oil text-center shadow-2xl" style={{ boxShadow: `0 0 0 2px ${t.color}, 0 0 70px ${t.color}66` }}>
        <div className="relative px-6 pb-5 pt-6" style={{ background: `radial-gradient(circle at 50% 0%, ${t.color}55, transparent 70%)` }}>
          {/* burst */}
          {Array.from({ length: 12 }).map((_, k) => (
            <motion.span key={k} className="absolute left-1/2 top-[58px] h-2 w-2 rounded-full" style={{ background: t.color }}
              initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos((k / 12) * 6.28) * 120, y: Math.sin((k / 12) * 6.28) * 70, opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} />
          ))}
          <div className="font-mono text-[10.5px] font-bold tracking-[0.25em]" style={{ color: t.color }}>TRAIT UNLOCKED · {n}/7</div>
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }} className="mx-auto mt-2 text-[54px] leading-none">{t.emoji}</motion.div>
          <div className="mt-2 font-cond text-[26px] font-bold leading-tight">{t.trait}</div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-3">
            <div className="font-stencil text-[44px] leading-none" style={{ color: t.color }}>{t.stat}</div>
            <div className="mt-1 text-[13px] text-paper/65">{t.statLabel}</div>
          </motion.div>
          <p className="mx-auto mt-3 max-w-[330px] text-[15px] leading-snug text-paper/85">{t.line}</p>
          <div className="mt-3 flex justify-center gap-1.5">{t.chips.map((c) => <span key={c} className="rounded-full bg-white/[.08] px-2.5 py-1 font-mono text-[10.5px] text-paper/75">{c}</span>)}</div>
          {last && <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="mt-4 rounded-xl bg-hazard px-3 py-2 font-mono text-[11.5px] font-bold text-ink">🏁 ALL 7 COLLECTED · HEAD TO THE PIT FOR YOUR REWARD</motion.div>}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 p-3">
          <button type="button" onClick={onMore} className="rounded-full px-3 py-2.5 font-mono text-[11px] text-paper/70 hover:text-paper">{t.gate === "projects" ? "SEE THE PROJECTS" : "THE FULL STORY"}</button>
          <button type="button" onClick={onGo} autoFocus className="relative ml-auto overflow-hidden rounded-full px-5 py-2.5 font-mono text-[11.5px] font-bold text-ink" style={{ background: t.color }}>
            {!hold && <motion.span className="absolute inset-y-0 left-0 bg-white/30" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: AUTO, ease: "linear" }} />}
            <span className="relative">KEEP DRIVING ↵</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
