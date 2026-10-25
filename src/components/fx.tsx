import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useSpring, animate } from "framer-motion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$@";

/** Cycles random uppercase glyphs, settling left to right on `text`. */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    let frame = 0, raf = 0;
    const total = text.length * 3 + 10;
    const tick = () => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      setOut(text.split("").map((ch, i) => (i < settled || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(""));
      if (frame < total) raf = window.setTimeout(tick, 34);
      else setOut(text);
    };
    tick();
    return () => clearTimeout(raf);
  }, [text]);
  return <span className={className} aria-label={text}>{out}</span>;
}

/** Character-staggered typewriter that remounts on a loop. */
export function Typewriter({ text, every = 9000, className }: { text: string; every?: number; className?: string }) {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setInterval(() => setK((v) => v + 1), every); return () => clearInterval(id); }, [every]);
  return (
    <p className={className} aria-label={text}>
      <span key={k} aria-hidden="true">
        {text.split("").map((c, i) => (
          <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02, duration: 0.05 }}>{c}</motion.span>
        ))}
        <motion.span className="inline-block w-[0.55em] h-[1em] -mb-[0.15em] ml-1 bg-lime" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} />
      </span>
    </p>
  );
}

/** Fade-and-rise when scrolled into view. */
export function Reveal({ children, delay = 0, y = 40, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "article" }) {
  const C = motion[as];
  return (
    <C className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.9, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </C>
  );
}

/** Headline whose words slide up out of a mask. */
export function SplitWords({ text, className, accent = [] as string[] }: { text: string; className?: string; accent?: string[] }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <h2 ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-top pb-[0.06em] mr-[0.22em]">
          <motion.span className={"inline-block " + (accent.includes(w) ? "text-lime" : "")} initial={{ y: "110%" }} animate={inView ? { y: 0 } : {}} transition={{ duration: 0.9, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}>
            {w}
          </motion.span>
        </span>
      ))}
    </h2>
  );
}

export function Counter({ to, pre = "", suf = "", pad = false }: { to: number; pre?: string; suf?: string; pad?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{pre}{pad && v < 10 ? "0" + v : v}{suf}</span>;
}

/** Section label: [01] — WORK */
export function Tag({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs tracking-[0.2em] uppercase text-white/50">
      <span className="text-lime">[{n}]</span><span className="h-px w-10 bg-white/25" /><span>{children}</span>
    </div>
  );
}

/** Lime ring cursor that swells over interactive elements (fine pointers only). */
export function Cursor() {
  const x = useMotionValue(-100), y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40 }), sy = useSpring(y, { stiffness: 500, damping: 40 });
  const [big, setBig] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setOn(true);
    const mv = (e: PointerEvent) => {
      x.set(e.clientX); y.set(e.clientY);
      const t = e.target as HTMLElement | null;
      setBig(!!t?.closest("a, button, input, textarea, select, [data-cursor]"));
    };
    window.addEventListener("pointermove", mv, { passive: true });
    return () => window.removeEventListener("pointermove", mv);
  }, [x, y]);
  if (!on) return null;
  return (
    <>
      <motion.div aria-hidden="true" className="fixed left-0 top-0 z-[999] pointer-events-none rounded-full border border-lime mix-blend-difference"
        style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }} animate={{ width: big ? 64 : 34, height: big ? 64 : 34, backgroundColor: big ? "rgba(204,255,0,1)" : "rgba(204,255,0,0)" }} transition={{ type: "spring", stiffness: 300, damping: 25 }} />
      <motion.div aria-hidden="true" className="fixed left-0 top-0 z-[999] pointer-events-none w-1.5 h-1.5 rounded-full bg-lime" style={{ x, y, translateX: "-50%", translateY: "-50%" }} />
    </>
  );
}
