"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Pause, Play, Volume2, VolumeX } from "lucide-react";

const songUrl = "https://suno.com/song/d74c521e-25c1-491a-bca2-f2cb29cc17b8";
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
});
const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const fill = (percent: number) => ({ "--am-fill": `${percent}%` } as CSSProperties);

export default function AmbientControls() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const panelId = useId();
  const [now, setNow] = useState<Date | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    const audio = audioRef.current;
    return () => { window.clearInterval(interval); audio?.pause(); };
  }, []);

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    if (error) audio.load();
    setError(false);
    setLoading(true);
    try { await audio.play(); }
    catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(true); setExpanded(true);
      }
    } finally { setLoading(false); }
  }

  function syncDuration() {
    const value = audioRef.current?.duration;
    setDuration(value && Number.isFinite(value) ? value : 0);
  }
  function seek(value: number) {
    if (!audioRef.current || !duration) return;
    audioRef.current.currentTime = value;
    setElapsed(value);
  }
  function changeVolume(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    audio.muted = false;
  }
  const progress = duration ? Math.min(100, elapsed / duration * 100) : 0;

  return (
    <aside className={`am-dock${playing && !loading ? " am-playing" : ""}${expanded ? " am-expanded" : ""}`} aria-label="Original soundtrack and India clock">
      <audio ref={audioRef} preload="none" src="/audio/chasing-the-horizon.mp3"
        onPlay={() => { setPlaying(true); setError(false); }}
        onPlaying={() => setLoading(false)} onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)}
        onPause={() => { setPlaying(false); setLoading(false); }}
        onEnded={() => { setPlaying(false); setLoading(false); }}
        onLoadedMetadata={syncDuration} onDurationChange={syncDuration}
        onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
        onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }}
        onError={() => { setError(true); setPlaying(false); setLoading(false); setExpanded(true); }} />
      <div className="am-player" id={panelId} hidden={!expanded}>
        <div className="am-sleeve-row">
          <div className="am-sleeve" aria-hidden="true"><span>SP</span><small>SIDE A · 01</small><i /></div>
          <div className="am-album"><span>THE ORIGINAL SOUNDTRACK</span><strong>Chasing the Horizon</strong><p>A little ambition, on repeat.</p><a href={songUrl} target="_blank" rel="noopener noreferrer">Made with Suno <ArrowUpRight size={12} /></a></div>
        </div>
        <div className="am-seek">
          <label className="am-sr-only" htmlFor={`${panelId}-seek`}>Track position</label>
          <input id={`${panelId}-seek`} className="am-range" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(elapsed, duration || 0)} disabled={!duration}
            aria-valuetext={`${timestamp(elapsed)} of ${duration ? timestamp(duration) : "unknown duration"}`} style={fill(progress)} onChange={event => seek(Number(event.target.value))} />
          <div className="am-timestamps"><span>{timestamp(elapsed)}</span><span>{duration ? timestamp(duration) : "—:—"}</span></div>
        </div>
        <div className="am-player-bottom">
          <span className="am-side-label"><i /> {loading ? "BUFFERING" : playing ? "NOW SPINNING" : "READY WHEN YOU ARE"}</span>
          <div className="am-volume">
            <button type="button" aria-label={muted ? "Unmute soundtrack" : "Mute soundtrack"} onClick={() => { if (audioRef.current) audioRef.current.muted = !audioRef.current.muted; }}>{muted || !volume ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
            <label className="am-sr-only" htmlFor={`${panelId}-volume`}>Volume</label>
            <input id={`${panelId}-volume`} className="am-range" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`} style={fill((muted ? 0 : volume) * 100)} onChange={event => changeVolume(Number(event.target.value))} />
          </div>
        </div>
        {error && <p className="am-error" role="status">Couldn’t play this track. <a href={songUrl} target="_blank" rel="noopener noreferrer">Listen on Suno ↗</a></p>}
      </div>
      <div className="am-bar">
        <button className="am-play" type="button" onClick={toggleMusic} aria-label={`${playing ? "Pause" : "Play"} Chasing the Horizon`} aria-pressed={playing}>
          <span className="am-vinyl" aria-hidden="true"><i /></span>
          <span className="am-play-icon">{playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</span>
        </button>
        <button className="am-track" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded ? "Collapse" : "Expand"} soundtrack controls`}>
          <span><strong>Chasing the Horizon</strong><small>{loading ? "Loading track…" : playing ? "Now spinning · Suno" : "Original soundtrack · Suno"}</small></span>
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <div className="am-clock" aria-label="Current date and time in India">
          <span className="am-clock-meta">{now ? dateFormat.format(now) : "— —"}<span>IST</span></span>
          <time dateTime={now?.toISOString()}>{now ? timeFormat.format(now) : "--:--:--"}</time>
        </div>
      </div>
      <div className="am-progress-rail" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
    </aside>
  );
}
