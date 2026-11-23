import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronUp, Download, Lightbulb, FileText, Route, Flag, LayoutGrid, MessageCircle, Music2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import * as voice from "./narrate";
import { GuideCard, HelpMenu, QuickView, TOUR } from "./ui/Guide";
import { createGarage, type GarageAPI } from "./scene/garage";
import { createBuggy } from "./scene/buggyEntry";
import { A, EMAIL } from "./data";
import { CAR_ORDER, JOBS, PROPS, type CarPart, type StationId } from "./content";
import { Decco, Diagnostic, JobCardView, Sheet, ToolChest, Trophies } from "./ui/Panels";
import { PROJECTS, type Kind } from "./projects";
const COLS = ([["LIVE", "#5dff9a", "live"], ["CASES", "#f2b705", "case"], ["MU COURSEWORK", "#7fc8ff", "course"], ["WING & PROTOTYPES", "#ff8a65", "lead"]] as const).map(([title, color, k]) => ({ title, color, items: PROJECTS.filter((p) => p.kind === k || (k === "lead" && p.kind === "proto")).map((p) => p.title) }));
import Bot from "./ui/Bot";
import Projects from "./ui/Projects";
import Journey from "./ui/Journey";
import Story from "./ui/Story";
import { CoCurriculars, ContactStrip, Education, SECTIONS } from "./ui/Sections";
const Specs = lazy(() => import("./ui/Specs"));
import Achievement from "./ui/Achievement";
const Drive = lazy(() => import("./ui/Drive"));

/** The shutter going up: a short metallic rattle made on the fly. */
function rattle() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new AC(); const len = 1.5; const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / c.sampleRate; const click = Math.sin(t * 2 * Math.PI * 28) > 0.6 ? 1 : 0.25; d[i] = (Math.random() * 2 - 1) * click * Math.min(1, t * 8) * Math.max(0, 1 - t / len); }
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = 0.35; src.connect(f); f.connect(g); g.connect(c.destination); src.start();
    window.setTimeout(() => c.close().catch(() => {}), 2000);
  } catch { /* sound is optional */ }
}

