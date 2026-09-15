"use client";
import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const nodes = [
  { name: "SQL", detail: "Find the signal", x: 13, y: 30, dx: -85, dy: -55 },
  { name: "Python", detail: "Clean the inputs", x: 18, y: 62, dx: -50, dy: 65 },
  { name: "APIs", detail: "Connect the pieces", x: 73, y: 27, dx: 75, dy: -40 },
  { name: "Gemini", detail: "Reason with evidence", x: 78, y: 57, dx: 60, dy: 60 },
  { name: "Make", detail: "Keep work moving", x: 53, y: 77, dx: 30, dy: 40 }
];

export default function CinematicHero() {
  const ref=useRef<HTMLElement>(null);
  const reduced=useReducedMotion();
  const {scrollYProgress:p}=useScroll({target:ref,offset:["start start","end end"]});
  const titleY=useTransform(p,[0,.5],[0,-100]);
  const titleOpacity=useTransform(p,[0,.25,.45],[1,1,0]);
  const figureScale=useTransform(p,[0,.6],[1,.78]);
  const figureY=useTransform(p,[0,.6],[0,45]);
  const wireOpacity=useTransform(p,[.22,.55],[0,1]);
  const wireLength=useTransform(p,[.35,.85],[0,1]);
  const copyOpacity=useTransform(p,[.42,.6],[0,1]);
  return <section className="cinema-scroll" id="top" ref={ref}>
    <div className="cinema-stage">
      <div className="cinema-grid" aria-hidden="true"/>
      <div className="cinema-topline"><span>SUMAHAR PELLURI / SYSTEMS BUILDER</span><span>AI · DATA · OPERATIONS</span></div>
      <motion.div className="cinema-title" style={reduced ? {} : {y:titleY,opacity:titleOpacity}}>
        <p>WELCOME TO THE WAY I THINK</p><h1>SUMAHAR</h1>
      </motion.div>
      <motion.div className="cinema-person" style={reduced ? {} : {scale:figureScale,y:figureY}}>
        <Image src="/assets/sumahar-cinematic.webp" alt="AI-created full-body portrait of Sumahar in a navy suit" fill sizes="(max-width: 700px) 66vw, 40vw" priority/>
      </motion.div>
      <motion.svg className="cinema-wires" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" style={{opacity:reduced ? .6 : wireOpacity}}>
        {nodes.map(n=><motion.path key={n.name} d={`M ${n.x*10+60} ${n.y*7+30} Q 500 ${n.y*7} 500 350`} fill="none" stroke="currentColor" strokeWidth="1.4" style={{pathLength:reduced ? 1 : wireLength}}/>)}
      </motion.svg>
      <div className="cinema-tools">{nodes.map((n,i)=><ToolNode key={n.name} node={n} index={i} progress={p} reduced={!!reduced}/>)}</div>
      <motion.div className="cinema-story" style={{opacity:reduced ? 1 : copyOpacity}}><span>DISCONNECTED TOOLS. ONE WORKING SYSTEM.</span><h2>I turn manual work<br/>into forward motion.</h2></motion.div>
      <div className="cinema-bottom"><div><span>THE WORK</span><p>Messy processes.<br/>Intelligent systems.</p><a href="#lab">EXPLORE THE BUILDS ↗</a></div><span className="cinema-scroll-hint">SCROLL TO CONNECT ↓</span><div className="cinema-side-note"><span>INDEPENDENT BUILDER</span><p>From raw data<br/>to real decisions.</p><small>AI-created portrait</small></div></div>
    </div>
  </section>;
}

function ToolNode({node:n,index,progress,reduced}:{node:typeof nodes[number];index:number;progress:ReturnType<typeof useScroll>["scrollYProgress"];reduced:boolean}) {
  const x=useTransform(progress,[0,.6],[n.dx,0]);const y=useTransform(progress,[0,.6],[n.dy,0]);const rotate=useTransform(progress,[0,.6],[(index%2?1:-1)*15,0]);const opacity=useTransform(progress,[.18,.45],[0,1]);
  return <motion.div className="cinema-tool" style={{left:`${n.x}%`,top:`${n.y}%`,x:reduced?0:x,y:reduced?0:y,rotate:reduced?0:rotate,opacity:reduced?1:opacity}}><b>{n.name}</b><span>{n.detail}</span><i/></motion.div>;
}
