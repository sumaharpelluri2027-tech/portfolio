import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LayoutGrid, Music2, Volume2, VolumeX } from "lucide-react";
import { createMusic } from "../scene/music";
import { JOBS, type CarPart } from "../content";
import { ACTIVITIES, DATA_FINALE, ROLES, type Activity, type Choice, type Line, type RoleId } from "../stages";
import { createArena, type ArenaAPI, type GameScore } from "../scene/arena";
import { createBuggy } from "../scene/buggyEntry";
import * as voice from "../narrate";
import { JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";
import Projects from "./Projects";
import Bot from "./Bot";

type GateId = CarPart;
const isPart = (g: GateId | null): g is CarPart => !!g && g in JOBS;
type Score = GameScore;
const freshScore = (a?: Activity): Score => ({ conv: 10, orders: 0, auto: false, fuel: a?.key === "runway" ? 30 : 100, aum: 10, rivals: 0, dodged: 0, prog: 0 });
const cr = (lakh: number) => (lakh >= 100 ? `₹${(lakh / 100).toFixed(1)} Cr` : `₹${Math.round(lakh)}L`);
type Phase = "ask" | "drive" | "explain" | "data" | "award";
const TASK: Record<Activity["key"], string> = { road: "Hill climb: pick the road", funnel: "Ramp jump: hit the target", orders: "Yard: handle what hits you", runway: "Desert: make the fuel last" };
/** the backdrop behind the cards, in each world's colours */
const BACK: Record<Activity["key"], string> = {
  road: "linear-gradient(180deg,#34488f 0%,#e58fb0 55%,#ffc38f 75%,#2f5a26 76%,#1f3a1a 100%)",
  funnel: "linear-gradient(180deg,#040822 0%,#2a1858 60%,#5a3b9a 76%,#16131f 77%)",
  orders: "repeating-linear-gradient(90deg,#8d8f92 0 30%,#3b3e44 30% 70%,#8d8f92 70% 100%)",
  runway: "radial-gradient(circle at 85% 0%,#ff9a5a 0%,transparent 45%),linear-gradient(180deg,#e8b878,#d79a5a)",
};

/** Four business functions, four different little games: one founder's call each, then I tell you what I did. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const arena = useRef<ArenaAPI | null>(null);
  const [auto, setAuto] = useState(true);
  const music = useRef(createMusic());
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const [sound, setSound] = useState(true);
  const [talk, setTalk] = useState(true);
  const [kmh, setKmh] = useState(0);
  const [prog, setProg] = useState(0);
  const [detail, setDetail] = useState<GateId | null>(null);
  const [board, setBoard] = useState(false);
  const [ask, setAsk] = useState<{ q?: string; n: number } | null>(null);
  const [role, setRole] = useState<RoleId>("founders");
  const [ai, setAi] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [score, setScore] = useState<Score>(freshScore());
  const [log, setLog] = useState<{ a: Activity; c: Choice; s: Score }[]>([]);
  const [pop, setPop] = useState<{ t: string; c: string; k: number } | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const scoreRef = useRef(score);
  const tel = useRef({ kmh: 0, prog: 0 });
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const act = ACTIVITIES[ai];

  useEffect(() => voice.onCaption(setCap), []);
  useEffect(() => { if (!pop) return; const id = window.setTimeout(() => setPop(null), 1700); return () => window.clearTimeout(id); }, [pop]);
  // one 3D arena for the whole session; the first course idles behind the start screen
  useEffect(() => {
    if (!host.current) return;
    const lowQ = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760 || /[?&]low\b/.test(location.search);
    const a = createArena({ container: host.current, createBuggy, quality: lowQ ? "low" : "high" });
    arena.current = a; a.preview(ACTIVITIES[0].key);
    const m = music.current;
    return () => { a.dispose(); arena.current = null; m.dispose(); voice.stop(); };
  }, []);
  // telemetry arrives every frame; the HUD only needs it ten times a second
  useEffect(() => { if (phase !== "drive") return; const id = window.setInterval(() => { setKmh(tel.current.kmh); setProg(tel.current.prog); }, 100); return () => window.clearInterval(id); }, [phase]);
  useEffect(() => { arena.current?.setPaused(!!detail || board || !!ask); }, [detail, board, ask]);

  const prepare = useCallback((k: number) => {
    const a = ACTIVITIES[k]; arena.current?.preview(a.key); const f = freshScore(a); scoreRef.current = f; setScore(f);
    setChoice(null); setAi(k); setProg(0); setKmh(0); setPhase("ask");
  }, []);

  const choose = (c: Choice) => {
    const a = ACTIVITIES[ai]; if (!arena.current) return;
    setChoice(c); voice.stop(); setPhase("drive");
    arena.current.start(a.key, c.id, {
      onAuto: (on) => setAuto(on),
      onPop: (t, col) => setPop({ t, c: col, k: Date.now() + Math.random() }),
      onScore: (p) => { const n = { ...scoreRef.current, ...p }; scoreRef.current = n; setScore(n); },
      onTel: (kmh, prog) => { tel.current = { kmh, prog }; },
      onDone: () => {
        setLog((l) => [...l, { a, c, s: scoreRef.current }]);
        music.current.sting(a.n === ACTIVITIES.length ? "finish" : "all");
        setPhase("explain");
      },
    });
    if (talk) voice.say(c.outcome.text, c.outcome.key);
  };

  const next = useCallback(() => {
    voice.stop();
    if (ai < ACTIVITIES.length - 1) prepare(ai + 1);
    else setPhase("data");
  }, [ai, prepare]);

  const applySound = (on: boolean) => { setSound(on); music.current.setOn(on); if (on) music.current.start(); };
  const applyTalk = (on: boolean) => { setTalk(on); voice.setMuted(!on); if (!on) voice.stop(); };
  const begin = () => { applySound(sound); voice.setMuted(!talk); prepare(0); setStarted(true); };
  const resume = useCallback(() => { setDetail(null); setBoard(false); setAsk(null); }, []);
  const overlay = !!detail || board || !!ask;
  const driving = started && phase === "drive" && !overlay;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a1030]">
      <div className="absolute inset-0 transition-[background] duration-700" style={{ background: BACK[act.key] }} />
      <div ref={host} className="absolute inset-0" role="application" aria-label={`${act.vertical}: ${TASK[act.key]}. Autopilot drives; arrow keys or A and D steer.`} />

      <header className="absolute inset-x-0 top-0 z-[35] flex items-center gap-2 px-4 py-4 md:px-7" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onExit} className="mr-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><ArrowLeft size={14} /> GARAGE</button>
        <button type="button" onClick={() => applyTalk(!talk)} aria-label={talk ? "Mute the narrator" : "Turn the narrator on"} title="Narrator" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur hover:border-hazard">{talk ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
        <button type="button" onClick={() => applySound(!sound)} aria-label={sound ? "Mute music" : "Turn music on"} title="Music" className={`grid h-10 w-10 place-items-center rounded-full border bg-black/45 backdrop-blur hover:border-hazard ${sound ? "border-white/25" : "border-white/10 opacity-50"}`}><Music2 size={15} /></button>
        {driving && <button type="button" onClick={() => arena.current?.setAuto(!auto)} aria-pressed={auto} className={`rounded-full border px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider backdrop-blur ${auto ? "border-hazard bg-hazard text-ink" : "border-white/25 bg-black/45 hover:border-hazard"}`}>AUTOPILOT {auto ? "ON" : "OFF"}</button>}
        <button type="button" onClick={() => setBoard(true)} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink"><LayoutGrid size={14} /><span className="hidden sm:inline">SKIP TO THE WORK</span><span className="sm:hidden">WORK</span></button>
      </header>

      {started && phase !== "data" && phase !== "award" && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-[35] flex justify-center px-4">
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2 py-1.5 backdrop-blur">
            {ACTIVITIES.map((a, k) => (
              <span key={a.n} className="flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-wider"
                style={{ background: k === ai ? a.color : k < ai ? `${a.color}33` : "transparent", color: k === ai ? "#14110e" : k < ai ? a.color : "rgba(239,233,220,.45)" }}>
                {a.emoji}<span className="hidden sm:inline">{a.title}</span>{k < ai && " ✓"}
              </span>
            ))}
          </div>
        </div>
      )}

      {driving && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-[118px] z-10 flex justify-center px-4">
            <div className="w-[min(440px,100%)] rounded-2xl border-2 bg-black/60 px-4 py-2 text-center backdrop-blur" style={{ borderColor: act.color }}>
              <div className="text-[14.5px] font-semibold">{act.emoji} {act.objective}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${prog * 100}%`, background: act.color }} /></div>
            </div>
          </div>
          <ScoreCard a={act} s={score} c={choice} />
          <Gauges kmh={kmh} a={act} s={score} />
        </>
      )}

      <AnimatePresence>
        {pop && driving && (
          <div key={pop.k} className="pointer-events-none absolute inset-x-0 top-[30%] z-20 flex justify-center px-4">
            <motion.div initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-full px-5 py-2 text-center font-stencil text-[clamp(16px,2.6vw,24px)] text-ink shadow-xl" style={{ background: pop.c }}>{pop.t}</motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cap && driving && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[54px] z-30 flex justify-center px-4">
            <motion.div key={cap} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-[640px] rounded-xl bg-black/75 px-4 py-2 text-center text-[15px] text-paper backdrop-blur">
              <span className="mr-2 font-mono text-[10px] font-bold tracking-[0.2em] text-hazard">SUMAHAR</span>{cap}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {driving && (coarse.current ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between p-4" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
          {([-1, 1] as const).map((v) => (
            <button key={v} type="button" aria-label={v < 0 ? "Steer left" : "Steer right"} className="grid h-16 w-16 select-none place-items-center rounded-full border border-white/30 bg-black/50 text-2xl active:bg-hazard active:text-ink"
              onPointerDown={() => arena.current?.setSteer(v)} onPointerUp={() => arena.current?.setSteer(0)} onPointerLeave={() => arena.current?.setSteer(0)} onPointerCancel={() => arena.current?.setSteer(0)}>{v < 0 ? "◀" : "▶"}</button>
          ))}
        </div>
      ) : <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-center font-mono text-[11px] tracking-[0.16em] text-paper/80">{auto ? "AUTOPILOT IS DRIVING · PRESS ← → OR A / D TO TAKE THE WHEEL" : "YOU'RE DRIVING · ← → OR A / D TO STEER · ↓ TO BRAKE"}</p>)}

      <AnimatePresence>
        {!started && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="w-full max-w-[600px] rounded-2xl border-2 border-hazard bg-oil/95 p-5 text-center shadow-[0_0_60px_rgba(242,183,5,.3)] md:p-6">
              <div className="font-mono text-[11px] font-bold tracking-[0.25em] text-hazard">THINK LIKE A FOUNDER</div>
              <h2 className="mt-1 font-stencil text-[32px] leading-none">FOUR CALLS. FOUR TEST DRIVES.</h2>
              <p className="mt-2 text-[14.5px] text-paper/80">Make the call, then drive it: steer yourself or let autopilot take it. About fifteen seconds each. Then hear what I actually did.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {ACTIVITIES.map((a) => (
                  <div key={a.n} className="rounded-xl p-2.5" style={{ background: a.color + "1f", border: `1px solid ${a.color}66` }}>
                    <div className="text-[20px] leading-none">{a.emoji}</div>
                    <div className="mt-1 font-cond text-[15px] font-bold leading-tight">{a.vertical}</div>
                    <div className="mt-0.5 text-[11.5px] leading-tight text-paper/65">{TASK[a.key]}</div>
                    <div className="mt-1 text-[10.5px] leading-tight text-paper/45">{a.world}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 font-mono text-[10.5px] tracking-wider text-[#36c8ff]">📊 DATA RUNS UNDER ALL FOUR · ABOUT 2 MINUTES</div>
              <div className="mt-4 text-left font-mono text-[10.5px] tracking-[0.18em] text-paper/60">WHAT ARE YOU HIRING FOR?</div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role you are hiring for">
                {ROLES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)} className={`rounded-full px-3 py-1.5 text-[13px] ${role === r.id ? "bg-hazard font-semibold text-ink" : "border border-white/20 text-paper/75 hover:border-white/50"}`}>{r.label}</button>)}
              </div>
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={begin} className="inline-flex items-center gap-2 rounded-full bg-hazard px-7 py-3 font-mono text-[13px] font-bold tracking-wider text-ink hover:brightness-110">START <ArrowRight size={16} /></button>
              </div>
              <div className="mt-3 flex justify-center gap-4 text-[12.5px] text-paper/60">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} className="accent-[#f2b705]" /> Narrator</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-[#f2b705]" /> Music</label>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{started && phase === "ask" && !overlay && <AskCard key={`ask${ai}`} a={act} talk={talk} onChoose={choose} />}</AnimatePresence>
      <AnimatePresence>{started && phase === "explain" && choice && !overlay && <ExplainCard key={`ex${ai}`} a={act} c={choice} s={score} role={role} talk={talk} onNext={next} onMore={() => setDetail(act.card)} />}</AnimatePresence>
      <AnimatePresence>{phase === "data" && !overlay && <DataCard log={log} talk={talk} onDone={() => { voice.stop(); setPhase("award"); }} />}</AnimatePresence>

      <Sheet open={isPart(detail)} onClose={resume} label="The full story">{isPart(detail) && <JobCardView id={detail} onBonnet={resume} />}</Sheet>
      <AnimatePresence>{board && <Projects onClose={resume} onAsk={(q) => { setBoard(false); setAsk({ q, n: Date.now() }); }} />}</AnimatePresence>
      <Sheet open={!!ask} onClose={resume} label="Ask Sumahar" tone="dark">{ask && <Bot key={ask.n} initialQuestion={ask.q} />}</Sheet>
      <AnimatePresence>{phase === "award" && <Achievement how="track" role={role} onClose={() => onExit()} />}</AnimatePresence>
    </div>
  );
}

/** Speaks lines one by one; reports which line is on, and when all are done. Muted, it paces them by reading time. */
function useNarration(lines: Line[], talk: boolean) {
  const [i, setI] = useState(-1);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    voice.setMuted(!talk);
    voice.sayAll(lines, (k) => { if (alive) setI(k); }).then((ok) => { if (alive && ok !== false) { setI(lines.length); setDone(true); } });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { i, done };
}

/** The founder's call, before the drive. The options unlock once the situation has been heard. */
function AskCard({ a, talk, onChoose }: { a: Activity; talk: boolean; onChoose: (c: Choice) => void }) {
  const { done } = useNarration([a.question], talk);
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/35 p-4 pt-[120px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label={`${a.vertical}: your call`} initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-[620px] overflow-hidden rounded-3xl bg-oil/95 backdrop-blur" style={{ boxShadow: `0 0 0 2px ${a.color}, 0 0 70px ${a.color}55` }}>
        <div className="p-5 md:p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${a.color}40, transparent 70%)` }}>
          <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em]" style={{ color: a.color }}>{a.emoji} {a.title} · {a.n} OF {ACTIVITIES.length} · YOUR CALL</div>
          <div className="mt-0.5 text-center text-[12px] text-paper/55">{a.world}</div>
          <p className="mx-auto mt-3 max-w-[30ch] text-center font-cond text-[clamp(22px,3.4vw,30px)] font-semibold leading-tight">{a.question.text}</p>
          <div className={`mt-5 grid gap-2 ${a.choices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {a.choices.map((c, k) => (
              <motion.button key={c.id} type="button" disabled={!done} onClick={() => onChoose(c)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: done ? 1 : 0.45, y: 0 }} transition={{ delay: 0.15 + k * 0.08 }}
                className="rounded-2xl border-2 border-white/15 bg-white/[.04] p-4 text-left transition-colors enabled:hover:bg-white/[.08] disabled:cursor-not-allowed"
                onMouseEnter={(e) => { if (done) e.currentTarget.style.borderColor = a.color; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}>
                <div className="font-mono text-[10px] font-bold tracking-wider text-paper/45">OPTION {String.fromCharCode(65 + k)}</div>
                <div className="mt-0.5 font-cond text-[20px] font-bold leading-tight">{c.label}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-paper/65">{c.sub}</div>
              </motion.button>
            ))}
          </div>
          <div className="mt-3 text-center text-[12.5px] text-paper/50">
            {done ? "Pick one. Then drive it." : "🔊 Listen first…"}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** What this function means, what I did, and why it matters to you. Next unlocks once it has been heard. */
function ExplainCard({ a, c, s, role, talk, onNext, onMore }: { a: Activity; c: Choice; s: Score; role: RoleId; talk: boolean; onNext: () => void; onMore: () => void }) {
  const roleLabel = ROLES.find((x) => x.id === role)?.label ?? "your team";
  const lines: Line[] = [...a.explain, { key: `${a.key}-fit-${role}`, text: a.fit[role] }];
  const { i, done } = useNarration(lines, talk);
  const nx = ACTIVITIES[a.n];
  const best = a.choices.find((x) => x.best)!;
  const yours = a.key === "road" ? (c.best ? "You took the mountain pass. So did I." : `The ${c.label.toLowerCase()} got you ${Math.round(s.prog * 100)}% of the way. I took the mountain pass.`)
    : a.key === "funnel" ? (c.best ? `You fixed the leaks: conversion hit ${s.conv}%.` : `More ads kept conversion at ${s.conv}%. I went after the leak.`)
    : a.key === "orders" ? (c.best ? `One fix by hand, then the system routed round ${s.dodged}.` : `You fixed ${s.orders} problems by hand. I wrote the SOP once.`)
    : (c.best ? `You grew assets to ${cr(s.aum)} and reached the oasis.` : `Flooring it ran the tank dry ${Math.round(s.prog * 100)}% of the way. I grew what we managed.`);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Enter" && done) { e.preventDefault(); onNext(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [done, onNext]);
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/55 p-4 pt-[70px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label={`${a.vertical}: what I did`} initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-full max-w-[580px] overflow-hidden rounded-3xl bg-oil" style={{ boxShadow: `0 0 0 2px ${a.color}, 0 0 80px ${a.color}55` }}>
        <div className="p-5 md:p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${a.color}40, transparent 70%)` }}>
          <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em]" style={{ color: a.color }}>{a.emoji} {a.vertical.toUpperCase()} · WHAT I DID</div>
          <div className="mt-1 text-center text-[13.5px] text-paper/65">{yours}{!c.best && a.key !== "road" && <> <span className="text-paper/80">(My call: {best.label}.)</span></>}</div>
          <div className="mt-3 text-center font-stencil text-[clamp(34px,6vw,46px)] leading-none" style={{ color: a.color }}>{a.result[0]}</div>
          <div className="text-center text-[13.5px] text-paper/70">{a.result[1]}</div>
          <ol className="mt-4 space-y-1.5">
            {a.explain.map((l, k) => (
              <motion.li key={l.key} initial={{ opacity: 0.25 }} animate={{ opacity: i >= k ? 1 : 0.25 }} className="flex items-start gap-2.5 text-[15.5px] leading-snug">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold text-ink" style={{ background: i >= k ? a.color : "rgba(255,255,255,.2)" }}>{k + 1}</span>
                <span className={i === k ? "font-semibold text-paper" : "text-paper/85"}>{l.text}</span>
              </motion.li>
            ))}
          </ol>
          <motion.div animate={{ opacity: i >= a.explain.length ? 1 : 0.3 }} className="mt-4 rounded-xl border-l-4 bg-white/[.05] p-3" style={{ borderColor: a.color }}>
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-hazard">FOR YOUR {roleLabel.toUpperCase()} ROLE</div>
            <p className="mt-1 text-[15px] leading-snug">{a.fit[role]}</p>
          </motion.div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={onMore} className="rounded-full border border-white/25 px-4 py-2.5 font-mono text-[11px] hover:border-hazard">THE FULL STORY</button>
            <button type="button" onClick={onNext} disabled={!done} className="rounded-full px-5 py-2.5 font-mono text-[12px] font-bold tracking-wider text-ink transition-opacity disabled:opacity-60" style={{ background: nx ? nx.color : "#36c8ff" }}>
              {done ? (nx ? `NEXT: ${nx.emoji} ${nx.title} →` : "📊 THE LAST WORD →") : `🔊 LISTENING · ${Math.min(i + 1, lines.length)}/${lines.length}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The scoreboard for the current game. */
function ScoreCard({ a, s, c }: { a: Activity; s: Score; c: Choice | null }) {
  const bar = (v: number, max: number, col: string, mark?: number) => (
    <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-white/10">
      <motion.div className="h-full rounded-full" style={{ background: col }} animate={{ width: `${Math.min(100, (v / max) * 100)}%` }} transition={{ type: "spring", stiffness: 90, damping: 15 }} />
      {mark !== undefined && <span className="absolute inset-y-0 w-[2px] bg-white" style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  );
  const lab = "font-mono text-[10px] tracking-[0.15em] text-paper/60";
  return (
    <div className="pointer-events-none absolute left-4 top-[118px] z-10 hidden w-[250px] rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur md:left-7 md:block">
      <div className="font-mono text-[10px] font-bold tracking-[0.18em]" style={{ color: a.color }}>YOUR CALL</div>
      <div className="font-cond text-[17px] font-bold leading-tight">{c?.label}</div>
      {a.key === "road" && <><div className="mt-2 flex justify-between"><span className={lab}>DISTANCE TO MARKET LEAD</span><b className="font-stencil" style={{ color: a.color }}>{Math.round(s.prog * 100)}%</b></div>{bar(s.prog, 1, a.color)}
        {s.rivals > 0 && <div className="mt-1 text-[12px] text-rust">Stuck behind {s.rivals} funded rivals</div>}</>}
      {a.key === "funnel" && <><div className="mt-2 flex justify-between"><span className={lab}>CONVERSION · TARGET 50%</span><b className="font-stencil" style={{ color: a.color }}>{s.conv}%</b></div>{bar(s.conv, 60, a.color, 50)}</>}
      {a.key === "orders" && <><div className="mt-2 flex justify-between"><span className={lab}>FIXED BY HAND</span><b className="font-stencil text-rust">{s.orders}</b></div>
        <div className="flex justify-between"><span className={lab}>{s.auto ? "ROUTED BY THE SYSTEM" : "DODGED"}</span><b className="font-stencil" style={{ color: a.color }}>{s.dodged}</b></div></>}
      {a.key === "runway" && <><div className="mt-2 flex justify-between"><span className={lab}>ASSETS MANAGED</span><b className="font-stencil" style={{ color: a.color }}>{cr(s.aum)}</b></div>{bar(s.aum, 250, a.color)}
        <div className="mt-2 flex justify-between"><span className={lab}>FUEL = RUNWAY</span><b className={`font-mono text-[12px] ${s.fuel < 10 ? "text-rust" : ""}`}>{Math.round(s.fuel)}%</b></div>{bar(s.fuel, 100, s.fuel < 10 ? "#ef5350" : s.fuel < 30 ? "#ffca28" : "#66bb6a")}</>}
    </div>
  );
}

/** The data layer: always on screen while playing, because data is under every activity. */
function Gauges({ kmh, a, s }: { kmh: number; a: Activity; s: Score }) {
  const kpi: [number, string, string] = a.key === "road" ? [s.prog, `${Math.round(s.prog * 100)}%`, "PROGRESS"]
    : a.key === "funnel" ? [s.conv / 50, `${s.conv}%`, "CONVERSION"]
    : a.key === "orders" ? [1 - s.orders / 6, `${s.orders} BY HAND`, "FIREFIGHTS"] : [s.fuel / 100, `${Math.round(s.fuel)}%`, "RUNWAY"];
  const dial = (frac: number, c: string, label: string, val: string) => {
    const f = Math.max(0, Math.min(1, frac)), ang = f * 240 - 120;
    return (
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 80 62" className="h-[50px] w-[64px]" aria-hidden="true">
          <path d="M12 54 A32 32 0 1 1 68 54" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" strokeLinecap="round" />
          <path d="M12 54 A32 32 0 1 1 68 54" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" pathLength={100} strokeDasharray={`${f * 100} 100`} />
          <line x1="40" y1="38" x2={40 + Math.sin((ang * Math.PI) / 180) * 22} y2={38 - Math.cos((ang * Math.PI) / 180) * 22} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="38" r="3.5" fill="#fff" />
        </svg>
        <div className="-mt-1 max-w-[76px] truncate font-stencil text-[14px] leading-none">{val}</div>
        <div className="font-mono text-[8.5px] tracking-wider text-paper/55">{label}</div>
      </div>
    );
  };
  return (
    <div className="pointer-events-none absolute bottom-[90px] right-4 z-10 rounded-2xl border border-[#36c8ff55] bg-black/60 px-3 pb-2 pt-1.5 backdrop-blur md:bottom-auto md:right-7 md:top-[118px]" aria-hidden="true">
      <div className="text-center font-mono text-[9px] font-bold tracking-[0.2em] text-[#36c8ff]">📊 THE DATA I WATCH</div>
      <div className="mt-1 flex gap-1">{dial(kmh / 120, "#36c8ff", "KM/H", String(Math.round(kmh)))}{dial(kpi[0], a.color, kpi[2], kpi[1])}</div>
    </div>
  );
}

/** After the four: data was under all of it. */
function DataCard({ log, talk, onDone }: { log: { a: Activity; c: Choice; s: Score }[]; talk: boolean; onDone: () => void }) {
  const { i, done } = useNarration(DATA_FINALE.lines, talk);
  const best = log.filter((x) => x.c.best).length;
  return (
    <motion.div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4 pt-[70px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-label="Data ran every step" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-[580px] rounded-3xl border-2 border-[#36c8ff] bg-[#07111c] p-5 shadow-[0_0_80px_rgba(54,200,255,.35)] md:p-6">
        <div className="text-center font-mono text-[11px] font-bold tracking-[0.25em] text-[#36c8ff]">📊 THE LAST WORD</div>
        <div className="mt-1 text-center font-stencil text-[clamp(28px,6vw,38px)] leading-none">{DATA_FINALE.title}</div>
        <div className="mt-2 text-center text-[13.5px] text-paper/65">Your four calls: <b className="text-paper">{best} of 4</b> matched mine.</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {log.map((x) => (
            <div key={x.a.n} className="rounded-lg border bg-[#0c1a2a] p-2 text-center" style={{ borderColor: `${x.a.color}55` }}>
              <div className="text-[16px]">{x.a.emoji}</div><div className="font-cond text-[13px] font-semibold leading-tight">{x.c.label}</div><div className="mt-0.5 text-[11px]" style={{ color: x.c.best ? "#2bff88" : "#ffca28" }}>{x.c.best ? "✓ my call too" : "different road"}</div>
            </div>
          ))}
        </div>
        <ol className="mt-4 space-y-1.5">
          {DATA_FINALE.lines.map((l, k) => <motion.li key={l.key} animate={{ opacity: i >= k ? 1 : 0.25 }} className="text-[15.5px] leading-snug">{l.text}</motion.li>)}
        </ol>
        <div className="mt-3 grid grid-cols-3 gap-2">{DATA_FINALE.proof.map(([b, l]) => <div key={l} className="rounded-lg bg-white/[.05] p-2 text-center"><div className="font-stencil text-[15px] text-[#2bff88]">{b}</div><div className="mt-0.5 text-[11px] leading-tight text-paper/60">{l}</div></div>)}</div>
        <div className="mt-5 text-center">
          <button type="button" onClick={onDone} disabled={!done} className="rounded-full bg-hazard px-6 py-3 font-mono text-[12.5px] font-bold tracking-wider text-ink disabled:opacity-60">{done ? "SEE WHY I FIT YOUR TEAM →" : `🔊 LISTENING · ${Math.min(i + 1, 4)}/4`}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
