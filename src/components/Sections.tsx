import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Copy, Check, Plus, Minus } from "lucide-react";
import { A, EDU, EMAIL, FLOW, GALLERY, LINKS, LOGOS, METHOD, MILESTONES, NUMBERS, PRODUCTS, ROLES, SERVICES, SKETCHES, TOOLKIT, WING, type Role } from "../data";
import { Counter, Reveal, Tag } from "./fx";
import { scrollToId } from "./Chrome";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const wrap = "relative z-10 mx-auto w-full max-w-[1440px] px-5 md:px-10";

/** Stacked display headline; each line slides out of a mask. kind: solid | lime | stroke */
function BigHead({ lines, className = "" }: { lines: [string, "solid" | "lime" | "stroke"][]; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <h2 ref={ref} className={"font-display uppercase leading-[0.88] text-[clamp(52px,10vw,168px)] " + className} aria-label={lines.map((l) => l[0]).join(" ")}>
      {lines.map(([t, k], i) => (
        <span key={i} aria-hidden="true" className="block overflow-hidden pb-[0.04em]">
          <motion.span className={"block " + (k === "lime" ? "text-lime" : k === "stroke" ? "stroke-text" : "")} initial={{ y: "105%" }} animate={inView ? { y: 0 } : {}} transition={{ duration: 1, delay: i * 0.1, ease: EASE }}>{t}</motion.span>
        </span>
      ))}
    </h2>
  );
}

const Arrow = () => <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />;

/* ---------------- logos ---------------- */
export function LogoStrip() {
  const row = LOGOS.map(([f, n]) => (
    <span key={f} className="flex items-center gap-4 pr-10 font-display text-3xl uppercase tracking-wide text-white/80 md:text-4xl">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1.5"><img src={A(`logos/${f}.png`)} alt="" className="max-h-9 w-auto" /></span>{n}<span className="text-lime">✦</span>
    </span>
  ));
  return (
    <div className="relative z-10 overflow-hidden border-y border-white/10 bg-space/60 py-5 backdrop-blur" aria-label="Where I've built and studied">
      <div className="marquee flex w-max hover:[animation-play-state:paused]">{row}{row}</div>
    </div>
  );
}

