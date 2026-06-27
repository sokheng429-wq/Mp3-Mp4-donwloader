"use client";

import { useState, useRef } from "react";

type Format = "mp3" | "mp4";
type Status = "idle" | "downloading" | "done" | "error";

interface JobStatus {
  status: Status;
  progress: number;
  title?: string;
  error?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp3");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${id}`);
        const data: JobStatus = await res.json();
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          stopPolling();
        }
      } catch {
        // ignore transient fetch errors during polling
      }
    }, 800);
  };

  const startDownload = async () => {
    if (!url.trim()) return;

    stopPolling();
    setJob({ status: "downloading", progress: 0 });
    setJobId(null);

    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format }),
      });
      const data = await res.json();
      setJobId(data.job_id);
      startPolling(data.job_id);
    } catch {
      setJob({ status: "error", progress: 0, error: "Could not connect to server." });
    }
  };

  const saveFile = () => {
    if (jobId) window.location.href = `/api/download/${jobId}`;
  };

  const isDownloading = job?.status === "downloading";
  const isDone = job?.status === "done";
  const isError = job?.status === "error";

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
          ទាញយក MP3 និង MP4 <br />ដោយគ្មានការផ្សាយពាណិជ្ជកម្ម
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
          onKeyDown={e => e.key === "Enter" && !isDownloading && startDownload()}
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
        {job !== null && (
          <div style={statusBoxStyle}>
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

            <div style={{
              height: "4px",
              background: "var(--border)",
              borderRadius: "99px",
              overflow: "hidden",
              marginBottom: (isError || isDone) ? "14px" : "0",
            }}>
              <div style={{
                height: "100%",
                width: `${job.progress}%`,
                background: isDone ? "var(--green)" : "var(--accent)",
                borderRadius: "99px",
                transition: "width 0.4s ease",
              }} />
            </div>

            {isError && (
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--red)" }}>
                {job.error}
              </p>
            )}

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
          <a href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
            target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            1000+ sites
          </a>.
          <br />
          Files saved to the <code style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)", fontSize: "11px" }}>downloads/</code> folder.
        </p>
      </div>
    </main>
  );
}

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
};