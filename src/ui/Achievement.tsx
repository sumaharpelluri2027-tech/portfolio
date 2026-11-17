import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, Mail, Trophy, X } from "lucide-react";
import { A, EMAIL, LINKS } from "../data";

/** The ending: hiring Sumahar is the achievement the visitor unlocks. */
export default function Achievement({ how, lap, onClose }: { how: "garage" | "track"; lap?: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
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

  const copy = () => { navigator.clipboard?.writeText(EMAIL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => {}); };
  const mail = `mailto:${EMAIL}?subject=${encodeURIComponent("Let's talk: a role for Sumahar")}&body=${encodeURIComponent("Hi Sumahar,\n\nI went through your garage and would like to talk about a role.\n\n")}`;

  return (
    <motion.div role="dialog" aria-label="Achievement unlocked: you found your next hire" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink/90 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <canvas ref={cv} className="pointer-events-none fixed inset-0" aria-hidden="true" />
      <motion.div initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.15 }}
        className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border-2 border-hazard bg-oil shadow-[0_0_80px_rgba(242,183,5,.35)]">
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
            <h2 className="mt-3 font-stencil text-[clamp(34px,5vw,50px)] leading-[0.95]">YOU FOUND YOUR<br /><span className="text-hazard">NEXT HIRE.</span></h2>
            <p className="mt-3 text-[15.5px] text-paper/80">
              {how === "track" ? "Every gate cleared. " : "All 7 systems inspected. "}
              Every part of this car was built and owned by one person. The last part is yours to fit: bring him onto your team.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="rounded border border-white/10 p-2"><div className="font-stencil text-xl text-hazard">7/7</div>systems</div>
              <div className="rounded border border-white/10 p-2"><div className="font-stencil text-xl text-hazard">{lap ?? "50→95%"}</div>{lap ? "your lap" : "data trust"}</div>
              <div className="rounded border border-white/10 p-2"><div className="font-stencil text-xl text-hazard">2027</div>available</div>
            </div>
            <p className="mt-4 font-mono text-[11px] tracking-wider text-paper/55">REWARD: SUMAHAR PELLURI · FOUNDER'S OFFICE · OPERATIONS · STRATEGY · DATA</p>
            {claim ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-hazard/60 bg-black/40 p-4">
                <div className="font-mono text-[10px] tracking-[0.2em] text-hazard">REWARD CLAIMED · HERE'S HOW TO REACH ME</div>
                <div className="mt-2 select-all break-all font-cond text-[19px] font-semibold text-paper">{EMAIL}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-hazard px-4 py-2 font-mono text-xs font-bold text-ink">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "COPIED" : "COPY EMAIL"}</button>
                  <a href={mail} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 font-mono text-xs hover:border-hazard"><Mail size={14} /> OPEN EMAIL APP</a>
                </div>
                <p className="mt-2 text-[12.5px] text-paper/60">Or message me on LinkedIn. </p>
              </motion.div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {!claim && <button type="button" onClick={() => setClaim(true)} className="inline-flex items-center gap-2 rounded-full bg-hazard px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-ink hover:brightness-110"><Mail size={14} /> CLAIM YOUR REWARD</button>}
              <a href={LINKS.linkedin} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-white/25 px-4 py-2.5 font-mono text-xs hover:border-hazard">LINKEDIN <ArrowUpRight size={13} /></a>
              <a href="#/specs" className="inline-flex items-center gap-1 rounded-full border border-white/25 px-4 py-2.5 font-mono text-xs hover:border-hazard">SPEC SHEET</a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
