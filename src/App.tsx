import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import ParticleBackground from "./components/ParticleBackground";
import { Header, Hero, InfoDrawer } from "./components/Chrome";
import { About, Contact, Experience, Explore, Labs, LogoStrip, Manifesto, MethodMarquee, NextPage, Numbers, PageFooter, Products, Work } from "./components/Sections";
import { Chatbot, Intro, Story } from "./components/Overlays";
import { Cursor } from "./components/fx";
import { A } from "./data";

const PAGES = ["home", "work", "experience", "labs", "about", "contact"] as const;
type Page = (typeof PAGES)[number];
const ALIAS: Record<string, Page> = { top: "home", projects: "labs", lab: "labs", skills: "about", process: "about", "case-files": "experience", ask: "contact" };
function readPage(): Page {
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  const p = (ALIAS[h] || h) as Page;
  return PAGES.includes(p) ? p : "home";
}
const TITLES: Record<Page, string> = {
  home: "Sumahar Pelluri | Systems builder: data, operations, AI",
  work: "Work | Sumahar Pelluri", experience: "Experience | Sumahar Pelluri", labs: "Labs | Sumahar Pelluri",
  about: "About | Sumahar Pelluri", contact: "Contact | Sumahar Pelluri",
};

/** Lime curtain that wipes up on every page change. */
function Curtain({ k }: { k: string }) {
  return (
    <motion.div key={k} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] origin-top bg-lime"
      initial={{ scaleY: 1 }} animate={{ scaleY: 0 }} transition={{ duration: 0.75, ease: [0.7, 0, 0.3, 1] }} />
  );
}
const Pad = ({ children }: { children: ReactNode }) => <div className="pt-[clamp(120px,14vw,190px)]">{children}</div>;

export default function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [first, setFirst] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [bot, setBot] = useState(false);
  const [story, setStory] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const { scrollYProgress } = useScroll();
  const prog = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  useEffect(() => {
    const on = () => { setFirst(false); setPage(readPage()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { document.title = TITLES[page]; }, [page]);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    const s = () => setPlaying(!a.paused);
    a.addEventListener("play", s); a.addEventListener("pause", s); a.addEventListener("ended", s);
    return () => { a.removeEventListener("play", s); a.removeEventListener("pause", s); a.removeEventListener("ended", s); };
  }, []);
  const play = () => { const p = audio.current?.play(); setStarted(true); p?.catch(() => {}); };
  const toggleSound = useCallback(() => { const a = audio.current; if (!a) return; if (a.paused) play(); else a.pause(); }, []);
  const openStory = useCallback(() => { setStory(true); play(); }, []);
  const closeStory = useCallback(() => setStory(false), []);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  let body: ReactNode;
  switch (page) {
    case "work": body = <><Pad><Work /></Pad><Products /><NextPage id="experience" label="Experience" /><PageFooter /></>; break;
    case "experience": body = <><Experience /><MethodMarquee /><div className="h-24" /><NextPage id="labs" label="Labs" /><PageFooter /></>; break;
    case "labs": body = <><Pad><Labs /></Pad><NextPage id="about" label="About" /><PageFooter /></>; break;
    case "about": body = <><Pad><Manifesto /></Pad><About /><NextPage id="contact" label="Contact" /><PageFooter /></>; break;
    case "contact": body = <Contact onDrawer={() => setDrawer(true)} onBot={() => setBot(true)} onStory={openStory} />; break;
    default: body = <><Hero onStory={openStory} /><LogoStrip /><Numbers /><Explore /><PageFooter /></>;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-space text-white">
      <ParticleBackground />
      <motion.div aria-hidden="true" className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-lime" style={{ scaleX: prog }} />
      <Header onDrawer={() => setDrawer(true)} playing={playing} onSound={toggleSound} started={started} page={page} />
      <AnimatePresence mode="wait">
        <motion.main key={page} initial={{ opacity: 0, y: first ? 0 : 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: first ? 0 : 0.25 }}>
          {body}
        </motion.main>
      </AnimatePresence>
      {!first && <Curtain k={page} />}
      <InfoDrawer open={drawer} onClose={closeDrawer} onStory={openStory} />
      <Chatbot open={bot} setOpen={setBot} />
      <Story open={story} onClose={closeStory} playing={playing} onSound={toggleSound} />
      <Intro />
      <Cursor />
      <audio ref={audio} preload="none" src={A("audio/chasing-the-horizon.mp3")} />
    </div>
  );
}
