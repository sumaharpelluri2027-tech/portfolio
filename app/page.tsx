"use client";

import Image from "next/image";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Check, ChevronRight, Command, Github, Linkedin, Mail, Moon, Sun, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cases, links, metrics, projects, thinking } from "./data";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: .7, delay, ease }}>{children}</motion.div>;
}

function Counter({ value, prefix, suffix }: { value: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now: number) => { const p = Math.min((now - start) / 1100, 1); setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [inView, value]);
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { const saved = localStorage.getItem("theme"); const on = saved ? saved === "light" : matchMedia("(prefers-color-scheme: light)").matches; setLight(on); document.documentElement.dataset.theme = on ? "light" : "dark"; }, []);
  const toggle = () => { const next = !light; setLight(next); document.documentElement.dataset.theme = next ? "light" : "dark"; localStorage.setItem("theme", next ? "light" : "dark"); };
  return <button className="icon-button" onClick={toggle} aria-label={`Use ${light ? "dark" : "light"} mode`}>{light ? <Moon size={16} /> : <Sun size={16} />}</button>;
}

type CommandItem = { label: string; hint: string; action: () => void };

function CommandPalette({ open, close, devMode, setDevMode }: { open: boolean; close: () => void; devMode: boolean; setDevMode: (v: boolean) => void }) {
  const [query, setQuery] = useState("");
  const go = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); close(); };
  const external = (url: string) => { window.open(url, "_blank", "noopener,noreferrer"); close(); };
  const items: CommandItem[] = [
    { label: "Projects", hint: "P", action: () => go("lab") }, { label: "Resume / Case Files", hint: "R", action: () => go("case-files") },
    { label: "Timeline", hint: "T", action: () => go("case-files") }, { label: "Contact", hint: "C", action: () => go("contact") },
    { label: "LinkedIn", hint: "↗", action: () => external(links.linkedin) }, { label: "GitHub", hint: "↗", action: () => external(links.github) },
    { label: "BoardIQ", hint: "↗", action: () => external(projects[0].url!) }, { label: devMode ? "Exit developer mode" : "Developer mode", hint: "⌘D", action: () => { setDevMode(!devMode); close(); } }
  ];
  const filtered = items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  return <AnimatePresence>{open && <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
    <motion.div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0, scale: .97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98 }} transition={{ duration: .2 }} onMouseDown={e => e.stopPropagation()}>
      <div className="palette-search"><Command size={17} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a command…" aria-label="Search commands" /><button onClick={close} aria-label="Close"><span>ESC</span></button></div>
      <div className="palette-results"><p>NAVIGATE</p>{filtered.map((item, i) => <button key={item.label} onClick={item.action} autoFocus={!query && i === 0}><span>{item.label}</span><kbd>{item.hint}</kbd></button>)}</div>
      <div className="palette-foot"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span>SUMAHAR.OS</span></div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function Header({ openPalette }: { openPalette: () => void }) {
  return <header className="header"><a href="#top" className="brand" aria-label="Sumahar Pelluri home"><span>SP</span><div>SUMAHAR<br/>PELLURI</div></a><nav aria-label="Main navigation"><a href="#case-files">Case files</a><a href="#lab">Product lab</a><a href="#thinking">Process</a></nav><div className="header-actions"><ThemeToggle /><button className="command-button" onClick={openPalette}><Command size={14}/><span>Command</span><kbd>/</kbd></button></div></header>;
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const portraitY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  return <section id="top" className="hero" ref={ref}>
    <div className="hero-grid" aria-hidden="true" />
    <div className="hero-copy">
      <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>MISSION CONTROL / 2026</motion.p>
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, ease }}>Messy process in.<br/><em>Intelligent system out.</em></motion.h1>
      <motion.p className="hero-lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .18, ease }}>I build the connective tissue between AI, data, operations, and product—so decisions move faster and work stops leaking through the gaps.</motion.p>
      <motion.div className="hero-links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .35 }}><a className="button primary" href="#lab">Enter the product lab <ArrowDown size={15}/></a><a className="text-link" href={links.email}>Start a conversation <ArrowUpRight size={14}/></a></motion.div>
    </div>
    <motion.div className="hero-portrait" style={{ y: portraitY }}><Image src="/assets/sumahar.webp" alt="Sumahar Pelluri" fill sizes="(max-width: 800px) 80vw, 36vw" priority /><div className="portrait-tag"><span>SP / 01</span><span>GURUGRAM, IN</span></div></motion.div>
    <motion.div className="mission-panel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .7, delay: .25, ease }}>
      <div className="panel-head"><span>CURRENT MISSION</span><span className="live"><i/>ACTIVE</span></div>
      <div className="mission-main"><span>01</span><div><p>CURRENT FOCUS</p><strong>Building systems that turn ambiguity into action.</strong></div></div>
      <div className="mission-cells"><div><span>SYSTEMS ONLINE</span><b>06</b></div><div><span>LIVE PRODUCTS</span><b>05</b></div><div><span>CURRENT BUILD</span><b>PRIYA</b></div><div><span>RECENT WIN</span><b>₹3L</b></div></div>
      <div className="mission-log"><p><span>●</span> NOW</p><div>PGP-TBM ’27 · Masters’ Union</div><div>AI & Analytics Wing · Vice President</div><div>Open to Data/BI · Founder’s Office · Product</div></div>
    </motion.div>
    <div className="scroll-cue"><span>SCROLL TO INSPECT</span><i/></div>
  </section>;
}

