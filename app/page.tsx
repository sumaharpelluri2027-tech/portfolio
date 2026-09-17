"use client";

import Image from "next/image";
import { ArrowUpRight, ArrowRight, Command, Moon, Sun, X, Workflow, Radio, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { links, projects } from "./data";
import AmbientControls from "./ambient-controls";
import ExploreSection from "./explore-sections";

const sections = [
  { id: "home", label: "Mission control", number: "00" },
  { id: "lab", label: "Product lab", number: "01" },
  { id: "experience", label: "Case files", number: "02" },
  { id: "impact", label: "The numbers", number: "03" },
  { id: "process", label: "My operating system", number: "04" },
  { id: "contact", label: "Let’s talk", number: "05" },
];
const brands = [
  { name: "Rabbit Invest", file: "rabbit-invest", caption: "FOUNDING TEAM" },
  { name: "Wipro", file: "wipro", caption: "PROJECT ENGINEER" },
  { name: "Myntra", file: "myntra", caption: "DATA ANALYST" },
  { name: "Masters’ Union", file: "masters-union", caption: "PGP-TBM ’27" },
  { name: "VIT", file: "vit", caption: "EDUCATION" },
  { name: "AI & Analytics Wing", file: "ai-analytics-wing", caption: "VICE PRESIDENT" },
];
const aliases: Record<string, string> = { "case-files": "experience", thinking: "process", projects: "lab", work: "lab", skills: "process", top: "home", mission: "home" };

function Mission({ navigate }: { navigate: (id: string) => void }) {
  const [connected, setConnected] = useState(true);
  return <section className="os-mission" aria-label="Mission control">
    <div className="os-intro"><p className="os-eyebrow"><span className="os-dot" /> SYSTEMS BUILDER · GURUGRAM, INDIA</p><span className="os-edition">PERSONAL OPERATING SYSTEM / V.04</span></div>
    <div className="os-hero-grid">
      <div className="os-hero-copy"><p className="os-kicker">A little curiosity. A lot of building.</p><h1>I see the mess.<br />I build the <em>system.</em></h1><p className="os-lede">AI, data & operations. Connected into things that actually work.</p><div className="os-hero-actions"><button className="os-primary" onClick={() => navigate("lab")}>Explore my builds <ArrowUpRight size={20} /></button><button className="os-text-button" onClick={() => navigate("experience")}>See the proof <ArrowRight size={17} /></button></div><div className="os-identity"><strong>Sumahar Pelluri</strong><span>PGP-TBM ’27 · Masters’ Union<br />Vice President · AI & Analytics Wing</span></div></div>
      <div className={`os-portrait-stage ${connected ? "is-connected" : ""}`}>
        <span className="os-portrait-word" aria-hidden="true">SUMAHAR</span>
        <div className="os-radar" aria-hidden="true"><i /><i /><i /></div>
        <svg className="os-connections" viewBox="0 0 600 540" preserveAspectRatio="none" aria-hidden="true"><path d="M90 140 Q170 140 300 270 M500 120 Q420 150 300 270 M95 380 Q170 340 300 270 M510 390 Q440 310 300 270" /></svg>
        <Image className="os-person" src="/assets/sumahar-cinematic.webp" alt="AI-created portrait of Sumahar Pelluri in a navy suit" fill priority sizes="(max-width: 760px) 94vw, 48vw" />
        <span className="os-tool os-tool-one"><b>SQL</b><small>Find the signal</small></span><span className="os-tool os-tool-two"><Sparkles size={17} /><b>AI</b><small>Reason & decide</small></span><span className="os-tool os-tool-three"><b>Python</b><small>Make it repeatable</small></span><span className="os-tool os-tool-four"><Workflow size={17}/><b>APIs</b><small>Join the dots</small></span>
        <button className="os-connect" onClick={() => setConnected(!connected)} aria-pressed={connected}><span className="os-dot" />{connected ? "System connected" : "Connect the system"}<ArrowUpRight size={15}/></button><small className="os-photo-note">AI-created portrait</small>
      </div>
    </div>
    <div className="os-brand-band" aria-label="Where I have built and studied">
      <div className="os-band-title"><span>THE PLACES THAT SHAPED MY THINKING</span><i /></div>
      <div className="os-brand-track">{brands.map(brand=><div className="os-brand-mark" key={brand.file}><div className="os-logo-tile"><Image src={`/assets/logos/${brand.file}.png`} alt={brand.name} width={72} height={54}/></div><span><b>{brand.name}</b></span></div>)}</div>
    </div>
    <div className="os-proof-grid">
      <button className="os-proof os-proof-lime" onClick={() => navigate("impact")}><span>LESS BUSYWORK <ArrowUpRight size={18}/></span><strong>80<span>%</span></strong><p>manual work automated</p><div className="os-pixel-grid" aria-hidden="true">{Array.from({length:50}, (_,i)=><i key={i} className={i<40 ? "on" : ""}/>)}</div></button>
      <button className="os-proof" onClick={() => navigate("impact")}><span>TRUST THE INPUTS <ArrowUpRight size={18}/></span><strong>95<span>%</span></strong><p>data accuracy · up from 50%</p><div className="os-accuracy-visual" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/><circle className="os-gauge-before" cx="50" cy="50" r="30" pathLength="100"/><circle className="os-gauge-after" cx="50" cy="50" r="40" pathLength="100"/></svg><span>50 → 95</span></div></button>
      <button className="os-proof os-revenue" onClick={() => navigate("decco")}><span>FROM ZERO TO MARKET <ArrowUpRight size={18}/></span><strong>₹3<span>L</span></strong><p>Decco revenue · first 30 days</p><div className="os-decco-thumb"><Image src="/assets/decco.webp" alt="Decco Store physical stall" fill sizes="160px"/></div></button>
      <button className="os-proof os-build-card" onClick={() => navigate("priya")}><span>ON THE WORKBENCH <Radio size={18}/></span><div className="os-wave" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} style={{"--n":i} as React.CSSProperties}/>)}</div><h2>Meet Priya.</h2><p>Calls → intent → action → human.</p><small>IN BUILD <ArrowRight size={15}/></small></button>
    </div>
    <div className="os-bottom-note"><span>Explore a result to see the system behind it.</span><a href="https://youtu.be/Ec_oS-oTlYQ" target="_blank" rel="noreferrer">Watch my campaign film <ArrowUpRight size={15}/></a></div>
  </section>;
}