/* ---------------- numbers ---------------- */
export function Numbers() {
  return (
    <section className={wrap + " py-[clamp(72px,10vw,140px)]"}>
      <Tag n="00">Proof, not adjectives</Tag>
      <div className="mt-10 grid grid-cols-2 border-t border-white/10 lg:grid-cols-4">
        {NUMBERS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className={"border-b border-white/10 py-8 pr-4 lg:border-b-0 " + (i % 2 ? "pl-4 lg:pl-8" : "lg:pl-0") + (i > 0 ? " lg:border-l lg:pl-8" : "")}>
            <div className="font-display text-[clamp(72px,11vw,170px)] leading-[0.85] text-lime"><Counter to={s.n} pre={s.pre} suf={s.suf} /></div>
            <div className="mt-4 font-sans text-base text-white">{s.label}</div>
            <div className="font-mono text-xs tracking-wider text-white/45">{s.from}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- what I do ---------------- */
export function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const text = "I don't start with tools. I start with what's broken: the process nobody owns. I MEASURE it, I AUTOMATE it, and I make sure people TRUST what the system says.";
  const words = text.split(" ");
  return (
    <section className={wrap + " pb-[clamp(72px,10vw,140px)]"}>
      <Tag n="01">What I do</Tag>
      <p ref={ref} className="mt-8 max-w-[22ch] font-display text-[clamp(38px,6vw,96px)] uppercase leading-[0.95]">
        {words.map((w, i) => <Word key={i} w={w} i={i} n={words.length} p={scrollYProgress} />)}
      </p>
      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
        {SERVICES.map((s, i) => (
          <Reveal key={s.t} delay={i * 0.1} className="group bg-space/85 p-7 backdrop-blur transition-colors duration-500 hover:bg-lime hover:text-black">
            <div className="font-mono text-xs tracking-[0.2em] text-lime group-hover:text-black">0{i + 1} / {s.k.toUpperCase()}</div>
            <h3 className="mt-6 font-display text-4xl uppercase leading-none">{s.t}</h3>
            <p className="mt-4 text-[15px] text-white/60 group-hover:text-black/70">{s.d}</p>
            <p className="mt-6 border-l-2 border-lime pl-3 text-sm group-hover:border-black">{s.p}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
function Word({ w, i, n, p }: { w: string; i: number; n: number; p: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const hi = /^[A-Z]{3,}$/.test(w.replace(/[^A-Za-z]/g, "")) && w !== "I";
  const op = useTransform(p, [i / n - 0.02, (i + 1) / n], [0.14, 1]);
  return <motion.span style={{ opacity: op }} className={"mr-[0.25em] inline-block " + (hi ? "text-lime" : "")}>{w}</motion.span>;
}

/* ---------------- work ---------------- */
export function Work() {
  const shot = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: shot, offset: ["start end", "center center"] });
  const rot = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const sc = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const flowRef = useRef<HTMLOListElement>(null);
  const flowIn = useInView(flowRef, { once: true, margin: "0px 0px -15% 0px" });
  return (
    <section id="work" className={wrap + " scroll-mt-20 pb-10"}>
      <Tag n="01">Selected work · flagship</Tag>
      <BigHead className="mt-6" lines={[["Built to be", "solid"], ["used,", "lime"], ["not shown", "stroke"]]} />
      <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal className="lg:sticky lg:top-28">
          <div className="font-mono text-xs tracking-[0.2em] text-white/50">AI IN BUSINESS CAPSTONE · DECISION INTELLIGENCE</div>
          <h3 className="mt-4 font-display text-[clamp(72px,9vw,140px)] uppercase leading-[0.85]">Board<span className="text-lime">IQ</span></h3>
          <p className="mt-6 max-w-[48ch] text-lg text-white/70">An investor should never have to trust a verdict they can’t inspect. BoardIQ starts from the decision, says what data it needs, checks whether that data can be trusted, and only then gives a recommendation with its full reasoning chain.</p>
          <a href={LINKS.boardiq} target="_blank" rel="noopener" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3.5 font-mono text-xs font-medium tracking-[0.18em] text-black">OPEN THE LIVE APP <Arrow /></a>
          <div className="mt-10 grid grid-cols-3 border-t border-white/10">
            {[["Gemini 2.5", "Live reasoning, search grounding"], ["12 screens", "Objective to board memo"], ["React · TS", "Express, on Render"]].map(([b, s], i) => (
              <div key={b} className={"pt-4 " + (i ? "border-l border-white/10 pl-4" : "pr-4")}><div className="font-display text-2xl uppercase">{b}</div><div className="text-xs text-white/50">{s}</div></div>
            ))}
          </div>
        </Reveal>
        <div style={{ perspective: 1400 }}>
          <motion.div ref={shot} style={{ rotateX: rot, scale: sc, transformOrigin: "50% 100%" }} className="overflow-hidden rounded-2xl border border-white/15 shadow-[0_40px_120px_rgba(204,255,0,0.12)]">
            <img src={A("img/boardiq.jpg")} alt="BoardIQ dashboard: five-year financial telemetry with ARR and revenue chart" className="w-full" loading="lazy" />
          </motion.div>
          <ol ref={flowRef} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="How BoardIQ works">
            {FLOW.map(([b, s], i) => (
              <motion.li key={b} initial={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(3,0,20,0.6)" }}
                animate={flowIn ? { borderColor: i === 3 ? "rgba(136,170,255,0.7)" : "rgba(204,255,0,0.6)", backgroundColor: i === 3 ? "rgba(136,170,255,0.12)" : "rgba(204,255,0,0.08)" } : {}}
                transition={{ delay: i * 0.14, duration: 0.4 }} className="rounded-xl border p-3.5 backdrop-blur">
                <div className={"font-mono text-[11px] " + (i === 3 ? "text-energy" : "text-lime")}>{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1 font-medium">{b}</div><div className="text-xs text-white/50">{s}</div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- horizontal product run ---------------- */
export function Products() {
  const sec = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const [desk, setDesk] = useState(false);
  useLayoutEffect(() => {
    const m = () => {
      const d = window.innerWidth >= 1024 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setDesk(d);
      if (track.current) setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
    };
    m(); window.addEventListener("resize", m);
    const t = setTimeout(m, 600);
    return () => { window.removeEventListener("resize", m); clearTimeout(t); };
  }, []);
  const { scrollYProgress } = useScroll({ target: sec, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * dist);
  const [idx, setIdx] = useState(1);
  useEffect(() => scrollYProgress.on("change", (v) => setIdx(Math.min(PRODUCTS.length, 1 + Math.floor(v * PRODUCTS.length)))), [scrollYProgress]);
  return (
    <section ref={sec} className="relative z-10" style={{ height: desk ? `calc(100vh + ${dist}px)` : "auto" }} aria-label="Products I've shipped">
      <div className={desk ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : "py-20"}>
        <div className={wrap + " mb-8 flex flex-wrap items-end justify-between gap-4"}>
          <div><Tag n="02">Everything else that’s live</Tag><h2 className="mt-4 font-display text-[clamp(48px,7vw,110px)] uppercase leading-[0.9]">Products I’ve <span className="text-lime">shipped</span></h2></div>
          <span className="font-mono text-xs tracking-widest text-white/50"><span className="text-lime">0{desk ? idx : 1}</span> / 0{PRODUCTS.length}{desk ? " · KEEP SCROLLING →" : " · SWIPE →"}</span>
        </div>
        <motion.div ref={track} style={desk ? { x } : undefined}
          className={"flex gap-5 pl-5 md:pl-10 xl:pl-[max(40px,calc((100vw-1440px)/2+40px))] " + (desk ? "w-max pr-[20vw]" : "snap-x snap-mandatory overflow-x-auto pb-4 pr-5 [scrollbar-width:none]")}>
          {PRODUCTS.map((p, i) => {
            const Tagx = p.href ? "a" : "div";
            return (
              <Tagx key={p.name} {...(p.href ? { href: p.href, target: "_blank", rel: "noopener" } : {})}
                className="group relative flex w-[min(82vw,380px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-space/80 backdrop-blur transition-colors duration-500 hover:border-lime lg:w-[440px]">
                <div className="relative aspect-[16/10] overflow-hidden bg-black">
                  {p.img ? <img src={A(p.img)} alt={p.name} loading="lazy" className="h-full w-full object-cover object-top grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                    : <VoiceArt />}
                  <span className="absolute left-3 top-3 font-display text-6xl leading-none text-white/90 mix-blend-difference">0{i + 1}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] tracking-wider">
                    <span className="text-white/50">{p.tag.toUpperCase()}</span>
                    <span className={"rounded-full border px-2.5 py-1 " + (p.live ? "border-lime/50 bg-lime/10 text-lime" : "border-white/20 text-white/60")}>{p.status}</span>
                  </div>
                  <h3 className="font-display text-4xl uppercase leading-none">{p.name}</h3>
                  <p className="text-sm text-white/60">{p.d}</p>
                  {p.cta && <span className="mt-auto inline-flex items-center gap-1 pt-2 font-mono text-xs tracking-wider text-lime">{p.cta.toUpperCase()} <Arrow /></span>}
                </div>
              </Tagx>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
function VoiceArt() {
  return (
    <div className="flex h-full items-center justify-center gap-1 bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.18),transparent_70%)]">
      {Array.from({ length: 34 }).map((_, j) => (
        <span key={j} className="voice-bar w-1 rounded bg-lime" style={{ height: 18 + ((j * 37) % 72), animationDelay: j * 0.05 + "s" }} />
      ))}
    </div>
  );
}

/* ---------------- big word marquee ---------------- */
export function MethodMarquee() {
  const items = METHOD.map(([t]) => t);
  const row = items.map((t) => <span key={t} className="whitespace-nowrap pr-10 font-display text-[clamp(48px,7vw,110px)] uppercase leading-none"><span className="stroke-text">{t}</span> <span className="text-lime">✦</span></span>);
  return (
    <div aria-hidden="true" className="relative z-10 -rotate-2 overflow-hidden border-y border-lime/30 bg-space/70 py-6 backdrop-blur">
      <div className="marquee-rev flex w-max">{row}{row}</div>
    </div>
  );
}

/* ---------------- experience ---------------- */
export function Experience() {
  const [open, setOpen] = useState(0);
  return (
    <section id="experience" className={wrap + " scroll-mt-20 pt-[clamp(120px,14vw,190px)] pb-[clamp(72px,9vw,120px)]"}>
      <Tag n="01">Experience</Tag>
      <BigHead className="mt-6" lines={[["Three roles.", "solid"], ["One lesson:", "stroke"], ["the bottleneck", "solid"], ["is never the tool", "lime"]]} />
      <div className="mt-16 border-t border-white/15">
        {ROLES.map((r, i) => (
          <div key={r.co} className="border-b border-white/15">
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
              className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 py-6 text-left md:gap-8">
              <span className="font-mono text-xs text-lime">0{i + 1}</span>
              <span>
                <span className={"block font-display text-[clamp(44px,8vw,128px)] uppercase leading-[0.9] transition-colors duration-300 " + (open === i ? "text-lime" : "stroke-text group-hover:text-white")}>{r.co}</span>
                <span className="mt-2 block font-mono text-[11px] tracking-wider text-white/50">{r.role.toUpperCase()} · {r.when.toUpperCase()}</span>
              </span>
              <span className={"grid h-12 w-12 place-items-center rounded-full border transition-all duration-300 " + (open === i ? "rotate-180 border-lime bg-lime text-black" : "border-white/25")}>{open === i ? <Minus size={18} /> : <Plus size={18} />}</span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }} className="overflow-hidden">
                  <RoleBody r={r} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {EDU.map((e, i) => (
          <Reveal key={e.t} delay={i * 0.08} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white p-2"><img src={A(`logos/${e.logo}.png`)} alt={e.t + " logo"} className="max-h-10 w-auto" /></span>
            <div><div className="font-display text-2xl uppercase">{e.t}</div><div className="text-sm text-white/55">{e.d}</div></div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
function RoleBody({ r }: { r: Role }) {
  return (
    <div className="grid gap-4 pb-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="hidden lg:block"><span className="grid h-20 w-20 place-items-center rounded-2xl bg-white p-2.5"><img src={A(`logos/${r.logo}.png`)} alt={r.co + " logo"} className="max-h-14 w-auto" /></span></div>
      <div className="grid gap-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div><div className="font-mono text-[11px] tracking-[0.2em] text-lime">THE CHALLENGE</div><p className="mt-2 text-white/70">{r.challenge}</p></div>
          <div><div className="font-mono text-[11px] tracking-[0.2em] text-lime">WHAT I BUILT</div><p className="mt-2 text-white/70">{r.built}</p></div>
        </div>
        {r.pipeline && (
          <div className="rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur">
            <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-white/50">THE DATA PIPELINE I DESIGNED</div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {[["CAMS · KFIN · AMFI", ""], ["→", "a"], ["INGESTION", ""], ["→", "a"], ["VALIDATION", "e"], ["→", "a"], ["QC AUTOMATION", "e"], ["→", "a"], ["95% TRUSTED", "l"]].map(([t, k], j) => (
                <motion.span key={j} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + j * 0.1 }}
                  className={k === "a" ? "text-white/40" : "rounded-lg border px-3 py-2 " + (k === "l" ? "border-lime bg-lime text-black" : k === "e" ? "border-energy/60 text-energy" : "border-white/20")}>{t}</motion.span>
              ))}
            </div>
          </div>
        )}
        <div className={"grid gap-4 " + (r.matrix ? "md:grid-cols-2" : "")}>
          {r.bars && (
            <div className="rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur">
              <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-white/50">{(r.scale || "What moved").toUpperCase()}</div>
              <div className="grid gap-3">
                {r.bars.map((b, j) => (
                  <div key={b.l} className="grid grid-cols-[1fr_64px] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[150px_1fr_64px]">
                    <span className="text-white/60">{b.l}</span>
                    <span className="relative col-span-2 h-2.5 overflow-hidden rounded-full bg-white/10 sm:col-span-1 sm:row-start-1 sm:col-start-2">
                      {b.was !== undefined && <motion.i className="absolute inset-y-0 left-0 z-10 rounded-full bg-white/35" initial={{ width: 0 }} animate={{ width: b.was + "%" }} transition={{ duration: 1, delay: 0.2 + j * 0.12 }} />}
                      <motion.i className="absolute inset-y-0 left-0 rounded-full bg-lime" initial={{ width: 0 }} animate={{ width: b.v + "%" }} transition={{ duration: 1.4, delay: 0.3 + j * 0.12, ease: EASE }} />
                    </span>
                    <b className="row-start-1 text-right font-mono text-xs font-medium sm:col-start-3">{b.b}</b>
                  </div>
                ))}
              </div>
              {r.extra && <p className="mt-4 text-sm text-white/55">{r.extra}</p>}
            </div>
          )}
          {r.matrix && (
            <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur">
              <div className="grid w-[210px] grid-cols-10 gap-1" aria-label="40 of 50 squares lit: 80%">
                {Array.from({ length: 50 }).map((_, j) => (
                  <motion.i key={j} className="aspect-square rounded-[3px]" initial={{ backgroundColor: "rgba(255,255,255,0.1)" }} animate={{ backgroundColor: j < 40 ? "#CCFF00" : "rgba(255,255,255,0.1)" }} transition={{ delay: 0.3 + j * 0.018 }} />
                ))}
              </div>
              <div><div className="font-display text-7xl leading-none text-lime">80%</div><div className="mt-1 font-mono text-[11px] text-white/50">manual ops automated<br />each square = 2%</div></div>
            </div>
          )}
          {r.big && (
            <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur">
              <div className="font-display text-[clamp(56px,7vw,96px)] uppercase leading-none text-lime">{r.big}</div>
              <p className="max-w-[44ch] text-white/60">{r.bigNote}</p>
            </div>
          )}
        </div>
        <p className="border-l-2 border-lime pl-4 font-display text-2xl uppercase leading-tight text-white md:text-3xl">“{r.quote}”</p>
      </div>
    </div>
  );
}

/* ---------------- labs: wing, gallery, archive ---------------- */
export function Labs() {
  return (
    <section id="labs" className={wrap + " scroll-mt-20 pb-[clamp(96px,12vw,170px)]"}>
      <Tag n="01">Leading the AI &amp; Analytics Wing</Tag>
      <BigHead className="mt-6" lines={[["Off the screen:", "solid"], ["events, stalls", "stroke"], ["& teams", "lime"]]} />
      <div className="mt-14 grid auto-rows-[200px] grid-cols-2 gap-3 md:auto-rows-[240px] md:grid-cols-4">
        {GALLERY.map(([src, cap], i) => (
          <motion.figure key={src} initial={{ clipPath: "inset(20% 10% 20% 10% round 16px)", opacity: 0.4 }} whileInView={{ clipPath: "inset(0% 0% 0% 0% round 16px)", opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: i * 0.08, ease: EASE }}
            className={"group relative overflow-hidden rounded-2xl bg-black " + (i === 0 ? "col-span-2 row-span-2" : i === 3 ? "col-span-2 md:col-span-1" : "")}>
            <img src={A(src)} alt={cap} loading="lazy" className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[11px] tracking-wider backdrop-blur">{cap.toUpperCase()}</figcaption>
          </motion.figure>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 border-t border-white/10 lg:grid-cols-4">
        {WING.map((w, i) => (
          <Reveal key={w.t} delay={i * 0.06} className={"py-6 pr-4 " + (i % 2 ? "border-l border-white/10 pl-4 " : "") + (i === 2 ? "lg:border-l lg:pl-4" : "")}>
            <div className="font-display text-7xl leading-none text-lime"><Counter to={parseInt(w.n)} pad /></div>
            <div className="mt-3 font-display text-2xl uppercase">{w.t}</div>
            <p className="mt-1 text-sm text-white/55">{w.d}</p>
          </Reveal>
        ))}
      </div>

      <div className="mt-[clamp(96px,12vw,160px)] flex flex-wrap items-end justify-between gap-6">
        <div><Tag n="02">Archive</Tag><h2 className="mt-4 font-display text-[clamp(48px,7vw,110px)] uppercase leading-[0.9]">Ventures, prototypes<br /><span className="stroke-text">&amp; analysis</span></h2></div>
        <p className="max-w-[36ch] text-white/55">Smaller builds and ideas I’ve tested. Each label says exactly how far it got.</p>
      </div>
      <div className="mt-10 border-t border-white/15">
        {SKETCHES.map((s, i) => {
          const Row = s.href ? "a" : "div";
          return (
            <Row key={s.t} {...(s.href ? { href: s.href, target: "_blank", rel: "noopener" } : {})}
              className="group relative grid grid-cols-[40px_1fr] items-baseline gap-x-4 gap-y-1 border-b border-white/15 px-2 py-5 transition-colors duration-300 hover:bg-lime hover:text-black md:grid-cols-[60px_minmax(0,1.1fr)_minmax(0,1.6fr)_200px] md:items-center">
              <span className="font-mono text-xs text-lime group-hover:text-black">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-display text-3xl uppercase leading-none md:text-4xl">{s.t}{s.href && <ArrowUpRight className="ml-1 inline" size={22} />}</span>
              <span className="col-start-2 text-sm text-white/60 group-hover:text-black/75 md:col-start-auto">{s.d}</span>
              <span className={"col-start-2 justify-self-start rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider md:col-start-auto md:justify-self-end " + (s.hot ? "border-lime/60 text-lime group-hover:border-black group-hover:text-black" : "border-white/25 text-white/60 group-hover:border-black/40 group-hover:text-black")}>{s.s.toUpperCase()}</span>
            </Row>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- about ---------------- */
export function About() {
  const loop = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: loop, offset: ["start 0.75", "end 0.55"] });
  const h = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const [lit, setLit] = useState(0);
  useEffect(() => scrollYProgress.on("change", (v) => setLit(Math.round(v * METHOD.length))), [scrollYProgress]);
  const [ti, setTi] = useState(0), [si, setSi] = useState(0);
  return (
    <section id="about" className={wrap + " scroll-mt-20 pb-[clamp(96px,12vw,170px)]"}>
      <Tag n="02">About</Tag>
      <div className="mt-6 grid gap-12 lg:grid-cols-2">
        <div>
          <BigHead lines={[["An engineer", "solid"], ["who learned", "stroke"], ["to sell", "lime"]]} className="!text-[clamp(52px,8vw,128px)]" />
          <Reveal className="mt-10 grid gap-4 text-lg text-white/70">
            <p>I trained as a mechanical engineer at VIT, where I designed the hybrid braking system for our BAJA SAE car. We finished eighth in India. It taught me to think in systems: every part has inputs, failure modes and a person who depends on it.</p>
            <p>Myntra and Wipro taught me that data only matters when it changes a decision. Rabbit Invest taught me the harder part: building an ops function as a founding member and being accountable for the numbers in front of the founders.</p>
            <p>At Masters’ Union I build on the side because that’s how I learn. Next: a <span className="text-lime">Data/BI, Founder’s Office or Product</span> role where I can do the same at scale.</p>
          </Reveal>
        </div>
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-white/50">HOW I WORK</div>
          <ol ref={loop} className="relative mt-6">
            <span className="absolute left-[19px] top-5 bottom-5 w-px bg-white/15" />
            <motion.span className="absolute left-[19px] top-5 w-px bg-lime" style={{ height: h }} />
            {METHOD.map(([t, d], i) => (
              <li key={t} className="relative grid grid-cols-[40px_1fr] gap-5 py-4">
                <span className={"z-10 grid h-10 w-10 place-items-center rounded-full border font-mono text-xs transition-all duration-500 " + (i < lit ? "border-lime bg-lime text-black" : "border-white/25 bg-space")}>0{i + 1}</span>
                <div><div className="font-display text-3xl uppercase leading-none">{t}</div><p className="mt-1 text-white/55">{d}</p></div>
              </li>
            ))}
          </ol>
          <Reveal className="mt-6 overflow-hidden rounded-2xl border border-white/10"><img src={A("img/system-loop.gif")} alt="Animation: inputs flowing along curves into a decision engine" loading="lazy" className="w-full" /></Reveal>
        </div>
      </div>

      <div className="mt-[clamp(96px,12vw,160px)]">
        <Tag n="03">Toolkit</Tag>
        <h2 className="mt-4 font-display text-[clamp(48px,7vw,110px)] uppercase leading-[0.9]">What I actually <span className="text-lime">work with</span></h2>
        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Skill areas">
          {TOOLKIT.map((g, k) => (
            <button key={g.name} role="tab" aria-selected={k === ti} type="button" onClick={() => { setTi(k); setSi(0); }}
              className={"rounded-full border px-5 py-2.5 font-mono text-xs tracking-wider transition-colors " + (k === ti ? "border-lime bg-lime text-black" : "border-white/20 text-white/60 hover:border-white/60")}>{g.name.toUpperCase()}</button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={ti} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
            <p className="mt-8 max-w-[60ch] font-display text-[clamp(26px,3vw,42px)] uppercase leading-tight">{TOOLKIT[ti].head}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOOLKIT[ti].skills.map(([s], k) => (
                <button key={s} type="button" aria-pressed={k === si} onClick={() => setSi(k)}
                  className={"rounded-xl border px-4 py-2.5 text-sm transition-all " + (k === si ? "border-lime text-lime shadow-[0_0_30px_rgba(204,255,0,0.2)]" : "border-white/15 bg-space/70 text-white/80 hover:border-white/50")}>{s}</button>
              ))}
            </div>
            <div className="mt-4 flex gap-4 rounded-2xl border border-white/10 bg-space/70 p-5 backdrop-blur" aria-live="polite">
              <span className="font-mono text-[11px] tracking-[0.2em] text-lime">IN PRACTICE</span><p className="text-white/80">{TOOLKIT[ti].skills[si][1]}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        <a href={LINKS.github} target="_blank" rel="noopener" className="group mt-6 inline-flex items-center gap-1 font-mono text-xs tracking-wider text-lime">MY CODE ON GITHUB <Arrow /></a>
      </div>

      <div className="mt-[clamp(96px,12vw,160px)]">
        <Tag n="04">Milestones</Tag>
        <h2 className="mt-4 font-display text-[clamp(48px,7vw,110px)] uppercase leading-[0.9]">A few things I’m <span className="stroke-text">proud of</span></h2>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONES.map(([b, t, d], i) => (
            <Reveal key={t} delay={(i % 4) * 0.06} className="group rounded-2xl border border-white/10 bg-space/70 p-6 backdrop-blur transition-colors duration-300 hover:bg-lime hover:text-black">
              <div className="font-display text-5xl leading-none text-lime group-hover:text-black">{b}</div>
              <div className="mt-4 font-display text-xl uppercase">{t}</div>
              <p className="mt-1 text-sm text-white/55 group-hover:text-black/70">{d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- contact ---------------- */
export function Contact({ onDrawer, onBot, onStory }: { onDrawer: () => void; onBot: () => void; onStory: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = (ok: boolean) => { setCopied(ok); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(EMAIL).then(() => done(true), () => done(false)); else done(false);
  };
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.7, 1]);
  return (
    <section id="contact" className="relative z-10 overflow-hidden pt-[clamp(120px,14vw,190px)]">
      <div className={wrap}>
        <Tag n="01">Contact</Tag>
        <div className="mt-6 grid items-end gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div>
            <button type="button" onClick={onDrawer} className="group block text-left" aria-label="Open the contact form">
              <span className="block font-display text-[clamp(84px,17vw,280px)] uppercase leading-[0.82]">
                <span className="stroke-text transition-colors duration-500 group-hover:text-lime">Let’s</span><br /><span className="text-lime">work.</span>
              </span>
            </button>
            <p className="mt-8 max-w-[52ch] text-lg text-white/65">Looking for Data/BI, Founder’s Office and Product roles after my PGP in 2027. Got a messy process and good data? I’d like to hear about it.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={onDrawer} className="rounded-full bg-lime px-6 py-3.5 font-mono text-xs font-medium tracking-[0.18em] text-black">WRITE TO ME →</button>
              <button type="button" onClick={onBot} className="rounded-full border border-white/25 px-6 py-3.5 font-mono text-xs tracking-[0.18em] hover:border-lime hover:text-lime">ASK SUMAHAR AI</button>
              <button type="button" onClick={onStory} className="rounded-full border border-white/25 px-6 py-3.5 font-mono text-xs tracking-[0.18em] hover:border-lime hover:text-lime">REPLAY MY STORY</button>
            </div>
          </div>
          <div className="grid">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-y border-white/15 py-4">
              <span className="col-span-2 font-mono text-[11px] tracking-[0.2em] text-white/45">EMAIL</span>
              <span className="select-all break-all text-[15px]">{EMAIL}</span>
              <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 font-mono text-[11px] hover:border-lime hover:text-lime">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "COPIED" : "COPY"}</button>
            </div>
            {[["LinkedIn", "/in/sumahar-pelluri", LINKS.linkedin], ["GitHub", "sumaharpelluri2027-tech", LINKS.github], ["BoardIQ", "AI investment platform, live", LINKS.boardiq], ["The Wing", "AI & Analytics Wing site", LINKS.wing], ["Decco Store", "D2C brand, ₹3L revenue", LINKS.decco]].map(([k, v, h]) => (
              <a key={k} href={h} target="_blank" rel="noopener" className="group grid grid-cols-[110px_1fr_auto] items-center gap-3 border-b border-white/15 py-4 transition-all duration-300 hover:pl-3 hover:text-lime">
                <span className="font-mono text-[11px] tracking-[0.2em] text-white/45">{k.toUpperCase()}</span><span>{v}</span><Arrow />
              </a>
            ))}
          </div>
        </div>
      </div>
      <motion.div ref={ref} style={{ scale }} aria-hidden="true" className="mt-20 select-none text-center font-display text-[22vw] uppercase leading-[0.78] text-lime/90">Sumahar</motion.div>
      <footer className={wrap + " flex flex-wrap justify-between gap-3 border-t border-white/10 py-6 font-mono text-[11px] tracking-wider text-white/45"} style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <span>SUMAHAR PELLURI · PGP-TBM ’27 · MASTERS’ UNION</span>
        <span>SOUNDTRACK: “CHASING THE HORIZON”, ORIGINAL · BUILT WITH REACT + THREE.JS</span>
      </footer>
    </section>
  );
}

/* ---------------- home: page index ---------------- */
const PAGES_INDEX: [string, string, string][] = [
  ["work", "Work", "BoardIQ and six live products"],
  ["experience", "Experience", "Rabbit Invest · Wipro · Myntra"],
  ["labs", "Labs", "The Wing, events, ventures and the archive"],
  ["about", "About", "How I work, toolkit, milestones"],
  ["contact", "Contact", "Let's work together"],
];
export function Explore() {
  return (
    <section className={wrap + " pb-[clamp(72px,9vw,120px)]"}>
      <Tag n="01">Explore</Tag>
      <div className="mt-8 border-t border-white/15">
        {PAGES_INDEX.map(([id, t, d], i) => (
          <a key={id} href={"#/" + id} onClick={(e) => { e.preventDefault(); scrollToId(id); }}
            className="group relative grid grid-cols-[40px_1fr_auto] items-center gap-4 overflow-hidden border-b border-white/15 py-5 md:grid-cols-[60px_1fr_minmax(0,320px)_auto]">
            <span className="absolute inset-0 origin-bottom scale-y-0 bg-lime transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100" />
            <span className="relative font-mono text-xs text-lime group-hover:text-black">0{i + 1}</span>
            <span className="relative font-display text-[clamp(48px,8vw,124px)] uppercase leading-[0.9] transition-transform duration-500 group-hover:translate-x-4 group-hover:text-black"><span className="stroke-text group-hover:text-black group-hover:[-webkit-text-stroke:0]">{t}</span></span>
            <span className="relative hidden text-white/55 group-hover:text-black/70 md:block">{d}</span>
            <ArrowUpRight className="relative h-8 w-8 transition-transform duration-500 group-hover:rotate-45 group-hover:text-black md:h-12 md:w-12" />
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------------- subpage tail ---------------- */
export function NextPage({ id, label }: { id: string; label: string }) {
  return (
    <section className={wrap + " pb-10"}>
      <a href={"#/" + id} onClick={(e) => { e.preventDefault(); scrollToId(id); }} className="group block border-t border-white/15 pt-10">
        <span className="font-mono text-xs tracking-[0.2em] text-white/50">NEXT PAGE</span>
        <span className="mt-2 flex items-center justify-between gap-4 font-display text-[clamp(56px,11vw,180px)] uppercase leading-[0.85]">
          <span className="stroke-text transition-colors duration-500 group-hover:text-lime group-hover:[-webkit-text-stroke:0]">{label}</span>
          <ArrowUpRight className="h-16 w-16 shrink-0 text-lime transition-transform duration-500 group-hover:rotate-45 md:h-28 md:w-28" />
        </span>
      </a>
    </section>
  );
}
export function PageFooter() {
  return (
    <footer className={wrap + " flex flex-wrap justify-between gap-3 border-t border-white/10 py-6 font-mono text-[11px] tracking-wider text-white/45"} style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <span>SUMAHAR PELLURI · PGP-TBM ’27 · MASTERS’ UNION</span>
      <a href={"mailto:" + EMAIL} className="hover:text-lime">{EMAIL.toUpperCase()}</a>
    </footer>
  );
}