function ProofStrip() {
  return <section className="proof" aria-label="Measured outcomes"><Reveal className="section-intro"><p className="eyebrow">SIGNAL / NOT NOISE</p><h2>Systems are only real<br/>when the numbers move.</h2></Reveal><div className="metrics">{metrics.map((m, i) => <Reveal key={m.label} className="metric" delay={i * .05}><b><Counter {...m}/></b><span>{m.label}</span><small>{m.detail}</small></Reveal>)}</div></section>;
}

function CaseFiles() {
  const [active, setActive] = useState(0);
  const c = cases[active];
  return <section id="case-files" className="case-section"><Reveal className="section-top"><div><p className="eyebrow">ARCHIVE / CASE FILES</p><h2>Not roles.<br/>Operating systems.</h2></div><p>Three environments. One pattern: find where the work breaks, build the missing layer, and measure what changes.</p></Reveal>
    <div className="case-shell"><div className="case-tabs" role="tablist" aria-label="Experience case files">{cases.map((item, i) => <button key={item.company} className={active === i ? "active" : ""} onClick={() => setActive(i)} role="tab" aria-selected={active === i}><span>0{i + 1}</span><div><b>{item.company}</b><small>{item.role}</small></div><ChevronRight size={18}/></button>)}</div>
      <AnimatePresence mode="wait"><motion.article key={c.company} className="case-file" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .35, ease }}>
        <div className="case-title"><div><p>{c.period} / {c.place}</p><h3>{c.company}</h3><span>{c.role}</span></div><span className="stamp">CASE<br/>VERIFIED</span></div>
        <div className="case-grid"><div><label>THE PROBLEM</label><p>{c.problem}</p></div><div><label>RESPONSIBILITY</label><p>{c.responsibility}</p></div><div><label>SYSTEMS BUILT</label><p>{c.built}</p></div><div><label>AUTOMATION</label><p>{c.automation}</p></div></div>
        <div className="case-impact"><label>MEASURED IMPACT</label><div>{c.impact.map(x => <span key={x}><Check size={14}/>{x}</span>)}</div></div>
        <blockquote><span>LESSON /</span> “{c.lesson}”</blockquote>
      </motion.article></AnimatePresence>
    </div>
  </section>;
}

function Architecture({ steps }: { steps: string[] }) { return <div className="architecture">{steps.map((step, i) => <div key={step}><span>{String(i + 1).padStart(2, "0")}</span><b>{step}</b>{i < steps.length - 1 && <i/>}</div>)}</div>; }

