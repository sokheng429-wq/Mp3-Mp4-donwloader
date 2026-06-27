import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

// In-memory job store (persists while the Next.js process is running)
export const jobs: Record<string, {
  status: "downloading" | "done" | "error";
  progress: number;
  title?: string;
  filename?: string;
  error?: string;
}> = {};

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// Use local yt-dlp.exe on Windows, system yt-dlp on Mac/Linux
const YT_DLP = process.platform === "win32"
  ? path.join(process.cwd(), "yt-dlp.exe")
  : "yt-dlp";

// ffmpeg folder path — needed for MP3 audio conversion on Windows
const FFMPEG_DIR = process.platform === "win32"
  ? "C:\\Users\\Ling Fu\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-124716-g054dffd133-win64-gpl\\bin"
  : "";

// Cookies let yt-dlp authenticate as a real user — the only reliable way past
// YouTube's "confirm you're not a bot" block from a datacenter IP (Render).
//
// You can supply cookies any of THREE ways (first one found wins):
//   1. YT_DLP_COOKIES         → absolute path to a cookies.txt file
//                               (e.g. /etc/secrets/cookies.txt via a Render Secret File)
//   2. YT_DLP_COOKIES_CONTENT → paste the entire cookies.txt text as an env var;
//                               it gets written to a temp file at runtime
//   3. a cookies.txt committed in the project root (process.cwd())
function resolveCookiesFile(): string {
  // 1. Explicit path
  const p = process.env.YT_DLP_COOKIES;
  if (p && fs.existsSync(p)) return p;

  // 2. Raw content pasted into an env var
  const content = process.env.YT_DLP_COOKIES_CONTENT;
  if (content && content.trim()) {
    const tmp = path.join(DOWNLOAD_DIR, ".cookies.txt");
    try {
      fs.writeFileSync(tmp, content, { mode: 0o600 });
      return tmp;
    } catch {
      /* fall through */
    }
  }

  // 3. cookies.txt sitting in the project root
  const local = path.join(process.cwd(), "cookies.txt");
  if (fs.existsSync(local)) return local;

  return "";
}

const COOKIES_FILE = resolveCookiesFile();

// Optional outbound proxy (e.g. a residential proxy) — another way past the
// datacenter-IP block. Set YT_DLP_PROXY to something like http://user:pass@host:port
const PROXY = process.env.YT_DLP_PROXY || "";

// Args that improve the odds of getting past YouTube's bot detection on servers.
// Alternate player clients ("tv"/"android") often bypass the check without login.
const resilienceArgs = [
  "--extractor-args", "youtube:player_client=tv,android,web",
  "--retries", "5",
  "--fragment-retries", "5",
  ...(COOKIES_FILE ? ["--cookies", COOKIES_FILE] : []),
  ...(PROXY ? ["--proxy", PROXY] : []),
];

export async function POST(req: NextRequest) {
  const { url, format } = await req.json();
  const jobId = randomBytes(4).toString("hex");
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}_%(title)s.%(ext)s`);

  jobs[jobId] = { status: "downloading", progress: 0 };

  // Speed optimizations:
  // --concurrent-fragments 4  → download 4 chunks at once (biggest speed boost)
  // --no-part                 → skip .part temp files, write directly
  // --buffer-size 16K         → larger buffer = fewer I/O calls
  const speedArgs = [
    "--concurrent-fragments", "4",
    "--no-part",
    "--buffer-size", "16K",
  ];

  const commonArgs = [
    ...speedArgs,
    ...resilienceArgs,
    "--newline",
    "--progress",
    ...(FFMPEG_DIR ? ["--ffmpeg-location", FFMPEG_DIR] : []),
    "-o", outputTemplate,
    url,
  ];

  const args =
    format === "mp3"
      ? ["-x", "--audio-format", "mp3", "--audio-quality", "192K", ...commonArgs]
      : [
          // Prefer mp4/m4a, but fall back to ANY best video+audio (or a single
          // combined stream) so it never errors with "format not available".
          // ffmpeg then merges/remuxes the result into an .mp4 container.
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
          "--merge-output-format", "mp4",
          ...commonArgs,
        ];

  // Collect stderr so we can surface the REAL yt-dlp error to the user
  const stderrLines: string[] = [];

  const proc = spawn(YT_DLP, args, {
    env: { ...process.env, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
  });

  const handleLine = (line: string) => {
    // Progress line: [download]  42.3% of   5.23MiB at  1.20MiB/s ETA 00:03
    const pct = line.match(/\[download\]\s+([\d.]+)%/);
    if (pct) {
      jobs[jobId].progress = Math.min(99, Math.floor(parseFloat(pct[1])));
    }

    // Title from destination filename
    const destMatch = line.match(/Destination: .+[/\\][a-f0-9]{8}_(.+)\.\w+$/);
    if (destMatch) jobs[jobId].title = destMatch[1];
  };

  proc.stdout.on("data", (chunk: Buffer) => {
    chunk.toString().split("\n").forEach(handleLine);
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    chunk.toString().split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) stderrLines.push(trimmed);
      handleLine(line);
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
        .filter(l => l.includes("ERROR") || l.includes("error"))
        .pop();
      jobs[jobId].error =
        relevantError ||
        stderrLines.slice(-3).join(" ") ||
        "Download failed. Check the URL and try again.";
    }
  });

  // Fires if the yt-dlp binary cannot be spawned at all
  proc.on("error", (err) => {
    jobs[jobId].status = "error";
    jobs[jobId].error = `Failed to start yt-dlp: ${err.message}`;
  });

  return NextResponse.json({ job_id: jobId });
}