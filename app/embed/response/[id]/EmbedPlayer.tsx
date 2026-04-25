"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface EmbedOptions {
  showName: boolean;
  showPersona: boolean;
  showMood: boolean;
  showSentiment: boolean;
  showProgress: boolean;
  showTime: boolean;
  accentColor: string;
  visibleCustomFields?: string[];
}

interface CFEntry { key: string; label: string; value: string }

export function EmbedPlayer({
  videoUrl,
  personName,
  persona,
  mood,
  sentiment,
  customFields = {},
  options = { showName: true, showPersona: true, showMood: true, showSentiment: true, showProgress: true, showTime: true, accentColor: "#f4a07a" },
}: {
  videoUrl: string;
  personName: string | null;
  persona: string | null;
  mood: string | null;
  sentiment: string | null;
  customFields?: Record<string, string>;
  options?: EmbedOptions;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
      setStarted(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(v.duration);
    const onEnd = () => { setPlaying(false); setProgress(100); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnd);
    };
  }, []);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  }

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const sentimentColor = sentiment === "positive" ? "#7fbb9c" :
    sentiment === "negative" ? "#e06464" :
    sentiment === "mixed" ? "#e8c76a" : "#a0a0a0";

  const visibleCF: string[] = options.visibleCustomFields ?? Object.keys(customFields);
  const visibleCustomEntries: CFEntry[] = visibleCF
    .filter((k: string) => customFields[k])
    .map((k: string) => ({ key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()), value: customFields[k] }));

  const hasInfoToShow = (options.showName && personName) || (options.showPersona && persona) || (options.showMood && mood) || (options.showSentiment && sentiment) || visibleCustomEntries.length > 0;
  const hasBottomBar = options.showProgress || options.showTime || hasInfoToShow;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        preload="metadata"
        muted={muted}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Big play button overlay */}
      {(!started || (!playing && hovered)) && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: started ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.4)",
          transition: "opacity 0.2s",
        }}>
          {/* Name overlay before play */}
          {!started && options.showName && personName && (
            <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              {personName}
            </div>
          )}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          </div>
          {/* Persona + sentiment + custom fields before play */}
          {!started && (options.showPersona || options.showSentiment || visibleCustomEntries.length > 0) && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "center" }}>
              {options.showPersona && persona && (
                <span style={{ fontSize: 12, padding: "2px 12px", borderRadius: 12, background: `${options.accentColor}44`, color: options.accentColor }}>
                  {persona}
                </span>
              )}
              {options.showSentiment && sentiment && (
                <span style={{ fontSize: 12, padding: "2px 12px", borderRadius: 12, background: `${sentimentColor}33`, color: sentimentColor }}>
                  {sentiment}
                </span>
              )}
              {visibleCustomEntries.map((cf) => (
                <span key={cf.key} style={{ fontSize: 12, padding: "2px 12px", borderRadius: 12, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                  {cf.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar — on hover or when paused */}
      {hasBottomBar && (
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
            padding: "24px 16px 12px",
            opacity: hovered || !playing ? 1 : 0,
            transition: "opacity 0.3s",
            pointerEvents: hovered || !playing ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          {options.showProgress && (
            <div
              style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, cursor: "pointer", marginBottom: 8 }}
              onClick={seek}
            >
              <div style={{ width: `${progress}%`, height: "100%", background: "#fff", borderRadius: 2, transition: "width 0.1s linear" }} />
            </div>
          )}

          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={togglePlay} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
                {playing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="8,5 19,12 8,19" /></svg>
                )}
              </button>
              {options.showTime && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
              )}
              <button
                onClick={() => { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}
              >
                {muted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                )}
              </button>
            </div>

            {/* Person info on hover */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {options.showName && personName && (
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{personName}</span>
              )}
              {options.showPersona && persona && (
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: `${options.accentColor}44`, color: options.accentColor }}>{persona}</span>
              )}
              {options.showMood && mood && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{mood}</span>
              )}
              {options.showSentiment && sentiment && (
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: `${sentimentColor}33`, color: sentimentColor }}>{sentiment}</span>
              )}
              {visibleCustomEntries.map((cf) => (
                <span key={cf.key} style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                  {cf.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
