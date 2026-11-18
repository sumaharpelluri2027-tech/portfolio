/**
 * The test track's soundtrack: an upbeat synthwave tune made live with WebAudio (nothing to download).
 * Supersaw pads that duck with the kick, a plucky arp, a sung-style lead with delay, a room reverb,
 * and short stingers for the moments that matter.
 */
export interface Music { start(): void; stop(): void; setOn(on: boolean): void; sting(kind: "gate" | "all" | "finish"): void; dispose(): void }

const BPM = 112;
const STEP = 60 / BPM / 4; // a 16th note
// eight bars: Am  F  C  G  |  Am  F  G  E
const CHORDS = [[57, 60, 64], [53, 57, 60], [52, 55, 60], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [56, 59, 64]];
const ROOTS = [45, 41, 48, 43, 45, 41, 43, 40];
// a singable hook over the 8 bars: [16th step, midi, length in 16ths]
const HOOK: [number, number, number][] = [
  [0, 69, 2], [2, 72, 2], [4, 76, 4], [10, 74, 2], [12, 72, 4],
  [16, 72, 2], [18, 74, 2], [20, 77, 4], [26, 76, 2], [28, 74, 4],
  [32, 76, 2], [34, 79, 2], [36, 84, 6], [44, 83, 2], [46, 81, 2],
  [48, 79, 4], [52, 76, 2], [54, 74, 2], [56, 76, 8],
  [64, 69, 2], [66, 72, 2], [68, 76, 4], [74, 74, 2], [76, 72, 4],
  [80, 72, 2], [82, 74, 2], [84, 77, 4], [90, 79, 2], [92, 81, 4],
  [96, 79, 4], [100, 77, 2], [102, 76, 2], [104, 74, 4],
  [112, 76, 2], [114, 74, 2], [116, 71, 4], [120, 68, 6],
];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic(): Music {
  let ctx: AudioContext | null = null;
  let out: GainNode, bus: GainNode, duck: GainNode, verb: ConvolverNode, verbIn: GainNode, delay: DelayNode, delayIn: GainNode;
  let noise: AudioBuffer;
  let timer = 0, step = 0, nextT = 0, playing = false, on = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new AC(); ctx = c;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2; comp.connect(c.destination);
    out = c.createGain(); out.gain.value = 0; out.connect(comp);
    bus = c.createGain(); bus.gain.value = 1; bus.connect(out);
    duck = c.createGain(); duck.gain.value = 1; duck.connect(bus);          // pads and bass pump with the kick
    // room reverb from decaying noise
    verb = c.createConvolver(); const ir = c.createBuffer(2, c.sampleRate * 2.4, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    verb.buffer = ir; verbIn = c.createGain(); verbIn.gain.value = 0.32; verbIn.connect(verb); const vOut = c.createGain(); vOut.gain.value = 0.55; verb.connect(vOut); vOut.connect(out);
    // dotted-eighth echo for the lead
    delay = c.createDelay(1); delay.delayTime.value = STEP * 3; const fb = c.createGain(); fb.gain.value = 0.33; const dl = c.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 3200;
    delayIn = c.createGain(); delayIn.gain.value = 0.28; delayIn.connect(delay); delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(out); dl.connect(verbIn);
    noise = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return c;
  }
  function env(g: GainNode, t: number, a: number, peak: number, hold: number, rel: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function voice(o: { type: OscillatorType; f: number; t: number; a?: number; hold: number; rel: number; vol: number; cut?: number; cutEnv?: number; detune?: number[]; to: AudioNode; send?: number; echo?: number; vib?: boolean }) {
    const c = ctx!; const g = c.createGain(); env(g, o.t, o.a ?? 0.008, o.vol, o.hold, o.rel);
    const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 2;
    const cut = o.cut ?? 6000; fl.frequency.setValueAtTime(cut * (o.cutEnv ?? 1), o.t); fl.frequency.exponentialRampToValueAtTime(cut, o.t + 0.25);
    fl.connect(g); g.connect(o.to);
    if (o.send) { const s = c.createGain(); s.gain.value = o.send; g.connect(s); s.connect(verbIn); }
    if (o.echo) { const s = c.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(delayIn); }
    const end = o.t + (o.a ?? 0.008) + o.hold + o.rel + 0.05;
    for (const dt of o.detune ?? [0]) {
      const osc = c.createOscillator(); osc.type = o.type; osc.frequency.value = o.f; osc.detune.value = dt;
      if (o.vib) { const l = c.createOscillator(); l.frequency.value = 5.2; const lg = c.createGain(); lg.gain.setValueAtTime(0, o.t); lg.gain.linearRampToValueAtTime(9, o.t + 0.3); l.connect(lg); lg.connect(osc.detune); l.start(o.t); l.stop(end); }
      osc.connect(fl); osc.start(o.t); osc.stop(end);
    }
  }
  function kick(t: number) {
    const c = ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
    duck.gain.setValueAtTime(0.35, t); duck.gain.linearRampToValueAtTime(1, t + STEP * 3);
  }
  function hit(t: number, type: BiquadFilterType, f: number, vol: number, len: number, send = 0) {
    const c = ctx!; const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(bus); if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verbIn); }
    s.start(t); s.stop(t + len + 0.02);
  }
  function snare(t: number) { hit(t, "bandpass", 1800, 0.5, 0.22, 0.5); voice({ type: "triangle", f: 190, t, hold: 0.02, rel: 0.1, vol: 0.25, to: bus }); }

  function schedule() {
    const c = ctx!;
    while (nextT < c.currentTime + 0.15) {
      const t = nextT, s = step % 128, bar = Math.floor(s / 16), b16 = s % 16;
      const intro = step < 64; // first 4 bars: pads, arp and hats only
      const ch = CHORDS[bar];
      if (!intro && b16 % 4 === 0) kick(t);
      if (!intro && (b16 === 4 || b16 === 12)) snare(t);
      if (b16 % 2 === 1) hit(t, "highpass", 8000, 0.08, 0.04);
      if (!intro && b16 % 4 === 2) hit(t, "highpass", 6500, 0.1, 0.16);  // open hat on the off-beat
      // bass: rolling eighths with an octave lift
      if (!intro && b16 % 2 === 0) voice({ type: "sawtooth", f: hz(ROOTS[bar] + (b16 % 8 === 6 ? 12 : 0)), t, hold: STEP * 0.9, rel: 0.08, vol: 0.2, cut: 520, cutEnv: 3, to: duck });
      // supersaw pad, held for the bar
      if (b16 === 0) ch.forEach((m) => voice({ type: "sawtooth", f: hz(m), t, a: 0.25, hold: STEP * 14, rel: 0.6, vol: 0.022, cut: 1800, detune: [-14, 0, 13], to: duck, send: 0.6 }));
      // plucked arp: up the chord across two octaves
      const arp = [0, 1, 2, 1][b16 % 4], oct = b16 >= 8 ? 24 : 12;
      voice({ type: "square", f: hz(ch[arp] + oct), t, hold: 0.01, rel: STEP * 0.9, vol: 0.035, cut: 1400, cutEnv: 4, to: bus, send: 0.35, echo: 0.25 });
      // the hook, from bar 5 on
      if (!intro) for (const [st, m, l] of HOOK) if (st === s) {
        voice({ type: "sawtooth", f: hz(m), t, a: 0.02, hold: STEP * l * 0.8, rel: 0.18, vol: 0.075, cut: 2600, cutEnv: 2.2, detune: [-6, 6], to: bus, send: 0.45, echo: 0.6, vib: l >= 4 });
      }
      step++; nextT += STEP;
    }
  }

  return {
    start() {
      const c = ensure(); c.resume?.();
      if (playing) return; playing = true;
      step = 0; nextT = c.currentTime + 0.1;
      out.gain.cancelScheduledValues(c.currentTime); out.gain.setTargetAtTime(on ? 0.55 : 0, c.currentTime, 0.6);
      timer = window.setInterval(schedule, 25);
    },
    stop() { playing = false; window.clearInterval(timer); if (ctx) out.gain.setTargetAtTime(0, ctx.currentTime, 0.2); },
    setOn(v) { on = v; if (ctx) out.gain.setTargetAtTime(v && playing ? 0.55 : 0, ctx.currentTime, 0.25); },
    sting(kind) {
      if (!on) return;
      const c = ensure(); c.resume?.(); const t = c.currentTime + 0.02;
      const g = c.createGain(); g.gain.value = 1; g.connect(c.destination);
      const notes = kind === "gate" ? [76, 79, 84] : kind === "all" ? [72, 76, 79, 84, 88] : [60, 64, 67, 72, 76, 79, 84, 88];
      const gap = kind === "finish" ? 0.085 : 0.065;
      notes.forEach((m, i) => voice({ type: "triangle", f: hz(m), t: t + i * gap, hold: 0.04, rel: 0.35, vol: 0.12, cut: 9000, to: g, send: 0.4 }));
      if (kind !== "gate") [0, 4, 7, 12].forEach((iv) => voice({ type: "sawtooth", f: hz(60 + iv), t: t + notes.length * gap, a: 0.03, hold: 0.6, rel: 1.2, vol: 0.05, cut: 3000, detune: [-10, 10], to: g, send: 0.7 }));
    },
    dispose() { this.stop(); window.setTimeout(() => { ctx?.close().catch(() => {}); ctx = null; }, 400); },
  };
}
