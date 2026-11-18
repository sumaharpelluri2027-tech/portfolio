import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, X } from "lucide-react";
import { A } from "../data";
import { TRAITS } from "../traits";
import HireForm from "./Hire";

/** The ending: hiring Sumahar is the achievement the visitor unlocks. */
export default function Achievement({ how, lap, onClose }: { how: "garage" | "track"; lap?: string | null; onClose: () => void }) {
  const [claim, setClaim] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);

  // sparks / confetti in hazard yellow, paper and green
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; if (reduce) return;
    const g = c.getContext("2d")!; let raf = 0;
    const W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    const cols = ["#f2b705", "#efe9dc", "#5dff9a", "#ff8a65"];
    const ps = Array.from({ length: 160 }, () => ({ x: W / 2, y: H * 0.42, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, s: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
    const tick = () => {
      g.clearRect(0, 0, W, H); let alive = 0;
      for (const p of ps) { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y < H + 20) alive++; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (alive) raf = requestAnimationFrame(tick);
    };
    tick(); return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  return (
    <motion.div role="dialog" aria-label="Achievement unlocked: you found your next hire" className="fixed inset-0 z-[70] overflow-y-auto bg-ink/90 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <canvas ref={cv} className="pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="grid min-h-full place-items-center p-4">
      <motion.div initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.15 }}
        className="relative w-full max-w-[820px] overflow-hidden rounded-2xl border-2 border-hazard bg-oil shadow-[0_0_80px_rgba(242,183,5,.35)]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:border-hazard"><X size={16} /></button>
        <div className="hazard h-2.5" />
        <div className="grid md:grid-cols-[260px_1fr]">
          <div className="relative h-56 overflow-hidden md:h-auto">
            <img src={A("me/studio-smile.webp")} alt="Sumahar Pelluri" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-oil/80 to-transparent md:bg-gradient-to-r md:from-transparent md:to-oil/40" />
          </div>
          <div className="p-6 md:p-7">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-hazard">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-hazard text-ink"><Trophy size={15} /></span> ACHIEVEMENT UNLOCKED
            </motion.div>
            <h2 className="mt-3 font-stencil text-[clamp(30px,4.2vw,46px)] leading-[0.95]">{how === "track" ? "YOU JUST TEST‑DROVE" : "YOU FOUND"}<br /><span className="text-hazard">YOUR NEXT HIRE.</span></h2>
            <p className="mt-3 text-[15.5px] text-paper/80">
              {how === "track" ? "Meter full: you know me 100% now. " : ""}Here's what I'd bring to your team:
            </p>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {TRAITS.map((t, k) => (
                <motion.div key={t.gate} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + k * 0.12, type: "spring", stiffness: 260, damping: 16 }}
                  className="flex items-center gap-2 rounded-lg bg-white/[.05] px-2.5 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${t.color}` }}>
                  <span className="text-[17px]">{t.emoji}</span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-tight">{t.trait}</span>
                  <span className="shrink-0 font-stencil text-[13px]" style={{ color: t.color }}>{t.stat}</span>
                </motion.div>
              ))}
            </div>
            {claim ? (
              <div className="mt-5 border-t border-white/10 pt-4"><HireForm /></div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 }} className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setClaim(true)} className="relative inline-flex items-center gap-2 rounded-full bg-hazard px-6 py-3 font-mono text-[13px] font-bold tracking-wider text-ink shadow-[0_0_30px_rgba(242,183,5,.5)] hover:brightness-110">
                  <span className="absolute inset-0 animate-ping rounded-full bg-hazard/40" aria-hidden="true" />
                  <span className="relative">CLAIM YOUR REWARD: HIRE ME</span> <ArrowRight size={16} className="relative" />
                </button>
                <span className="text-[12.5px] text-paper/55">A ready message, 30 seconds.</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      </div>
    </motion.div>
  );
}
