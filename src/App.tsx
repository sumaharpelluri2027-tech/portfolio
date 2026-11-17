import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileText, Flag, LayoutGrid, MessageCircle, Music2, Pause, X, Zap } from "lucide-react";
import { GuideCard, Greeting, HelpMenu, TOUR } from "./ui/Guide";
import { createGarage, type GarageAPI, type ZoneId } from "./scene/garage";
import { createBuggy } from "./scene/buggyEntry";
import { A, EMAIL } from "./data";
import { CAR_ORDER, JOBS, PROPS, type CarPart, type StationId } from "./content";
import { Crew, Decco, Diagnostic, Driver, JobCardView, Sheet, ToolChest, Trophies } from "./ui/Panels";
import { PROJECTS, type Kind } from "./projects";
const COLS = ([["LIVE", "#5dff9a", "live"], ["CASES", "#f2b705", "case"], ["MU COURSEWORK", "#7fc8ff", "course"], ["WING & PROTOTYPES", "#ff8a65", "lead"]] as const).map(([title, color, k]) => ({ title, color, items: PROJECTS.filter((p) => p.kind === k || (k === "lead" && p.kind === "proto")).map((p) => p.title) }));
import Bot from "./ui/Bot";
import Projects from "./ui/Projects";
const Specs = lazy(() => import("./ui/Specs"));
import Achievement from "./ui/Achievement";
const Drive = lazy(() => import("./ui/Drive"));

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
      onReady: () => setPhase("live"),
      onProgress: (p) => setProgress(p),
      quality: coarse.current || window.innerWidth < 760 || /[?&]low\b/.test(window.location.search) ? "low" : "high",
    });
    api.current = g;
    const t = window.setTimeout(() => setPhase((p) => (p === "loading" ? "gate" : p)), 400);
    return () => { window.clearTimeout(t); g.dispose(); api.current = null; };
  }, []);
  const selectRef = useRef(select); selectRef.current = select;
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

  const switchOn = () => { setPhase("intro"); api.current?.startIntro(); try { sessionStorage.setItem("sp-lights", "1"); } catch { /* ignore */ } };
  useEffect(() => { if (phase === "gate") { let on = false; try { on = sessionStorage.getItem("sp-lights") === "1"; } catch { /* ignore */ } if (on) switchOn(); } }, [phase]); // returning visitors skip the gate
  const live = phase === "live";
  const stationIds: StationId[] = [...CAR_ORDER, ...PROPS.map((p) => p.id)];
  const nameOf = (id: StationId) => (isPart(id) ? JOBS[id].hover : PROPS.find((p) => p.id === id)?.label + " · " + PROPS.find((p) => p.id === id)?.hint);

  /* ---- guide: greeting → tour → help menu ---- */
  const [guide, setGuide] = useState<"greet" | "tour" | "help">("greet");
  const [step, setStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zone, setZone] = useState<ZoneId>("car");
  useEffect(() => { try { if (localStorage.getItem("sp-toured") === "1") setGuide("help"); } catch { /* ignore */ } }, []);
  const tourGo = useCallback((k: number) => {
    const st = TOUR[k]; setStep(k); setOpen(null); setXray(false);
    if (st.target) api.current?.focus(st.target); else api.current?.focus(null);
  }, []);
  const startTour = () => { setHelpOpen(false); setBoard(null); setGuide("tour"); tourGo(0); };
  const endTour = () => { setGuide("help"); api.current?.focus(null); try { localStorage.setItem("sp-toured", "1"); } catch { /* ignore */ } };
  const tourTarget = guide === "tour" ? TOUR[step].target : null;
  const goDrive = () => { window.location.hash = "#/drive"; };
  const ZONES: [ZoneId, string][] = [["car", "The car"], ["bench", "Workbench"], ["wall", "Back wall"], ["shelf", "Trophies"], ["board", "Build board"]];
  const moveZone = useCallback((z: ZoneId) => { setZone(z); setOpen(null); setGuide((g) => (g === "tour" ? "help" : g)); api.current?.goZone(z); }, []);
  useEffect(() => {
    if (!live) return;
    const k = (e: KeyboardEvent) => {
      if (open || board || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = ZONES.findIndex(([z]) => z === zone); const n = (i + (e.key === "ArrowRight" ? 1 : -1) + ZONES.length) % ZONES.length;
      moveZone(ZONES[n][0]);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <div ref={host} className="absolute inset-0" aria-label="A 3D garage. The car parts and garage objects open my work. Use the Explore menu for a keyboard-friendly list." role="application" />

      {/* labels: quiet until you hover, or the tour points at them */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {stationIds.map((id) => {
          const on = live && !xray && (hover === id || tourTarget === id) && (!open || open === id);
          return (
            <div key={id} ref={(el) => api.current?.bindLabel(id, el)} className="label absolute left-0 top-0">
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
          <div key={"w" + id} ref={(el) => api.current?.bindLabel("wire-" + id, el)} className="label absolute left-0 top-0 transition-opacity duration-500" style={{ opacity: xray ? 1 : 0 }}>
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
        <a href="#/" onClick={(e) => { e.preventDefault(); close(); setXray(false); moveZone("car"); }} className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded bg-hazard font-stencil text-lg text-ink">SP</span>
          <span className="leading-tight"><span className="block font-stencil text-[17px] tracking-wide sm:text-[19px]">SUMAHAR PELLURI</span><span className="hidden font-mono text-[10.5px] tracking-[0.18em] text-paper/60 sm:block">FOUNDER'S OFFICE · OPERATIONS · DATA</span></span>
        </a>
        <button type="button" onClick={() => { setOpen(null); setBoard("all"); }} className="flex items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] font-bold tracking-wider backdrop-blur hover:border-hazard"><LayoutGrid size={14} /><span className="hidden sm:inline">PROJECTS</span></button>
        <button type="button" onClick={() => select("laptop")} aria-label="Ask Sumahar AI" className="flex items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><MessageCircle size={14} /><span className="hidden md:inline">ASK ME</span></button>
        <button type="button" onClick={toggleRadio} aria-label={playing ? "Turn the radio off" : "Turn the radio on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-ink/60 backdrop-blur hover:border-hazard">{playing ? <Pause size={15} /> : <Music2 size={15} />}</button>
        <a href="#/specs" aria-label="Spec sheet" className="hidden items-center gap-2 rounded-full border border-white/25 bg-ink/60 px-3.5 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard sm:flex"><FileText size={14} /><span className="hidden lg:inline">SPEC SHEET</span></a>
      </header>

      {/* the big call: take it for a drive */}
      <AnimatePresence>
        {live && !open && !xray && !board && (
          <motion.button type="button" onClick={goDrive} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }}
            className="group absolute left-1/2 top-[78px] z-20 -translate-x-1/2 overflow-hidden rounded-xl p-[2px] shadow-[0_0_50px_rgba(242,183,5,.35)]">
            <span className="hazard absolute inset-0 animate-[spin_6s_linear_infinite] opacity-90 [background-size:200%_200%]" aria-hidden="true" />
            <span className="relative flex items-center gap-3 rounded-[10px] bg-ink px-5 py-3 md:px-7">
              <Flag className="text-hazard transition-transform group-hover:-rotate-12" size={22} />
              <span className="text-left">
                <span className="block font-stencil text-[19px] leading-none text-hazard md:text-[24px]">TAKE IT FOR A DRIVE</span>
                <span className="mt-1 block font-mono text-[10px] tracking-[0.18em] text-paper/70">A 2-MINUTE LAP THROUGH MY CAREER</span>
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* bottom: guide (left) · zones (centre) · explore (right) */}
      {live && !open && !board && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between md:p-6" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait">
              {guide === "greet" && !xray && <Greeting key="g" onTour={startTour} onExplore={() => { setGuide("help"); try { localStorage.setItem("sp-toured", "1"); } catch { /* ignore */ } }} />}
              {guide === "tour" && <GuideCard key={"t" + step} step={TOUR[step]} i={step} n={TOUR.length} onNext={() => tourGo(step + 1)} onBack={() => tourGo(step - 1)} onClose={endTour}
                onOpen={() => { const t = TOUR[step].target; if (t) { endTour(); select(t); } }} onDrive={() => { endTour(); goDrive(); }} />}
              {guide === "help" && <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><HelpMenu open={helpOpen} setOpen={setHelpOpen} onTour={startTour} onProjects={() => { setHelpOpen(false); setBoard("all"); }} onAsk={() => { setHelpOpen(false); select("laptop"); }} onDrive={goDrive} onList={() => { setHelpOpen(false); setList(true); }} /></motion.div>}
            </AnimatePresence>
          </div>
          {!xray && guide !== "tour" && (
            <nav aria-label="Move around the garage" className="pointer-events-auto order-1 flex items-center gap-1 self-center rounded-full border border-white/15 bg-oil/85 p-1 backdrop-blur md:order-2 md:absolute md:bottom-6 md:left-1/2 md:-translate-x-1/2">
              <button type="button" aria-label="Previous area" onClick={() => { const i = ZONES.findIndex(([z]) => z === zone); moveZone(ZONES[(i - 1 + ZONES.length) % ZONES.length][0]); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronLeft size={16} /></button>
              {ZONES.map(([z, l]) => (
                <button key={z} type="button" onClick={() => moveZone(z)} aria-current={zone === z ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1.5 font-mono text-[10.5px] tracking-wider transition-colors md:px-3.5 ${zone === z ? "bg-hazard text-ink" : "text-paper/75 hover:text-paper"}`}>{l.toUpperCase()}</button>
              ))}
              <button type="button" aria-label="Next area" onClick={() => { const i = ZONES.findIndex(([z]) => z === zone); moveZone(ZONES[(i + 1) % ZONES.length][0]); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronRight size={16} /></button>
            </nav>
          )}
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
              <div><div className="font-cond text-[19px] font-semibold">Everything in the garage</div><div className="text-xs text-paper/60">{seenAll.length} of {stationIds.length} seen · see all 7 car systems for a surprise</div></div>
              <button type="button" onClick={() => setList(false)} aria-label="Close list" className="p-1"><X size={15} /></button>
            </div>
            <div className="px-2 pb-1 pt-2 font-mono text-[10px] tracking-[0.2em] text-hazard">ON THE CAR · {seen.length}/{CAR_ORDER.length}</div>
            {CAR_ORDER.map((id) => <button key={id} type="button" onClick={() => select(id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"><Tick on={seenAll.includes(id)} /><span className="font-cond text-[16.5px] font-semibold">{JOBS[id].part}</span><span className="ml-auto text-xs text-paper/55">{JOBS[id].area}</span></button>)}
            <div className="px-2 pb-1 pt-3 font-mono text-[10px] tracking-[0.2em] text-hazard">AROUND THE GARAGE</div>
            {PROPS.map((p) => <button key={p.id} type="button" onClick={() => select(p.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"><Tick on={seenAll.includes(p.id)} /><span className="font-cond text-[16px] font-semibold">{p.label}</span><span className="ml-auto text-right text-xs text-paper/55">{p.hint}</span></button>)}
          </motion.nav>
        )}
      </AnimatePresence>

      {/* panels */}
      <Sheet open={isPart(open)} onClose={close} label="Job card">{isPart(open) && <JobCardView id={open} onBonnet={() => { close(); setXray(true); }} />}</Sheet>
      <Sheet open={open === "toolchest"} onClose={close} label="Tool chest" tone="dark"><ToolChest /></Sheet>
      <Sheet open={open === "trophies"} onClose={close} label="Trophy shelf" tone="dark"><Trophies /></Sheet>
      <Sheet open={open === "crew"} onClose={close} label="Pit crew" tone="dark" wide><Crew /></Sheet>
      <Sheet open={open === "decco"} onClose={close} label="Decco Store" tone="dark"><Decco /></Sheet>
      <Sheet open={open === "driver"} onClose={close} label="About the driver" tone="dark"><Driver onProjects={() => { close(); setBoard("all"); }} /></Sheet>
      <AnimatePresence>{board && <Projects start={board === "live" ? 1 : 0} onClose={() => { setBoard(null); api.current?.focus(null); }} onAsk={(q) => { setBoard(null); setAskQ((a) => ({ q, n: a.n + 1 })); select("laptop"); }} />}</AnimatePresence>
      <Sheet open={open === "laptop"} onClose={() => { close(); setAskQ((a) => ({ n: a.n + 1 })); }} label="Ask Sumahar" tone="dark"><Bot key={askQ.n} initialQuestion={askQ.q} /></Sheet>
      <Sheet open={open === "scanner"} onClose={close} label="Run a diagnostic" tone="lcd"><Diagnostic onShowPart={(p) => select(p)} /></Sheet>

      {/* toast */}
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-1/2 top-[84px] z-40 -translate-x-1/2 rounded-full bg-paper px-4 py-2 font-mono text-[11px] text-ink">{toast}</motion.div>}</AnimatePresence>

      {/* gate: switch on the lights */}
      <AnimatePresence>
        {(phase === "loading" || phase === "gate") && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0 z-50 grid place-items-start overflow-hidden bg-ink px-6 pt-[12vh] text-center md:px-[7vw] md:pt-0 md:text-left">
            <motion.img src={A("me/cover.webp")} alt="Sumahar Pelluri, smiling, in a dark suit" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-none absolute bottom-0 right-0 h-[46%] w-full object-cover object-top opacity-90 md:h-full md:w-[52%] md:opacity-95 [mask-image:linear-gradient(to_bottom,transparent,black_30%)] md:[mask-image:linear-gradient(to_right,transparent,black_35%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,transparent,rgba(12,11,10,.55)_70%)]" />
            <div className="relative w-full md:mt-[18vh] md:max-w-[620px]">
              <div className="font-mono text-[11px] tracking-[0.3em] text-paper/50">BAY 08 · AFTER HOURS</div>
              <h1 className="mt-3 font-stencil text-[clamp(44px,9vw,104px)] leading-[0.9]">SUMAHAR'S<br /><span className="text-hazard">GARAGE</span></h1>
              <p className="mx-auto mt-4 max-w-[46ch] text-paper/70 md:mx-0">A car on a lift. Every part is something I built for a business, and every part is wired with data.</p>
              <div className="mt-9 flex flex-col items-center gap-4 md:items-start">
                {phase === "loading" ? (
                  <div className="w-64"><div className="h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-hazard transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} /></div><div className="mt-2 font-mono text-[11px] text-paper/50">OPENING THE SHUTTER · {Math.round(progress * 100)}%</div></div>
                ) : (
                  <motion.button type="button" onClick={switchOn} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-3 rounded-lg border-2 border-hazard bg-hazard/10 px-7 py-4 font-stencil text-2xl text-hazard shadow-[0_0_40px_rgba(242,183,5,.25)]">
                    <Zap className="transition-transform group-hover:rotate-12" /> SWITCH ON<span className="hidden sm:inline"> THE LIGHTS</span>
                  </motion.button>
                )}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-start font-mono text-[11px] tracking-[0.18em] text-paper/55">
                  <button type="button" onClick={() => { switchOn(); setBoard("all"); }} className="underline decoration-white/30 underline-offset-4 hover:text-paper">SKIP TO THE PROJECTS</button>
                  <a href="#/drive" onClick={() => { try { sessionStorage.setItem("sp-lights", "1"); } catch { /* ignore */ } }} className="underline decoration-white/30 underline-offset-4 hover:text-paper">GO STRAIGHT TO THE TRACK</a>
                  <a href="#/specs" className="underline decoration-white/30 underline-offset-4 hover:text-paper">READ THE SPEC SHEET</a>
                </div>
              </div>
            </div>
            <div className="absolute bottom-6 left-0 right-0 font-mono text-[10px] tracking-[0.2em] text-paper/35">{EMAIL.toUpperCase()}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{award && <Achievement how={award.how} lap={award.lap} onClose={() => setAward(null)} />}</AnimatePresence>

      <audio ref={audio} preload="none" src={A("audio/chasing-the-horizon.mp3")} loop />
    </div>
  );
}
