import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { A } from "../data";
import { FACTS, quickAnswer } from "../bot";

type Msg = { who: "me" | "ai"; text: string; typing?: boolean };
type Sample = (msgs: { role: string; content: string }[], opts: Record<string, unknown>) => Promise<{ text: string }>;
const SUGG = ["What did you build at Rabbit Invest?", "Tell me about BoardIQ", "Why hire you for a Founder's Office role?", "How did you automate 80%?"];

/** Sumahar AI, as a terminal on the laptop. Uses live Claude when the page runs inside a Claude viewer, offline answers otherwise. */
export default function Bot() {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "ai", text: "Hey, I'm Sumahar. Ask me about anything in this garage: what I built, the numbers behind it, or whether I'd fit your team." }]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState("");
  const sample = useRef<Sample | null>(null);
  const turns = useRef<{ role: string; content: string }[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<Sample | null> } }).claude;
    if (c && typeof c.use === "function") c.use("sample").then((fn) => { if (fn) { sample.current = fn; setLive(true); } }, () => {});
    setTimeout(() => input.current?.focus(), 300);
  }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);

  const setLast = (text: string) => setMsgs((m) => [...m.slice(0, -1), { who: "ai", text }]);
  const ask = (raw: string) => {
    const text = raw.trim(); if (!text || busy) return;
    setBusy(true); setQ("");
    setMsgs((m) => [...m, { who: "me", text }, { who: "ai", text: "", typing: true }]);
    const finish = () => { setBusy(false); input.current?.focus(); };
    if (live && sample.current) {
      turns.current.push({ role: "user", content: text });
      sample.current([{ role: "user", content: FACTS }, ...turns.current.slice(-10)], { cache: false, modelTier: "quick", onText: (u: { text: string }) => setLast(u.text) })
        .then((r) => { setLast(r.text); turns.current.push({ role: "assistant", content: r.text }); finish(); },
          (e: { code?: string; text?: string }) => {
            turns.current.pop();
            if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled"].includes(e.code || "")) setLive(false);
            setLast(e?.text || quickAnswer(text)); finish();
          });
    } else setTimeout(() => { setLast(quickAnswer(text)); finish(); }, 450 + Math.random() * 350);
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0f0b] font-mono text-[13.5px] text-[#c9f5d6]">
      <div className="relative h-28 shrink-0 overflow-hidden"><img src={A("me/desk-night.webp")} alt="" className="h-full w-full object-cover object-[60%_35%] opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0b] to-transparent" /></div>
      <div className="flex items-center gap-3 border-b border-lcd/20 px-4 py-3">
        <img src={A("me/avatar.webp")} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-lcd/50" />
        <div>
          <div className="text-sm font-bold tracking-wider text-lcd">sumahar-ai ~ $</div>
          <div className="text-[10px] tracking-[0.2em] text-lcd/60">{live ? "LIVE MODEL" : "OFFLINE ANSWERS"} · SPEAKS AS ME</div>
        </div>
      </div>
      <div ref={log} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.who === "me" ? "self-end max-w-[88%] text-right text-paper" : "max-w-[92%] whitespace-pre-wrap"}>
            <span className={m.who === "me" ? "text-hazard" : "text-lcd"}>{m.who === "me" ? "you › " : "sp › "}</span>
            {m.typing && !m.text ? <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>▮</motion.span> : m.text}
          </div>
        ))}
      </div>
      {msgs.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {SUGG.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded border border-lcd/30 px-2.5 py-1.5 text-left text-xs text-lcd/90 hover:bg-lcd/10">{s}</button>)}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-lcd/20 p-3">
        <span className="self-center text-lcd">›</span>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ask me anything" aria-label="Your question" autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-paper placeholder:text-lcd/35 focus:outline-none" />
        <button type="submit" disabled={busy} aria-label="Send" className="grid h-10 w-10 place-items-center rounded bg-lcd text-black disabled:opacity-40"><Send size={16} /></button>
      </form>
    </div>
  );
}
