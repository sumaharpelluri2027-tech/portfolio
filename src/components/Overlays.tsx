import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Send, X } from "lucide-react";
import { A, STORY } from "../data";
import { FACTS, quickAnswer } from "../bot";

/* ---------------- Sumahar AI ---------------- */
type Msg = { who: "me" | "ai"; text: string; typing?: boolean };
type Sample = (msgs: { role: string; content: string }[], opts: Record<string, unknown>) => Promise<{ text: string }>;
const SUGG = ["What have you shipped?", "Tell me about BoardIQ", "Why hire you for Data/BI?", "How did you automate 80%?"];

export function Chatbot({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState("");
  const sample = useRef<Sample | null>(null);
  const turns = useRef<{ role: string; content: string }[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<Sample | null> } }).claude;
    if (c && typeof c.use === "function") c.use("sample").then((fn) => { if (fn) { sample.current = fn; setLive(true); } }, () => {});
  }, []);
  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ who: "ai", text: "Hey, I'm Sumahar. Ask me about anything I've built, the numbers behind it, or whether I'd fit what you're hiring for." }]);
    if (open) setTimeout(() => input.current?.focus(), 80);
  }, [open, msgs.length]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, setOpen]);

  const setLast = (text: string) => setMsgs((m) => [...m.slice(0, -1), { who: "ai", text }]);
  const ask = (raw: string) => {
    const text = raw.trim(); if (!text || busy) return;
    setBusy(true); setQ("");
    setMsgs((m) => [...m, { who: "me", text }, { who: "ai", text: "", typing: true }]);
    const finish = () => { setBusy(false); input.current?.focus(); };
    if (live && sample.current) {
      turns.current.push({ role: "user", content: text });
      sample.current([{ role: "user", content: FACTS }, ...turns.current.slice(-10)], { cache: false, modelTier: "quick", onText: (u: { text: string }) => setLast(u.text) })
        .then((r) => { setLast(r.text); turns.current.push({ role: "assistant", content: r.text }); finish(); },
          (e: { code?: string; text?: string }) => {
            turns.current.pop();
            if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled"].includes(e.code || "")) setLive(false);
            setLast(e?.text || quickAnswer(text)); finish();
          });
    } else setTimeout(() => { setLast(quickAnswer(text)); finish(); }, 450 + Math.random() * 350);
  };

  return (
    <>
      <motion.button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="bot"
        className="fixed z-[60] flex items-center gap-2.5 rounded-full bg-lime py-1.5 pl-1.5 pr-5 font-mono text-xs font-medium tracking-[0.15em] text-black shadow-[0_10px_40px_rgba(204,255,0,0.35)]"
        style={{ right: "calc(18px + env(safe-area-inset-right))", bottom: "calc(18px + env(safe-area-inset-bottom))" }}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.8, type: "spring" }} whileHover={{ y: -3 }}>
        <img src={A("img/avatar.jpg")} alt="" className="h-9 w-9 rounded-full object-cover grayscale" /><span className="hidden sm:inline">ASK SUMAHAR AI</span><span className="sm:hidden">ASK</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div id="bot" role="dialog" aria-label="Chat with Sumahar AI" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed z-[61] flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b0820]/95 shadow-2xl backdrop-blur-xl"
            style={{ right: "calc(16px + env(safe-area-inset-right))", bottom: "calc(80px + env(safe-area-inset-bottom))", width: "min(400px, calc(100vw - 32px))", height: "min(600px, calc(100vh - 150px))" }}>
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
              <img src={A("img/avatar.jpg")} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div><div className="font-display text-lg uppercase tracking-wide">Sumahar AI</div><div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-lime"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />{live ? "LIVE AI" : "ONLINE"}</div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-white/15 hover:border-lime hover:text-lime"><X size={16} /></button>
            </div>
            <div ref={log} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={"max-w-[86%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed " + (m.who === "me" ? "self-end rounded-br-md bg-lime text-black" : "self-start rounded-bl-md bg-white/10")}>
                  {m.typing && !m.text ? <span className="flex gap-1">{[0, 1, 2].map((d) => <motion.i key={d} className="h-1.5 w-1.5 rounded-full bg-white/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.15 }} />)}</span> : m.text}
                </div>
              ))}
            </div>
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {SUGG.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:border-lime hover:text-lime">{s}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-white/10 p-3">
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask me anything about my work" aria-label="Your question" autoComplete="off"
                className="min-w-0 flex-1 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-[14.5px] placeholder:text-white/35 focus:border-lime focus:outline-none" />
              <button type="submit" disabled={busy} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime text-black disabled:opacity-50"><Send size={17} /></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- story mode ---------------- */
const STEP = 7600;
export function Story({ open, onClose, playing, onSound }: { open: boolean; onClose: () => void; playing: boolean; onSound: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (open) { setI(0); setPaused(false); } }, [open]);
  useEffect(() => {
    if (!open || paused || i >= STORY.length - 1) return;
    const t = setTimeout(() => setI((v) => v + 1), STEP);
    return () => clearTimeout(t);
  }, [open, paused, i]);
  const step = useCallback((d: number) => {
    if (lock.current) return; lock.current = true; setTimeout(() => (lock.current = false), 650);
    setI((v) => { const n = v + d; if (n >= STORY.length) { onClose(); return v; } return Math.max(0, n); });
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose, step]);
  const c = STORY[i];
  let y0: number | null = null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-label="My story in seven chapters" className="fixed inset-0 z-[80] overflow-hidden bg-[#020010] text-white"
          initial={{ clipPath: "circle(0% at 50% 50%)" }} animate={{ clipPath: "circle(150% at 50% 50%)" }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
          onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setPaused((p) => !p); }}
          onWheel={(e) => { if (Math.abs(e.deltaY) > 12) step(e.deltaY > 0 ? 1 : -1); }}
          onTouchStart={(e) => { y0 = e.touches[0].clientY; }}
          onTouchEnd={(e) => { if (y0 === null) return; const d = y0 - e.changedTouches[0].clientY; if (Math.abs(d) > 40) step(d > 0 ? 1 : -1); y0 = null; }}>
          <AnimatePresence>
            <motion.div key={c.bg + i} className="absolute inset-[-6%] bg-cover bg-center grayscale" style={{ backgroundImage: `url('${A("img/" + c.bg + ".jpg")}')` }}
              initial={{ opacity: 0, scale: 1.15 }} animate={{ opacity: 0.4, scale: 1.02 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: 1.1 }, scale: { duration: 9, ease: "linear" } }} />
          </AnimatePresence>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,0,16,0.4),rgba(2,0,16,0.95))]" />
          <div className="absolute inset-x-0 top-0 h-[6vh] bg-black" /><div className="absolute inset-x-0 bottom-0 h-[6vh] bg-black" />
          <motion.div key={"p" + i} className="absolute left-0 top-0 z-10 h-[3px] bg-lime" initial={{ width: (i / STORY.length) * 100 + "%" }} animate={{ width: ((paused ? i : i + 1) / STORY.length) * 100 + "%" }} transition={{ duration: paused ? 0.2 : STEP / 1000, ease: "linear" }} />
          <AnimatePresence mode="wait">
            <motion.div key={i} className="absolute inset-0 z-[5] flex items-center justify-center px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(8px)" }} transition={{ duration: 0.5 }}>
              <div className="max-w-5xl">
                {c.portrait && <motion.img src={A("img/portrait-hero-cut.png")} alt="" className="mx-auto mb-4 h-[34vh] w-auto grayscale contrast-125" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9 }} />}
                <div className="font-mono text-xs tracking-[0.4em] text-lime">{c.n}</div>
                {c.metric && <motion.div className="font-display text-[clamp(96px,20vw,280px)] leading-[0.85] text-lime" initial={{ scale: 0.6, opacity: 0, filter: "blur(10px)" }} animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>{c.metric}</motion.div>}
                <h2 className={"mt-4 font-display uppercase leading-[0.92] " + (c.metric ? "text-[clamp(30px,4.4vw,64px)]" : "text-[clamp(44px,7.4vw,112px)]")}>
                  {c.big.split(" ").map((w, k) => (
                    <motion.span key={k} className="mr-[0.22em] inline-block" initial={{ opacity: 0, y: "0.6em", rotate: 4, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, rotate: 0, filter: "blur(0px)" }} transition={{ delay: 0.15 + k * 0.06, duration: 0.6 }}>{w}</motion.span>
                  ))}
                </h2>
                <motion.p className="mx-auto mt-5 max-w-[56ch] text-white/70 md:text-lg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>{c.sub}</motion.p>
                {c.chips && <div className="mt-6 flex flex-wrap justify-center gap-2">{c.chips.map((x, k) => <motion.span key={x} className="rounded-full border border-lime/50 px-3 py-1.5 font-mono text-xs text-lime" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 + k * 0.08 }}>{x}</motion.span>)}</div>}
              </div>
            </motion.div>
          </AnimatePresence>
          <button type="button" onClick={onClose} className="absolute right-5 top-[calc(6vh+14px)] z-10 flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 font-mono text-xs tracking-widest hover:border-lime hover:text-lime">CLOSE <X size={14} /></button>
          <p className="absolute inset-x-0 bottom-[calc(6vh+64px)] z-10 px-6 text-center font-mono text-[10px] tracking-[0.2em] text-white/45">{paused ? "PAUSED · CLICK OR SPACE TO RESUME" : "AUTO-PLAYING · CLICK OR SPACE TO PAUSE"} · ← → TO SKIP · ESC TO EXIT</p>
          <div className="absolute inset-x-0 bottom-[calc(6vh+16px)] z-10 flex items-center justify-center gap-3">
            <button type="button" onClick={() => step(-1)} aria-label="Previous chapter" className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 hover:border-lime"><ArrowLeft size={15} /></button>
            <div className="flex gap-1.5">{STORY.map((_, k) => <button key={k} type="button" aria-label={"Chapter " + (k + 1)} onClick={() => setI(k)} className={"h-[3px] w-7 rounded " + (k === i ? "bg-lime" : "bg-white/25")} />)}</div>
            <button type="button" onClick={() => step(1)} aria-label="Next chapter" className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/40 hover:border-lime"><ArrowRight size={15} /></button>
            <button type="button" onClick={onSound} className="rounded-full border border-white/25 bg-black/40 px-3 py-2 font-mono text-[11px] tracking-widest hover:border-lime">{playing ? "SOUND ON" : "SOUND OFF"}</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- intro (once per session) ---------------- */
export function Intro() {
  const [show, setShow] = useState(() => {
    try { if (sessionStorage.getItem("sp-intro") === "1") return false; } catch { /* ignore */ }
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => { setShow(false); try { sessionStorage.setItem("sp-intro", "1"); } catch { /* ignore */ } }, 2600);
    return () => clearTimeout(t);
  }, [show]);
  const name = "SUMAHAR PELLURI";
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-lime text-black" exit={{ clipPath: "inset(0 0 100% 0)" }} transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}>
          <div className="text-center">
            <div className="flex flex-wrap justify-center font-display text-[clamp(56px,13vw,200px)] leading-[0.85]">
              {name.split("").map((ch, k) => (
                <motion.span key={k} className="inline-block" initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + k * 0.04, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>{ch === " " ? " " : ch}</motion.span>
              ))}
            </div>
            <motion.div className="mt-4 font-mono text-xs tracking-[0.4em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>DATA · OPERATIONS · AI</motion.div>
          </div>
          <button type="button" onClick={() => setShow(false)} className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-black/40 px-4 py-2 font-mono text-[11px] tracking-[0.2em]">SKIP</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
