"use client";

import Image from "next/image";
import { ArrowUpRight, ArrowRight, AudioLines, Bot, Check, Database, Github, HeartPulse, Linkedin, Mail, ShoppingBag, Sparkles, Workflow } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";
import { cases, links, projects, thinking } from "./data";

function Tabs({ id, label, items, active, onChange, compact = false }: { id: string; label: string; items: string[]; active: number; onChange: (index: number) => void; compact?: boolean }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className={`ex-tabs ${compact ? "ex-tabs-compact" : ""}`} role="tablist" aria-label={label}>{items.map((item, index) => <button key={item} id={`${id}-tab-${index}`} ref={element => { buttons.current[index] = element; }} role="tab" aria-selected={active === index} aria-controls={`${id}-panel`} tabIndex={active === index ? 0 : -1} onClick={() => onChange(index)} onKeyDown={event => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault(); onChange(next); buttons.current[next]?.focus();
  }}><span className="ex-tab-index">{String(index + 1).padStart(2, "0")}</span>{item}</button>)}</div>;
}

function ScreenTitle({ eyebrow, title, accent, note }: { eyebrow: string; title: string; accent: string; note?: string }) {
  return <div className="ex-screen-title"><div><p className="ex-eyebrow">{eyebrow}</p><h1>{title} <em>{accent}</em></h1></div>{note && <p className="ex-title-note">{note}</p>}</div>;
}

function Flow({ steps }: { steps: string[] }) {
  return <ol className="ex-flow">{steps.map((step, index) => <li key={step} style={{ "--ex-delay": `${index * .5}s` } as CSSProperties}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < steps.length - 1 && <ArrowRight size={20} aria-hidden="true" />}</li>)}</ol>;
}

function ProjectVisual({ project }: { project: typeof projects[number] }) {
  if (project.image) return <div className={`ex-product-picture ex-picture-${project.id}`}><Image src={project.image} alt={`${project.name} product interface`} fill sizes="(max-width: 780px) 100vw, 57vw" priority={project.id === "boardiq"} /><span className="ex-picture-label"><i />{project.name} / product view</span></div>;
  const Icon = project.id === "fitgenie" ? HeartPulse : project.id === "shopper" ? ShoppingBag : AudioLines;
  return <div className={`ex-concept ex-concept-${project.id}`} aria-label={`${project.name} concept visualization`}><div className="ex-concept-ring ex-ring-one" /><div className="ex-concept-ring ex-ring-two" /><div className="ex-concept-core"><Icon size={70} strokeWidth={1} /></div>{project.id === "priya" ? <div className="ex-wave" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <i key={index} style={{ "--ex-delay": `${index * .07}s`, height: `${24 + (index % 5) * 12}px` } as CSSProperties} />)}</div> : <div className="ex-concept-pills">{project.architecture.slice(1, 4).map(item => <span key={item}>{item}</span>)}</div>}<span className="ex-picture-label">CONCEPT VISUAL / {project.category}</span></div>;
}

function ProductLab() {
  const [active, setActive] = useState(0), [detail, setDetail] = useState(0);
  const project = projects[active], projectId = useId(), detailId = useId();
  return <section className="ex-screen ex-lab" aria-label="Product lab"><ScreenTitle eyebrow="THE PRODUCT LAB / 06 BUILDS" title="Built to" accent="be used." note="Open a build. Follow the system." /><Tabs id={projectId} label="Choose a project" items={projects.map(item => item.name)} active={active} onChange={index => { setActive(index); setDetail(0); }} /><article id={`${projectId}-panel`} role="tabpanel" aria-labelledby={`${projectId}-tab-${active}`} tabIndex={0} className="ex-project-panel" key={project.id}><div className="ex-project-topline"><span>{project.category}</span><span className={`ex-status ${project.status === "IN BUILD" ? "ex-building" : ""}`}><i />{project.status}</span></div><div className="ex-project-grid"><ProjectVisual project={project} /><div className="ex-project-info"><div className="ex-project-name"><h2>{project.name}</h2>{project.url && <a className="ex-open-icon" href={project.url} target="_blank" rel="noreferrer" aria-label={`Open ${project.name}`}><ArrowUpRight size={26} /></a>}</div><p className="ex-thesis">{project.thesis}</p><div className="ex-project-proof">{project.metrics.map((metric, index) => <div key={metric}><span>{index === 0 ? <Sparkles size={17} /> : <Check size={17} />}</span><strong>{metric}</strong></div>)}</div><Tabs id={detailId} label={`${project.name} details`} items={["Overview", "System", "Next"]} active={detail} onChange={setDetail} compact /><div className="ex-project-detail" id={`${detailId}-panel`} role="tabpanel" aria-labelledby={`${detailId}-tab-${detail}`} tabIndex={0}>{detail === 0 ? <><p className="ex-detail-label">THE PROBLEM</p><p>{project.problem}</p><details><summary>What changed <ArrowRight size={15} /></summary><p>{project.impact}</p></details></> : detail === 1 ? <><div className="ex-stack">{project.technology.map(item => <span key={item}>{item}</span>)}</div><Flow steps={project.architecture} /></> : <><p className="ex-detail-label">NEXT ITERATION</p><p>{project.roadmap}</p><p className="ex-detail-label">WHY IT MATTERS</p><p>{project.impact}</p></>}</div></div></div></article></section>;
}

