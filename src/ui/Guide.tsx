import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flag, LayoutGrid, MessageCircle, RotateCcw, X } from "lucide-react";
import { A } from "../data";
import type { StationId } from "../content";
import type { ZoneId } from "../scene/garage";

export interface TourStep { target: StationId | null; zone?: ZoneId; title: string; text: string; stat?: string; statLabel?: string; open?: boolean }

/** A 60-second walk through the garage, told in my own voice. */
export const TOUR: TourStep[] = [
  { target: "driver", title: "Hi, I'm Sumahar.", text: "Mechanical engineer turned operator. This garage is my career: every object opens something I actually built." },
  { target: "brakes", title: "My signature fix", text: "Investor data nobody trusted. I built the checks that stop bad data before it moves.", stat: "50→95%", statLabel: "data accuracy" },
  { target: "engine", title: "Work that runs itself", text: "I built Rabbit Invest's operations from zero as a founding member, then automated the repetitive work.", stat: "80%", statLabel: "manual ops automated" },
  { target: "accelerator", title: "Growth with numbers", text: "Dashboards that showed where leads dropped. Conversion went from 10% to 50%.", stat: "5×", statLabel: "sales conversion" },
  { target: "board", title: "What I've built at Masters' Union", text: "Live products, national case competitions and coursework. The big ones are up top." },
  { target: "powerbox", title: "The data underneath", text: "Flip this switch any time to see the data wiring under every part of the car." },
  { target: null, title: "Your turn.", text: "Take the buggy for a lap. Every gate shows you something about me, and the finish line has a surprise." },
];

export function GuideCard({ step, i, n, onNext, onBack, onClose, onOpen, onDrive }: { step: TourStep; i: number; n: number; onNext: () => void; onBack: () => void; onClose: () => void; onOpen: () => void; onDrive: () => void }) {
  const last = i === n - 1;
  return (
    <motion.div key={i} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.35 }}
      role="dialog" aria-label={`Tour step ${i + 1} of ${n}`}
      className="pointer-events-auto relative w-[min(380px,calc(100vw-32px))] rounded-2xl border border-hazard/50 bg-oil/95 p-4 pr-5 shadow-[0_20px_60px_rgba(0,0,0,.6)] backdrop-blur">
      <button type="button" onClick={onClose} aria-label="End the tour" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-paper/60 hover:bg-white/10 hover:text-paper"><X size={14} /></button>
      <div className="flex gap-3">
        <img src={A("me/avatar.webp")} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-hazard" />
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-hazard">TOUR · {i + 1}/{n}</div>
          <div className="font-cond text-[21px] font-semibold leading-tight">{step.title}</div>
        </div>
      </div>
      {step.stat && (
        <div className="mt-3 flex items-baseline gap-2">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }} className="font-stencil text-[40px] leading-none text-hazard">{step.stat}</motion.span>
          <span className="font-mono text-[11px] text-paper/60">{step.statLabel}</span>
        </div>
      )}
      <p className="mt-2 text-[15px] leading-snug text-paper/85">{step.text}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className="mr-auto flex gap-1">{Array.from({ length: n }).map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-hazard" : "w-1.5 bg-white/25"}`} />)}</div>
        {i > 0 && <button type="button" onClick={onBack} aria-label="Previous step" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:border-white/50"><ChevronLeft size={16} /></button>}
        {step.target && step.target !== "powerbox" && <button type="button" onClick={onOpen} className="rounded-full border border-white/25 px-3 py-2 font-mono text-[11px] hover:border-hazard">OPEN IT</button>}
        {last ? (
          <button type="button" onClick={onDrive} className="flex items-center gap-1.5 rounded-full bg-hazard px-4 py-2 font-mono text-[11px] font-bold text-ink"><Flag size={13} /> DRIVE</button>
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
            <button type="button" onClick={onList} className={item}><span className="w-[15px] text-center text-hazard">≡</span><span className="text-[14.5px]">List everything in the garage</span></button>
            <button type="button" onClick={onDrive} className={item}><Flag size={15} className="text-hazard" /><span className="text-[14.5px]">Take the buggy for a lap</span></button>
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
