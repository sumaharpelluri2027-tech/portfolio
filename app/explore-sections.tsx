"use client";

import Image from "next/image";
import { ArrowUpRight, ArrowRight, AudioLines, Bot, Check, Database, Github, HeartPulse, Linkedin, Mail, ShoppingBag, Sparkles, Workflow, Target, ShieldCheck, BarChart3 } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
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
  const icons = [Target, Database, ShieldCheck, Bot, Check];
  return <ol className="ex-flow">{steps.map((step, index) => { const Icon = icons[index % icons.length]; return <li key={step} style={{ "--ex-delay": `${index * .5}s` } as CSSProperties}><span className="ex-flow-icon"><Icon size={21} strokeWidth={1.5}/></span><strong>{step}</strong><span className="ex-flow-number">{String(index + 1).padStart(2, "0")}</span></li>; })}</ol>;
}

function ConversionFunnel() {
  return <figure className="ex-funnel"><figcaption><span>CONVERSION</span><strong>5×</strong></figcaption><div className="ex-funnel-pair">{[10, 50].map((value, index) => <div key={value} className={index ? "ex-funnel-after" : "ex-funnel-before"}><p>{index ? "AFTER" : "BEFORE"}</p><svg viewBox="0 0 180 145" role="img" aria-label={`${index ? "After" : "Before"}: ${value}% conversion, with the input normalized to 100%`}><path d="M10 12H170" stroke="currentColor" strokeWidth="2"/><path d={`M10 22 L170 22 L${90 + value * .8} 126 L${90 - value * .8} 126 Z`} fill="currentColor" fillOpacity={index ? ".28" : ".15"} stroke="currentColor" strokeWidth="1.5"/><path d={`M${90 - value * .8} 130 H${90 + value * .8}`} stroke="currentColor" strokeWidth="6"/><path d="M10 54H170 M10 88H170" stroke="currentColor" strokeOpacity=".08" strokeDasharray="3 4"/></svg><strong>{value}<small>%</small></strong></div>)}</div><p className="ex-chart-note">Input width = 100% · Output width = conversion rate</p></figure>;
}

function DataPipeline() {
  return <div className="ex-data-pipeline"><p className="ex-detail-label">THE DATA PIPELINE I DESIGNED</p><div className="ex-source-nodes">{["CAMS", "KFin", "AMFI"].map(name => <span key={name}><Database size={17}/>{name}</span>)}</div><div className="ex-source-merge" aria-hidden="true"><i/><i/><i/></div><Flow steps={["Ingestion", "Validation", "QC automation", "Trusted reporting"]}/><div className="ex-pipeline-output"><strong>95<small>%</small></strong><span>data accuracy<small>up from 50%</small></span></div><p className="ex-chart-note">Python · Google Scripts · REST APIs</p></div>;
}

function DeltaChart() {
  const values = [{name:"Retention", value:50}, {name:"Pipeline visibility", value:40}, {name:"Revenue · own initiatives", value:30}, {name:"Acquisition funnel", value:15}];
  return <div className="ex-delta-chart"><p className="ex-detail-label">WHAT MOVED AT WIPRO</p><div className="ex-delta-axis"><span>0%</span><span>25%</span><span>50%</span></div>{values.map(item => <div className="ex-delta-row" key={item.name}><span>{item.name}</span><div><i style={{width:`${item.value * 2}%`}}/></div><strong>+{item.value}%</strong></div>)}<p className="ex-chart-note">Reported percentage change · common 0–50% scale</p></div>;
}

