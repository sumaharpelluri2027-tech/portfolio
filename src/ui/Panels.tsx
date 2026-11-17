import Journey from "./Journey";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { A, EDU, LINKS, MILESTONES, PRODUCTS, SKETCHES, TOOLKIT, WING } from "../data";
import { JOBS, SYMPTOMS, type CarPart } from "../content";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ---------------- shell: right sheet on desktop, bottom sheet on phones ---------------- */
export function Sheet({ open, onClose, children, label, tone = "paper", wide = false }: { open: boolean; onClose: () => void; children: ReactNode; label: string; tone?: "paper" | "dark" | "lcd"; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const bg = tone === "paper" ? "paper" : tone === "lcd" ? "bg-[#0a0f0b]" : "bg-oil text-paper";
  return (
    <AnimatePresence>
      {open && (
        <motion.aside role="dialog" aria-label={label}
          className={`fixed z-40 flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.6)] ${bg}
            inset-x-0 bottom-0 max-h-[78vh] rounded-t-2xl
            md:inset-x-auto md:bottom-auto md:right-5 md:top-[84px] md:max-h-[calc(100vh-108px)] md:rounded-xl ${wide ? "md:w-[560px]" : "md:w-[470px]"}`}
          initial={{ opacity: 0, y: 40, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 30, rotate: -1 }}
          transition={{ duration: 0.5, ease: EASE }}>
          <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border ${tone === "paper" ? "border-black/20 hover:bg-black/5" : "border-white/20 hover:bg-white/10"}`}><X size={16} /></button>
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ---------------- job card for a car part ---------------- */
export function JobCardView({ id, onBonnet }: { id: CarPart; onBonnet: () => void }) {
  const j = JOBS[id];
  const [tab, setTab] = useState<"card" | "wiring">("card");
  useEffect(() => setTab("card"), [id]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hazard h-2.5 shrink-0" />
      <div className="flex items-end justify-between gap-3 border-b-2 border-black/80 px-5 pb-3 pt-4 pr-14">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-black/55">JOB CARD Nº {j.no} · {j.part.toUpperCase()}</div>
          <div className="font-stencil text-[30px] leading-none text-black">{j.area.toUpperCase()}</div>
        </div>
      </div>
      <div className="flex shrink-0 border-b border-black/15 font-mono text-[11px] tracking-[0.14em]" role="tablist">
        {(["card", "wiring"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2.5 ${tab === t ? (t === "wiring" ? "bg-bp text-bpline" : "bg-black text-paper") : "text-black/60 hover:bg-black/5"}`}>
            {t === "card" ? "THE JOB" : "UNDER THE BONNET · DATA"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "card" ? (
            <motion.div key="c" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-4 px-5 py-5">
              {/* the result first: that's what a reader came for */}
              <div className="relative overflow-hidden rounded-xl bg-black p-4 text-paper">
                <div className="font-mono text-[10px] tracking-[0.22em] text-hazard">RESULT</div>
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 }}
                  className="origin-left whitespace-nowrap font-stencil text-[clamp(34px,6.4vw,52px)] leading-none text-hazard">{j.result.big}</motion.div>
                <div className="mt-1 text-[14.5px] text-paper/80">{j.result.label}</div>
                {j.extra && <div className="mt-2 border-t border-white/15 pt-2 text-[13px] text-paper/65">{j.extra}</div>}
              </div>
              <div>
                <h2 className="font-cond text-[22px] font-semibold leading-tight text-black">{j.title}</h2>
                <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-black/55">{j.where}</p>
              </div>
              <div className="rounded-lg border-l-4 border-rust bg-rust/[.07] px-3 py-2.5">
                <div className="font-mono text-[10px] tracking-[0.2em] text-rust">THE PROBLEM</div>
                <p className="text-[14.5px] leading-snug text-black/85">{j.complaint}</p>
              </div>
              <div>
                <div className="mb-1.5 font-mono text-[10px] tracking-[0.2em] text-black/55">WHAT I DID</div>
                <ol className="space-y-1.5">
                  {(j.did ?? [j.work]).map((d, i) => (
                    <motion.li key={d} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex gap-2.5 text-[14.5px] leading-snug text-black/85">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black font-mono text-[10px] font-bold text-hazard">{i + 1}</span>{d}
                    </motion.li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-1.5">{j.tools.map((t) => <span key={t} className="rounded-full border border-black/25 px-2.5 py-1 font-mono text-[10.5px] text-black/75">{t}</span>)}</div>
              {j.links && <div className="flex flex-wrap gap-2">{j.links.map(([l, h]) => <a key={h} href={h} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-black px-4 py-2 font-mono text-xs text-hazard hover:bg-black/80">{l} <ArrowUpRight size={13} /></a>)}</div>}
              <button type="button" onClick={() => setTab("wiring")} className="w-full rounded-lg border border-dashed border-black/40 py-3 font-mono text-xs tracking-wider text-black/70 hover:bg-black/5">HOW THE DATA FLOWED UNDER THIS →</button>
            </motion.div>
          ) : (
            <motion.div key="w" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="bp-grid min-h-full space-y-5 px-5 py-5 text-[#cfe9ff]">
              <div className="font-mono text-[10px] tracking-[0.2em] text-bpline">THE PIPELINE</div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                {j.wiring.pipeline.map((p, i) => (
                  <motion.span key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-center gap-1.5">
                    <span className={`rounded border px-2 py-1 ${i === j.wiring.pipeline.length - 1 ? "border-hazard bg-hazard text-black" : "border-bpline/50"}`}>{p}</span>
                    {i < j.wiring.pipeline.length - 1 && <span className="text-bpline/60">→</span>}
                  </motion.span>
                ))}
              </div>
              <div>
                <div className="mb-2 flex justify-between font-mono text-[10px] tracking-[0.2em] text-bpline"><span>{j.wiring.snippetLang.toUpperCase()}</span><span className="text-bpline/60">A SKETCH OF THE APPROACH</span></div>
                <pre className="overflow-x-auto rounded-lg border border-bpline/30 bg-black/40 p-4 text-[12px] leading-relaxed text-[#e6f6ff]"><code>{j.wiring.snippet}</code></pre>
              </div>
              <p className="border-l-2 border-hazard pl-3 text-[15px] text-[#e6f6ff]">{j.wiring.note}</p>
              <button type="button" onClick={onBonnet} className="w-full rounded-lg border border-bpline/50 py-3 font-mono text-xs tracking-wider text-bpline hover:bg-bpline/10">LIFT THE WHOLE BONNET →</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
function Field({ k, children }: { k: string; children: ReactNode }) {
  return <div><div className="mb-1 font-mono text-[10px] tracking-[0.2em] text-black/55">{k}</div><p className="text-[15.5px] leading-relaxed text-black/85">{children}</p></div>;
}

/* ---------------- prop panels ---------------- */
function Head({ k, t }: { k: string; t: string }) {
  return <div className="border-b border-white/10 px-5 pb-4 pt-5 pr-14"><div className="font-mono text-[10px] tracking-[0.2em] text-hazard">{k}</div><div className="font-stencil text-[30px] leading-none">{t}</div></div>;
}

export function ToolChest() {
  const [ti, setTi] = useState(0), [si, setSi] = useState(0);
  const g = TOOLKIT[ti];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="TOOL CHEST" t="WHAT I WORK WITH" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-1.5">
          {TOOLKIT.map((d, k) => (
            <button key={d.name} type="button" onClick={() => { setTi(k); setSi(0); }} aria-expanded={k === ti}
              className={`group relative flex w-full items-center justify-between overflow-hidden rounded-md border px-4 py-3 text-left transition-all ${k === ti ? "border-hazard bg-[#2a251d]" : "border-white/10 bg-[#1d1a16] hover:border-white/30"}`}>
              <span className="font-cond text-lg font-semibold tracking-wide">{d.name.toUpperCase()}</span>
              <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-[#777] to-[#bbb]" aria-hidden="true" />
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={ti} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
            <p className="text-[15px] text-paper/90">{g.head}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.skills.map(([s], k) => <button key={s} type="button" onClick={() => setSi(k)} aria-pressed={k === si} className={`rounded border px-2.5 py-1.5 font-mono text-xs ${k === si ? "border-hazard text-hazard" : "border-white/20 text-paper/75 hover:border-white/50"}`}>{s}</button>)}
            </div>
            <p className="mt-3 border-l-2 border-hazard pl-3 text-sm text-paper/80" aria-live="polite">{g.skills[si][1]}</p>
          </motion.div>
        </AnimatePresence>
        <a href={LINKS.github} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-hazard">MY CODE ON GITHUB <ArrowUpRight size={13} /></a>
      </div>
    </div>
  );
}

export function Trophies() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="TROPHY SHELF" t="WINS & MILESTONES" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-2">
          {MILESTONES.map(([b, t, d], i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-md border border-[#d9a63a]/30 bg-gradient-to-b from-[#2a2217] to-[#1a1610] p-3">
              <div className="font-stencil text-2xl text-[#e9b84a]">{b}</div>
              <div className="font-cond text-[15px] font-semibold">{t}</div>
              <div className="text-xs text-paper/60">{d}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-5 font-mono text-[10px] tracking-[0.2em] text-hazard">WHERE I TRAINED</div>
        <div className="mt-2 space-y-2">
          {EDU.map((e) => (
            <div key={e.t} className="flex items-center gap-3 rounded-md border border-white/10 p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded bg-white p-1.5"><img src={A(`logos/${e.logo}.png`)} alt={e.t + " logo"} className="max-h-8 w-auto" /></span>
              <div><div className="font-cond text-[17px] font-semibold">{e.t}</div><div className="text-xs text-paper/60">{e.d}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Crew() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="PIT CREW · PEOPLE" t="THE AI & ANALYTICS WING" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-[15px] text-paper/85">Elected VP of the AI & Analytics Wing at Masters' Union. I run the crew: events, case challenges, recruitment and the Wing's own website.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([["img/aiaw-event.webp", "Wing event, a full room"], ["img/aiaw-team.webp", "The Wing's core team"], ["img/aiaw-site.webp", "The Wing's website, built by me"]] as const).map(([src, cap], i) => (
            <figure key={src} className={`relative overflow-hidden rounded-md bg-black ${i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`} style={{ transform: `rotate(${[-1, 1.5, -2][i]}deg)` }}>
              <img src={A(src)} alt={cap} className="h-full w-full object-cover" loading="lazy" />
              <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px]">{cap}</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {WING.map((w) => (
            <div key={w.t} className="rounded-md border border-white/10 p-3">
              <div className="font-stencil text-3xl text-hazard">{w.n}</div>
              <div className="font-cond text-[15px] font-semibold">{w.t}</div>
              <div className="text-xs text-paper/60">{w.d}</div>
            </div>
          ))}
        </div>
        <a href={LINKS.wing} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-hazard">THE WING'S WEBSITE <ArrowUpRight size={13} /></a>
      </div>
    </div>
  );
}

export function Shipped() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="SHIPPED CRATE" t="PRODUCTS THAT LEFT THE GARAGE" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {PRODUCTS.map((p, i) => {
          const Tg = p.href ? "a" : "div";
          return (
            <Tg key={p.name} {...(p.href ? { href: p.href, target: "_blank", rel: "noopener" } : {})} className="group flex gap-3 rounded-md border border-white/10 bg-[#1b1814] p-2.5 transition-colors hover:border-hazard">
              <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded bg-black">
                {p.img ? <img src={A(p.img)} alt="" className="h-full w-full object-cover object-top" loading="lazy" /> : <div className="grid h-full place-items-center font-mono text-[10px] text-hazard">VOICE AI</div>}
                <span className="absolute left-1 top-0.5 font-stencil text-xl text-white/90 mix-blend-difference">0{i + 1}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-cond text-[18px] font-semibold">{p.name}</span><span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${p.live ? "bg-lcd/15 text-lcd" : "bg-white/10 text-paper/60"}`}>{p.status}</span></div>
                <p className="mt-0.5 text-[13px] leading-snug text-paper/65">{p.d}</p>
                {p.href && <span className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-hazard">{(p.cta || "Open").toUpperCase()} <ArrowUpRight size={12} /></span>}
              </div>
            </Tg>
          );
        })}
      </div>
    </div>
  );
}

export function Prototypes() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="PROTOTYPE BOX" t="VENTURES & ANALYSIS" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-3 text-sm text-paper/65">Smaller builds and ideas I've tested. Each tag says exactly how far it got.</p>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {SKETCHES.map((s) => {
            const Tg = s.href ? "a" : "div";
            return (
              <Tg key={s.t} {...(s.href ? { href: s.href, target: "_blank", rel: "noopener" } : {})} className="block py-3">
                <div className="flex items-center justify-between gap-2"><span className="font-cond text-[17px] font-semibold">{s.t}{s.href && <ArrowUpRight className="ml-1 inline" size={14} />}</span><span className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] ${s.hot ? "border-hazard text-hazard" : "border-white/20 text-paper/55"}`}>{s.s}</span></div>
                <p className="text-[13px] text-paper/65">{s.d}</p>
              </Tg>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- diagnostic scanner ---------------- */
export function Diagnostic({ onShowPart }: { onShowPart: (p: CarPart) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState<"ask" | "scan" | "print">("ask");
  const s = SYMPTOMS.find((x) => x.id === pick);
  const j = s ? JOBS[s.part] : null;
  useEffect(() => {
    if (phase !== "scan") return;
    const t = setTimeout(() => setPhase("print"), 1400); return () => clearTimeout(t);
  }, [phase]);
  return (
    <div className="flex min-h-0 flex-1 flex-col font-mono text-[13px] text-lcd">
      <div className="border-b border-lcd/20 px-5 pb-3 pt-5 pr-14">
        <div className="text-[10px] tracking-[0.25em] text-lcd/60">OBD SCANNER · SUMAHAR-08</div>
        <div className="font-stencil text-[28px] leading-none text-lcd">RUN A DIAGNOSTIC</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {phase === "ask" && (
          <>
            <p className="mb-3 text-lcd/80">What's the symptom at your company?</p>
            <div className="space-y-2">
              {SYMPTOMS.map((x) => (
                <button key={x.id} type="button" onClick={() => { setPick(x.id); setPhase("scan"); }} className="w-full rounded border border-lcd/30 px-3 py-3 text-left text-[13.5px] text-[#c9f5d6] hover:bg-lcd/10">
                  <span className="text-lcd/50">› </span>{x.text}
                </button>
              ))}
            </div>
          </>
        )}
        {phase === "scan" && (
          <div className="grid place-items-center py-12 text-center">
            <motion.div className="h-1 w-56 overflow-hidden rounded bg-lcd/15"><motion.div className="h-full bg-lcd" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1.3 }} /></motion.div>
            <p className="mt-4 text-lcd/80">reading the system…</p>
          </div>
        )}
        {phase === "print" && s && j && (
          <div className="printing rounded-sm bg-[#f4f1e8] p-5 text-[12.5px] leading-relaxed text-black shadow-[0_10px_30px_rgba(0,0,0,.4)]">
            <div className="text-center text-[11px] tracking-[0.3em]">SUMAHAR'S GARAGE · DIAGNOSTIC</div>
            <div className="my-2 border-y border-dashed border-black/40 py-2">
              <div>FAULT CODE ..... <b>{s.code}</b></div>
              <div>SYMPTOM ........ {s.text}</div>
              <div>CHECK FIRST .... <b>{j.part.toUpperCase()}</b> ({j.area})</div>
            </div>
            <div className="text-[11px] tracking-[0.2em]">WHAT I'D DO FIRST</div>
            <ol className="mt-1 list-decimal pl-5">{s.first.map((f) => <li key={f}>{f}</li>)}</ol>
            <div className="mt-3 border-t border-dashed border-black/40 pt-2 text-[11px] tracking-[0.2em]">WHERE I'VE FIXED THIS BEFORE</div>
            <div className="mt-1">{j.where}</div>
            <div className="mt-1 text-[20px] font-bold text-rust">{j.result.big} <span className="text-[12px] font-normal text-black/70">{j.result.label}</span></div>
            <div className="mt-3 text-center text-[11px]">· · · thank you · · ·</div>
          </div>
        )}
      </div>
      {phase === "print" && s && (
        <div className="flex gap-2 border-t border-lcd/20 p-3">
          <button type="button" onClick={() => onShowPart(s.part)} className="flex-1 rounded bg-lcd px-3 py-2.5 text-xs font-bold tracking-wider text-black">SHOW ME THE PART →</button>
          <button type="button" onClick={() => { setPhase("ask"); setPick(null); }} className="rounded border border-lcd/40 px-3 py-2.5 text-xs tracking-wider">RE-SCAN</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- build board: every project, filterable ---------------- */
import { KINDS, PROJECTS, count, type Kind } from "../projects";
export function BuildBoard({ initial = "all", onClose }: { initial?: Kind | "all"; onClose: () => void }) {
  const [k, setK] = useState<Kind | "all">(initial);
  useEffect(() => setK(initial), [initial]);
  useEffect(() => { const e = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); }; window.addEventListener("keydown", e); return () => window.removeEventListener("keydown", e); }, [onClose]);
  const list = PROJECTS.filter((p) => k === "all" || p.kind === k);
  const blurb = KINDS.find((x) => x.id === k)?.blurb;
  return (
    <motion.div role="dialog" aria-label="Build board: all projects" className="fixed inset-0 z-[45] flex flex-col bg-ink/95 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <div className="hazard h-2 shrink-0" />
      <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col px-4 md:px-8">
        <div className="flex items-start justify-between gap-4 pt-6">
          <div>
            <div className="font-mono text-[11px] tracking-[0.25em] text-hazard">BUILD BOARD · {PROJECTS.length} ENTRIES</div>
            <h2 className="font-stencil text-[clamp(32px,5vw,60px)] leading-[0.95]">EVERYTHING I'VE BUILT</h2>
            <p className="mt-1 max-w-[60ch] text-paper/70">Masters' Union projects, case competitions, live products and the Wing, in one place. Each tag says exactly how far it got.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the build board" className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 hover:border-hazard hover:text-hazard"><X size={18} /></button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" role="tablist">
          {KINDS.map((x) => (
            <button key={x.id} role="tab" aria-selected={k === x.id} type="button" onClick={() => setK(x.id)}
              className={`shrink-0 rounded-full border px-4 py-2 font-mono text-[11.5px] tracking-wider transition-colors ${k === x.id ? "border-hazard bg-hazard text-ink" : "border-white/20 text-paper/75 hover:border-white/50"}`}>
              {x.label.toUpperCase()} <span className={k === x.id ? "text-ink/60" : "text-paper/40"}>{count(x.id)}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 font-mono text-[11px] text-paper/50">{blurb}</p>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-10">
          <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((p) => {
                const Tg = p.href ? "a" : "div";
                return (
                  <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
                    <Tg {...(p.href ? { href: p.href, target: "_blank", rel: "noopener" } : {})}
                      className={`group flex h-full flex-col overflow-hidden rounded-lg border bg-[#191612] transition-colors ${p.href ? "hover:border-hazard" : ""} ${p.hot ? "border-hazard/40" : "border-white/10"}`}>
                      {p.img && <div className="aspect-[16/7] overflow-hidden bg-black"><img src={A(p.img)} alt="" loading="lazy" className="h-full w-full object-cover object-top opacity-85 transition-transform duration-500 group-hover:scale-105" /></div>}
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] tracking-wider">
                          <span className="truncate text-paper/50">{p.where.toUpperCase()}</span>
                          <span className={`shrink-0 rounded px-2 py-0.5 ${p.kind === "live" ? "bg-lcd/15 text-lcd" : p.hot ? "bg-hazard/15 text-hazard" : "bg-white/10 text-paper/65"}`}>{p.status}</span>
                        </div>
                        <h3 className="font-cond text-[21px] font-semibold leading-tight">{p.title}</h3>
                        <p className="text-[14px] leading-snug text-paper/75">{p.what}</p>
                        <p className="border-l-2 border-hazard/70 pl-2.5 text-[13.5px] leading-snug text-paper/90"><span className="font-mono text-[10px] tracking-wider text-hazard">MY PART · </span>{p.mine}</p>
                        {p.number && <p className="font-stencil text-xl text-hazard">{p.number}</p>}
                        {p.href && <span className="mt-auto inline-flex items-center gap-1 pt-1 font-mono text-[11px] tracking-wider text-hazard">{(p.cta || "Open").toUpperCase()} <ArrowUpRight size={13} /></span>}
                      </div>
                    </Tg>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Decco Store board ---------------- */
export function Decco() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="DECCO STORE · VENTURE" t="A BRAND WE SOLD BY HAND" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-2">
          <img src={A("img/decco-stall.webp")} alt="Running the Decco Store stall" className="aspect-square w-full rounded-md object-cover" />
          <img src={A("img/decco-team.webp")} alt="Team Decco at the market" className="aspect-square w-full rounded-md object-cover" />
          <img src={A("img/decco-shot.webp")} alt="The Decco Store website" className="col-span-2 aspect-[16/8] w-full rounded-md object-cover object-top" />
        </div>
        <div className="mt-4 rounded-md border border-hazard/40 p-4"><div className="font-stencil text-4xl text-hazard">₹3L</div><div className="text-sm text-paper/75">revenue in the first 30 days</div></div>
        <p className="mt-4 text-[15px] text-paper/85">A vintage-inspired home and speaker brand, built with a team at Masters' Union. I handled the Shopify setup, the Lovable storefront, the product catalogue and pricing, ran the campaigns, then sold in person at our stall.</p>
        <a href={LINKS.decco} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1 rounded-full bg-hazard px-4 py-2 font-mono text-xs font-bold text-ink">VISIT THE STORE <ArrowUpRight size={13} /></a>
      </div>
    </div>
  );
}

/* ---------------- the driver: about me ---------------- */
export function Driver({ onProjects }: { onProjects: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative aspect-[4/4.2] w-full overflow-hidden bg-black">
          <img src={A("me/studio-smile.webp")} alt="Sumahar Pelluri in a dark suit, smiling" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-oil via-oil/70 to-transparent px-5 pb-4 pt-20">
            <div className="font-mono text-[10px] tracking-[0.25em] text-hazard">DRIVER LICENCE · Nº 08</div>
            <div className="font-stencil text-[38px] leading-none">SUMAHAR PELLURI</div>
            <div className="mt-1 font-mono text-[11px] tracking-wider text-paper/70">CLASS: OPERATIONS · GROWTH · DATA</div>
          </div>
        </div>
        <div className="space-y-4 p-5 text-[15.5px] leading-relaxed text-paper/85">
          <p>Mechanical engineer turned operator. I think in systems: every part has inputs, failure modes and someone who depends on it.</p>
          <div className="font-mono text-[10.5px] tracking-[0.22em] text-hazard">THE ROAD SO FAR</div>
          <Journey compact />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onProjects} className="rounded-full bg-hazard px-4 py-2 font-mono text-xs font-bold text-ink">SEE EVERYTHING I'VE BUILT</button>
            <a href={LINKS.linkedin} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-white/25 px-4 py-2 font-mono text-xs hover:border-hazard">LINKEDIN <ArrowUpRight size={12} /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
