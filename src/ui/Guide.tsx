import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as voice from "../narrate";
import { ChevronLeft, ChevronRight, Download, FileText, Flag, LayoutGrid, MessageCircle, Pause, Play, RotateCcw, Route, Volume2, VolumeX, X } from "lucide-react";
import { A, JOURNEY } from "../data";
import type { StationId } from "../content";
import { SECTIONS } from "./Sections";
import type { ZoneId } from "../scene/garage";

export interface TourStep { target: StationId | null; zone?: ZoneId; title: string; lines: { key: string; text: string }[]; stat?: string; statLabel?: string; open?: boolean }

/** A one-minute walk through the garage: short spoken lines, one stop at a time. */
export const TOUR: TourStep[] = [
  { target: "journey", title: "💼 Work-ex", stat: "50→95%", statLabel: "data accuracy at Rabbit Invest", lines: [
    { key: "tour-1a", text: "This road map is my career." }, { key: "tour-1b", text: "Myntra, then Wipro, then Rabbit Invest." }, { key: "tour-1c", text: "There I built ops from zero, and became Lead." }] },
  { target: "brakes", title: "🔧 The car is my work", stat: "80%", statLabel: "manual ops automated", lines: [
    { key: "tour-2a", text: "Each part of this buggy is a job I did." }, { key: "tour-2b", text: "Click any part for the full story." }] },
  { target: "driver", title: "🎓 Education", lines: [
    { key: "tour-3a", text: "Mechanical engineer from VIT." }, { key: "tour-3b", text: "Now a PGP at Masters' Union." }] },
  { target: "trophies", title: "🏆 Achievements", stat: "AIR 8", statLabel: "BAJA SAE India", lines: [
    { key: "tour-4a", text: "BAJA: All India Rank 8." }, { key: "tour-4b", text: "Case rounds, and a deadlift first place." }] },
  { target: "crew", title: "🎯 Co-curriculars", lines: [
    { key: "tour-5a", text: "I lead the AI and Analytics Wing." }, { key: "tour-5b", text: "I also sold for our D2C brand, Decco." }] },
  { target: "laptop", title: "✉️ Contact", lines: [
    { key: "tour-6a", text: "My CV, email and WhatsApp are here." }, { key: "tour-6b", text: "Or just ask me anything." }] },
  { target: null, title: "🏁 Now see how I think", lines: [
    { key: "tour-7a", text: "Four quick games. One founder's call each." }, { key: "tour-7b", text: "Then I tell you what I actually did." }] },
];