function ProductLab() {
  return <section id="lab" className="lab"><Reveal className="section-top"><div><p className="eyebrow">PRODUCT LAB / 06 BUILDS</p><h2>Ideas are cheap.<br/>Shipping is evidence.</h2></div><p>Each build starts with a broken decision or workflow. The interface is the visible edge; the system underneath is the work.</p></Reveal>
    <div className="project-list">{projects.map((p, idx) => <Reveal key={p.id}><article id={p.id} className={`project ${idx === 0 ? "featured" : ""}`}>
      <div className="project-meta"><span>{p.index}</span><span>{p.category}</span><span className={p.status === "LIVE" ? "status-live" : "status-build"}><i/>{p.status}</span></div>
      <div className="project-heading"><h3>{p.name}</h3>{p.url && <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open ${p.name}`}><ArrowUpRight/></a>}</div>
      <p className="project-thesis">“{p.thesis}”</p>
      {p.image && <div className="project-image"><Image src={p.image} alt={`${p.name} project view`} fill sizes="(max-width: 900px) 100vw, 55vw" loading="lazy"/></div>}
      <div className="project-body"><div><label>PROBLEM</label><p>{p.problem}</p></div><div className="arch-block"><label>ARCHITECTURE</label><Architecture steps={p.architecture}/></div><div><label>BUSINESS IMPACT</label><p>{p.impact}</p></div><div><label>ROADMAP</label><p>{p.roadmap}</p></div></div>
      <div className="project-foot"><div>{p.technology.map(t => <span key={t}>{t}</span>)}</div><div>{p.metrics.map(m => <b key={m}>{m}</b>)}</div></div>
    </article></Reveal>)}</div>
  </section>;
}

function Thinking() {
  const [active, setActive] = useState(0);
  return <section id="thinking" className="thinking"><Reveal className="section-intro"><p className="eyebrow">HOW MY BRAIN WORKS</p><h2>How I solve<br/>messy problems.</h2><p className="intro-copy">A repeatable loop for turning ambiguity into an operating system.</p></Reveal>
    <div className="thinking-layout"><div className="orbit" aria-hidden="true"><div className="orbit-core">DECIDE<br/>BUILD<br/>LEARN</div>{thinking.map((t, i) => <button tabIndex={-1} key={t.n} className={active === i ? "active" : ""} style={{ "--i": i } as React.CSSProperties}>{t.n}</button>)}</div>
      <div className="thinking-list">{thinking.map((t, i) => <button key={t.n} className={active === i ? "active" : ""} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}><span>{t.n}</span><div><h3>{t.title}</h3><AnimatePresence initial={false}>{active === i && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{t.text}</motion.p>}</AnimatePresence></div><ChevronRight/></button>)}</div></div>
  </section>;
}

function LiveDashboard() {
  const rows = [
    ["Priya Voice Agent", "Building", "68%", 68], ["BoardIQ", "Live / iterating", "92%", 92], ["AI & Analytics Wing", "Live", "100%", 100], ["FitGenie AI", "Live / testing", "84%", 84]
  ];
  return <section className="dashboard"><Reveal className="dashboard-head"><div><p className="eyebrow">LIVE DASHBOARD</p><h2>What’s on the bench.</h2></div><span className="live"><i/>SYSTEM ONLINE</span></Reveal><Reveal className="dashboard-shell"><div className="dash-top"><div><span>SHIPPING NEXT</span><b>Priya / production guardrails</b></div><div><span>UPDATED</span><b>SEP 2026</b></div></div><div className="dash-table"><div className="dash-row labels"><span>PROJECT</span><span>STATUS</span><span>PROGRESS</span></div>{rows.map(r => <div className="dash-row" key={String(r[0])}><b>{r[0]}</b><span><i className="row-dot"/>{r[1]}</span><div><span>{r[2]}</span><i><b style={{ width: `${r[3]}%` }}/></i></div></div>)}</div><div className="update-log"><span>RECENT UPDATES</span><p><b>01</b> Portfolio reframed as a systems product</p><p><b>02</b> Six builds documented as product cases</p><p><b>03</b> Operating metrics moved to the surface</p></div></Reveal></section>;
}

function Contact() { return <footer id="contact"><div className="contact-copy"><p className="eyebrow">OPEN CHANNEL / 2026</p><h2>Have a messy<br/>system worth fixing?</h2><p>I’m open to Data/BI, Founder’s Office, and Product roles—and to conversations with people building ambitious, useful things.</p><a className="button primary" href={links.email}>Start with an email <ArrowUpRight size={15}/></a></div><div className="contact-side"><Image src="/assets/sumahar-portrait.webp" alt="Sumahar Pelluri" fill sizes="(max-width: 800px) 100vw, 35vw"/><div className="socials"><a href={links.linkedin} target="_blank" rel="noreferrer"><Linkedin size={17}/>LinkedIn<ArrowUpRight size={14}/></a><a href={links.github} target="_blank" rel="noreferrer"><Github size={17}/>GitHub<ArrowUpRight size={14}/></a><a href={links.email}><Mail size={17}/>Email<ArrowUpRight size={14}/></a></div></div><div className="footer-bottom"><span>© 2026 SUMAHAR PELLURI</span><span>SYSTEMS BUILDER / GURUGRAM</span><a href="#top">BACK TO TOP ↑</a></div></footer>; }

export default function Home() {
  const [palette, setPalette] = useState(false); const [devMode, setDevMode] = useState(false);
  const { scrollYProgress } = useScroll(); const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: .001 });
  const keyHandler = useCallback((e: KeyboardEvent) => { if ((e.key === "/" && !(e.target instanceof HTMLInputElement)) || (e.metaKey && e.key.toLowerCase() === "k")) { e.preventDefault(); setPalette(true); } if (e.key === "Escape") setPalette(false); }, []);
  useEffect(() => { window.addEventListener("keydown", keyHandler); return () => window.removeEventListener("keydown", keyHandler); }, [keyHandler]);
  return <><motion.div className="progress" style={{ scaleX }}/><Header openPalette={() => setPalette(true)}/><main><Hero/><ProofStrip/><CaseFiles/><ProductLab/><Thinking/><LiveDashboard/></main><Contact/><CommandPalette open={palette} close={() => setPalette(false)} devMode={devMode} setDevMode={setDevMode}/>{devMode && <div className="dev-console"><button onClick={() => setDevMode(false)} aria-label="Close developer mode"><X size={13}/></button><p>&gt; SYSTEM LOGS</p><span>build.version: SYSTEMS/01</span><span>git.commit: {process.env.NEXT_PUBLIC_BUILD_SHA}</span><span>render.mode: {document?.documentElement.dataset.theme || "dark"}</span><span>status: all systems nominal</span><span>&gt; minimal_terminal enabled_</span></div>}</>;
}
