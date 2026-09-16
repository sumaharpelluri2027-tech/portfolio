"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";

const songUrl = "https://suno.com/song/d74c521e-25c1-491a-bca2-f2cb29cc17b8";
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
});

export default function AmbientControls() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const panelId = useId();
  const [now, setNow] = useState<Date | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    setError(false);
    setLoading(true);
    try { await audio.play(); }
    catch { setError(true); setExpanded(true); }
    finally { setLoading(false); }
  }

  return (
    <aside className={`am-dock${playing ? " am-playing" : ""}`} aria-label="Live clock and original soundtrack">
      <div className="am-bar">
        <div className="am-clock" aria-label="Current date and time in India">
          <span className="am-clock-meta"><i />{now ? dateFormat.format(now) : "— —"}<span>IST</span></span>
          <time dateTime={now?.toISOString()}>{now ? timeFormat.format(now) : "--:--:--"}</time>
        </div>
        <button className="am-play" type="button" onClick={toggleMusic} disabled={loading}
          aria-label={`${playing ? "Pause" : "Play"} Chasing the Horizon`} aria-pressed={playing}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <button className="am-track" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={panelId}>
          <span><strong>CHASING THE HORIZON</strong><small>{loading ? "Loading track…" : playing ? "Playing · made with Suno" : "Original soundtrack · Suno"}</small></span>
          <span className="am-equalizer" aria-hidden="true"><i /><i /><i /></span>
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      <div className="am-player" id={panelId} hidden={!expanded}>
        <p>Your soundtrack for the journey.</p>
        <audio ref={audioRef} controls preload="none" src="/audio/chasing-the-horizon.mp3"
          aria-label="Chasing the Horizon original Suno soundtrack"
          onPlay={() => { setPlaying(true); setError(false); }} onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)} onError={() => { setError(true); setPlaying(false); setLoading(false); }} />
        {error && <p className="am-error" role="status">Playback unavailable. <a href={songUrl} target="_blank" rel="noopener noreferrer">Listen on Suno ↗</a></p>}
      </div>
    </aside>
  );
}