function ExperienceOverview({ active }: { active: number }) {
  if (active === 0) return <div className="ex-case-visual"><DataPipeline/><div className="ex-case-proof"><ConversionFunnel/><div className="ex-inline-stats"><div><strong>80%</strong><span>manual ops automated</span></div><div><strong>+200%</strong><span>execution efficiency</span></div></div></div></div>;
  if (active === 1) return <div className="ex-case-visual"><div className="ex-account-system"><div className="ex-account-count"><strong>100<span>+</span></strong><p>SMB accounts</p></div><Flow steps={["Zoho CRM", "Acquisition + retention", "Pipeline reporting", "Commercial decisions"]}/></div><DeltaChart/></div>;
  return <div className="ex-case-visual ex-myntra-visual"><div className="ex-analysis-flow"><p className="ex-detail-label">FROM FUNNEL TO DECISION</p><Flow steps={["Customer behaviour", "Channel performance", "Conversion analysis", "Budget choices"]}/></div><div className="ex-decision-visual"><div className="ex-decision-rings" aria-hidden="true"><i/><i/><i/><BarChart3 size={56}/></div><span>ANALYSIS → ACTION</span><h3>CEO-level<br/><em>budget reallocation.</em></h3><p>Full-funnel visibility</p></div></div>;
}

function ProjectVisual({ project }: { project: typeof projects[number] }) {
  if (project.image) return <div className={`ex-product-picture ex-picture-${project.id}`}><Image src={project.image} alt={`${project.name} product interface`} fill sizes="(max-width: 780px) 100vw, 57vw" priority={project.id === "boardiq"} /><span className="ex-picture-label"><i />{project.name} / product view</span></div>;
  const Icon = project.id === "fitgenie" ? HeartPulse : project.id === "shopper" ? ShoppingBag : AudioLines;
  return <div className={`ex-concept ex-concept-${project.id}`} aria-label={`${project.name} concept visualization`}><div className="ex-concept-ring ex-ring-one" /><div className="ex-concept-ring ex-ring-two" /><div className="ex-concept-core"><Icon size={70} strokeWidth={1} /></div>{project.id === "priya" ? <div className="ex-wave" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <i key={index} style={{ "--ex-delay": `${index * .07}s`, height: `${24 + (index % 5) * 12}px` } as CSSProperties} />)}</div> : <div className="ex-concept-pills">{project.architecture.slice(1, 4).map(item => <span key={item}>{item}</span>)}</div>}<span className="ex-picture-label">CONCEPT VISUAL / {project.category}</span></div>;
}

function ProductLab({ initialProject }: { initialProject?: string }) {
  const [active, setActive] = useState(() => Math.max(0, projects.findIndex(item => item.id === initialProject))), [detail, setDetail] = useState(0);
  useEffect(() => { if (initialProject) { setActive(Math.max(0, projects.findIndex(item => item.id === initialProject))); setDetail(0); } }, [initialProject]);
  const project = projects[active] || projects[0], projectId = useId(), detailId = useId();
  return <section className="ex-screen ex-lab" aria-label="Product lab"><ScreenTitle eyebrow="THE PRODUCT LAB / 06 BUILDS" title="Built to" accent="be used."/><Tabs id={projectId} label="Choose a project" items={[...projects.map(item => item.name), "Sketchbook"]} active={active} onChange={index => { setActive(index); setDetail(0); }}/><article id={`${projectId}-panel`} role="tabpanel" aria-labelledby={`${projectId}-tab-${active}`} tabIndex={0} className="ex-project-panel" key={active === projects.length ? "sketchbook" : project.id}>{active === projects.length ? <Sketchbook/> : <><div className="ex-project-topline"><span>{project.category}</span><span className={`ex-status ${project.status === "IN BUILD" ? "ex-building" : ""}`}><i/>{project.status}</span></div><div className="ex-project-grid"><div className="ex-project-media"><ProjectVisual project={project}/><div className="ex-project-proof">{project.metrics.map((metric, index) => <div key={metric}><span>{index === 0 ? <Sparkles size={17}/> : <Check size={17}/>}</span><strong>{metric}</strong></div>)}</div></div><div className="ex-project-info"><div className="ex-project-name"><h2>{project.name}</h2>{project.url && <a className="ex-open-icon" href={project.url} target="_blank" rel="noreferrer" aria-label={`Open ${project.name}`}><ArrowUpRight size={26}/></a>}</div><Tabs id={detailId} label={`${project.name} details`} items={["The flow", "Story", "Next"]} active={detail} onChange={setDetail} compact/><div className="ex-project-detail" id={`${detailId}-panel`} role="tabpanel" aria-labelledby={`${detailId}-tab-${detail}`} tabIndex={0}>{detail === 0 ? <><Flow steps={project.architecture}/><div className="ex-stack">{project.technology.map(item => <span key={item}>{item}</span>)}</div></> : detail === 1 ? <div className="ex-story"><blockquote>{project.thesis}</blockquote><p className="ex-detail-label">THE PROBLEM</p><p>{project.problem}</p><p className="ex-detail-label">WHAT CHANGED</p><p>{project.impact}</p></div> : <div className="ex-story"><p className="ex-detail-label">NEXT ITERATION</p><p>{project.roadmap}</p><p className="ex-detail-label">WHY IT MATTERS</p><p>{project.impact}</p></div>}</div></div></div></>}</article></section>;
}