export function GuideCard({ step, i, n, onNext, onBack, onClose, onOpen, onDrive }: { step: TourStep; i: number; n: number; onNext: () => void; onBack: () => void; onClose: () => void; onOpen: () => void; onDrive: () => void }) {
  const last = i === n - 1;
  const [line, setLine] = useState(-1);
  const [heard, setHeard] = useState(false);
  const [paused, setPaused] = useState(false);
  const [talk, setTalk] = useState(!voice.isMuted());
  // speak this stop's lines; then move on by itself (unless paused, or it's the last stop)
  useEffect(() => {
    let alive = true;
    voice.sayAll(step.lines, (k) => { if (alive) setLine(k); }).then((ok) => { if (alive && ok !== false) { setLine(step.lines.length); setHeard(true); } });
    return () => { alive = false; voice.stop(); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextRef = useRef(onNext); nextRef.current = onNext;
  useEffect(() => { if (!heard || paused || last) return; const id = window.setTimeout(() => nextRef.current(), 900); return () => window.clearTimeout(id); }, [heard, paused, last]);
  return (
    <motion.div key={i} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.35 }}
      role="dialog" aria-label={`Tour step ${i + 1} of ${n}`}
      className="pointer-events-auto relative w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-hazard/60 bg-oil/95 p-4 pr-5 shadow-[0_20px_60px_rgba(0,0,0,.6),0_0_40px_rgba(242,183,5,.18)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 flex gap-1 p-1.5">{Array.from({ length: n }).map((_, k) => (
        <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"><motion.span className="block h-full bg-hazard" initial={false} animate={{ width: k < i ? "100%" : k === i ? `${Math.max(0, Math.min(1, (line + (heard ? 1 : 0.5)) / step.lines.length)) * 100}%` : "0%" }} transition={{ duration: 0.6 }} /></span>
      ))}</div>
      <div className="absolute right-2.5 top-4 flex gap-1">
        <button type="button" onClick={() => { const v = !talk; setTalk(v); voice.setMuted(!v); }} aria-label={talk ? "Mute the narrator" : "Turn the narrator on"} className="grid h-7 w-7 place-items-center rounded-full text-paper/60 hover:bg-white/10 hover:text-paper">{talk ? <Volume2 size={14} /> : <VolumeX size={14} />}</button>
        <button type="button" onClick={onClose} aria-label="End the tour" className="grid h-7 w-7 place-items-center rounded-full text-paper/60 hover:bg-white/10 hover:text-paper"><X size={14} /></button>
      </div>
      <div className="mt-2 flex gap-3">
        <span className="relative h-12 w-12 shrink-0">
          <img src={A("me/avatar.webp")} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-hazard" />
          {!heard && talk && <motion.span className="absolute -inset-1 rounded-full border-2 border-hazard" animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }} transition={{ repeat: Infinity, duration: 1.2 }} />}
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-hazard">TOUR · {i + 1}/{n}</div>
          <div className="font-cond text-[22px] font-semibold leading-tight">{step.title}</div>
        </div>
      </div>
      {step.stat && (
        <div className="mt-3 flex items-baseline gap-2">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }} className="font-stencil text-[40px] leading-none text-hazard">{step.stat}</motion.span>
          <span className="font-mono text-[11px] text-paper/60">{step.statLabel}</span>
        </div>
      )}
      <ul className="mt-2 space-y-1">
        {step.lines.map((l, k) => <motion.li key={l.key} animate={{ opacity: line >= k ? 1 : 0.3 }} className={`text-[15.5px] leading-snug ${line === k ? "font-semibold text-paper" : "text-paper/85"}`}>{l.text}</motion.li>)}
      </ul>
      <div className="mt-4 flex items-center gap-2">
        {i > 0 && <button type="button" onClick={onBack} aria-label="Previous step" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:border-white/50"><ChevronLeft size={16} /></button>}
        {!last && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume the tour" : "Pause the tour"} className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:border-white/50">{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
        <span className="mr-auto font-mono text-[10px] text-paper/45">{last ? "" : paused ? "PAUSED" : heard ? "NEXT STOP…" : "🔊 LISTENING"}</span>
        {step.target && step.target !== "powerbox" && <button type="button" onClick={onOpen} className="rounded-full border border-white/25 px-3 py-2 font-mono text-[11px] hover:border-hazard">OPEN IT</button>}
        {last ? (
          <button type="button" onClick={onDrive} className="flex items-center gap-1.5 rounded-full bg-hazard px-4 py-2 font-mono text-[11px] font-bold text-ink"><Flag size={13} /> PLAY THE 4 GAMES</button>
        ) : (
          <button type="button" onClick={onNext} className="flex items-center gap-1 rounded-full bg-hazard px-4 py-2 font-mono text-[11px] font-bold text-ink">NEXT <ChevronRight size={14} /></button>
        )}
      </div>
    </motion.div>
  );
}

/** First greeting, and the small "need a hand?" button after. */
export function Greeting({ onTour, onExplore }: { onTour: () => void; onExplore: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ delay: 0.4 }}
      className="pointer-events-auto w-[min(380px,calc(100vw-32px))] rounded-2xl border border-hazard/50 bg-oil/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,.6)] backdrop-blur">
      <div className="flex gap-3">
        <img src={A("me/avatar.webp")} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-hazard" />
        <div>
          <div className="font-cond text-[21px] font-semibold leading-tight">Hey, I'm Sumahar 👋</div>
          <p className="mt-1 text-[14.5px] leading-snug text-paper/80">This garage is my career. Want me to show you around? It takes about a minute.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onTour} className="flex-1 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11.5px] font-bold text-ink">SHOW ME AROUND</button>
        <button type="button" onClick={onExplore} className="rounded-full border border-white/25 px-4 py-2.5 font-mono text-[11.5px] hover:border-white/50">I'LL EXPLORE</button>
      </div>
    </motion.div>
  );
}

