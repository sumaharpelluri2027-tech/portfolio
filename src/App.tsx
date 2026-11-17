import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, LayoutGrid, List, Music2, Pause, Terminal, X, Zap } from "lucide-react";
import { createGarage, type GarageAPI } from "./scene/garage";
import { createBuggy } from "./scene/buggyEntry";
import { A, EMAIL } from "./data";
import { CAR_ORDER, JOBS, PROPS, type CarPart, type StationId } from "./content";
import { BuildBoard, Crew, Decco, Diagnostic, Driver, JobCardView, Sheet, ToolChest, Trophies } from "./ui/Panels";
import { PROJECTS, type Kind } from "./projects";
const COLS = ([["LIVE", "#5dff9a", "live"], ["CASES", "#f2b705", "case"], ["MU COURSEWORK", "#7fc8ff", "course"], ["WING & PROTOTYPES", "#ff8a65", "lead"]] as const).map(([title, color, k]) => ({ title, color, items: PROJECTS.filter((p) => p.kind === k || (k === "lead" && p.kind === "proto")).map((p) => p.title) }));
import Bot from "./ui/Bot";
import Specs from "./ui/Specs";
import Achievement from "./ui/Achievement";
import Drive from "./ui/Drive";

const isPart = (id: StationId | null): id is CarPart => !!id && id in JOBS;
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
  if (route === "specs" || !webgl.current) return <Specs />;
  if (route === "drive") return <Drive onExit={() => { window.location.hash = "#/"; }} />;
  return <Garage />;
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
  const [seen, setSeen] = useState<CarPart[]>([]);
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
      images: { "aiaw-event": A("img/aiaw-event.jpg"), "aiaw-team": A("img/aiaw-team.jpg"), "decco-stall": A("img/decco-stall.jpg"), "decco-team": A("img/decco-team.jpg"), "decco-shot": A("img/decco-shot.jpg"), driver: A("me/studio-smile.webp") },
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

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <div ref={host} className="absolute inset-0" aria-label="A 3D garage. The car parts and garage objects open my work. Use the parts list for a keyboard-friendly menu." role="application" />

      {/* labels pinned to 3D objects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden={!live}>
        {stationIds.map((id) => {
          const show = live && !xray && (!open || open === id);
          const on = hover === id || open === id;
          return (
            <div key={id} ref={(el) => api.current?.bindLabel(id, el)} className="label absolute left-0 top-0 transition-opacity duration-300" style={{ opacity: show ? 1 : 0 }}>
              <button type="button" tabIndex={-1} onClick={() => select(id)} className="pointer-events-auto relative -translate-x-1/2 -translate-y-1/2">
                <span className={`relative block h-3 w-3 rounded-full border-2 border-ink ${isPart(id) ? "bg-hazard" : "bg-paper"} ${!on && !open ? "ping" : ""}`} />
              </button>
              <AnimatePresence>
                {(on || (coarse.current && !open && isPart(id))) && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink/90 px-2.5 py-1 font-mono text-[11px] tracking-wider text-paper ring-1 ring-hazard/60">
                    {isPart(id) && <span className="mr-1.5 text-hazard">{JOBS[id].no}</span>}{nameOf(id)}
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
            <motion.div key="bn" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-20 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-bpline/50 bg-bp/90 p-4 text-center font-mono text-[#cfe9ff] backdrop-blur md:bottom-8">
              <div className="text-[11px] tracking-[0.25em] text-bpline">BONNET UP · DATA WIRING VISIBLE</div>
              <p className="mt-1 font-sans text-[15px]">Every part of this car runs on data I wired myself. Click a tag to open its job card.</p>
              <button type="button" onClick={() => setXray(false)} className="mt-3 rounded-full border border-bpline/60 px-4 py-1.5 text-[11px] tracking-wider hover:bg-bpline/10">CLOSE THE BONNET</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* header */}
      <header className={`absolute inset-x-0 top-0 z-30 flex items-center gap-3 px-4 py-4 transition-opacity duration-700 md:px-7 ${phase === "gate" || phase === "loading" ? "opacity-0" : "opacity-100"}`} style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <a href="#/" onClick={(e) => { e.preventDefault(); close(); setXray(false); }} className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded bg-hazard font-stencil text-lg text-ink">SP</span>
          <span className="leading-tight"><span className="block font-stencil text-[19px] tracking-wide">SUMAHAR PELLURI</span><span className="hidden font-mono text-[10.5px] tracking-[0.18em] text-paper/60 sm:block">OPERATIONS · GROWTH · DATA UNDERNEATH</span></span>
        </a>
        <button type="button" onClick={() => { setOpen(null); setBoard("all"); }} className="flex items-center gap-2 rounded-full bg-hazard px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink shadow-[0_0_24px_rgba(242,183,5,.35)] hover:brightness-110"><LayoutGrid size={14} /> PROJECTS<span className="hidden sm:inline"> · {PROJECTS.length}</span></button>
        <button type="button" onClick={() => select("laptop")} className="hidden items-center gap-2 rounded-full border border-white/20 bg-ink/60 px-4 py-2 font-mono text-[11px] tracking-wider backdrop-blur hover:border-lcd hover:text-lcd md:flex"><Terminal size={14} /> ASK SUMAHAR AI</button>
        <button type="button" onClick={toggleRadio} aria-label={playing ? "Turn the radio off" : "Turn the radio on"} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-ink/60 backdrop-blur hover:border-hazard">{playing ? <Pause size={15} /> : <Music2 size={15} />}</button>
        <a href="#/specs" className="flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-ink hover:bg-hazard"><FileText size={14} /><span className="hidden sm:inline">SPEC SHEET</span></a>
      </header>

      {/* idea + hint */}
      <AnimatePresence>
        {live && !open && !xray && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.7 }}
            className="pointer-events-none absolute bottom-0 left-0 z-10 max-w-[620px] p-4 pb-[calc(76px+env(safe-area-inset-bottom))] md:p-7">
            <p className="font-cond text-[clamp(22px,3vw,34px)] font-semibold leading-[1.08] [text-shadow:0_2px_20px_#000]">Founders drive. I build the car, and wire it so <span className="text-hazard">every gauge tells the truth.</span></p>
            <p className="mt-3 max-w-[48ch] font-mono text-[10.5px] tracking-[0.14em] text-paper/70 md:text-[11px]">{coarse.current ? "TAP ANY PART · " : "CLICK ANY PART · DRAG TO LOOK AROUND · "}FLIP THE POWER BOX TO SEE THE DATA WIRING</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* take it for a drive */}
      {live && !open && !xray && (
        <motion.a href="#/drive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="absolute left-1/2 top-[84px] z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-hazard bg-ink/70 px-5 py-2.5 font-stencil text-lg tracking-wide text-hazard shadow-[0_0_30px_rgba(242,183,5,.3)] backdrop-blur hover:bg-hazard hover:text-ink md:top-auto md:bottom-7">
          <span aria-hidden="true">🏁</span> TAKE IT FOR A DRIVE
        </motion.a>
      )}

      {/* parts list (keyboard + quick access) */}
      {live && (
        <div className="absolute bottom-0 right-0 z-20 flex flex-col items-end p-4 md:p-7" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
          {!open && (
            <div className="mb-2 flex items-center justify-end gap-2 font-mono text-[10px] tracking-[0.18em] text-paper/60" aria-label={`${seen.length} of ${CAR_ORDER.length} systems inspected`}>
              <span className="hidden sm:inline">SYSTEMS INSPECTED</span>
              <span className="flex gap-1">{CAR_ORDER.map((id) => <span key={id} className={`h-2 w-2 rounded-full ${seen.includes(id) ? "bg-hazard" : "bg-white/20"}`} />)}</span>
              <span className="text-hazard">{seen.length}/{CAR_ORDER.length}</span>
            </div>
          )}
          {!open && <button type="button" onClick={() => setList((v) => !v)} aria-expanded={list} className="flex items-center gap-2 rounded-full border border-white/20 bg-ink/70 px-4 py-2.5 font-mono text-[11px] tracking-wider backdrop-blur hover:border-hazard"><List size={14} /> PARTS LIST · {stationIds.length}</button>}
        </div>
      )}
      <AnimatePresence>
        {list && (
          <motion.nav initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} aria-label="Parts list"
            className="absolute bottom-20 right-4 z-30 max-h-[70vh] w-[min(360px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-white/15 bg-oil/95 p-3 backdrop-blur md:right-7">
            <div className="flex items-center justify-between px-2 pb-2"><span className="font-mono text-[10px] tracking-[0.2em] text-hazard">ON THE CAR</span><button type="button" onClick={() => setList(false)} aria-label="Close list"><X size={15} /></button></div>
            {CAR_ORDER.map((id) => <button key={id} type="button" onClick={() => select(id)} className="flex w-full items-baseline gap-3 rounded px-2 py-2 text-left hover:bg-white/5"><span className="font-mono text-[11px] text-hazard">{JOBS[id].no}</span><span className="font-cond text-[17px] font-semibold">{JOBS[id].part}</span><span className="ml-auto text-xs text-paper/55">{JOBS[id].area}</span></button>)}
            <div className="px-2 pb-1 pt-3 font-mono text-[10px] tracking-[0.2em] text-hazard">IN THE GARAGE</div>
            {PROPS.map((p) => <button key={p.id} type="button" onClick={() => select(p.id)} className="flex w-full items-baseline gap-3 rounded px-2 py-2 text-left hover:bg-white/5"><span className="font-cond text-[16px] font-semibold">{p.label}</span><span className="ml-auto text-right text-xs text-paper/55">{p.hint}</span></button>)}
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
      <AnimatePresence>{board && <BuildBoard initial={board} onClose={() => { setBoard(null); api.current?.focus(null); }} />}</AnimatePresence>
      <Sheet open={open === "laptop"} onClose={close} label="Ask Sumahar AI" tone="lcd"><Bot /></Sheet>
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
