import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Mail } from "lucide-react";
import { A, EMAIL } from "../data";
import { FACTS, quickAnswer } from "../bot";
import { PROJECTS } from "../projects";

type Msg = { who: "me" | "ai"; text: string; typing?: boolean };
type Sample = (msgs: { role: string; content: string }[], opts: Record<string, unknown>) => Promise<{ text: string }>;

const TOPICS: { label: string; emoji: string; qs: string[] }[] = [
  { label: "My work", emoji: "🛠", qs: ["How did you take data accuracy from 50% to 95%?", "How did you automate 80% of manual ops?", "What did you do at Wipro?"] },
  { label: "Projects", emoji: "🚀", qs: ["Tell me about BoardIQ", "What is NutriSathi?", "How did Decco Store reach ₹3 lakh?"] },
  { label: "Fit", emoji: "🎯", qs: ["Why hire you for a Founder's Office role?", "Why hire you for a data role?", "What's the hardest problem you've solved?"] },
  { label: "About me", emoji: "👋", qs: ["What are you studying?", "What do you do outside work?", "How do I reach you?"] },
];
const ALL_QS = TOPICS.flatMap((t) => t.qs);

/** Any project named in the question gets its own record, so every logbook line can be questioned. */
function answer(q: string) {
  const s = q.toLowerCase();
  const p = PROJECTS.find((x) => { const name = x.title.split(/ · | \(/)[0].toLowerCase(); return name.length > 3 && s.includes(name); });
  if (p && !/^(how|why) /.test(s)) return `${p.what} My part: ${p.mine}${p.href ? ` Have a look: ${p.href.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : ""}`;
  return quickAnswer(q);
}

/** Ask Sumahar: a friendly chat. Uses live Claude inside a Claude viewer, short offline answers everywhere else. */
export default function Bot({ initialQuestion }: { initialQuestion?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState(0);
  const asked = useRef(new Set<string>());
  const sample = useRef<Sample | null>(null);
  const turns = useRef<{ role: string; content: string }[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<Sample | null> } }).claude;
    if (c && typeof c.use === "function") c.use("sample").then((fn) => { if (fn) { sample.current = fn; setLive(true); } }, () => {});
  }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  useEffect(() => { if (initialQuestion && !fired.current) { fired.current = true; window.setTimeout(() => ask(initialQuestion), 350); } }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLast = (text: string) => setMsgs((m) => [...m.slice(0, -1), { who: "ai", text }]);
  const ask = (raw: string) => {
    const text = raw.trim(); if (!text || busy) return;
    asked.current.add(text);
    setBusy(true); setQ("");
    setMsgs((m) => [...m, { who: "me", text }, { who: "ai", text: "", typing: true }]);
    const finish = () => setBusy(false);
    if (live && sample.current) {
      turns.current.push({ role: "user", content: text });
      sample.current([{ role: "user", content: FACTS }, ...turns.current.slice(-10)], { cache: false, modelTier: "quick", onText: (u: { text: string }) => setLast(u.text) })
        .then((r) => { setLast(r.text); turns.current.push({ role: "assistant", content: r.text }); finish(); },
          (e: { code?: string; text?: string }) => {
            turns.current.pop();
            if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled"].includes(e.code || "")) setLive(false);
            setLast(answer(text)); finish();
          });
    } else window.setTimeout(() => { setLast(answer(text)); finish(); }, 550 + Math.random() * 400);
  };
  const next = ALL_QS.filter((x) => !asked.current.has(x)).slice(0, 2);
  const fresh = msgs.length === 0;

  return (
    <div className="flex h-full min-h-[520px] flex-col bg-[#14110e] text-paper">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 pr-14">
        <div className="relative"><img src={A("me/avatar.webp")} alt="" className="h-11 w-11 rounded-full object-cover" /><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#14110e] bg-[#3ddc84]" /></div>
        <div className="min-w-0">
          <div className="font-cond text-[19px] font-semibold leading-tight">Ask Sumahar</div>
          <div className="text-[12px] text-paper/55">{live ? "AI version of me · answers from my real record" : "Quick answers from my real record"}</div>
        </div>
      </div>

      <div ref={log} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4" aria-live="polite">
        {fresh && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <img src={A("me/avatar.webp")} alt="" className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-hazard/30" />
            <div className="mt-2 font-cond text-[22px] font-semibold">Hey 👋 ask me anything</div>
            <p className="mx-auto mt-1 max-w-[300px] text-[14px] text-paper/60">What I built, the numbers behind it, or whether I'd fit your team. Pick a topic or type below.</p>
          </motion.div>
        )}
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25 }}
            className={`flex items-end gap-2 ${m.who === "me" ? "justify-end" : ""}`}>
            {m.who === "ai" && <img src={A("me/avatar.webp")} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />}
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-[1.5] ${m.who === "me" ? "rounded-br-md bg-hazard font-medium text-ink" : "rounded-bl-md bg-white/[.07] text-paper/95"}`}>
              {m.typing && !m.text ? (
                <span className="flex gap-1 py-1" aria-label="typing">{[0, 1, 2].map((d) => <motion.i key={d} className="h-1.5 w-1.5 rounded-full bg-paper/60" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />)}</span>
              ) : m.text}
            </div>
          </motion.div>
        ))}
        {!fresh && !busy && (
          <div className="mt-1 flex flex-wrap gap-1.5 pl-9">
            {next.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/15 px-3 py-1.5 text-left text-[12.5px] text-paper/75 hover:border-hazard hover:text-paper">{s}</button>)}
            <a href={`mailto:${EMAIL}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-paper/75 hover:border-hazard"><Mail size={12} /> Ask me directly</a>
          </div>
        )}
      </div>

      {fresh && (
        <div className="px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
            {TOPICS.map((t, k) => (
              <button key={t.label} type="button" onClick={() => setTopic(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] ${k === topic ? "bg-paper text-ink" : "bg-white/[.06] text-paper/70 hover:bg-white/10"}`}>{t.emoji} {t.label}</button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={topic} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-1.5">
              {TOPICS[topic].qs.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2.5 text-left text-[14px] text-paper/85 hover:border-hazard/60 hover:bg-white/[.06]">{s}</button>)}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2 border-t border-white/10 p-3">
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question…" aria-label="Your question" autoComplete="off"
          className="min-w-0 flex-1 rounded-full bg-white/[.07] px-4 py-2.5 text-[14.5px] text-paper placeholder:text-paper/35 focus:outline-none focus:ring-2 focus:ring-hazard/50" />
        <button type="submit" disabled={busy || !q.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hazard text-ink transition-opacity disabled:opacity-30"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