const isPart = (id: StationId | null): id is CarPart => !!id && id in JOBS;
const Tick = ({ on }: { on: boolean }) => <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${on ? "border-hazard bg-hazard text-ink" : "border-white/25 text-transparent"}`}>✓</span>;
const ALIAS: Record<string, string> = { work: "specs", experience: "specs", labs: "specs", about: "specs", contact: "specs", resume: "specs" };

function useRoute() {
  const read = () => { const h = window.location.hash.replace(/^#\/?/, "").toLowerCase(); return ALIAS[h] || h; };
  const [r, setR] = useState(read);
  useEffect(() => { const on = () => { setR(read()); window.scrollTo(0, 0); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  return r;
}

export default function App() {
  const route = useRoute();
  useEffect(() => { document.title = route === "specs" ? "Spec sheet | Sumahar Pelluri" : "Sumahar's Garage | Sumahar Pelluri"; }, [route]);
  const webgl = useRef<boolean | null>(null);
  if (webgl.current === null) { try { const c = document.createElement("canvas"); webgl.current = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { webgl.current = false; } }
  if (route === "specs" || !webgl.current) return <Suspense fallback={<Loading text="OPENING THE SPEC SHEET" />}><Specs /></Suspense>;
  if (route === "drive") return <Suspense fallback={<Loading text="ROLLING THE BUGGY OUT" />}><Drive onExit={() => { window.location.hash = "#/"; }} /></Suspense>;
  return <Garage />;
}

function Loading({ text }: { text: string }) {
  return <div className="fixed inset-0 grid place-items-center bg-ink text-center"><div><div className="font-stencil text-5xl">SUMAHAR'S <span className="text-hazard">GARAGE</span></div><div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded bg-white/10"><div className="h-full w-1/3 animate-pulse bg-hazard" /></div><div className="mt-3 font-mono text-[11px] tracking-[0.25em] text-paper/50">{text}…</div></div></div>;
}

/* =================================================================== */
function Garage() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<GarageAPI | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "gate" | "intro" | "live">("loading");
  const [hover, setHover] = useState<StationId | null>(null);
  const [open, setOpen] = useState<StationId | null>(null);
  const [xray, setXray] = useState(false);
  const [list, setList] = useState(false);
  const [story, setStory] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<Kind | "all" | null>(null);
  const [askQ, setAskQ] = useState<{ q?: string; n: number }>({ n: 0 });
  const [seen, setSeen] = useState<CarPart[]>([]);
  const [seenAll, setSeenAll] = useState<StationId[]>([]);
  const [award, setAward] = useState<null | { how: "garage" | "track"; lap?: string | null }>(null);
  const awarded = useRef(false);
  const audio = useRef<HTMLAudioElement>(null);
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2600); };
  const toggleRadio = useCallback(() => {
    const a = audio.current; if (!a) return;
    if (a.paused) { a.play().then(() => flash("Now playing · “Chasing the Horizon”, an original track"), () => {}); } else { a.pause(); flash("Radio off"); }
  }, []);

  const select = useCallback((id: StationId) => {
    const g = api.current; if (!g) return;
    setList(false);
    setSeenAll((s) => (s.includes(id) ? s : [...s, id]));
    if (id === "powerbox") { setXray((x) => !x); setOpen(null); g.focus(null); return; }
    if (id === "radio") { toggleRadio(); return; }
    if (id === "clipboard") { window.location.hash = "#/specs"; return; }
    if (id === "exit") { g.focus("exit"); window.setTimeout(() => { window.location.hash = "#/drive"; }, 900); return; }
    if (id === "board" || id === "shipped" || id === "prototypes") { setOpen(null); g.focus(id); window.setTimeout(() => setBoard(id === "shipped" ? "live" : id === "prototypes" ? "proto" : "all"), 650); return; }
    setXray(false);
    if (isPart(id)) setSeen((s) => (s.includes(id) ? s : [...s, id]));
    setOpen(id); g.focus(id);
  }, [toggleRadio]);
  const close = useCallback(() => { setOpen(null); api.current?.focus(null); }, []);
  useEffect(() => {
    if (!open && seen.length === CAR_ORDER.length && !awarded.current) { awarded.current = true; const t = window.setTimeout(() => setAward({ how: "garage" }), 500); return () => window.clearTimeout(t); }
  }, [open, seen]);

  useEffect(() => { api.current?.setXray(xray); if (xray) setOpen(null); }, [xray]);

  useEffect(() => {
    if (!host.current) return;
    const g = createGarage({
      container: host.current,
      createBuggy,
      images: { "aiaw-event": A("img/aiaw-event.webp"), "aiaw-team": A("img/aiaw-team.webp"), "decco-stall": A("img/decco-stall.webp"), "decco-team": A("img/decco-team.webp"), "decco-shot": A("img/decco-shot.webp"), driver: A("me/studio-smile.webp") },
      boardColumns: COLS,
      onHover: setHover,
      onSelect: (id) => selectRef.current(id),
      onFree: () => { setOpen(null); setLooked(true); },
      onReady: () => setPhase("live"),
      onProgress: (p) => setProgress(p),
      quality: coarse.current || window.innerWidth < 760 || /[?&]low\b/.test(window.location.search) ? "low" : "high",
    });
    api.current = g;
    const t = window.setTimeout(() => setPhase((p) => (p === "loading" ? "gate" : p)), 15000); // the button waits for everything to load (with a safety net)
    return () => { window.clearTimeout(t); g.dispose(); api.current = null; };
  }, []);
  const selectRef = useRef(select); selectRef.current = select;
  const [voiceOn, setVoiceOn] = useState(() => !voice.isMuted());
  const [lights, setLights] = useState<"full" | "normal">(() => { try { return (localStorage.getItem("sp-lightmode") as "full" | "normal") || "full"; } catch { return "full"; } });
  useEffect(() => { api.current?.setLights(lights); try { localStorage.setItem("sp-lightmode", lights); } catch { /* ignore */ } }, [lights]);
  useEffect(() => {
    if (phase !== "gate") return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openShutter(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === "loading" && progress >= 1) setPhase("gate"); }, [progress, phase]);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    const s = () => setPlaying(!a.paused);
    a.addEventListener("play", s); a.addEventListener("pause", s); a.addEventListener("ended", s);
    return () => { a.removeEventListener("play", s); a.removeEventListener("pause", s); a.removeEventListener("ended", s); };
  }, []);
  // deep links: #/part/brakes
  useEffect(() => {
    if (phase !== "live") return;
    const m = window.location.hash.match(/^#\/(?:part|open)\/([a-z]+)/);
    if (m && (m[1] in JOBS || PROPS.some((p) => p.id === m[1]))) select(m[1] as StationId);
  }, [phase, select]);

  const openShutter = () => { rattle(); switchOn(); };
  const switchOn = () => { setPhase("intro"); api.current?.startIntro(); try { sessionStorage.setItem("sp-lights", "1"); } catch { /* ignore */ } };
  useEffect(() => { if (phase === "gate") { let on = false; try { on = sessionStorage.getItem("sp-lights") === "1"; } catch { /* ignore */ } if (on) switchOn(); } }, [phase]); // returning visitors skip the gate
  const live = phase === "live";
  const stationIds: StationId[] = [...CAR_ORDER, ...PROPS.map((p) => p.id)];
  const nameOf = (id: StationId) => (isPart(id) ? JOBS[id].hover : PROPS.find((p) => p.id === id)?.label + " · " + PROPS.find((p) => p.id === id)?.hint);

  /* ---- guide: greeting → tour → help menu ---- */
  const [guide, setGuide] = useState<"greet" | "tour" | "help">("greet");
  const [step, setStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [looked, setLooked] = useState(false);
  useEffect(() => { try { if (localStorage.getItem("sp-toured") === "1") setGuide("help"); } catch { /* ignore */ } }, []);
  const tourGo = useCallback((k: number) => {
    const st = TOUR[k]; setStep(k); setOpen(null); setXray(false);
    if (st.target) api.current?.focus(st.target); else api.current?.focus(null);
  }, []);
  useEffect(() => { api.current?.setHidden(!!board || story); }, [board, story]);
  const storyShown = useRef(false);
  useEffect(() => { if (live && guide === "greet" && !storyShown.current) { storyShown.current = true; setStory(true); } }, [live, guide]);
  const dismissGreet = () => { setGuide("help"); try { localStorage.setItem("sp-toured", "1"); } catch { /* ignore */ } };
  const startTour = () => { setHelpOpen(false); setBoard(null); setGuide("tour"); tourGo(0); };
  const endTour = () => { setGuide("help"); api.current?.focus(null); try { localStorage.setItem("sp-toured", "1"); } catch { /* ignore */ } };
  const tourTarget = guide === "tour" ? TOUR[step].target : null;
  const goDrive = () => { window.location.hash = "#/drive"; };
  useEffect(() => {
    if (!live) return;
    const k = (e: KeyboardEvent) => {
      if (open || board || story || guide === "greet" || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      setLooked(true); api.current?.turn(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  useEffect(() => {
    if (!live || looked) return;
    const h = host.current; if (!h) return;
    const d = () => setLooked(true);
    h.addEventListener("pointerdown", d); const t = window.setTimeout(d, 14000);
    return () => { h.removeEventListener("pointerdown", d); window.clearTimeout(t); };
  }, [live, looked]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <div ref={host} className="absolute inset-0" aria-label="A 3D garage. The car parts and garage objects open my work. Use the Explore menu for a keyboard-friendly list." role="application" />

      {/* labels: quiet until you hover, or the tour points at them */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {stationIds.map((id) => {
          const sec = SECTIONS.find((x) => x.station === id);
          if (sec) {
            const show = live && !xray && !open && !story && guide !== "greet";
            return (
              <div key={id} ref={(el) => api.current?.bindLabel(id, el)} className="label absolute left-0 top-0">
                {show && (
                  <button type="button" onClick={() => select(id)} className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-hazard bg-ink/90 px-3 py-1.5 font-mono text-[11.5px] font-bold tracking-wider text-paper shadow-[0_6px_20px_rgba(0,0,0,.5)] hover:bg-hazard hover:text-ink">
                    <span>{sec.emoji}</span>{sec.label.toUpperCase()}
                  </button>
                )}
              </div>
            );
          }
          const on = live && !xray && (hover === id || tourTarget === id) && (!open || open === id);
          return (
            <div key={id} ref={(el) => api.current?.bindLabel(id, el)} className="label absolute left-0 top-0" aria-hidden="true">
              <AnimatePresence>
                {on && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/90 px-3 py-1.5 font-mono text-[11px] tracking-wider text-paper ring-1 ring-hazard/70">
                    {nameOf(id)}{!coarse.current && <span className="ml-2 text-hazard">CLICK</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {CAR_ORDER.map((id) => (
          <div key={"w" + id} ref={(el) => api.current?.bindLabel("wire-" + id, el)} aria-hidden="true" className="label absolute left-0 top-0 transition-opacity duration-500" style={{ opacity: xray ? 1 : 0 }}>
            <button type="button" onClick={() => { setXray(false); setTimeout(() => select(id), 50); }} className={`${xray ? "pointer-events-auto" : ""} -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded border border-bpline/60 bg-bp/90 px-2.5 py-1.5 text-left font-mono text-[10.5px] text-[#cfe9ff] hover:border-hazard`}>
              <span className="block text-hazard">{JOBS[id].part.toUpperCase()} · {JOBS[id].area}</span>
              {JOBS[id].wiring.pipeline[0]} → … → {JOBS[id].wiring.pipeline[JOBS[id].wiring.pipeline.length - 1]}
            </button>
          </div>
        ))}
      </div>

      {/* x-ray sweep + banner */}
      <AnimatePresence>
        {xray && (
          <>
            <motion.div key="sweep" className="scanline pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-bpline/40 to-transparent" />
            <motion.div key="bn" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-20 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-bpline/50 bg-bp/90 p-4 text-center font-mono text-[#cfe9ff] backdrop-blur">
              <div className="text-[11px] tracking-[0.25em] text-bpline">BONNET UP · DATA WIRING VISIBLE</div>
              <p className="mt-1 font-sans text-[15px]">Every part of this car runs on data I wired myself. Click a tag to open its job card.</p>
              <button type="button" onClick={() => setXray(false)} className="mt-3 rounded-full border border-bpline/60 px-4 py-1.5 text-[11px] tracking-wider hover:bg-bpline/10">CLOSE THE BONNET</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* header */}
      <header className={`absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-4 py-4 transition-opacity duration-700 md:gap-3 md:px-7 ${phase === "gate" || phase === "loading" ? "opacity-0" : "opacity-100"}`} style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <a href="#/" onClick={(e) => { e.preventDefault(); close(); setXray(false); api.current?.goZone("car"); }} className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded bg-hazard font-stencil text-lg text-ink">SP</span>
          <span className="leading-tight"><span className="block font-stencil text-[17px] tracking-wide sm:text-[19px]">SUMAHAR PELLURI</span><span className="hidden font-mono text-[10.5px] tracking-[0.18em] text-paper/60 sm:block">FOUNDER'S OFFICE · OPERATIONS · DATA</span></span>
        </a>
        {guide !== "tour" && <button type="button" onClick={startTour} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink shadow-[0_0_24px_rgba(242,183,5,.45)] hover:brightness-110"><Play size={13} fill="currentColor" /><span>1-MIN TOUR</span></button>}
        <button type="button" onClick={() => { const v = !voiceOn; setVoiceOn(v); voice.setMuted(!v); }} aria-pressed={voiceOn} aria-label={voiceOn ? "Mute my voice" : "Turn my voice on"} title="Narration" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-ink/60 backdrop-blur hover:border-hazard">{voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
        <button type="button" onClick={() => { setOpen(null); setBoard("all"); }} className="flex items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider backdrop-blur hover:border-hazard"><LayoutGrid size={14} /><span className="hidden sm:inline">PROJECTS</span></button>
        <button type="button" onClick={() => select("journey")} className="hidden items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard md:flex"><Route size={14} />JOURNEY</button>
        <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full border border-hazard/70 bg-hazard/15 px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider text-hazard backdrop-blur hover:bg-hazard hover:text-ink"><Download size={14} /><span className="hidden sm:inline">CV</span></a>
        <button type="button" onClick={() => setLights(lights === "full" ? "normal" : "full")} aria-pressed={lights === "full"} title={lights === "full" ? "Switch to the moody workshop light" : "Turn the full lights on"}
          className="flex items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><Lightbulb size={14} className={lights === "full" ? "text-hazard" : ""} /><span className="hidden md:inline">{lights === "full" ? "FULL LIGHTS" : "MOODY"}</span></button>
        <button type="button" onClick={() => select("laptop")} aria-label="Ask Sumahar AI" className="flex items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><MessageCircle size={14} /><span className="hidden md:inline">ASK ME</span></button>
        <button type="button" onClick={toggleRadio} aria-label={playing ? "Turn the radio off" : "Turn the radio on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-ink/60 backdrop-blur hover:border-hazard">{playing ? <Pause size={15} /> : <Music2 size={15} />}</button>
        <a href="#/specs" aria-label="Spec sheet" className="hidden items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard sm:flex"><FileText size={14} /><span className="hidden lg:inline">SPEC SHEET</span></a>
      </header>

      {/* the big call: take it for a drive */}
      <AnimatePresence>
        {live && !open && !xray && !board && guide === "help" && (
          <div key="drive-cta" className="pointer-events-none absolute inset-x-0 top-[78px] z-20 flex justify-center px-4 md:bottom-6 md:top-auto">
            <motion.button type="button" onClick={goDrive} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 20 }}
              whileHover={{ y: -3 }} className="group pointer-events-auto relative overflow-hidden rounded-2xl p-[2px] shadow-[0_0_50px_rgba(242,183,5,.35)]">
              <span className="hazard absolute inset-0 animate-[spin_6s_linear_infinite] opacity-90 [background-size:200%_200%]" aria-hidden="true" />
              <span className="relative flex items-center gap-4 rounded-[14px] bg-ink px-4 py-2.5 md:px-5 md:py-3">
                <span className="relative grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-hazard/15" aria-hidden="true">
                  <motion.span animate={{ x: [-8, 8, -8], rotate: [0, -6, 0, 4, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className="text-[26px]">🏎️</motion.span>
                  <span className="absolute inset-x-1 bottom-1.5 h-[2px] rounded bg-hazard/50" />
                </span>
                <span className="text-left">
                  <span className="block font-stencil text-[20px] leading-none text-hazard md:text-[25px]">TAKE IT FOR A DRIVE</span>
                  <span className="mt-1 block font-mono text-[10px] tracking-[0.16em] text-paper/75">THINK LIKE A FOUNDER · 4 QUICK GAMES · 2 MIN</span>
                  <span className="mt-1.5 hidden gap-1 sm:flex">
                    {[["🧭", "Strategy", "#4fc3f7"], ["🚀", "Marketing", "#ff7043"], ["⚙️", "Ops", "#ffca28"], ["⛽", "Finance", "#66bb6a"], ["📊", "Data", "#36c8ff"]].map(([e, l, c]) => (
                      <span key={l} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: c + "22", color: c, border: `1px solid ${c}55` }}>{e} {l}</span>
                    ))}
                  </span>
                </span>
                <ArrowRight className="shrink-0 text-hazard transition-transform group-hover:translate-x-1" size={22} />
              </span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{story && <Story key="story" onDone={() => setStory(false)} />}</AnimatePresence>
      <AnimatePresence>
        {live && guide === "greet" && !story && !open && !board && !xray && (
          <QuickView key="qv" onSection={(st) => { dismissGreet(); select(st); }} onStory={() => setStory(true)} onTour={startTour} onProjects={() => { dismissGreet(); setBoard("all"); }} onJourney={() => { dismissGreet(); select("journey"); }} onDrive={() => { dismissGreet(); goDrive(); }} onClose={dismissGreet} />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {live && guide === "tour" && !open && !board && (
          <div key="tourwrap" className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 md:pb-7" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
            <GuideCard key={"t" + step} step={TOUR[step]} i={step} n={TOUR.length} onNext={() => tourGo(step + 1)} onBack={() => tourGo(step - 1)} onClose={endTour}
              onOpen={() => { const t = TOUR[step].target; if (t) { endTour(); select(t); } }} onDrive={() => { endTour(); goDrive(); }} />
          </div>
        )}
      </AnimatePresence>

      {/* bottom: guide (left) · zones (centre) · explore (right) */}
      {live && !open && !board && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between md:p-6" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait">
              {guide === "help" && <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><HelpMenu open={helpOpen} setOpen={setHelpOpen} onTour={startTour} onProjects={() => { setHelpOpen(false); setBoard("all"); }} onAsk={() => { setHelpOpen(false); select("laptop"); }} onDrive={goDrive} onList={() => { setHelpOpen(false); select("journey"); }} /></motion.div>}
            </AnimatePresence>
          </div>
          <div className="order-1 flex-1 md:order-2" />
          <AnimatePresence>
            {!xray && !looked && guide !== "tour" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ delay: 1.2 }}
                className="pointer-events-none order-1 flex items-center gap-2.5 self-center rounded-full border border-white/15 bg-oil/85 px-4 py-2.5 backdrop-blur md:absolute md:bottom-[104px] md:left-1/2 md:-translate-x-1/2">
                <motion.span animate={{ x: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className="text-[16px]">{coarse.current ? "👆" : "🖱️"}</motion.span>
                <span className="font-mono text-[11px] tracking-wider text-paper/85">{coarse.current ? "DRAG TO LOOK AROUND · TAP ANYTHING THAT GLOWS" : "MOVE TO LOOK · PUSH TO THE EDGE OR DRAG TO TURN 360°"}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pointer-events-auto order-3 hidden md:block">
            <button type="button" onClick={() => setList((v) => !v)} aria-expanded={list} className="flex items-center gap-3 rounded-full border border-white/20 bg-oil/85 py-2 pl-4 pr-2 backdrop-blur hover:border-hazard">
              <span className="font-mono text-[11px] tracking-wider">EXPLORE</span>
              <span className="relative grid h-9 w-9 place-items-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke="#f2b705" strokeWidth="3" strokeDasharray={`${(seenAll.length / stationIds.length) * 94.2} 94.2`} strokeLinecap="round" /></svg>
                <span className="font-mono text-[10px] text-hazard">{seenAll.length}</span>
              </span>
            </button>
          </div>
        </div>
      )}
      <AnimatePresence>
        {list && (
          <motion.nav initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} aria-label="Explore list"
            className="absolute bottom-20 right-4 z-30 max-h-[70vh] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-white/15 bg-oil/95 p-3 backdrop-blur md:right-6">
            <div className="flex items-start justify-between px-2 pb-2">
              <div><div className="font-cond text-[19px] font-semibold">The garage, in five sections</div><div className="text-xs text-paper/60">{seenAll.length} of {stationIds.length} seen · see all 7 car systems for a surprise</div></div>
              <button type="button" onClick={() => setList(false)} aria-label="Close list" className="p-1"><X size={15} /></button>
            </div>
            {SECTIONS.map((x) => (
              <button key={x.id} type="button" onClick={() => select(x.station as StationId)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/5">
                <Tick on={seenAll.includes(x.station as StationId)} /><span className="text-[17px]">{x.emoji}</span>
                <span className="font-cond text-[17px] font-semibold">{x.label}</span><span className="ml-auto text-right text-xs text-paper/55">{x.hint}</span>
              </button>
            ))}
            <div className="px-2 pb-1 pt-3 font-mono text-[10px] tracking-[0.2em] text-hazard">WORK-EX, PART BY PART · {seen.length}/{CAR_ORDER.length}</div>
            {CAR_ORDER.map((id) => <button key={id} type="button" onClick={() => select(id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"><Tick on={seenAll.includes(id)} /><span className="font-cond text-[15.5px] font-semibold">{JOBS[id].part}</span><span className="ml-auto text-xs text-paper/55">{JOBS[id].area}</span></button>)}
            <div className="px-2 pb-1 pt-3 font-mono text-[10px] tracking-[0.2em] text-hazard">ALSO</div>
            {PROPS.filter((p) => !SECTIONS.some((x) => x.station === p.id)).map((p) => <button key={p.id} type="button" onClick={() => select(p.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"><Tick on={seenAll.includes(p.id)} /><span className="font-cond text-[15.5px] font-semibold">{p.label}</span><span className="ml-auto text-right text-xs text-paper/55">{p.hint}</span></button>)}
          </motion.nav>
        )}
      </AnimatePresence>

      {/* panels */}
      <Sheet open={isPart(open)} onClose={close} label="Job card">{isPart(open) && <JobCardView id={open} onBonnet={() => { close(); setXray(true); }} />}</Sheet>
      <Sheet open={open === "toolchest"} onClose={close} label="Tool chest" tone="dark"><ToolChest /></Sheet>
      <Sheet open={open === "trophies"} onClose={close} label="Trophy shelf" tone="dark"><Trophies /></Sheet>
      <Sheet open={open === "crew"} onClose={close} label="Co-curriculars" tone="dark" wide><CoCurriculars onProjects={() => { close(); setBoard("all"); }} /></Sheet>
      <Sheet open={open === "decco"} onClose={close} label="Decco Store" tone="dark"><Decco /></Sheet>
      <Sheet open={open === "journey"} onClose={close} label="Career journey" tone="dark"><div className="min-h-0 flex-1 overflow-y-auto"><Journey onHire={() => { close(); setAward({ how: "garage" }); }} /></div></Sheet>
      <Sheet open={open === "driver"} onClose={close} label="Education" tone="dark"><Education /></Sheet>
      <AnimatePresence>{board && <Projects start={board === "live" ? 1 : 0} onClose={() => { setBoard(null); api.current?.focus(null); }} onAsk={(q) => { setBoard(null); setAskQ((a) => ({ q, n: a.n + 1 })); select("laptop"); }} />}</AnimatePresence>
      <Sheet open={open === "laptop"} onClose={() => { close(); setAskQ((a) => ({ n: a.n + 1 })); }} label="Contact and ask me" tone="dark"><ContactStrip /><div className="min-h-0 flex-1"><Bot key={askQ.n} initialQuestion={askQ.q} /></div></Sheet>
      <Sheet open={open === "scanner"} onClose={close} label="Run a diagnostic" tone="lcd"><Diagnostic onShowPart={(p) => select(p)} /></Sheet>

      {/* toast */}
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[84px] z-40 -translate-x-1/2 rounded-full bg-paper px-4 py-2 font-mono text-[11px] text-ink">{toast}</motion.div>}</AnimatePresence>

      {/* gate: a roller shutter. Open it and the lights come on. */}
      <AnimatePresence>
        {(phase === "loading" || phase === "gate") && (
          <motion.div key="shutter" exit={{ y: "-104%" }} transition={{ duration: 1.5, ease: [0.55, 0.05, 0.3, 1] }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 text-center"
            style={{ background: "repeating-linear-gradient(180deg,#8e949b 0 3px,#b9bec4 3px 22px,#6f757c 22px 26px,#a3a9af 26px 44px)", boxShadow: "inset 0 -40px 60px rgba(0,0,0,.45)" }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,.18),rgba(0,0,0,.35)_75%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10px] bg-[#2b2724]" />
            <div className="relative">
              <div className="font-mono text-[11px] font-bold tracking-[0.35em] text-[#2b2724]/80">BAY 08 · SUMAHAR PELLURI</div>
              <h1 className="mt-2 font-stencil text-[clamp(48px,10vw,120px)] leading-[0.88] text-[#1b1714] [text-shadow:0_2px_0_rgba(255,255,255,.35)]">SUMAHAR'S<br /><span className="text-[#c8261b]">GARAGE</span></h1>
              <p className="mx-auto mt-3 max-w-[44ch] text-[15px] font-medium text-[#2b2724]">Founder's Office · Strategy &amp; Ops · Data. Every part of the car inside is something I built for a business.</p>
              <div className="mt-8 flex flex-col items-center gap-4">
                {phase === "loading" ? (
                  <div className="w-64"><div className="h-2 overflow-hidden rounded bg-black/25"><div className="h-full bg-[#1b1714] transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} /></div><div className="mt-2 font-mono text-[11px] font-bold text-[#2b2724]">GETTING THE GARAGE READY · {Math.round(progress * 100)}%</div></div>
                ) : (
                  <motion.button type="button" onClick={openShutter} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-3 rounded-xl border-4 border-[#1b1714] bg-hazard px-8 py-4 font-stencil text-[26px] text-ink shadow-[0_8px_0_#1b1714]">
                    <ChevronUp size={28} strokeWidth={3} /> OPEN THE GARAGE
                  </motion.button>
                )}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-[11px] font-bold tracking-[0.16em] text-[#2b2724]/80">
                  <button type="button" onClick={() => { openShutter(); setBoard("all"); }} className="underline decoration-black/30 underline-offset-4 hover:text-black">SKIP TO THE PROJECTS</button>
                  <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className="underline decoration-black/30 underline-offset-4 hover:text-black">DOWNLOAD MY CV</a>
                  <a href="#/specs" className="underline decoration-black/30 underline-offset-4 hover:text-black">READ THE SPEC SHEET</a>
                </div>
              </div>
            </div>
            {/* handle */}
            <div className="absolute bottom-[22px] left-1/2 h-[14px] w-[120px] -translate-x-1/2 rounded-full bg-[#2b2724] shadow-[0_2px_0_rgba(255,255,255,.3)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{award && <Achievement how={award.how} lap={award.lap} onClose={() => setAward(null)} />}</AnimatePresence>

      <audio ref={audio} preload="none" src={A("audio/chasing-the-horizon.mp3")} loop />
    </div>
  );
}
