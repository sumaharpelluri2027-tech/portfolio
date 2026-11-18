import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LayoutGrid, Music2, RotateCcw, VolumeX } from "lucide-react";
import { createTrack, type GateId, type GateSpec, type Telemetry, type TrackAPI } from "../scene/track";
import { createBuggy } from "../scene/buggyEntry";
import { createMusic } from "../scene/music";
import { JOBS, type CarPart } from "../content";
import { A } from "../data";
import { TRAITS, traitFor, type Trait } from "../traits";
import { JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";
import Projects from "./Projects";
import Bot from "./Bot";

const LABEL: Record<GateId, [string, string]> = {
  steering: ["STRATEGY", "Owner mindset"], accelerator: ["GROWTH", "Moves the number"], engine: ["OPERATIONS", "Engine"], fuel: ["FINANCE", "Fuel tank"],
  brakes: ["DATA & OPS", "Trust + automation"], nav: ["AI & BUILDS", "What I ship"], projects: ["MU BUILDS", "Projects"], pit: ["FINISH · HIRE", "Your reward"],
};
const ORDER: GateId[] = ["steering", "accelerator", "brakes", "nav", "pit"];
const N = TRAITS.length;
const GATES: GateSpec[] = ORDER.map((id) => ({ id, label: LABEL[id][0], sub: LABEL[id][1], color: traitFor(id)?.color ?? "#f2b705" }));
const isPart = (g: GateId | null): g is GateId & CarPart => !!g && g in JOBS;

/** The test track: each gate unlocks one thing I bring to a team; the pit is where you hire the driver. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<TrackAPI | null>(null);
  const music = useRef(createMusic());
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(true);
  const [tel, setTel] = useState<Telemetry | null>(null);
  const [reward, setReward] = useState<Trait | null>(null);
  const [detail, setDetail] = useState<GateId | null>(null);
  const [board, setBoard] = useState(false);
  const [ask, setAsk] = useState<{ q?: string; n: number } | null>(null);
  const [award, setAward] = useState<null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [got, setGot] = useState<GateId[]>([]);
  const [finale, setFinale] = useState(false);
  const [auto, setAuto] = useState(false);
  const telRef = useRef<Telemetry | null>(null);
  const finished = useRef(false);
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const input = useRef({ throttle: 0, steer: 0, brake: false });

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2800); };
  const onGate = useCallback((id: GateId) => {
    const t = telRef.current;
    if (id === "pit") {
      const left = ORDER.filter((g) => g !== "pit" && !t?.gatesCleared.includes(g)).length;
      if (left > 0) setGot(TRAITS.map((x) => x.gate)); // missed a gate? you still get the full picture at the finish
      if (finished.current) return;
      finished.current = true;
      api.current?.celebrate(); music.current.sting("finish"); setFinale(true);
      window.setTimeout(() => { setFinale(false); api.current?.setPaused(true); setAward(null); }, 3200);
      return;
    }
    const tr = traitFor(id); if (!tr) return;
    setGot((g) => { const n = g.includes(id) ? g : [...g, id]; music.current.sting(n.length >= N ? "all" : "gate"); return n; });
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
    const m = music.current;
    return () => { t.dispose(); api.current = null; m.dispose(); };
  }, []);

  const applySound = (on: boolean) => {
    setSound(on); api.current?.setSound(on);
    music.current.setOn(on); if (on) music.current.start();
  };
  const start = (self = false) => { setStarted(true); applySound(sound); setAuto(self); api.current?.setAuto(self); api.current?.setPaused(false); };
  const resume = useCallback(() => { setReward(null); setDetail(null); setBoard(false); setAsk(null); api.current?.setPaused(false); }, []);

  // start screen: Enter starts
  useEffect(() => {
    if (!ready || started) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(false); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [ready, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: "throttle" | "steer" | "brake", v: number | boolean) => { (input.current as Record<string, number | boolean>)[k] = v; api.current?.setInput({ ...input.current }); };
  const next = traitFor((tel?.nextGate ?? "pit") as GateId);
  const allGot = TRAITS.every((t) => got.includes(t.gate) || tel?.gatesCleared.includes(t.gate));
  const busy = !!detail || board || !!ask || award !== undefined;

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

      {/* driver card + the trait tray: what you're collecting */}
      {ready && started && (
        <div className="pointer-events-none absolute left-4 top-[74px] z-10 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-white/15 bg-black/50 p-3 backdrop-blur md:left-7">
          <div className="flex items-center gap-2.5">
            <img src={A("me/avatar.webp")} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-hazard" />
            <div className="min-w-0"><div className="font-cond text-[16px] font-semibold leading-tight">Driver: Sumahar Pelluri</div><div className="truncate text-[11.5px] text-paper/60">Founder's Office · Data · Ops · PGP '27</div></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-paper/60"><span>HOW WELL YOU KNOW ME</span><motion.span key={got.length} initial={{ scale: 1.6, color: "#fff" }} animate={{ scale: 1, color: "#f2b705" }} className="font-bold">{Math.round((got.length / N) * 100)}%</motion.span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-[#4fc3f7] via-[#f2b705] to-[#66bb6a]" animate={{ width: `${(got.length / N) * 100}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} /></div>
          <div className="mt-1.5 grid grid-cols-4 gap-1 md:hidden">
            {TRAITS.map((t) => { const on = got.includes(t.gate); return <div key={t.gate} className="grid aspect-square place-items-center rounded-lg text-[15px]" style={{ background: on ? t.color : "rgba(255,255,255,.08)", opacity: on ? 1 : 0.4 }}>{t.emoji}</div>; })}
          </div>
          <div className="mt-2 hidden md:block">
            <div className="font-mono text-[9.5px] tracking-[0.18em] text-paper/45">WHAT YOU'VE LEARNED</div>
            <ul className="mt-1 space-y-1">
              {TRAITS.map((t) => {
                const on = got.includes(t.gate);
                return (
                  <motion.li key={t.gate} initial={false} animate={on ? { opacity: 1, x: 0 } : { opacity: 0.35, x: 0 }} className="flex items-center gap-2 text-[12.5px] leading-tight">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[11px]" style={{ background: on ? t.color : "rgba(255,255,255,.08)" }}>{on ? t.emoji : "?"}</span>
                    <span className={on ? "text-paper" : "text-paper/50"}>{on ? t.trait : LABEL[t.gate][0].toLowerCase() + " · locked"}</span>
                    {on && <span className="ml-auto font-stencil text-[11px]" style={{ color: t.color }}>{t.stat}</span>}
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* where to go next */}
      {ready && started && !busy && (
        <motion.div key={next?.gate ?? "pit"} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute left-1/2 top-[74px] z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border-2 bg-black/55 px-4 py-2 font-mono text-[11.5px] font-bold tracking-wider backdrop-blur lg:flex"
          style={{ borderColor: allGot ? "#f2b705" : next?.color }}>
          {allGot ? <>🏁 ALL 4 UNLOCKED · CROSS THE FINISH FOR YOUR REWARD</> : <>NEXT GATE <span style={{ color: next?.color }}>{next?.emoji} {next ? LABEL[next.gate][0] : ""}</span></>}
        </motion.div>
      )}

      {/* small speed pill */}
      {ready && started && (
        <div className="pointer-events-none absolute bottom-[112px] right-4 z-10 rounded-xl md:bottom-auto md:top-[74px] border border-white/15 bg-black/50 px-3 py-2 text-right font-mono backdrop-blur md:right-7" aria-hidden="true">
          <div><span className="font-stencil text-[28px] leading-none tabular-nums">{Math.round(tel?.speedKmh ?? 0)}</span><span className="ml-1 text-[10px] text-paper/60">KM/H</span></div>
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
              <p className="mt-2 text-[15px] text-paper/80">No timer, no racing. Drive through <b className="text-paper">4 coloured gates</b>. Each one shows you something I'd bring to your team. About a minute. Or let the car drive itself and just read.</p>
              <div className="mt-4 flex justify-center gap-1.5">{TRAITS.map((t) => <span key={t.gate} className="grid h-9 w-9 place-items-center rounded-lg text-[17px]" style={{ background: t.color + "33", border: `1px solid ${t.color}` }}>{t.emoji}</span>)}</div>
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

      {/* the reward: one trait, one number, one line */}
      <AnimatePresence>
        {reward && !detail && !board && (
          <TraitToast key={reward.gate} t={reward} n={got.length} onDone={() => setReward(null)}
            onMore={() => { api.current?.setPaused(true); if (reward.gate === "projects") setBoard(true); else setDetail(reward.gate); }} />
        )}
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
      <AnimatePresence>{award !== undefined && <Achievement how="track" onClose={() => { setAward(undefined); api.current?.setPaused(false); }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[132px] z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-paper px-4 py-2 font-mono text-[11px] text-ink">{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

/** A trait card that slides in beside the road while you keep driving, then tucks itself away. */
function TraitToast({ t, n, onDone, onMore }: { t: Trait; n: number; onDone: () => void; onMore: () => void }) {
  const [hold, setHold] = useState(false);
  useEffect(() => { if (hold) return; const id = window.setTimeout(onDone, 7000); return () => window.clearTimeout(id); }, [hold, onDone]);
  return (
    <>
      <motion.div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: `inset 0 0 140px ${t.color}` }} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1.1 }} />
      <motion.aside role="status" aria-label={`Unlocked: ${t.trait}`} onPointerEnter={() => setHold(true)} onPointerDown={() => setHold(true)}
        initial={{ x: 60, opacity: 0, scale: 0.92 }} animate={{ x: 0, opacity: 1, scale: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="absolute right-4 top-[150px] z-30 w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-oil/95 backdrop-blur md:right-7 md:top-1/2 md:-translate-y-1/2"
        style={{ boxShadow: `0 0 0 2px ${t.color}, 0 0 50px ${t.color}55` }}>
        <div className="p-4" style={{ background: `radial-gradient(circle at 15% 0%, ${t.color}44, transparent 65%)` }}>
          <div className="flex items-center gap-3">
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="text-[38px] leading-none">{t.emoji}</motion.span>
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold tracking-[0.2em]" style={{ color: t.color }}>UNLOCKED · {n}/{N}</div>
              <div className="font-cond text-[21px] font-bold leading-tight">{t.trait}</div>
            </div>
            <button type="button" onClick={onDone} aria-label="Dismiss" className="ml-auto self-start rounded-full px-1.5 text-paper/50 hover:text-paper">×</button>
          </div>
          <div className="mt-2 flex items-baseline gap-2"><span className="font-stencil text-[30px] leading-none" style={{ color: t.color }}>{t.stat}</span><span className="text-[12.5px] text-paper/65">{t.statLabel}</span></div>
          <p className="mt-2 text-[13.5px] leading-snug text-paper/85">💡 {t.aha}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: t.color }} initial={{ width: `${((n - 1) / N) * 100}%` }} animate={{ width: `${(n / N) * 100}%` }} transition={{ delay: 0.3, duration: 0.8 }} /></div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-paper/55">YOU KNOW ME {Math.round((n / N) * 100)}%{n >= N ? " · NOW CROSS THE FINISH 🏁" : ""}</span>
            <button type="button" onClick={onMore} className="font-mono text-[10.5px] font-bold tracking-wider hover:underline" style={{ color: t.color }}>{t.gate === "projects" ? "SEE PROJECTS →" : "FULL STORY →"}</button>
          </div>
        </div>
        {!hold && <motion.div className="h-1" style={{ background: t.color }} initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 7, ease: "linear" }} />}
      </motion.aside>
    </>
  );
}