export function HelpMenu({ open, setOpen, onTour, onProjects, onDrive, onAsk, onList }: { open: boolean; setOpen: (v: boolean) => void; onTour: () => void; onProjects: () => void; onDrive: () => void; onAsk: () => void; onList: () => void }) {
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5";
  return (
    <div className="pointer-events-auto relative">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-[calc(100%+10px)] left-0 w-[260px] rounded-xl border border-white/15 bg-oil/95 p-2 backdrop-blur">
            <button type="button" onClick={onTour} className={item}><RotateCcw size={15} className="text-hazard" /><span className="text-[14.5px]">Give me the tour</span></button>
            <button type="button" onClick={onProjects} className={item}><LayoutGrid size={15} className="text-hazard" /><span className="text-[14.5px]">Show me your projects</span></button>
            <button type="button" onClick={onAsk} className={item}><MessageCircle size={15} className="text-hazard" /><span className="text-[14.5px]">Let me ask you something</span></button>
            <button type="button" onClick={onList} className={item}><Route size={15} className="text-hazard" /><span className="text-[14.5px]">My career journey</span></button>
            <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className={item}><FileText size={15} className="text-hazard" /><span className="text-[14.5px]">Download my CV</span></a>
            <button type="button" onClick={onDrive} className={item}><Flag size={15} className="text-hazard" /><span className="text-[14.5px]">Take it for a drive: 4 quick games</span></button>
          </motion.div>
        )}
      </AnimatePresence>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 rounded-full border border-white/20 bg-oil/85 py-1.5 pl-1.5 pr-4 backdrop-blur hover:border-hazard">
        <img src={A("me/avatar.webp")} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-hazard" />
        <span className="font-mono text-[11px] tracking-wider">NEED A HAND?</span>
      </button>
    </div>
  );
}