function ImpactBadge({ text }: { text: string }) {
  const match = text.match(/^([+\d%→ ]+)\s([A-Za-z].*)$/);
  return <div className={`ex-result ${match ? "" : "ex-result-text"}`}>{match ? <><strong>{match[1].trim()}</strong><span>{match[2]}</span></> : <><ArrowUpRight size={32} /><strong>{text}</strong></>}</div>;
}

function Experience() {
  const [active, setActive] = useState(0), [detail, setDetail] = useState(0);
  const experience = cases[active], id = useId(), detailId = useId();
  const logos = ["rabbit-invest", "wipro", "myntra"];
  return <section className="ex-screen"><p className="ex-eyebrow">EXPERIENCE / SYSTEMS IN THE REAL WORLD</p><Tabs id={id} label="Choose experience" items={cases.map(item => item.company)} active={active} onChange={index => { setActive(index); setDetail(0); }}/><article className="ex-experience" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} key={experience.company}><div className="ex-exp-masthead"><div><p className="ex-eyebrow">{experience.period} / {experience.place}</p><h1>{experience.company}</h1><p className="ex-role">{experience.role}</p></div><div className="ex-company-icon" aria-hidden="true"><Image src={`/assets/logos/${logos[active]}.png`} alt="" width={72} height={60} style={{objectFit:"contain"}}/><span>0{active + 1}</span></div></div><Tabs id={detailId} label={`${experience.company} case study`} items={["Visual overview", "The story", "The lesson"]} active={detail} onChange={setDetail} compact/><div id={`${detailId}-panel`} role="tabpanel" aria-labelledby={`${detailId}-tab-${detail}`} tabIndex={0} className="ex-exp-detail">{detail === 0 ? <ExperienceOverview active={active}/> : detail === 1 ? <div className="ex-exp-detail-grid"><div><p className="ex-detail-label">THE CHALLENGE</p><p>{experience.problem}</p><p className="ex-detail-label">MY RESPONSIBILITY</p><p>{experience.responsibility}</p></div><div><p className="ex-detail-label">BUILT</p><p>{experience.built}</p><p className="ex-detail-label">AUTOMATED</p><p>{experience.automation}</p></div></div> : <><blockquote><span>“</span>{experience.lesson}</blockquote><div className="ex-outcomes">{experience.impact.map(item => <ImpactBadge key={item} text={item}/>)}</div></>}</div></article></section>;
}

function ComparisonChart({ name, before, after }: { name: string; before: number; after: number }) {
  return <div className="ex-comparison"><p className="ex-detail-label">{name}</p><div className="ex-chart-scale"><span>0%</span><span>50%</span><span>100%</span></div><div className="ex-bar-row"><span>Before</span><div><i style={{ width: `${before}%` }} /></div><b>{before}%</b></div><div className="ex-bar-row ex-bar-after"><span>After</span><div><i style={{ width: `${after}%` }} /></div><b>{after}%</b></div></div>;
}

