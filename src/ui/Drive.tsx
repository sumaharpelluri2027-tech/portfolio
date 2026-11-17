import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LayoutGrid, RotateCcw } from "lucide-react";
import { createTrack, type GateId, type GateSpec, type Telemetry, type TrackAPI } from "../scene/track";
import { createBuggy } from "../scene/buggyEntry";
import { JOBS, type CarPart } from "../content";
import { A } from "../data";
import { BuildBoard, JobCardView, Sheet } from "./Panels";
import Achievement from "./Achievement";

const GATES: GateSpec[] = [
  { id: "steering", label: "STRATEGY", sub: "Steering" },
  { id: "accelerator", label: "GROWTH", sub: "Accelerator" },
  { id: "engine", label: "OPERATIONS", sub: "Engine" },
  { id: "fuel", label: "FINANCE", sub: "Fuel tank" },
  { id: "brakes", label: "DATA TRUST", sub: "Brakes" },
  { id: "nav", label: "AI", sub: "Navigation" },
  { id: "projects", label: "MU BUILDS", sub: "Projects board" },
  { id: "pit", label: "PIT · HIRE", sub: "The finish" },
];
const isPart = (g: GateId | null): g is GateId & CarPart => !!g && g in JOBS;
const fmt = (s: number | null) => (s == null ? "--:--.-" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`);

/** The drivable test track: every gate is a business function; the pit is where you hire the driver. */
export default function Drive({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<TrackAPI | null>(null);
  const [ready, setReady] = useState(false);
  const [tel, setTel] = useState<Telemetry | null>(null);
  const [open, setOpen] = useState<GateId | null>(null);
  const [award, setAward] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [skip, setSkip] = useState(false);
  const telRef = useRef<Telemetry | null>(null);
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const input = useRef({ throttle: 0, steer: 0, brake: false });

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2600); };
  const onGate = useCallback((id: GateId) => {
    const t = telRef.current;
    if (id === "pit") {
      const others = GATES.filter((g) => g.id !== "pit").map((g) => g.id);
      const done = others.filter((g) => t?.gatesCleared.includes(g)).length;
      if (done >= others.length) { api.current?.setPaused(true); setAward(fmt(t?.lapTime ?? null)); }
      else flash(`${others.length - done} gates to go before the pit`);
      return;
    }
    api.current?.setPaused(true);
    setOpen(id);
  }, []);

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
    return () => { t.dispose(); api.current = null; };
  }, []);
  const onGateRef = useRef(onGate); onGateRef.current = onGate;

  const resume = () => { setOpen(null); setSkip(false); api.current?.setPaused(false); };
  const press = (k: "throttle" | "steer" | "brake", v: number | boolean) => { (input.current as Record<string, number | boolean>)[k] = v; api.current?.setInput({ ...input.current }); };

  const cleared = tel?.gatesCleared ?? [];
  const next = GATES.find((g) => g.id === tel?.nextGate);
  const rpmPct = Math.min(100, ((tel?.rpm ?? 900) / 7000) * 100);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06070c]">
      <div ref={host} className="absolute inset-0" role="application" aria-label="A drivable test track. Each gate opens a part of my work. Use the work list for a non-driving view." />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-4 md:px-7" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onExit} className="mr-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/50 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><ArrowLeft size={14} /> GARAGE</button>
        <button type="button" onClick={() => api.current?.resetCar()} aria-label="Reset the car to the start" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/50 backdrop-blur hover:border-hazard"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => { api.current?.setPaused(true); setSkip(true); }} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink"><LayoutGrid size={14} /> SKIP TO THE WORK</button>
      </header>

      {/* telemetry dash: a data person's car records everything */}
      {ready && (
        <div className="pointer-events-none absolute left-4 top-20 z-10 w-[230px] rounded-xl border border-white/15 bg-black/55 p-3 font-mono text-paper backdrop-blur md:left-7" aria-live="off">
          <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-hazard"><span>TELEMETRY</span><span className="flex items-center gap-1 text-lcd"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lcd" />LIVE</span></div>
          <div className="mt-1 flex items-end gap-2"><span className="font-stencil text-5xl leading-none tabular-nums">{Math.round(tel?.speedKmh ?? 0)}</span><span className="pb-1 text-[11px] text-paper/60">KM/H · G{tel?.gear ?? 1}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-gradient-to-r from-lcd via-hazard to-rust" style={{ width: `${rpmPct}%` }} /></div>
          <div className="mt-1 text-[10px] text-paper/55">{Math.round(tel?.rpm ?? 900)} RPM</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]"><span className="text-paper/55">LAP</span><span className="text-right tabular-nums">{fmt(tel?.lapTime ?? 0)}</span><span className="text-paper/55">BEST</span><span className="text-right tabular-nums">{fmt(tel?.bestLap ?? null)}</span></div>
          <div className="mt-2 flex gap-1">{GATES.map((g) => <span key={g.id} title={g.label} className={`h-2 flex-1 rounded-sm ${cleared.includes(g.id) ? "bg-lcd" : g.id === tel?.nextGate ? "animate-pulse bg-hazard" : "bg-white/15"}`} />)}</div>
          <div className="mt-1 text-[10px] text-paper/60">{cleared.length}/{GATES.length} GATES{next ? ` · NEXT: ${next.label}` : ""}</div>
        </div>
      )}

      {/* hint + controls */}
      {ready && !open && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-center md:p-7" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
          {!coarse.current && <p className="font-mono text-[11px] tracking-[0.16em] text-paper/75">W A S D OR ARROWS TO DRIVE · SPACE HANDBRAKE · R RESET · DRIVE THROUGH A GATE TO OPEN IT</p>}
        </div>
      )}
      {ready && coarse.current && !open && (
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

      {!ready && <div className="absolute inset-0 z-30 grid place-items-center bg-[#06070c] font-mono text-[11px] tracking-[0.3em] text-paper/60">ROLLING THE BUGGY OUT…</div>}

      {/* gate cards */}
      <Sheet open={isPart(open)} onClose={resume} label="Job card">{isPart(open) && <JobCardView id={open} onBonnet={resume} />}</Sheet>
      <AnimatePresence>{(open === "projects" || skip) && <BuildBoard initial="all" onClose={resume} />}</AnimatePresence>
      <AnimatePresence>{award !== undefined && <Achievement how="track" lap={award} onClose={() => { setAward(undefined); api.current?.setPaused(false); }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-paper px-4 py-2 font-mono text-[11px] text-ink">{toast}</motion.div>}</AnimatePresence>
      <img src={A("me/avatar.webp")} alt="" className="pointer-events-none absolute right-4 top-20 z-10 hidden h-14 w-14 rounded-full object-cover ring-2 ring-hazard md:right-7 md:block" />
    </div>
  );
}
