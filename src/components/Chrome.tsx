import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Menu, Pause, Play, X } from "lucide-react";
import { A, EMAIL, LINKS } from "../data";
import { ScrambleText, Typewriter } from "./fx";

/** Pages live behind hash routes (#/work …) so the site works on any static host. */
export function scrollToId(id: string) {
  const target = id === "home" ? "#/" : "#/" + id;
  if (window.location.hash !== target) window.location.hash = target;
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- header ---------------- */
export function Header({ onDrawer, playing, onSound, started, page }: { onDrawer: () => void; playing: boolean; onSound: () => void; started: boolean; page: string }) {
  const [time, setTime] = useState("--:--:--");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let fmt: Intl.DateTimeFormat | null = null;
    try { fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }); } catch { /* ignore */ }
    const tick = () => setTime(fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8));
    tick(); const id = setInterval(tick, 1000);
    const sc = () => setScrolled(window.scrollY > 40);
    sc(); window.addEventListener("scroll", sc, { passive: true });
    return () => { clearInterval(id); window.removeEventListener("scroll", sc); };
  }, []);
  const links: [string, string][] = [["WORK", "work"], ["EXPERIENCE", "experience"], ["LABS", "labs"], ["ABOUT", "about"], ["CONTACT", "contact"]];
  return (
    <header className={"fixed inset-x-0 top-0 z-30 transition-colors duration-500 " + (scrolled ? "bg-space/70 backdrop-blur-xl border-b border-white/5" : "")} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-6 px-5 md:px-10">
        <a href="#/" onClick={(e) => { e.preventDefault(); scrollToId("home"); }} className="group mr-auto flex items-center gap-3" aria-label="Sumahar Pelluri, home">
          <span className="font-display text-xl uppercase tracking-widest">Sumahar</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-black text-lg transition-transform duration-500 group-hover:rotate-180">✦</span>
        </a>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Sections">
          {links.map(([l, id]) => (
            <a key={id} href={"#/" + id} onClick={(e) => { e.preventDefault(); scrollToId(id); }} aria-current={page === id ? "page" : undefined}
              className={"relative font-mono text-xs tracking-[0.2em] transition-colors hover:text-lime " + (page === id ? "text-lime" : "text-white/60")}>
              {l}{page === id && <motion.span layoutId="navdot" className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
            </a>
          ))}
        </nav>
        <span className="hidden font-mono text-xs text-white/50 md:inline"><span className="text-white tabular-nums">{time}</span> IST</span>
        {started && (
          <button type="button" onClick={onSound} className="hidden items-center gap-2 rounded-full border border-white/20 px-3 py-2 font-mono text-[11px] tracking-widest text-white/70 hover:border-lime hover:text-lime sm:flex" aria-label={playing ? "Pause soundtrack" : "Play soundtrack"}>
            {playing ? <Pause size={12} /> : <Play size={12} />}{playing ? "SOUND ON" : "SOUND OFF"}
          </button>
        )}
        <button type="button" onClick={onDrawer} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-mono text-xs font-medium tracking-[0.18em] text-black transition-colors hover:bg-lime">
          <span className="hidden sm:inline">HIRE ME</span><Menu size={16} className="sm:hidden" aria-label="Menu" /><span className="sm:hidden sr-only">Menu</span>
        </button>
      </div>
    </header>
  );
}

/* ---------------- hero ---------------- */
const WORDS = ["AUTOMATE", "CONVERT", "SCALE", "EARN TRUST"];
export function Hero({ onStory }: { onStory: () => void }) {
  const [w, setW] = useState(0);
  useEffect(() => { const id = setInterval(() => setW((v) => (v + 1) % WORDS.length), 4000); return () => clearInterval(id); }, []);
  return (
    <section id="top" className="relative z-10 flex h-[100svh] min-h-[620px] flex-col overflow-hidden">
      {/* lime aura behind the subject */}
      <div aria-hidden="true" className="absolute left-1/2 bottom-[-10%] z-[5] h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-lime/10 blur-[120px]" />
      {/* subject cut-out */}
      <motion.img
        src={A("img/portrait-hero-cut.png")} alt="Sumahar Pelluri in a dark suit, smiling"
        className="group absolute bottom-[8%] left-1/2 z-10 h-[62%] md:bottom-0 w-auto max-w-none object-contain brightness-95 contrast-125 grayscale drop-shadow-[0_25px_50px_rgba(0,0,0,0.5)] transition-transform duration-700 ease-out hover:scale-[1.04] sm:h-[86%] lg:h-[96%]"
        initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ x: "-50%", transformOrigin: "50% 100%" }}
      />
      {/* fade subject into the marquee */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-[15] h-[48%] bg-gradient-to-t from-space via-space/70 to-transparent md:h-40 md:via-transparent" />

      <div className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pt-[96px] md:px-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-start justify-between font-mono text-[11px] tracking-[0.2em] text-white/50">
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-space/40 px-3 py-1.5 backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />OPEN TO ROLES · 2027</span>
          <span className="hidden text-right leading-relaxed sm:block">DATA · OPERATIONS · AI<br />PGP-TBM ’27 · MASTERS’ UNION</span>
        </motion.div>

        {/* mammoth headline, set over the torso so the face stays clear */}
        <h1 className="mt-auto mb-[clamp(8px,2vh,24px)] text-center font-display uppercase leading-[0.86]" aria-label={"I build systems that " + WORDS[w].toLowerCase()}>
          <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.9 }}
            className="stroke-text block text-[clamp(30px,5.6vw,84px)] tracking-wide" aria-hidden="true">I build systems that</motion.span>
          <span className="block text-[clamp(76px,15.5vw,224px)] text-lime drop-shadow-[0_10px_40px_rgba(204,255,0,0.25)]" aria-hidden="true">
            <ScrambleText text={WORDS[w]} />
          </span>
        </h1>

        <div className="mb-[clamp(70px,12vh,150px)] grid items-end gap-4 md:grid-cols-[minmax(0,420px)_1fr_auto]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="md:rounded-2xl md:border md:border-white/10 md:bg-space/55 md:p-4 md:backdrop-blur-md">
            <Typewriter className="text-center font-sans text-[14px] leading-relaxed text-white/80 md:text-left md:text-[15px]" text="I'm Sumahar, a systems builder who turns messy manual processes into measurable, automated systems across data, operations and AI." />
          </motion.div>
          <span />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="flex justify-center gap-2 md:justify-end md:gap-3">
            <button type="button" onClick={() => scrollToId("work")} className="rounded-full bg-lime px-4 py-3 font-mono text-[11px] font-medium tracking-[0.16em] text-black transition-transform hover:-translate-y-0.5 md:px-6 md:py-3.5 md:text-xs">SEE THE WORK ↓</button>
            <button type="button" onClick={onStory} className="flex items-center gap-2 rounded-full border border-white/25 bg-space/50 px-4 py-3 font-mono text-[11px] tracking-[0.16em] backdrop-blur hover:border-lime hover:text-lime md:px-6 md:py-3.5 md:text-xs"><Play size={13} />PLAY MY STORY</button>
          </motion.div>
        </div>
      </div>
      <FooterMarquee />
    </section>
  );
}