function ImpactBadge({ text }: { text: string }) {
  const match = text.match(/^([+\d%→ ]+)\s([A-Za-z].*)$/);
  return <div className={`ex-result ${match ? "" : "ex-result-text"}`}>{match ? <><strong>{match[1].trim()}</strong><span>{match[2]}</span></> : <><ArrowUpRight size={32} /><strong>{text}</strong></>}</div>;
}

function Experience() {
  const [active, setActive] = useState(0), [detail, setDetail] = useState(0);
  const experience = cases[active], id = useId(), detailId = useId();
  const symbols = [Database, Workflow, Bot], Icon = symbols[active];
  return <section className="ex-screen"><ScreenTitle eyebrow="EXPERIENCE / IN THE REAL WORLD" title="Messy inputs." accent="Useful systems." /><Tabs id={id} label="Choose experience" items={cases.map(item => item.company)} active={active} onChange={index => { setActive(index); setDetail(0); }} /><article className="ex-experience" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} key={experience.company}><div className="ex-exp-masthead"><div><p className="ex-eyebrow">{experience.period} / {experience.place}</p><h2>{experience.company}</h2><p className="ex-role">{experience.role}</p></div><div className="ex-company-icon" aria-hidden="true"><Icon size={58} strokeWidth={1.2} /><span>0{active + 1}</span></div></div><div className="ex-outcomes">{experience.impact.map(item => <ImpactBadge key={item} text={item} />)}</div><Tabs id={detailId} label={`${experience.company} case study`} items={["The system", "The challenge", "The lesson"]} active={detail} onChange={setDetail} compact /><div id={`${detailId}-panel`} role="tabpanel" aria-labelledby={`${detailId}-tab-${detail}`} tabIndex={0} className="ex-exp-detail">{detail === 0 ? <div className="ex-exp-detail-grid"><div><p className="ex-detail-label">BUILT</p><p>{experience.built}</p></div><div><p className="ex-detail-label">AUTOMATED</p><p>{experience.automation}</p></div></div> : detail === 1 ? <div className="ex-exp-detail-grid"><div><p className="ex-detail-label">THE MESS</p><p>{experience.problem}</p></div><div><p className="ex-detail-label">MY RESPONSIBILITY</p><p>{experience.responsibility}</p></div></div> : <blockquote><span>“</span>{experience.lesson}</blockquote>}</div></article></section>;
}

function ComparisonChart({ name, before, after }: { name: string; before: number; after: number }) {
  return <div className="ex-comparison"><p className="ex-detail-label">{name}</p><div className="ex-chart-scale"><span>0%</span><span>50%</span><span>100%</span></div><div className="ex-bar-row"><span>Before</span><div><i style={{ width: `${before}%` }} /></div><b>{before}%</b></div><div className="ex-bar-row ex-bar-after"><span>After</span><div><i style={{ width: `${after}%` }} /></div><b>{after}%</b></div></div>;
}

