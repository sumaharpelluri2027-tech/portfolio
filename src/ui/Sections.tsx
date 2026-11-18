import { motion } from "framer-motion";
import { ArrowUpRight, Download, Linkedin, Mail, MessageCircle } from "lucide-react";
import { A, EDU, EMAIL, LINKS, WHATSAPP } from "../data";

/** The five things the garage is organised around. */
export type SectionId = "work" | "education" | "achievements" | "cocurricular" | "contact";
export const SECTIONS: { id: SectionId; label: string; emoji: string; station: "journey" | "driver" | "trophies" | "crew" | "laptop"; hint: string }[] = [
  { id: "work", label: "Work-ex", emoji: "💼", station: "journey", hint: "Myntra → Wipro → Rabbit Invest" },
  { id: "education", label: "Education", emoji: "🎓", station: "driver", hint: "VIT · Masters' Union" },
  { id: "achievements", label: "Achievements", emoji: "🏆", station: "trophies", hint: "AIR 8 · Round 2 · 1st place" },
  { id: "cocurricular", label: "Co-curriculars", emoji: "🎯", station: "crew", hint: "The Wing · Decco · cases" },
  { id: "contact", label: "Contact", emoji: "✉️", station: "laptop", hint: "Email · WhatsApp · CV · ask me" },
];
export const sectionOf = (station: string) => SECTIONS.find((s) => s.station === station);

const Head = ({ k, t }: { k: string; t: string }) => (
  <div className="border-b border-white/10 px-5 pb-4 pt-5 pr-14">
    <div className="font-mono text-[11px] tracking-[0.25em] text-hazard">{k}</div>
    <h2 className="font-stencil text-[30px] leading-none">{t}</h2>
  </div>
);

export function Education() {
  const rows = [
    { logo: "masters-union", t: "Masters' Union, Gurugram", when: "Class of 2027", d: "PGP in Technology & Business Management", pts: ["Vice President, AI & Analytics Wing", "Live AI products: BoardIQ, NutriSathi", "National case competitions: The Ken (Round 2), Vantage, Gambit"] },
    { logo: "vit", t: "VIT, Vellore", when: "Graduated 2022", d: "B.Tech, Mechanical Engineering · CGPA 8.39", pts: ["BAJA SAE India, All India Rank 8", "Designed the buggy's hybrid braking system", "Data analyst internship at Myntra in the final semester"] },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="🎓 EDUCATION" t="WHERE I TRAINED" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {rows.map((r, i) => (
          <motion.div key={r.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white p-1.5"><img src={A(`logos/${r.logo}.png`)} alt="" className="max-h-9 w-auto" /></span>
              <div className="min-w-0"><div className="font-cond text-[19px] font-semibold leading-tight">{r.t}</div><div className="text-[13px] text-paper/65">{r.d}</div></div>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-hazard">{r.when}</span>
            </div>
            <ul className="mt-3 space-y-1">{r.pts.map((p) => <li key={p} className="flex gap-2 text-[14px] text-paper/85"><span className="text-hazard">▸</span>{p}</li>)}</ul>
          </motion.div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          {([["94.5%", "Class XII"], ["9.7", "Class X CGPA"], ["AWS", "Cloud Practitioner, 2022"]] as const).map(([b, l]) => (
            <div key={l} className="rounded-lg bg-white/[.04] p-3 text-center"><div className="font-stencil text-[22px] text-hazard">{b}</div><div className="text-[11.5px] text-paper/60">{l}</div></div>
          ))}
        </div>
        <p className="text-[12px] text-paper/40">{EDU.length} institutions · photos from VIT and work coming soon</p>
      </div>
    </div>
  );
}

export function CoCurriculars({ onProjects }: { onProjects: () => void }) {
  const items: { e: string; t: string; d: string; img?: string; href?: string }[] = [
    { e: "🧠", t: "VP, AI & Analytics Wing", d: "Elected to lead the Wing at Masters' Union: events, recruitment, and four problem statements shortlisted for Case Union 4.0.", img: "img/aiaw-team.webp", href: LINKS.wing },
    { e: "🛍️", t: "Decco Store", d: "Our team's D2C brand: ₹3 lakh in 30 days, including a physical stall I ran.", img: "img/decco-stall.webp", href: LINKS.decco },
    { e: "🏁", t: "BAJA SAE India", d: "All India Rank 8 with VIT's team. I designed the hybrid braking system.", },
    { e: "📈", t: "Case competitions", d: "The Ken's Great Rewiring (Round 2), Vantage 2026, Gambit 2026, plus one-day challenges." },
    { e: "🏋️", t: "Powerlifting", d: "First place in deadlift in my weight category." },
    { e: "🎬", t: "The campaign film", d: "An AI-made film for my Wing election campaign.", href: LINKS.film },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Head k="🎯 CO-CURRICULARS" t="OUTSIDE THE JOB" />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((x, i) => (
            <motion.div key={x.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03]">
              {x.img && <img src={A(x.img)} alt="" className="h-32 w-full object-cover" />}
              <div className="p-3">
                <div className="font-cond text-[17px] font-semibold">{x.e} {x.t}</div>
                <p className="mt-0.5 text-[13px] leading-snug text-paper/70">{x.d}</p>
                {x.href && <a href={x.href} target="_blank" rel="noopener" className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-hazard">OPEN <ArrowUpRight size={12} /></a>}
              </div>
            </motion.div>
          ))}
        </div>
        <button type="button" onClick={onProjects} className="mt-4 w-full rounded-full border border-hazard/60 py-3 font-mono text-[12px] font-bold tracking-wider text-hazard hover:bg-hazard/10">SEE EVERY PROJECT, BY FUNCTION →</button>
      </div>
    </div>
  );
}

/** A compact contact strip that sits above the chat. */
export function ContactStrip() {
  const btn = "inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 font-mono text-[11px] hover:border-hazard";
  return (
    <div className="border-b border-white/10 px-4 py-3 pr-14">
      <div className="font-mono text-[10px] tracking-[0.22em] text-hazard">✉️ CONTACT</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a href={`mailto:${EMAIL}`} target="_blank" rel="noopener" className={btn}><Mail size={13} /> EMAIL</a>
        <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener" className={btn}><MessageCircle size={13} /> WHATSAPP</a>
        <a href={LINKS.linkedin} target="_blank" rel="noopener" className={btn}><Linkedin size={13} /> LINKEDIN</a>
        <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className={`${btn} border-hazard/60 text-hazard`}><Download size={13} /> CV</a>
      </div>
    </div>
  );
}
