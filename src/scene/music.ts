/**
 * A driving synthwave loop for the test track, made live with WebAudio (no file to download),
 * plus short stingers for the moments that matter.
 */
export interface Music { start(): void; stop(): void; setOn(on: boolean): void; sting(kind: "gate" | "all" | "finish"): void; dispose(): void }

const BPM = 118;
const STEP = 60 / BPM / 4; // a 16th note
// A minor → F → C → G, one bar each
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const BASS = [45, 41, 48, 43];
// an eight-bar hook over the progression, as [step, midi, length in 16ths]
const LEAD: [number, number, number][] = [
  [0, 76, 3], [4, 74, 2], [6, 72, 2], [8, 76, 4], [14, 79, 2],
  [16, 77, 3], [20, 76, 2], [22, 74, 2], [24, 72, 6],
  [32, 72, 3], [36, 74, 2], [38, 76, 2], [40, 79, 4], [46, 81, 2],
  [48, 79, 3], [52, 76, 2], [54, 74, 2], [56, 71, 4], [60, 74, 4],
];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic(): Music {
  let ctx: AudioContext | null = null, master: GainNode | null = null, comp: DynamicsCompressorNode | null = null;
  let timer = 0, step = 0, nextT = 0, playing = false, on = true;
  let noise: AudioBuffer | null = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type: OscillatorType, f: number, t: number, len: number, vol: number, cutoff = 4000, dest?: AudioNode) {
    const c = ctx!; const o = c.createOscillator(); o.type = type; o.frequency.value = f;
    const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = cutoff;
    const g = c.createGain(); env(g, t, 0.01, vol, len);
    o.connect(fl); fl.connect(g); g.connect(dest ?? master!); o.start(t); o.stop(t + len + 0.05);
  }
  function kick(t: number) {
    const c = ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(g, t, 0.003, 0.9, 0.28); o.connect(g); g.connect(master!); o.start(t); o.stop(t + 0.32);
  }
  function hit(t: number, hp: number, vol: number, len: number) {
    const c = ctx!; const s = c.createBufferSource(); s.buffer = noise;
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = c.createGain(); env(g, t, 0.002, vol, len); s.connect(f); f.connect(g); g.connect(master!); s.start(t); s.stop(t + len + 0.02);
  }

  function schedule() {
    const c = ctx!;
    while (nextT < c.currentTime + 0.12) {
      const s = step % 64, bar = Math.floor(s / 16) % 4, inBar = s % 16, t = nextT;
      if (inBar % 4 === 0) kick(t);
      if (inBar === 4 || inBar === 12) hit(t, 1200, 0.35, 0.18);          // clap
      if (inBar % 2 === 1) hit(t, 7000, 0.12, 0.05);                      // hats
      // pulsing bass on 8ths, octave jump on the off-beat
      if (inBar % 2 === 0) tone("sawtooth", hz(BASS[bar] + (inBar % 4 === 2 ? 12 : 0)), t, STEP * 1.6, 0.22, 700);
      // shimmering arp on 16ths
      const ch = CHORDS[bar]; tone("square", hz(ch[inBar % 3] + 12 + (inBar >= 8 ? 12 : 0)), t, STEP * 0.8, 0.045, 2600);
      // pad at the top of each bar
      if (inBar === 0) ch.forEach((m) => tone("sawtooth", hz(m), t, STEP * 15, 0.035, 1400));
      // the hook, every other 8-bar phrase rests
      const phrase = Math.floor(step / 64) % 2;
      if (phrase === 0 || step >= 128) for (const [st, m, l] of LEAD) if (st === s) { tone("triangle", hz(m), t, STEP * l * 0.95, 0.11, 5000); tone("square", hz(m + 12), t, STEP * l * 0.6, 0.02, 3000); }
      step++; nextT += STEP;
    }
  }

  return {
    start() {
      const c = ensure(); c.resume?.();
      if (playing) return; playing = true;
      step = 0; nextT = c.currentTime + 0.08;
      master!.gain.cancelScheduledValues(c.currentTime); master!.gain.setTargetAtTime(on ? 0.5 : 0, c.currentTime, 0.4);
      timer = window.setInterval(schedule, 25);
    },
    stop() { playing = false; window.clearInterval(timer); if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); },
    setOn(v) { on = v; if (ctx && master) master.gain.setTargetAtTime(v && playing ? 0.5 : 0, ctx.currentTime, 0.2); },
    sting(kind) {
      if (!on) return;
      const c = ensure(); c.resume?.(); const t = c.currentTime + 0.02;
      const out = c.createGain(); out.gain.value = 0.9; out.connect(comp!);
      const notes = kind === "gate" ? [72, 76, 79, 84] : kind === "all" ? [67, 72, 76, 79, 84, 88] : [60, 64, 67, 72, 76, 79, 84, 88, 91];
      const gap = kind === "finish" ? 0.09 : 0.06;
      notes.forEach((m, i) => { tone("square", hz(m), t + i * gap, 0.35, 0.09, 6000, out); tone("triangle", hz(m + 12), t + i * gap, 0.4, 0.07, 8000, out); });
      if (kind !== "gate") { [0, 4, 7, 12].forEach((iv) => tone("sawtooth", hz(60 + iv), t + notes.length * gap, 1.6, 0.06, 3000, out)); hit(t + notes.length * gap, 3000, 0.25, 0.8); }
    },
    dispose() { this.stop(); window.setTimeout(() => { ctx?.close().catch(() => {}); ctx = null; }, 400); },
  };
}
