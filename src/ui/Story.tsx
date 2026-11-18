import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import { A } from "../data";
import * as voice from "../narrate";

/**
 * My story, narrated: one line per chapter, a picture behind each, about a minute end to end.
 * Swap `img` for real photos (VIT, work) as they come in; drop a recording at assets/voice/story-<n>.mp3 and list it in narrate.RECORDED.
 */
export const CHAPTERS: { tag: string; title: string; line: string; img: string; logo?: string; stat?: [string, string] }[] = [
  { tag: "HELLO", title: "I'm Sumahar.", line: "Hi, I'm Sumahar. I make businesses run better.", img: "me/cover.webp" },
  { tag: "VIT · → 2022", title: "The engineer", line: "Mechanical engineer from VIT. Our BAJA buggy ranked eighth in India.", img: "me/studio-smile.webp", logo: "vit", stat: ["AIR 8", "BAJA SAE India"] },
  { tag: "MYNTRA · 2022", title: "The analyst", line: "Then Myntra. My funnel analysis reached a CEO-level budget call.", img: "me/desk-night.webp", logo: "myntra", stat: ["CEO-level", "budget call"] },
  { tag: "WIPRO · 2022–24", title: "The client side", line: "At Wipro, I rebuilt CRM reporting for over a hundred accounts.", img: "me/desk-night.webp", logo: "wipro", stat: ["+40%", "pipeline visibility"] },
  { tag: "RABBIT INVEST · 2024–26", title: "The operator", line: "At Rabbit Invest, I built ops from zero. Data accuracy went from fifty to ninety-five percent.", img: "me/clean.webp", logo: "rabbit-invest", stat: ["50→95%", "data accuracy"] },
  { tag: "MASTERS' UNION · NOW", title: "The builder", line: "Now at Masters' Union: shipping AI products, and leading the AI Wing.", img: "img/aiaw-team.webp", logo: "masters-union", stat: ["2", "live AI products"] },
  { tag: "YOUR TURN", title: "Look around, or drive.", line: "This garage is my career. Look around, or take it for a drive.", img: "me/cover.webp" },
];

export default function Story({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [talk, setTalk] = useState(!voice.isMuted());
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; voice.stop(); }, []);
  useEffect(() => {
    let cancelled = false;
    const c = CHAPTERS[i];
    (async () => {
      await voice.say(c.line, `story-${i + 1}`);
      if (cancelled || !alive.current) return;
      await new Promise((r) => window.setTimeout(r, 450));
      if (cancelled || !alive.current) return;
      if (i < CHAPTERS.length - 1) setI(i + 1); else onDone();
    })();
    return () => { cancelled = true; };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { voice.stop(); onDone(); } if (e.key === "ArrowRight") { voice.stop(); setI((v) => Math.min(CHAPTERS.length - 1, v + 1)); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onDone]);
  const c = CHAPTERS[i];
  return (
    <motion.div role="dialog" aria-label="My story, narrated" className="absolute inset-0 z-[45] overflow-hidden bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <AnimatePresence mode="sync">
        <motion.img key={i} src={A(c.img)} alt="" className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 0.5, scale: 1 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: 0.9 }, scale: { duration: 9, ease: "linear" } }} />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-4 md:p-6">
        <div className="flex flex-1 gap-1">{CHAPTERS.map((_, k) => <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"><motion.span className="block h-full bg-hazard" initial={false} animate={{ width: k < i ? "100%" : k === i ? "60%" : "0%" }} transition={{ duration: k === i ? 4 : 0.3 }} /></span>)}</div>
        <button type="button" onClick={() => { const v = !talk; setTalk(v); voice.setMuted(!v); }} aria-label={talk ? "Mute the narrator" : "Turn the narrator on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/40">{talk ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        <button type="button" onClick={() => { voice.stop(); onDone(); }} className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-4 py-2.5 font-mono text-[11px] tracking-wider hover:border-hazard"><SkipForward size={14} /> SKIP</button>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 pb-10 md:p-12">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }} className="mx-auto max-w-[860px]">
            <div className="flex items-center gap-3">
              {c.logo && <span className="grid h-11 w-11 place-items-center rounded-lg bg-white p-1.5"><img src={A(`logos/${c.logo}.png`)} alt="" className="max-h-8 w-auto" /></span>}
              <span className="font-mono text-[12px] font-bold tracking-[0.25em] text-hazard">{c.tag}</span>
            </div>
            <h2 className="mt-2 font-stencil text-[clamp(40px,7vw,84px)] leading-[0.9]">{c.title}</h2>
            <p className="mt-3 max-w-[64ch] text-[clamp(16px,1.8vw,20px)] leading-snug text-paper/90">{c.line}</p>
            {c.stat && <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-hazard/50 bg-black/40 px-4 py-2"><span className="font-stencil text-[30px] text-hazard">{c.stat[0]}</span><span className="text-[14px] text-paper/70">{c.stat[1]}</span></div>}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
