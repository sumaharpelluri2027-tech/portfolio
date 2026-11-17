import { motion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { A, JOURNEY } from "../data";

/** The career road: where I studied, then every stop since, in order. */
export default function Journey({ onHire, compact = false }: { onHire?: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "" : "px-5 pb-8 pt-5"}>
      {!compact && (
        <>
          <div className="font-mono text-[11px] tracking-[0.25em] text-hazard">THE ROAD SO FAR</div>
          <h2 className="mt-1 font-stencil text-[34px] leading-none">MY CAREER JOURNEY</h2>
          <p className="mt-2 text-[14.5px] text-paper/65">Engineer → analyst → operator → builder. Five stops, in order.</p>
        </>
      )}
      <ol className="relative mt-6">
        <span className="absolute bottom-6 left-[21px] top-3 w-[6px] rounded bg-[#2b2622]" aria-hidden="true">
          <span className="absolute inset-x-[2px] inset-y-0 bg-[repeating-linear-gradient(to_bottom,#f2b705_0_10px,transparent_10px_22px)] opacity-70" />
        </span>
        {JOURNEY.map((s, i) => {
          const now = i === JOURNEY.length - 1;
          return (
            <motion.li key={s.where} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.08 }}
              className="relative mb-4 grid grid-cols-[48px_1fr] gap-3">
              <span className={`relative z-10 grid h-12 w-12 place-items-center rounded-full border-4 ${now ? "border-hazard" : "border-[#2b2622]"} bg-white p-1.5`}>
                {s.logo ? <img src={A(`logos/${s.logo}.png`)} alt="" className="max-h-7 w-auto" /> : <MapPin size={18} className="text-ink" />}
                {now && <span className="absolute -inset-1 animate-ping rounded-full border-2 border-hazard/60" aria-hidden="true" />}
              </span>
              <div className={`rounded-xl border p-3.5 ${now ? "border-hazard/60 bg-hazard/[.06]" : "border-white/10 bg-white/[.03]"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-cond text-[19px] font-semibold leading-tight">{s.where}</span>
                  <span className={`font-mono text-[11px] ${now ? "text-hazard" : "text-paper/55"}`}>{s.when}</span>
                </div>
                <div className="text-[13px] text-paper/75">{s.role}</div>
                <div className="font-mono text-[10.5px] text-paper/45">{s.place}</div>
                <p className="mt-2 text-[14px] leading-snug text-paper/85">{s.line}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {s.stats.map(([b, l]) => <span key={l} className="rounded-md bg-black/30 px-2 py-1 text-[12px]"><b className="font-stencil text-hazard">{b}</b> <span className="text-paper/65">{l}</span></span>)}
                </div>
              </div>
            </motion.li>
          );
        })}
        <motion.li initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="relative grid grid-cols-[48px_1fr] gap-3">
          <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border-4 border-dashed border-hazard bg-ink font-stencil text-hazard">?</span>
          <div className="rounded-xl border border-dashed border-hazard/60 p-3.5">
            <div className="font-cond text-[19px] font-semibold">Next stop: your team</div>
            <p className="text-[13.5px] text-paper/70">Founder's Office, data, product or strategy & ops. From 2027, or for an internship before.</p>
            {onHire && <button type="button" onClick={onHire} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-hazard px-4 py-2 font-mono text-[11px] font-bold text-ink">MAKE IT THE NEXT STOP <ArrowRight size={13} /></button>}
          </div>
        </motion.li>
      </ol>
    </div>
  );
}
