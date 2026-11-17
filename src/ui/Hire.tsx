import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, Mail, MessageCircle } from "lucide-react";
import { EMAIL, LINKS, WHATSAPP } from "../data";

const ROLES = ["Founder's Office", "Data / BI", "Product", "Strategy & Ops"];

/** A ready-to-send message: the visitor fills four blanks and it opens in their email or WhatsApp. */
export default function HireForm() {
  const [f, setF] = useState({ name: "", company: "", title: "", role: "Founder's Office", jd: "" });
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const who = f.name.trim() || "[your name]";
  const at = f.company.trim() || "[company]";
  const title = f.title.trim();
  const body = [
    "Hi Sumahar,",
    "",
    `I'm ${who}${title ? `, ${title}` : ""} at ${at}. I just test-drove your garage portfolio and I'd like to talk to you about a ${f.role || "role"} opening on our team.`,
    f.jd.trim() ? `\nHere's the JD: ${f.jd.trim()}` : "",
    "",
    "Are you free for a 20-minute call this week?",
    "",
    who,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  const subject = `${f.role} role at ${at} · let's talk`;
  const mail = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const wa = WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(body)}` : "";
  const copy = () => navigator.clipboard?.writeText(body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => {});
  const field = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-[14.5px] text-paper placeholder:text-paper/35 focus:border-hazard focus:outline-none";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-left">
      <div className="font-mono text-[10.5px] tracking-[0.2em] text-hazard">FILL THE BLANKS · I'LL REPLY WITHIN A DAY</div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role you're hiring for">
        {ROLES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={f.role === r} onClick={() => setF({ ...f, role: r })}
            className={`rounded-full px-3 py-1.5 text-[12.5px] ${f.role === r ? "bg-hazard font-semibold text-ink" : "border border-white/20 text-paper/75 hover:border-white/50"}`}>{r}</button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder="Your name" aria-label="Your name" value={f.name} onChange={set("name")} autoComplete="name" />
        <input className={field} placeholder="Company" aria-label="Company" value={f.company} onChange={set("company")} autoComplete="organization" />
        <input className={field} placeholder="Your role (optional)" aria-label="Your role" value={f.title} onChange={set("title")} autoComplete="organization-title" />
        <input className={field} placeholder="Link to the JD (optional)" aria-label="Link to the job description" value={f.jd} onChange={set("jd")} inputMode="url" />
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-[#f4f1e8] p-3.5 text-[13.5px] leading-relaxed text-[#1b1813]">
        <div className="mb-1.5 font-mono text-[10px] tracking-wider text-black/45">PREVIEW · {subject.toUpperCase()}</div>
        <div className="whitespace-pre-wrap">{body}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={mail} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-hazard px-5 py-2.5 font-mono text-xs font-bold text-ink hover:brightness-110"><Mail size={14} /> SEND BY EMAIL</a>
        {wa && <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2.5 font-mono text-xs font-bold text-ink"><MessageCircle size={14} /> SEND ON WHATSAPP</a>}
        <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 font-mono text-xs hover:border-hazard">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "COPIED" : "COPY MESSAGE"}</button>
        <a href={LINKS.linkedin} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-white/25 px-4 py-2.5 font-mono text-xs hover:border-hazard">LINKEDIN <ArrowUpRight size={13} /></a>
      </div>
      <p className="mt-2 text-[12px] text-paper/50">Or write to <span className="select-all text-paper/75">{EMAIL}</span></p>
    </motion.div>
  );
}