function Impact() {
  const [active, setActive] = useState(0), id = useId();
  return <section className="ex-screen ex-impact"><ScreenTitle eyebrow="THE SCOREBOARD / OUTCOMES" title="Let the" accent="numbers talk."  /><Tabs id={id} label="Impact views" items={["Rabbit Invest", "Wipro", "Decco Store"]} active={active} onChange={setActive} /><div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0} key={active} className="ex-impact-panel">{active === 0 ? <><div className="ex-impact-hero"><div className="ex-big-stat"><span className="ex-detail-label">MANUAL OPERATIONS AUTOMATED</span><strong>80<span>%</span></strong><p>Python + APIs. More room for the work that matters.</p><div className="ex-dot-matrix" aria-hidden="true">{Array.from({ length: 50 }, (_, index) => <i key={index} className={index < 40 ? "ex-lit" : ""} />)}</div><small>Each square = 2% of recurring manual work</small></div><div className="ex-charts"><ComparisonChart name="DATA ACCURACY" before={50} after={95} /><ConversionFunnel/></div></div><div className="ex-impact-bottom"><div><b>5×</b><span>conversion<br /><small>10% → 50%</small></span></div><div><b>+200%</b><span>execution efficiency<br /><small>at Rabbit Invest</small></span></div></div></> : active === 1 ? <div className="ex-wipro-metrics"><div className="ex-wipro-context"><span className="ex-detail-label">ACCOUNTS IN SCOPE</span><b>100+</b><p>SMB accounts. One clearer view of the commercial funnel.</p></div><div className="ex-wipro-grid">{cases[1].impact.map(item => <ImpactBadge key={item} text={item} />)}</div></div> : <div className="ex-revenue"><div className="ex-revenue-copy"><p className="ex-detail-label">REVENUE / FIRST 30 DAYS</p><strong>≈₹3<span>L</span></strong><h2>From a product idea<br />to a paying customer.</h2><p>Decco Store · Online + offline</p><a href={projects[1].url!} target="_blank" rel="noreferrer" className="ex-action">Visit Decco <ArrowUpRight size={20} /></a></div><div className="ex-revenue-image"><Image src="/assets/decco.webp" alt="Decco Store home and lifestyle product storefront" fill sizes="(max-width: 780px) 100vw, 50vw" /></div></div>}</div><p className="ex-source-note">Portfolio-reported outcomes · {active === 0 ? "Rabbit Invest, Jan 2024–Jun 2026" : active === 1 ? "Wipro, Jul 2022–Jan 2024" : "Decco’s first 30 days"}</p></section>;
}

function ProcessMethod() {
  const [active, setActive] = useState(0), id = useId();
  const step = thinking[active], labels = ["Frame", "Trace", "Validate", "Design", "Ship"];
  const processSignals = [["Decision", "Boundary", "Outcome"], ["Inputs", "Handoffs", "Exceptions"], ["Sources", "Validation", "Confidence"], ["Observe", "Decide", "Act"], ["Release", "Measure", "Improve"]];
  return <div className="ex-method"><Tabs id={id} label="Process steps" items={labels} active={active} onChange={setActive}/><div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} className="ex-process-panel"><div className="ex-process-art"><div className="ex-orbital ex-orbital-one" aria-hidden="true"/><div className="ex-orbital ex-orbital-two" aria-hidden="true"/><div className="ex-process-center" aria-hidden="true"><Workflow size={36}/><strong>DECIDE<br/>BUILD<br/>LEARN</strong></div>{thinking.map((item, index) => <button key={item.n} aria-label={item.title} aria-pressed={active === index} onClick={() => setActive(index)} className={`ex-orbit-node ${index === active ? "ex-node-active" : ""}`} style={{ "--ex-angle": `${index * 72 - 90}deg` } as CSSProperties}><span>{item.n}</span><strong>{labels[index]}</strong></button>)}<div className="ex-orbit-caption">CLICK A NODE. FOLLOW THE LOOP.</div></div><div className="ex-process-copy" key={active}><span className="ex-process-number">{step.n}<small>/ 05</small></span><h2>{step.title}</h2><div className="ex-process-signals">{processSignals[active].map((signal, index) => <span key={signal}>{signal}{index < 2 && <ArrowRight size={18}/>}</span>)}</div><details className="ex-process-thinking"><summary>The thinking behind it <ArrowRight size={17}/></summary><p>{step.text}</p></details><div className="ex-process-next"><span>{active === thinking.length - 1 ? "LOOP BACK TO" : "UP NEXT"}</span><button onClick={() => setActive((active + 1) % thinking.length)}>{thinking[(active + 1) % thinking.length].title}<ArrowRight size={21}/></button></div></div></div></div>;
}

