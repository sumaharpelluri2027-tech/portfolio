"use client";
import { useState } from "react";
export default function MotionLab() {
  const [playing,setPlaying]=useState(false);
  return <section className="motion-lab"><div><p className="eyebrow">MOTION STUDIES / SYSTEMS IN ACTION</p><h2>From scattered signals<br/>to a clear decision.</h2><p>A looping illustration of data moving through a system. Play the study, or leave it still.</p><button className="button primary" aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing ? "Pause animation" : "Play motion study"}</button></div><div><img src={playing ? "/assets/system-loop.gif" : "/assets/system-still.png"} width="640" height="360" alt="Illustration of signals converging into a decision system" loading="lazy"/><span>ILLUSTRATION / NOT LIVE PRODUCT DATA</span></div><a className="film-link" href="https://youtu.be/Ec_oS-oTlYQ" target="_blank" rel="noreferrer"><span>▶</span><div><small>THE ORIGINAL CAMPAIGN FILM / GOOGLE FLOW</small><h3>Another way to tell a story.</h3><p>My first AI-generated film, created for the AI & Analytics Wing campaign.</p></div><b>WATCH ↗</b></a></section>;
}