/** The first thing a visitor sees once the shutter is up: who I am, my road so far, and four clear ways in. */
export function QuickView({ onTour, onProjects, onJourney, onDrive, onClose, onSection, onStory }: { onTour: () => void; onProjects: () => void; onJourney: () => void; onDrive: () => void; onClose: () => void; onSection: (station: StationId) => void; onStory: () => void }) {
  const big = "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto absolute inset-0 z-[35] grid place-items-center overflow-y-auto bg-black/35 p-4">
      <motion.div role="dialog" aria-label="Quick view: who I am" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.45, delay: 0.15 }}
        className="relative w-full max-w-[640px] rounded-2xl border border-hazard/50 bg-oil/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,.6)] backdrop-blur md:p-6">
        <button type="button" onClick={onClose} aria-label="Close and look around" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-paper/60 hover:bg-white/10 hover:text-paper"><X size={16} /></button>
        <div className="flex items-center gap-4">
          <img src={A("me/avatar.webp")} alt="Sumahar Pelluri" className="h-[72px] w-[72px] shrink-0 rounded-full object-cover ring-2 ring-hazard" />
          <div className="min-w-0">
            <div className="font-cond text-[26px] font-semibold leading-tight">Hi, I'm Sumahar 👋</div>
            <p className="text-[14.5px] leading-snug text-paper/75">Mechanical engineer turned operator. I fix data at the source, automate the repeat work and ship AI products. Looking for Founder's Office, data or strategy &amp; ops roles.</p>
          </div>
        </div>
        {/* the road so far, at a glance */}
        <button type="button" onClick={onJourney} className="group mt-4 block w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left hover:border-hazard/60">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-hazard"><span>MY CAREER JOURNEY</span><span className="text-paper/50 group-hover:text-hazard">OPEN →</span></div>
          <ol className="relative mt-2.5 grid grid-cols-5 gap-1">
            <span className="absolute left-[10%] right-[10%] top-[17px] h-[3px] bg-[repeating-linear-gradient(90deg,#f2b705_0_8px,transparent_8px_14px)]" aria-hidden="true" />
            {JOURNEY.map((s, i) => (
              <li key={s.where} className="relative flex flex-col items-center text-center">
                <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full bg-white p-1 ${i === JOURNEY.length - 1 ? "ring-2 ring-hazard" : ""}`}>{s.logo && <img src={A(`logos/${s.logo}.png`)} alt="" className="max-h-6 w-auto" />}</span>
                <span className="mt-1.5 font-cond text-[13px] font-semibold leading-tight">{s.where.replace(", Vellore", "")}</span>
                <span className="font-mono text-[9.5px] leading-tight text-paper/55">{s.when.replace("Now · class of ", "Now · '").replace("Jan – Jun ", "").replace(/Jan |Jul /g, "")}</span>
              </li>
            ))}
          </ol>
        </button>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([["50→95%", "data accuracy"], ["80%", "manual ops automated"], ["5×", "sales conversion"]] as const).map(([b, l]) => (
            <div key={l} className="rounded-lg bg-white/[.04] px-2 py-2"><div className="font-stencil text-[22px] leading-none text-hazard">{b}</div><div className="mt-1 text-[11.5px] leading-tight text-paper/60">{l}</div></div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[10px] tracking-[0.2em] text-paper/55">IN THE GARAGE</div>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" onClick={() => onSection(x.station as StationId)} className="rounded-lg border border-white/15 bg-white/[.03] px-1 py-2 text-center hover:border-hazard">
              <div className="text-[18px] leading-none">{x.emoji}</div><div className="mt-1 font-cond text-[13px] font-semibold leading-tight">{x.label}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onTour} className={`${big} border-transparent bg-hazard text-ink hover:brightness-110`}><Play size={18} /><span><span className="block font-mono text-[12px] font-bold tracking-wider">60-SECOND TOUR</span><span className="block text-[12px] opacity-75">I'll walk you through it</span></span></button>
          <button type="button" onClick={onProjects} className={`${big} border-white/20 hover:border-hazard`}><LayoutGrid size={18} className="text-hazard" /><span><span className="block font-mono text-[12px] font-bold tracking-wider">MY PROJECTS</span><span className="block text-[12px] text-paper/60">The big five, then the rest</span></span></button>
          <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className={`${big} border-white/20 hover:border-hazard`}><Download size={18} className="text-hazard" /><span><span className="block font-mono text-[12px] font-bold tracking-wider">DOWNLOAD CV</span><span className="block text-[12px] text-paper/60">One page, PDF</span></span></a>
          <button type="button" onClick={onDrive} className={`${big} border-white/20 hover:border-hazard`}><Flag size={18} className="text-hazard" /><span><span className="block font-mono text-[12px] font-bold tracking-wider">TEST-DRIVE ME</span><span className="block text-[12px] text-paper/60">Drive to learn what I do, or auto-run</span></span></button>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
          <button type="button" onClick={onStory} className="font-mono text-[11px] tracking-wider text-hazard underline decoration-hazard/40 underline-offset-4">▶ HEAR MY STORY AGAIN</button>
          <button type="button" onClick={onClose} className="font-mono text-[11px] tracking-wider text-paper/55 underline decoration-white/25 underline-offset-4 hover:text-paper">I'LL LOOK AROUND MYSELF</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
