/**
 * The narrator. Uses a recorded clip when there is one for a line (drop files in public/assets/voice/<key>.mp3
 * and list the key in RECORDED), otherwise the browser's own text-to-speech. Captions always show.
 */
import { A } from "./data";

export const RECORDED = new Set<string>([]);

let audio: HTMLAudioElement | null = null;
let muted = false;
let token = 0;
let run = 0;
const listeners = new Set<(line: string | null) => void>();
export function onCaption(f: (line: string | null) => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const caption = (l: string | null) => listeners.forEach((f) => f(l));

function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  const pref = [(v: SpeechSynthesisVoice) => v.lang === "en-IN" && /male|ravi|prabhat|rishi/i.test(v.name), (v: SpeechSynthesisVoice) => v.lang === "en-IN",
    (v: SpeechSynthesisVoice) => /Google UK English Male|Daniel|Arthur/i.test(v.name), (v: SpeechSynthesisVoice) => v.lang.startsWith("en-GB"), (v: SpeechSynthesisVoice) => v.lang.startsWith("en")];
  for (const p of pref) { const v = vs.find(p); if (v) return v; }
  return null;
}
if (typeof window !== "undefined") window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});

export function stop() { token++; run++; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } if (audio) { audio.pause(); audio = null; } caption(null); }
export function setMuted(v: boolean) { muted = v; if (v) { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } audio?.pause(); } }
export const isMuted = () => muted;

/** Say one line (with its caption). Resolves when it's done, or after a reading-time fallback. */
export function say(text: string, key?: string): Promise<void> {
  const my = ++token; caption(text);
  const readMs = Math.max(2200, text.split(/\s+/).length * 330);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; if (my === token) caption(null); resolve(); };
    const fallback = window.setTimeout(finish, readMs + 1500);
    const t0 = Date.now();
    // a line that 'ends' far too early means speech failed silently: still give people time to read it
    const end = () => { window.clearTimeout(fallback); window.setTimeout(finish, Math.max(250, readMs * 0.6 - (Date.now() - t0))); };
    if (muted) { window.clearTimeout(fallback); window.setTimeout(finish, readMs); return; }
    if (key && RECORDED.has(key)) {
      audio = new Audio(A(`voice/${key}.mp3`)); audio.onended = end; audio.onerror = () => window.setTimeout(finish, readMs);
      audio.play().catch(() => window.setTimeout(finish, readMs)); return;
    }
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") { window.clearTimeout(fallback); window.setTimeout(finish, readMs); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text); const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } u.rate = 1.02; u.pitch = 1;
      u.onend = end; u.onerror = end;
      synth.speak(u);
    } catch { window.setTimeout(finish, readMs); }
  });
}

/** Say several lines in order; stops early if stop() is called or another sequence starts. */
export async function sayAll(lines: { text: string; key?: string }[], onLine?: (i: number) => void) {
  const my = ++run;
  for (let i = 0; i < lines.length; i++) {
    if (run !== my) return false;
    onLine?.(i); await say(lines[i].text, lines[i].key);
  }
  return run === my;
}
