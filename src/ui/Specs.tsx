import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { A, EDU, EMAIL, LINKS, MILESTONES, NUMBERS, ROLES, TOOLKIT } from "../data";
import { KINDS, PROJECTS } from "../projects";
import { CAR_ORDER, JOBS } from "../content";

/** The plain page: everything in the garage, as a spec sheet you can read top to bottom (and print). */
export default function Specs() {
  const row = "grid gap-1 border-b border-black/15 py-3 md:grid-cols-[180px_1fr] md:gap-6";
  const k = "font-mono text-[11px] tracking-[0.18em] text-black/55 pt-1";
  const k_ = k;
  return (
    <div className="paper min-h-full">
      <div className="hazard h-3" />
      <div className="mx-auto max-w-[920px] px-5 pb-20 pt-8 md:px-10">
        <div className="flex items-center justify-between font-mono text-xs">
          <a href="#/" className="inline-flex items-center gap-1 rounded-full bg-black px-4 py-2 text-hazard print:hidden"><ArrowLeft size={14} /> <span className="sm:hidden">GARAGE</span><span className="hidden sm:inline">BACK TO THE GARAGE</span></a>
          <a href={A("Sumahar-Pelluri-CV.pdf")} download="Sumahar-Pelluri-CV.pdf" target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border-2 border-black px-4 py-2 text-black print:hidden">DOWNLOAD CV (PDF)</a>
          <span className="text-black/50">SPEC SHEET · REV 2026.11</span>
        </div>

        <header className="mt-10 grid items-end gap-6 border-b-4 border-black pb-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-black/55">MODEL</div>
            <h1 className="font-stencil text-[clamp(48px,9vw,92px)] leading-[0.9] text-black">SUMAHAR PELLURI</h1>
            <p className="mt-3 max-w-[56ch] font-cond text-[22px] font-medium leading-snug text-black/85">Founders drive. I build the car, and wire it so every gauge tells the truth.</p>
            <p className="mt-2 text-black/70">Operations, growth and strategy, with data underneath all of it. PGP in Technology &amp; Business Management '27 at Masters' Union. Open to Founder's Office, operations, strategy and data roles from 2027.</p>
          </div>
          <img src={A("me/clean.webp")} alt="Sumahar Pelluri" className="h-44 w-36 rounded object-cover object-top md:h-56 md:w-44" />
        </header>

        <section className="mt-8">
          <div className="grid grid-cols-2 border-2 border-black md:grid-cols-4">
            {NUMBERS.map((n, i) => (
              <div key={n.label} className={`p-4 ${i ? "border-l-2 border-black max-md:[&:nth-child(3)]:border-l-0 max-md:[&:nth-child(n+3)]:border-t-2" : ""}`}>
                <div className="font-stencil text-4xl text-rust">{n.pre}{n.n}{n.suf}</div>
                <div className="text-sm text-black/80">{n.label}</div>
                <div className="font-mono text-[10px] text-black/50">{n.from}</div>
              </div>
            ))}
          </div>
        </section>

        <Section n="01" t="Systems on this car">
          {CAR_ORDER.map((id) => { const j = JOBS[id]; return (
            <div key={id} className={row}>
              <div className={k}>{j.part.toUpperCase()} · {j.area.toUpperCase()}</div>
              <div>
                <div className="font-cond text-[19px] font-semibold text-black">{j.title}</div>
                <div className="font-mono text-[11px] text-black/50">{j.where}</div>
                <p className="mt-1 text-[15px] text-black/80">{j.work}</p>
                <p className="mt-1 text-[15px]"><b className="text-rust">{j.result.big}</b> <span className="text-black/75">{j.result.label}</span>{j.extra ? <span className="text-black/60"> · {j.extra}</span> : null}</p>
              </div>
            </div>
          ); })}
        </Section>

        <Section n="02" t="Service history">
          {ROLES.map((r) => (
            <div key={r.co} className={row}>
              <div className={k}>{r.when.toUpperCase()}</div>
              <div><div className="font-cond text-[19px] font-semibold text-black">{r.co} · <span className="font-normal">{r.role}</span></div><p className="text-[15px] text-black/80">{r.built}</p><p className="mt-1 text-sm italic text-black/60">"{r.quote}"</p></div>
            </div>
          ))}
          {EDU.map((e) => (<div key={e.t} className={row}><div className={k}>EDUCATION</div><div><div className="font-cond text-[19px] font-semibold text-black">{e.t}</div><p className="text-[15px] text-black/75">{e.d}</p></div></div>))}
        </Section>

        <Section n="03" t="Projects: MU and beyond">
          {KINDS.filter((k) => k.id !== "all").map((k) => (
            <div key={k.id} className="mt-5">
              <div className="font-mono text-[11px] tracking-[0.2em] text-rust">{k.label.toUpperCase()}</div>
              {PROJECTS.filter((p) => p.kind === k.id).map((p) => (
                <div key={p.id} className={row}>
                  <div className={k_}>{p.status.toUpperCase()}</div>
                  <div>
                    <div className="font-cond text-[18px] font-semibold text-black">{p.href ? <a href={p.href} target="_blank" rel="noopener" className="underline decoration-hazard decoration-2 underline-offset-4">{p.title} <ArrowUpRight className="inline" size={15} /></a> : p.title} <span className="font-mono text-[11px] font-normal text-black/50">· {p.where}</span></div>
                    <p className="text-[15px] text-black/75">{p.what}</p>
                    <p className="text-[14px] text-black/65"><b className="font-mono text-[10px] tracking-wider text-rust">MY PART </b>{p.mine}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Section>

        <Section n="04" t="Tools">
          {TOOLKIT.map((g) => (
            <div key={g.name} className={row}><div className={k}>{g.name.toUpperCase()}</div><div><p className="text-[15px] text-black/80">{g.head}</p><p className="mt-1 font-mono text-[12px] text-black/60">{g.skills.map((s) => s[0]).join(" · ")}</p></div></div>
          ))}
        </Section>

        <Section n="05" t="Wins">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {MILESTONES.map(([b, t, d]) => (<div key={t} className="flex gap-3 border-b border-black/15 py-2.5"><b className="w-16 shrink-0 font-stencil text-lg text-rust">{b}</b><div><div className="font-semibold text-black">{t}</div><div className="text-sm text-black/65">{d}</div></div></div>))}
          </div>
        </Section>

        <Section n="06" t="Contact">
          <div className={row}><div className={k}>EMAIL</div><div className="select-all break-all text-[16px] text-black">{EMAIL}</div></div>
          {[["LinkedIn", LINKS.linkedin], ["GitHub", LINKS.github], ["BoardIQ", LINKS.boardiq]].map(([l, h]) => (
            <div key={l} className={row}><div className={k}>{l.toUpperCase()}</div><a href={h} target="_blank" rel="noopener" className="break-all text-[16px] text-black underline decoration-hazard decoration-2 underline-offset-4">{h.replace(/^https?:\/\/(www\.)?/, "")}</a></div>
          ))}
        </Section>
      </div>
    </div>
  );
}
function Section({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="flex items-baseline gap-3 border-b-2 border-black pb-2"><span className="font-mono text-xs text-rust">{n}</span><span className="font-stencil text-3xl text-black" dangerouslySetInnerHTML={{ __html: t.toUpperCase() }} /></h2>
      {children}
    </section>
  );
}
