import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

export const jobs: Record<string, {
  status: "downloading" | "done" | "error";
  progress: number;
  title?: string;
  filename?: string;
  error?: string;
}> = {};

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// Windows → use local yt-dlp.exe, Linux/Mac → use system yt-dlp (installed via pip in Docker)
const YT_DLP =
  process.platform === "win32"
    ? path.join(process.cwd(), "yt-dlp.exe")
    : process.env.YT_DLP_PATH || "/usr/local/bin/yt-dlp";

// Windows needs an explicit ffmpeg path; on Linux it's in PATH via apk/apt
const FFMPEG_LOCATION =
  process.platform === "win32"
    ? "C:\\Users\\Ling Fu\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-124716-g054dffd133-win64-gpl\\bin"
    : ""; // empty = not passed; ffmpeg is on PATH in the Docker container

export async function POST(req: NextRequest) {
  const { url, format } = await req.json();
  const jobId = randomBytes(4).toString("hex");
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}_%(title)s.%(ext)s`);

  jobs[jobId] = { status: "downloading", progress: 0 };

  const speedArgs = [
    "--concurrent-fragments", "4",
    "--no-part",
    "--buffer-size", "16K",
  ];

  const commonArgs = [
    ...speedArgs,
    "--newline",
    "--progress",
    "--no-playlist",
    // Only pass --ffmpeg-location on Windows; on Linux ffmpeg is already in PATH
    ...(FFMPEG_LOCATION ? ["--ffmpeg-location", FFMPEG_LOCATION] : []),
    "-o", outputTemplate,
    url,
  ];

  const args =
    format === "mp3"
      ? ["-x", "--audio-format", "mp3", "--audio-quality", "192K", ...commonArgs]
      : [
          "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "--merge-output-format", "mp4",
          ...commonArgs,
        ];

  // Collect stderr lines so we can surface the real error message
  const stderrLines: string[] = [];

  const proc = spawn(YT_DLP, args, {
    // Ensure the system PATH is available (important on some Linux envs)
    env: { ...process.env, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
  });

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse download percentage: [download] 42.3% of ...
    const pct = trimmed.match(/\[download\]\s+([\d.]+)%/);
    if (pct) {
      jobs[jobId].progress = Math.min(99, Math.floor(parseFloat(pct[1])));
    }

    // Parse destination filename to extract title
    const destMatch = trimmed.match(/Destination: .+[/\\][a-f0-9]{8}_(.+)\.\w+$/);
    if (destMatch) jobs[jobId].title = destMatch[1];
  };

  proc.stdout.on("data", (chunk: Buffer) => {
    chunk.toString().split("\n").forEach(handleLine);
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n");
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) stderrLines.push(trimmed);
      handleLine(line); // yt-dlp also writes progress to stderr sometimes
    });
  });

  proc.on("close", (code: number) => {
    if (code === 0) {
      const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(jobId));
      if (files.length) {
        jobs[jobId].filename = files[0];
        const raw = files[0].replace(`${jobId}_`, "").replace(/\.[^.]+$/, "");
        if (!jobs[jobId].title) jobs[jobId].title = raw;
      }
      jobs[jobId].status = "done";
      jobs[jobId].progress = 100;
    } else {
      jobs[jobId].status = "error";
      // Surface the real yt-dlp error instead of a generic message
      const relevantError = stderrLines
        .filter(l => l.includes("ERROR") || l.includes("error") || l.includes("Warning"))
        .pop();
      jobs[jobId].error =
        relevantError ||
        stderrLines.slice(-3).join(" ") ||
        "Download failed. Check the URL and try again.";
    }
  });

  proc.on("error", (err) => {
    // Fires if yt-dlp binary is not found or not executable
    jobs[jobId].status = "error";
    jobs[jobId].error = `Failed to start yt-dlp: ${err.message}. Check that yt-dlp is installed in the Docker container.`;
  });

  return NextResponse.json({ job_id: jobId });
}