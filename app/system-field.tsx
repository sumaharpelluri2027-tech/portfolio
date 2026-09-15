"use client";
import { useEffect, useRef, useState } from "react";

/** A bounded, visibility-aware particle simulation. No external rendering runtime. */
export default function SystemField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, frame = 0, visible = true;
    const pointer = { x: -1000, y: -1000 };
    const points = Array.from({ length: 65 }, (_, i) => ({ x: ((i * 137.508) % 100) / 100, y: ((i * 73.71) % 100) / 100, phase: i * .73 }));
    const resize = new ResizeObserver(() => { const rect = el.getBoundingClientRect(); width = rect.width; height = rect.height; const dpr = Math.min(devicePixelRatio, 2); el.width = width * dpr; el.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0); });
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = reduced.matches || paused ? 0 : time * .00018;
      const ps = points.map(p => ({ x: p.x * width + Math.sin(t + p.phase) * 22, y: p.y * height + Math.cos(t * .7 + p.phase) * 18 }));
      ps.forEach((p, i) => {
        ps.slice(i + 1).forEach(q => { const dist = Math.hypot(p.x-q.x,p.y-q.y); if(dist < 110) { ctx.strokeStyle = `rgba(110,183,208,${(1-dist/110)*.24})`; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); } });
        const near = Math.hypot(pointer.x-p.x,pointer.y-p.y) < 130;
        ctx.fillStyle = near ? "#f4bd7b" : "#75bdd2";
        ctx.beginPath(); ctx.arc(p.x,p.y,near ? 3 : 1.5,0,Math.PI*2); ctx.fill();
        if(near) { ctx.strokeStyle="rgba(244,189,123,.2)"; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(pointer.x,pointer.y); ctx.stroke(); }
      });
    };
    const loop = (time:number) => { if(visible && !document.hidden) draw(time); frame=requestAnimationFrame(loop); };
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    const move = (e:PointerEvent) => { const rect=el.getBoundingClientRect(); pointer.x=e.clientX-rect.left; pointer.y=e.clientY-rect.top; };
    const leave = () => { pointer.x=-1000; pointer.y=-1000; };
    resize.observe(el); intersection.observe(el); el.addEventListener("pointermove",move); el.addEventListener("pointerleave",leave);
    if(!paused && !reduced.matches) frame=requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); el.removeEventListener("pointermove",move); el.removeEventListener("pointerleave",leave); };
  }, [paused]);
  return <div className="system-field"><canvas ref={canvas} aria-label="Interactive network illustration connecting data and decisions" role="img"/><div className="field-caption"><span>DATA → INTELLIGENCE → ACTION</span><button onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused ? "Resume motion" : "Pause motion"}</button></div><div className="field-node node-a">01 / DATA</div><div className="field-node node-b">02 / REASON</div><div className="field-node node-c">03 / EXECUTE</div></div>;
}
