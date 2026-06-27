"use client";

import { useState, useEffect, useRef } from "react";

type Format = "mp3" | "mp4";
type Status = "idle" | "downloading" | "done" | "error";

interface JobStatus {
  status: Status;
  progress: number;
  title?: string;
  error?: string;
  filename?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp3");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll job status
  useEffect(() => {
    if (!jobId || !job) return;
    if (job.status === "done" || job.status === "error") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/status/${jobId}`);
      const data: JobStatus = await res.json();
      setJob(data);
    }, 800);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, job?.status]);

  const startDownload = async () => {
    if (!url.trim()) return;
    setJob({ status: "downloading", progress: 0 });
    const res = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), format }),
    });
    const data = await res.json();
    setJobId(data.job_id);
  };

  const saveFile = () => {
    if (jobId) window.location.href = `/api/download/${jobId}`;
  };

  const isDownloading = job?.status === "downloading";
  const isDone = job?.status === "done";
  const isError = job?.status === "error";
  const showStatus = job !== null;

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>

        {/* Wordmark */}
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "11px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: "28px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span style={{
            display: "inline-block",
            width: "8px", height: "8px",
            background: "var(--accent)",
            borderRadius: "50%",
            boxShadow: "0 0 8px var(--accent)",
          }} />
          Loader
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: "32px",
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          marginBottom: "6px",
        }}>
          Download<br />without the noise.
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", fontWeight: 300, marginBottom: "36px" }}>
          Paste a link. Pick a format. Done.
        </p>

        {/* URL Input */}
        <label style={labelStyle}>Video or Audio URL</label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && startDownload()}
          placeholder="https://youtube.com/watch?v=..."
          style={inputStyle}
        />

        {/* Format Toggle */}
        <label style={labelStyle}>Format</label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
          {(["mp3", "mp4"] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                ...fmtBtnStyle,
                borderColor: format === f ? "var(--accent)" : "var(--border)",
                background: format === f ? "var(--accent-glow)" : "var(--surface)",
                color: format === f ? "var(--text)" : "var(--muted)",
              }}
            >
              <span style={{ fontSize: "16px" }}>{f === "mp3" ? "🎵" : "🎬"}</span>
              {f === "mp3" ? "MP3 (Audio)" : "MP4 (Video)"}
            </button>
          ))}
        </div>

        {/* Download Button */}
        <button
          onClick={startDownload}
          disabled={isDownloading}
          style={{
            ...dlBtnStyle,
            opacity: isDownloading ? 0.45 : 1,
            cursor: isDownloading ? "not-allowed" : "pointer",
          }}
        >
          {isDownloading ? "Downloading…" : "Start Download"}
        </button>

        {/* Status Box */}
        {showStatus && (
          <div style={statusBoxStyle}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{
                display: "inline-block",
                width: "8px", height: "8px",
                borderRadius: "50%",
                flexShrink: 0,
                background: isDone ? "var(--green)" : isError ? "var(--red)" : "var(--accent)",
              }} className={isDownloading ? "pulse" : ""} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--muted)" }}>
                {isDone && <><strong style={{ color: "var(--text)" }}>Done!</strong> {job.title}</>}
                {isDownloading && <><strong style={{ color: "var(--text)" }}>Downloading…</strong> {job.progress}%</>}
                {isError && <strong style={{ color: "var(--text)" }}>Something went wrong</strong>}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              height: "4px",
              background: "var(--border)",
              borderRadius: "99px",
              overflow: "hidden",
              marginBottom: isError ? "14px" : isDone ? "14px" : "0",
            }}>
              <div style={{
                height: "100%",
                width: `${job.progress}%`,
                background: isDone ? "var(--green)" : "var(--accent)",
                borderRadius: "99px",
                transition: "width 0.4s ease",
              }} />
            </div>

            {/* Error message */}
            {isError && (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--red)" }}>
                {job.error}
              </p>
            )}

            {/* Save button */}
            {isDone && (
              <button onClick={saveFile} style={saveBtnStyle}>
                ⬇ Save File
              </button>
            )}
          </div>
        )}

        {/* Divider + Tip */}
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "32px 0 20px" }} />
        <p style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 300, lineHeight: 1.7 }}>
          Works with YouTube, Facebook, TikTok, Twitter/X, and{" "}
          <a
            href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)" }}
          >
            1000+ sites
          </a>.
          <br />
          Files are saved to the <code style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)", fontSize: "11px" }}>downloads/</code> folder on your computer.
        </p>
      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'DM Mono', monospace",
  fontSize: "11px",
  color: "var(--muted)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  color: "var(--text)",
  fontFamily: "'DM Mono', monospace",
  fontSize: "13px",
  padding: "14px 16px",
  outline: "none",
  marginBottom: "20px",
};

const fmtBtnStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid",
  borderRadius: "10px",
  fontFamily: "'DM Mono', monospace",
  fontSize: "13px",
  padding: "12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  transition: "all 0.18s",
};

const dlBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--accent)",
  border: "none",
  borderRadius: "10px",
  color: "#fff",
  fontFamily: "'Sora', sans-serif",
  fontWeight: 600,
  fontSize: "15px",
  padding: "15px",
  transition: "opacity 0.18s",
};

const statusBoxStyle: React.CSSProperties = {
  marginTop: "24px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "18px",
};

const saveBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--green)",
  border: "none",
  borderRadius: "8px",
  color: "#0d0f14",
  fontFamily: "'Sora', sans-serif",
  fontWeight: 600,
  fontSize: "14px",
  padding: "12px",
  cursor: "pointer",
  marginTop: "14px",
};