function Sketchbook() {
  const sketches = [
    ["Brew Home", "PROTOTYPE", "Indian specialty coffee, a flavour quiz, and a subscription flow."],
    ["IKSHANA Z INC", "DELIVERED", "Multi-state incorporation analysis. Delaware recommendation adopted by the client."],
    ["Decoding F&B", "PITCHED", "Fusion condiments: Chilli Crisp × Tadka and Kokum Hot Sauce."],
    ["Kinfolio", "CONCEPT", "Financial legacy and family-continuity fintech."],
    ["TrustMRR EDA", "COMPLETED", "SaaS dataset analysis with a consulting-style executive write-up."],
    ["AI Insurance Assistant", "COMPLETED", "Claims-processing automation built in Make.com."]
  ];
  return <div className="ex-sketchbook"><div className="ex-sketch-grid">{sketches.map(([name, status, text], index) => <details key={name} className="ex-sketch"><summary><span>0{index + 1}</span><small>{status}</small><h3>{name}</h3><ArrowUpRight size={24}/></summary><p>{text}</p></details>)}</div><a className="ex-film-link" href="https://youtu.be/Ec_oS-oTlYQ" target="_blank" rel="noreferrer"><span>▶</span><div><small>AI FILMMAKING / GOOGLE FLOW</small><strong>My first AI film. My Wing election campaign.</strong></div><ArrowUpRight size={24}/></a></div>;
}

const toolkit = [{"name": "Data & Analytics", "skills": [["SQL", "Querying and reconciling fund data across three registrar feeds daily."], ["Pandas", "The workhorse for every reconciliation and QC script I wrote at Rabbit."], ["ETL", "Built ingestion → validation → QC as a repeatable pipeline, not one-off cleanups."], ["Data validation", "Null, duplicate and outlier rules that moved accuracy from 50% to 95%."], ["Funnel analysis", "Myntra intern project that informed a CEO-level budget reallocation."], ["Looker", "Dashboards the sales team actually triaged from — conversion 10% → 50%."], ["EDA", "TrustMRR SaaS dataset, written up in a consulting-style exec summary."]]}, {"name": "Automation & AI", "skills": [["Python automation", "Replaced the recurring manual ops work that ate the team’s week."], ["Make.com", "No-code orchestration — including a working AI insurance claims assistant."], ["Agentic AI design", "Designing the decision chain, not just the prompt. BoardIQ is the proof."], ["Gemini", "Reasoning + search grounding behind BoardIQ’s verdicts and IC memos."], ["Google Scripts", "Glue between Sheets, mail and the registrar APIs at Rabbit."], ["REST APIs", "Pulled CAMS/KFin/AMFI data directly instead of waiting on exports."], ["Selenium", "Scraped what had no API worth using."], ["Bolna · Fish Audio", "Priya — a two-way AI voice call agent with a cloned voice."]]}, {"name": "Ops & General Management", "skills": [["SOP design", "Wrote the operating manual for a function that had none."], ["KPI governance", "Defined what got measured — so automation targeted the real bottleneck."], ["Zoho CRM", "Reporting rebuilt: +40% pipeline visibility across 100+ SMB accounts."], ["Founder-level comms", "Represented Ops in founder meetings at Rabbit Invest."], ["Recruitment ops", "Ran the Wing’s hiring workbook, feedback and QR systems as VP."], ["Event ops", "Wing events end to end — logistics, comms, and the debrief."]]}, {"name": "Product & Growth", "skills": [["Shopify", "D2C storefront mechanics — catalog, pricing, checkout."], ["Lovable", "Four live products shipped on it, including Decco and FitGenie."], ["React · TypeScript", "BoardIQ’s twelve-screen front end."], ["Campaign analytics", "Wired campaigns to KPIs so spend could be judged, not guessed."], ["Pricing", "Set the margins that made Decco actually profitable, not just busy."]]}, {"name": "Cloud & Tooling", "skills": [["AWS", "Certified Cloud Practitioner; the vocabulary behind everything I deploy."], ["Render", "Hosts BoardIQ and the AI & Analytics Wing site."], ["Git · GitHub", "Every build versioned at github.com/sumaharpelluri2027-tech."]]}];