export default function Home() {
  const [section, setSection] = useState("home");
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [light, setLight] = useState(false);
  const [query, setQuery] = useState("");
  const [devMode, setDevMode] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const navigate = useCallback((id: string) => {
    const project = projects.find(p => p.id === id);
    const resolved = project ? "lab" : aliases[id] || id;
    setSelectedProject(project?.id);
    setSection(resolved);
    const hash = project?.id || resolved;
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, "", `#${hash}`);
    window.scrollTo({top:0, behavior:"instant"});
    dialog.current?.close();
    requestAnimationFrame(() => main.current?.focus({preventScroll:true}));
  }, []);
  useEffect(() => {
    const sync = () => { const hash = location.hash.slice(1); const id = aliases[hash] || (projects.some(p=>p.id===hash) ? "lab" : hash); setSelectedProject(projects.find(p=>p.id===hash)?.id); setSection(sections.some(s=>s.id===id) ? id : "home"); };
    sync();
    const saved = localStorage.getItem("theme");
    setLight(saved === "light"); document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
    window.addEventListener("popstate", sync); window.addEventListener("hashchange", sync);
    return () => {window.removeEventListener("popstate",sync);window.removeEventListener("hashchange",sync);};
  }, []);
  const openPalette = useCallback(() => {setQuery("");dialog.current?.showModal();requestAnimationFrame(()=>search.current?.focus());}, []);
  useEffect(() => {const onKey = (e: KeyboardEvent) => {
    const editing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
    if ((e.key === "/" && !editing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k")) {e.preventDefault();openPalette();}
  }; window.addEventListener("keydown",onKey);return ()=>window.removeEventListener("keydown",onKey);},[openPalette]);
  const toggleTheme = () => {const next=!light;setLight(next);document.documentElement.dataset.theme=next?"light":"dark";localStorage.setItem("theme",next?"light":"dark");};
  const commands = [...sections.map(s=>({label:s.label,run:()=>navigate(s.id)})),{label:"LinkedIn",run:()=>window.open(links.linkedin,"_blank","noopener,noreferrer")},{label:"GitHub",run:()=>window.open(links.github,"_blank","noopener,noreferrer")},{label:devMode?"Close system log":"Developer mode / System log",run:()=>{setDevMode(!devMode);dialog.current?.close();}}].filter(c=>c.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="os-app">
    <a className="os-skip" href="#workspace" onClick={e=>{e.preventDefault();main.current?.focus();main.current?.scrollIntoView({block:"start"});}}>Skip to content</a>
    <header className="os-header"><a className="os-brand" href="#home" onClick={e=>{e.preventDefault();navigate("home");}} aria-label="Sumahar Pelluri home"><span>SP<span className="os-brand-dot">.</span></span><div>SUMAHAR PELLURI<small>SYSTEMS BUILDER</small></div></a><div className="os-header-note"><span className="os-dot"/> OPEN TO GOOD PROBLEMS</div><div className="os-header-actions"><button onClick={toggleTheme} aria-label={`Use ${light?"dark":"light"} mode`}>{light?<Moon size={18}/>:<Sun size={18}/>}</button><button onClick={openPalette} aria-label="Open command palette"><Command size={17}/><span>Jump to</span><kbd>/</kbd></button></div></header>
    <nav className="os-nav" aria-label="Portfolio sections">{sections.map(s=><a key={s.id} href={`#${s.id}`} aria-current={section===s.id?"page":undefined} onClick={e=>{e.preventDefault();navigate(s.id);}}><span>{s.number}</span>{s.label}</a>)}</nav>
    <main id="workspace" className="os-workspace" ref={main} tabIndex={-1}><div className="os-screen" key={`${section}-${selectedProject || ""}`}>{section === "home" ? <Mission navigate={navigate}/> : <ExploreSection section={section} initialProject={selectedProject}/>}</div></main>
    <div className="os-footer"><span>© 2026 SUMAHAR PELLURI</span><span>BUILT TO CONNECT THE DOTS.</span><button onClick={openPalette}>PRESS <kbd>/</kbd> TO EXPLORE</button></div>
    <AmbientControls/>
    <dialog className="os-command-dialog" aria-label="Command palette" ref={dialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}><div className="os-command-head"><Command size={20}/><input ref={search} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Where shall we go?" aria-label="Search commands" onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();dialog.current?.querySelector<HTMLButtonElement>(".os-command-list button")?.focus();}if(e.key==="Enter"&&commands[0])commands[0].run();}}/><button onClick={()=>dialog.current?.close()} aria-label="Close command palette"><X size={20}/></button></div><div className="os-command-list" onKeyDown={e=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;e.preventDefault();const buttons=Array.from(e.currentTarget.querySelectorAll("button"));const idx=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=e.key==="Home"?0:e.key==="End"?buttons.length-1:(idx+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}}>{commands.length?commands.map(c=><button key={c.label} onClick={c.run}><span>{c.label}</span><ArrowUpRight size={18}/></button>):<p>No matching commands.</p>}</div><p className="os-command-hint">↑ ↓ to explore · Enter to open · Esc to close</p></dialog>
    {devMode&&<aside className="os-console" aria-label="System log"><button onClick={()=>setDevMode(false)} aria-label="Close system log"><X size={16}/></button><b>SUMAHAR.OS / SYSTEM LOG</b><span>version: 04 · visual workspace</span><span>build: {process.env.NEXT_PUBLIC_BUILD_SHA}</span><span>section: {section}</span><span>catalog: {projects.length} builds / {projects.filter(p=>p.status==="LIVE").length} live</span><span>soundtrack: Chasing the Horizon</span><span>theme: {light?"light":"dark"}</span></aside>}
  </div>;
}