function Impact() {
  const [active, setActive] = useState(0), id = useId();
  return <section className="ex-screen ex-impact"><ScreenTitle eyebrow="THE SCOREBOARD / OUTCOMES" title="Let the" accent="numbers talk." note="Results from the work. Big enough to read." /><Tabs id={id} label="Impact views" items={["Rabbit Invest", "Wipro", "Decco Store"]} active={active} onChange={setActive} /><div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0} key={active} className="ex-impact-panel">{active === 0 ? <><div className="ex-impact-hero"><div className="ex-big-stat"><span className="ex-detail-label">MANUAL OPERATIONS AUTOMATED</span><strong>80<span>%</span></strong><p>Python + APIs. More room for the work that matters.</p><div className="ex-dot-matrix" aria-hidden="true">{Array.from({ length: 50 }, (_, index) => <i key={index} className={index < 40 ? "ex-lit" : ""} />)}</div><small>Each square = 2% of recurring manual work</small></div><div className="ex-charts"><ComparisonChart name="DATA ACCURACY" before={50} after={95} /><ComparisonChart name="CONVERSION" before={10} after={50} /></div></div><div className="ex-impact-bottom"><div><b>5×</b><span>conversion<br /><small>10% → 50%</small></span></div><div><b>+200%</b><span>execution efficiency<br /><small>at Rabbit Invest</small></span></div></div></> : active === 1 ? <div className="ex-wipro-metrics"><div className="ex-wipro-context"><span className="ex-detail-label">ACCOUNTS IN SCOPE</span><b>100+</b><p>SMB accounts. One clearer view of the commercial funnel.</p></div><div className="ex-wipro-grid">{cases[1].impact.map(item => <ImpactBadge key={item} text={item} />)}</div></div> : <div className="ex-revenue"><div className="ex-revenue-copy"><p className="ex-detail-label">REVENUE / FIRST 30 DAYS</p><strong>≈₹3<span>L</span></strong><h2>From a product idea<br />to a paying customer.</h2><p>Decco Store · Online + offline</p><a href={projects[1].url!} target="_blank" rel="noreferrer" className="ex-action">Visit Decco <ArrowUpRight size={20} /></a></div><div className="ex-revenue-image"><Image src="/assets/decco.webp" alt="Decco Store home and lifestyle product storefront" fill sizes="(max-width: 780px) 100vw, 50vw" /></div></div>}</div><p className="ex-source-note">Portfolio-reported outcomes · {active === 0 ? "Rabbit Invest, Jan 2024–Jun 2026" : active === 1 ? "Wipro, Jul 2022–Jan 2024" : "Decco’s first 30 days"}</p></section>;
}

function Process() {
  const [active, setActive] = useState(0), id = useId();
  const step = thinking[active];
  return <section className="ex-screen ex-process"><ScreenTitle eyebrow="INSIDE MY HEAD / THE WORKING LOOP" title="Find the mess." accent="Make it work." /><Tabs id={id} label="Process steps" items={["Frame", "Trace", "Validate", "Design", "Ship"]} active={active} onChange={setActive} /><div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} className="ex-process-panel"><div className="ex-process-art" aria-hidden="true"><div className="ex-orbital ex-orbital-one" /><div className="ex-orbital ex-orbital-two" /><div className="ex-process-center"><Workflow size={36} /><strong>DECIDE<br />BUILD<br />LEARN</strong></div>{thinking.map((item, index) => <div key={item.n} className={`ex-orbit-node ${index === active ? "ex-node-active" : ""}`} style={{ "--ex-angle": `${index * 72 - 90}deg` } as CSSProperties}><span>{item.n}</span></div>)}<div className="ex-orbit-caption">A LOOP, NOT A CHECKLIST</div></div><div className="ex-process-copy" key={active}><span className="ex-process-number">{step.n}<small>/ 05</small></span><h2>{step.title}</h2><p>{step.text}</p><div className="ex-process-next"><span>{active === thinking.length - 1 ? "LOOP BACK TO" : "UP NEXT"}</span><button onClick={() => setActive((active + 1) % thinking.length)}>{thinking[(active + 1) % thinking.length].title}<ArrowRight size={21} /></button></div></div></div></section>;
}

function Contact() {
  return <section className="ex-screen ex-contact"><div className="ex-contact-main"><p className="ex-eyebrow">OPEN CHANNEL / LET’S BUILD SOMETHING</p><h1>Got a messy<br />system?<br /><em>I’m listening.</em></h1><p className="ex-contact-intro">Data/BI · Founder’s Office · Product</p><a className="ex-action ex-action-large" href={links.email}>Let’s talk <Mail size={22} /></a><div className="ex-contact-links"><a href={links.linkedin} target="_blank" rel="noreferrer"><Linkedin size={21} />LinkedIn<ArrowUpRight size={19} /></a><a href={links.github} target="_blank" rel="noreferrer"><Github size={21} />GitHub<ArrowUpRight size={19} /></a></div><p className="ex-contact-note">Sumahar Pelluri<br />PGP-TBM ’27 · Masters’ Union<br />AI & Analytics Wing · Vice President</p></div><div className="ex-contact-photo"><Image src="/assets/sumahar-alternate.webp" alt="Portrait of Sumahar Pelluri" fill sizes="(max-width: 780px) 90vw, 42vw" /><div className="ex-contact-photo-caption"><span>HUMAN BEHIND THE SYSTEMS</span><strong>Sumahar Pelluri <ArrowUpRight size={26} /></strong></div></div></section>;
}

export default function ExploreSection({ section }: { section: string }) {
  if (section === "lab") return <ProductLab />;
  if (section === "experience") return <Experience />;
  if (section === "impact") return <Impact />;
  if (section === "process") return <Process />;
  if (section === "contact") return <Contact />;
  return null;
}