export function FooterMarquee() {
  const line = "SUMAHAR PELLURI // SYSTEMS BUILDER // DATA · OPS · AI // ";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-30 overflow-hidden py-2">
      <div className="marquee flex w-max">
        {[0, 1].map((k) => (
          <span key={k} className="stroke-faint whitespace-nowrap pr-8 font-display text-[clamp(56px,9vw,140px)] uppercase leading-none">{line}{line}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- drawer ---------------- */
type View = "menu" | "work";
export function InfoDrawer({ open, onClose, onStory }: { open: boolean; onClose: () => void; onStory: () => void }) {
  const [view, setView] = useState<View>("menu");
  const [form, setForm] = useState({ name: "", email: "", kind: "Data / BI role", msg: "" });
  useEffect(() => {
    if (!open) { setTimeout(() => setView("menu"), 400); return; }
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const go = (id: string) => { onClose(); setTimeout(() => scrollToId(id), 250); };
  const items: [string, () => void][] = [
    ["HOME", () => go("home")], ["WORK", () => go("work")], ["EXPERIENCE", () => go("experience")], ["LABS", () => go("labs")], ["ABOUT", () => go("about")],
    ["STORY MODE", () => { onClose(); onStory(); }], ["LET'S WORK", () => setView("work")],
  ];
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `${form.kind}: hello from ${form.name || "your portfolio"}`;
    const body = `${form.msg}\n\n— ${form.name}${form.email ? " (" + form.email + ")" : ""}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const field = "w-full border-0 border-b border-white/30 bg-transparent px-0 py-3 font-sans text-lg text-white placeholder:text-white/35 focus:border-lime focus:outline-none focus:ring-0";
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-label="Menu and contact" className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto border-l border-white/5 bg-drawer sm:max-w-xl md:max-w-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-drawer/90 px-6 py-5 backdrop-blur md:px-10">
              <button type="button" onClick={() => (view === "menu" ? onClose() : setView("menu"))} className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-white/60 hover:text-lime">
                {view === "menu" ? <><Menu size={16} />MENU</> : <><ArrowLeft size={16} />BACK</>}
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 hover:border-lime hover:text-lime"><X size={18} /></button>
            </div>
            <div className="flex-1 px-6 py-8 md:px-10">
              {view === "menu" ? (
                <ul className="space-y-1">
                  {items.map(([l, fn], i) => (
                    <motion.li key={l} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
                      <button type="button" onClick={fn} className="group flex w-full items-baseline gap-5 py-2 text-left">
                        <span className="font-mono text-xs text-lime">0{i + 1}</span>
                        <span className="font-display text-[clamp(40px,6.4vw,70px)] uppercase leading-none text-white transition-all duration-300 group-hover:translate-x-3 group-hover:text-lime">{l}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <form onSubmit={send} className="space-y-8">
                  <h2 className="font-display text-6xl uppercase leading-none">Let’s <span className="text-lime">work.</span></h2>
                  <p className="text-white/60">Tell me what you’re hiring for or building. This opens your email app with the note ready to send.</p>
                  <input className={field} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  <input className={field} type="email" placeholder="Your email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <select className={field + " cursor-pointer"} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="What is this about?">
                    {["Data / BI role", "Founder's Office role", "Product role", "Collaboration", "Just saying hi"].map((o) => <option key={o} className="bg-drawer">{o}</option>)}
                  </select>
                  <textarea className={field + " min-h-[120px] resize-y"} placeholder="What's the messy process?" value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} required />
                  <button type="submit" className="w-full rounded-full bg-lime py-4 font-mono text-sm font-medium tracking-[0.2em] text-black hover:brightness-110">SEND IT →</button>
                </form>
              )}
            </div>
            <div className="grid gap-2 border-t border-white/5 px-6 py-6 font-mono text-xs tracking-wider text-white/60 md:px-10">
              <span className="select-all text-white">{EMAIL}</span>
              <div className="flex flex-wrap gap-5">
                <a href={LINKS.linkedin} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-lime">LINKEDIN <ArrowUpRight size={12} /></a>
                <a href={LINKS.github} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-lime">GITHUB <ArrowUpRight size={12} /></a>
                <a href={LINKS.boardiq} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-lime">BOARDIQ <ArrowUpRight size={12} /></a>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