function Toolkit() {
  const [active, setActive] = useState(0), [skill, setSkill] = useState(0), id = useId();
  const domain = toolkit[active];
  return <div className="ex-toolkit"><Tabs id={id} label="Skill disciplines" items={toolkit.map(item => item.name)} active={active} onChange={index => {setActive(index);setSkill(0);}} compact/><div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0}><div className="ex-toolkit-heading"><Database size={48} strokeWidth={1}/><h2>{domain.name}</h2></div><div className="ex-skill-chips">{domain.skills.map(([name], index) => <button key={name} onClick={() => setSkill(index)} aria-pressed={skill === index}>{name}</button>)}</div><div className="ex-skill-proof"><span>IN PRACTICE</span><p>{domain.skills[skill][1]}</p></div></div></div>;
}

function Milestones() {
  const milestones = [
    ["AIR 8", "BAJA SAE Enduro", "Designed the hybrid braking architecture."],
    ["VP", "AI & Analytics Wing", "Masters’ Union."],
    ["02", "Leadership campaigns", "Led strategy for FOCOS Club President and Google Fraternity President."],
    ["1st", "Powerlifting Deadlift", "First place in weight category."],
    ["AWS", "Cloud Practitioner", "Certified in 2022."],
    ["TOP 5%", "State cohort", "Class XII: 94.5% · Class X: 9.7 CGPA."]
  ];
  return <div className="ex-milestones">{milestones.map(([value, title, description]) => <div key={title}><strong>{value}</strong><h3>{title}</h3><p>{description}</p></div>)}</div>;
}

function Process() {
  const [active,setActive] = useState(0), id = useId();
  return <section className="ex-screen ex-process"><ScreenTitle eyebrow="HOW I WORK / WHAT I BRING" title="Find the mess." accent="Make it work."/><Tabs id={id} label="Method, toolkit and milestones" items={["Method", "Toolkit", "Milestones"]} active={active} onChange={setActive}/><div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>{active === 0 ? <ProcessMethod/> : active === 1 ? <Toolkit/> : <Milestones/>}</div></section>;
}

function Contact() {
  return <section className="ex-screen ex-contact"><div className="ex-contact-main"><p className="ex-eyebrow">OPEN CHANNEL / LET’S BUILD SOMETHING</p><h1>Got a messy<br />system?<br /><em>I’m listening.</em></h1><p className="ex-contact-intro">Data/BI · Founder’s Office · Product<br/><small>Open to roles from 2027</small></p><a className="ex-action ex-action-large" href={links.email}>Let’s talk <Mail size={22} /></a><div className="ex-contact-links"><a href={links.linkedin} target="_blank" rel="noreferrer"><Linkedin size={21} />LinkedIn<ArrowUpRight size={19} /></a><a href={links.github} target="_blank" rel="noreferrer"><Github size={21} />GitHub<ArrowUpRight size={19} /></a></div><p className="ex-contact-note">Sumahar Pelluri<br />PGP-TBM ’27 · Masters’ Union<br />AI & Analytics Wing · Vice President</p></div><div className="ex-contact-photo"><Image src="/assets/sumahar-alternate.webp" alt="Portrait of Sumahar Pelluri" fill sizes="(max-width: 780px) 90vw, 42vw" /><div className="ex-contact-photo-caption"><span>HUMAN BEHIND THE SYSTEMS</span><strong>Sumahar Pelluri <ArrowUpRight size={26} /></strong></div></div></section>;
}

export default function ExploreSection({ section, initialProject }: { section: string; initialProject?: string }) {
  if (section === "lab") return <ProductLab initialProject={initialProject}/>;
  if (section === "experience") return <Experience />;
  if (section === "impact") return <Impact />;
  if (section === "process") return <Process />;
  if (section === "contact") return <Contact />;
  return null;
}
