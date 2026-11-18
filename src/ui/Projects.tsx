import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChevronDown, MessageCircle, X } from "lucide-react";
import { A } from "../data";
import { FNS, HEROES, PROJECTS, type Hero, type Kind, type Project } from "../projects";

const COVERED = new Set(["boardiq", "nutrisathi", "decco", "arogya", "wing", "case-union", "wing-site"]);
const LOG = PROJECTS.filter((p) => !COVERED.has(p.id));
const FILTERS: { id: "all" | Kind | "build"; label: string }[] = [
  { id: "all", label: "Every type" }, { id: "build", label: "Live & builds" }, { id: "case", label: "Case competitions" }, { id: "course", label: "MU coursework" }, { id: "lead", label: "Leadership" },
];
const TYPE: Record<Kind, string> = { live: "LIVE", proto: "PROTOTYPE", case: "CASE", course: "COURSEWORK", lead: "LEADERSHIP" };
const inFilter = (k: Kind, f: string) => f === "all" || k === f || (f === "build" && (k === "live" || k === "proto"));

/** The projects board: five hero projects on a stage, everything else in a compact logbook. */
export default function Projects({ onClose, onAsk, start = 0 }: { onClose: () => void; onAsk: (q: string) => void; start?: number }) {
  const [i, setI] = useState(start);
  const [f, setF] = useState<string>("all");
  const [fn, setFn] = useState<string>("all");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const h = HEROES[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") setI((v) => (v + 1) % HEROES.length);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") setI((v) => (v - 1 + HEROES.length) % HEROES.length);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const rows = LOG.filter((p) => inFilter(p.kind, f));

  return (
    <motion.div role="dialog" aria-label="Projects: what I've built" className="fixed inset-0 z-[45] overflow-y-auto bg-[#0f0d0b]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="hazard sticky top-0 z-10 h-1.5" />
      <div className="mx-auto max-w-[1240px] px-4 pb-16 md:px-8">
        <div className="flex items-start justify-between gap-4 pt-6">
          <div>
            <div className="font-mono text-[11px] tracking-[0.25em] text-hazard">PROJECTS</div>
            <h2 className="font-stencil text-[clamp(34px,5vw,58px)] leading-[0.95]">WHAT I'VE BUILT</h2>
            <p className="mt-1 text-paper/65">Five I'd happily be grilled on, then the full logbook.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close projects" className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 hover:border-hazard hover:text-hazard"><X size={18} /></button>
        </div>

        {/* ---------- the big five ---------- */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible" role="tablist" aria-label="Hero projects">
            {HEROES.map((x, k) => (
              <button key={x.id} role="tab" aria-selected={k === i} type="button" onClick={() => setI(k)}
                className={`group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all lg:w-full ${k === i ? "border-transparent bg-white/[.07]" : "border-white/10 hover:border-white/30"}`}>
                {k === i && <motion.span layoutId="heroBar" className="absolute inset-y-0 left-0 w-1" style={{ background: x.accent }} />}
                <span className="font-stencil text-[22px] leading-none" style={{ color: k === i ? x.accent : "rgba(239,233,220,.45)" }}>{x.stat}</span>
                <span className="min-w-0"><span className="block truncate font-cond text-[16px] font-semibold">{x.title}</span><span className="block truncate font-mono text-[10px] text-paper/50">{x.scope}</span></span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.article key={h.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#171411]">
              <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <Visual h={h} />
                <div className="flex flex-col p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] tracking-wider">
                    <span style={{ color: h.accent }}>{h.kicker.toUpperCase()}</span>
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-paper/70">{h.scope}</span>
                  </div>
                  <h3 className="mt-2 font-stencil text-[clamp(34px,4vw,48px)] leading-none">{h.title.toUpperCase()}</h3>
                  <div className="mt-3">
                    <motion.span key={h.stat} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.1 }}
                      className="block whitespace-nowrap font-stencil text-[clamp(40px,4.4vw,58px)] leading-none" style={{ color: h.accent }}>{h.stat}</motion.span>
                    <span className="mt-1 block text-[14px] text-paper/70">{h.statLabel}</span>
                  </div>
                  <ol className="mt-5 space-y-2.5">
                    {([["THE PROBLEM", h.beats.problem], ["WHAT I DID", h.beats.did], ["RESULT", h.beats.result]] as const).map(([k, v], n) => (
                      <motion.li key={k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + n * 0.12 }} className="grid grid-cols-[22px_1fr] gap-3">
                        <span className="mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[10px] font-bold text-ink" style={{ background: n === 2 ? h.accent : "rgba(239,233,220,.8)" }}>{n + 1}</span>
                        <span><span className="block font-mono text-[10px] tracking-[0.2em] text-paper/45">{k}</span><span className={`text-[15px] leading-snug ${n === 2 ? "text-paper" : "text-paper/85"}`}>{v}</span></span>
                      </motion.li>
                    ))}
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-1.5">{h.stack.map((s) => <span key={s} className="rounded-md bg-white/[.06] px-2 py-1 font-mono text-[10.5px] text-paper/70">{s}</span>)}</div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {h.href && <a href={h.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 font-mono text-[11px] font-bold text-ink" style={{ background: h.accent }}>{(h.cta || "Open").toUpperCase()} <ArrowUpRight size={14} /></a>}
                    <button type="button" onClick={() => onAsk(h.ask)} className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-4 py-2.5 font-mono text-[11px] hover:border-hazard"><MessageCircle size={14} /> ASK ME ABOUT THIS</button>
                    <button type="button" onClick={() => setI((i + 1) % HEROES.length)} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2.5 font-mono text-[11px] text-paper/60 hover:text-paper">NEXT <ArrowRight size={14} /></button>
                  </div>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {/* ---------- the logbook ---------- */}
        <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
          <div><div className="font-mono text-[11px] tracking-[0.25em] text-hazard">THE LOGBOOK · {LOG.length} MORE</div><p className="mt-1 text-sm text-paper/60">Sorted by business function. Click any line for my part.</p></div>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Project type">
            {FILTERS.map((x) => (
              <button key={x.id} role="tab" aria-selected={f === x.id} type="button" onClick={() => setF(x.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] ${f === x.id ? "border-paper bg-paper text-ink" : "border-white/20 text-paper/70 hover:border-white/50"}`}>
                {x.label} <span className="opacity-60">{LOG.filter((p) => inFilter(p.kind, x.id)).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Business function">
          <button role="tab" aria-selected={fn === "all"} type="button" onClick={() => setFn("all")} className={`rounded-full border px-3 py-1.5 text-[12.5px] ${fn === "all" ? "border-hazard bg-hazard font-semibold text-ink" : "border-white/20 text-paper/75 hover:border-white/50"}`}>All functions</button>
          {FNS.filter((x) => LOG.some((p) => p.fn === x.id)).map((x) => (
            <button key={x.id} role="tab" aria-selected={fn === x.id} type="button" onClick={() => setFn(x.id)}
              className="rounded-full border px-3 py-1.5 text-[12.5px]" style={fn === x.id ? { background: x.color, borderColor: x.color, color: "#14110e", fontWeight: 600 } : { borderColor: `${x.color}66`, color: "rgba(239,233,220,.8)" }}>
              {x.emoji} {x.label} <span className="opacity-60">{rows.filter((p) => p.fn === x.id).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-6">
          {FNS.filter((x) => (fn === "all" || fn === x.id) && rows.some((p) => p.fn === x.id)).map((x) => (
            <section key={x.id} aria-label={x.label}>
              <div className="mb-2 flex items-center gap-2 border-b pb-1.5" style={{ borderColor: `${x.color}55` }}>
                <span className="text-[18px]">{x.emoji}</span><h3 className="font-cond text-[20px] font-semibold" style={{ color: x.color }}>{x.label}</h3>
                <span className="font-mono text-[11px] text-paper/45">{rows.filter((p) => p.fn === x.id).length}</span>
              </div>
              <div className="grid items-start gap-2 md:grid-cols-2">
                {rows.filter((p) => p.fn === x.id).map((p) => <Row key={p.id} p={p} color={x.color} on={openRow === p.id} toggle={() => setOpenRow(openRow === p.id ? null : p.id)} onAsk={onAsk} />)}
              </div>
            </section>
          ))}
          {rows.filter((p) => fn === "all" || p.fn === fn).length === 0 && <p className="text-paper/55">Nothing of this type in that function yet.</p>}
        </div>
      </div>
    </motion.div>
  );
}

/** The left half of the stage: a browser-framed screenshot, or an illustration when there's no product to show. */
function Visual({ h }: { h: Hero }) {
  if (!h.img) {
    // Arogya: no live product, so show the idea as a phone conversation
    return (
      <div className="relative grid min-h-[300px] place-items-center overflow-hidden p-6" style={{ background: `radial-gradient(circle at 30% 20%, ${h.accent}33, transparent 60%), #12161c` }}>
        <div className="w-[230px] rounded-[28px] border-[6px] border-[#0b0d10] bg-[#f4f1e8] p-3 shadow-2xl">
          <div className="mb-2 text-center font-mono text-[10px] text-black/50">Arogya · family health</div>
          {[["agent", "Amma's BP tablets run out in 3 days."], ["agent", "Reorder from the usual pharmacy near her?"], ["me", "Yes, and tell my brother."], ["agent", "Ordered ✓ Delivery tomorrow 10 am. Ravi notified."]].map(([who, t], k) => (
            <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.45 }}
              className={`mb-1.5 max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${who === "me" ? "ml-auto bg-[#1f6feb] text-white" : "bg-white text-black shadow"}`}>{t}</motion.div>
          ))}
        </div>
        <span className="absolute bottom-3 left-3 font-mono text-[10px] text-paper/45">Illustration of the concept</span>
      </div>
    );
  }
  return (
    <div className="relative flex min-h-[260px] flex-col justify-center overflow-hidden bg-black/40 p-4 md:p-5" style={{ background: `radial-gradient(circle at 20% 10%, ${h.accent}2e, transparent 55%), #12100e` }}>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#1c1916] px-3 py-2"><i className="h-2 w-2 rounded-full bg-[#ff5f57]" /><i className="h-2 w-2 rounded-full bg-[#febc2e]" /><i className="h-2 w-2 rounded-full bg-[#28c840]" /><span className="ml-2 truncate font-mono text-[10px] text-paper/45">{h.href?.replace(/^https?:\/\//, "") || h.title}</span></div>
        <div className="group relative aspect-[16/10] overflow-hidden">
          <img src={A(h.img)} alt={`${h.title} screenshot`} className="h-full w-full object-cover object-top transition-transform duration-[2500ms] ease-out group-hover:scale-110" />
        </div>
      </div>
      {h.img2 && <motion.img initial={{ opacity: 0, rotate: 0, y: 20 }} animate={{ opacity: 1, rotate: -4, y: 0 }} transition={{ delay: 0.35 }} src={A(h.img2)} alt="" className="absolute bottom-3 right-3 w-[38%] rounded-md border-4 border-[#f2eee6] shadow-xl" />}
    </div>
  );
}

function Row({ p, color, on, toggle, onAsk }: { p: Project; color: string; on: boolean; toggle: () => void; onAsk: (q: string) => void }) {
  return (
    <div className="rounded-xl border transition-colors" style={{ borderColor: on ? color : "rgba(255,255,255,.1)", background: on ? "rgba(255,255,255,.04)" : undefined }}>
      <button type="button" onClick={toggle} aria-expanded={on} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1"><span className="block truncate font-cond text-[17px] font-semibold">{p.title}</span><span className="block truncate font-mono text-[10.5px] text-paper/50">{TYPE[p.kind]} · {p.where}</span></span>
        <span className="hidden shrink-0 rounded-full bg-white/[.07] px-2 py-0.5 font-mono text-[10px] text-paper/70 sm:inline">{p.status}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${on ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {on && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 px-4 pb-4 pl-8 text-[14px]">
              <p className="text-paper/80">{p.what}</p>
              <p><span className="font-mono text-[10px] tracking-wider" style={{ color }}>MY PART · </span><span className="text-paper/90">{p.mine}</span></p>
              <div className="flex flex-wrap gap-3 pt-1">
                {p.href && <a href={p.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-[11px] text-hazard">{(p.cta || "Open").toUpperCase()} <ArrowUpRight size={12} /></a>}
                <button type="button" onClick={() => onAsk(`Tell me about ${p.title}. What was your part?`)} className="inline-flex items-center gap-1 font-mono text-[11px] text-paper/70 hover:text-hazard"><MessageCircle size={12} /> ASK ME ABOUT THIS</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
