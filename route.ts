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

export async function POST(req: NextRequest) {
  const { url, format } = await req.json();
  const jobId = randomBytes(4).toString("hex");
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}_%(title)s.%(ext)s`);

  jobs[jobId] = { status: "downloading", progress: 0 };

  const args =
    format === "mp3"
      ? [
          "-x", "--audio-format", "mp3", "--audio-quality", "192K",
          "--newline", "-o", outputTemplate, url,
        ]
      : [
          "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "--merge-output-format", "mp4",
          "--newline", "-o", outputTemplate, url,
        ];

  const proc = spawn("yt-dlp", args);

  proc.stdout.on("data", (chunk: Buffer) => {
    const line = chunk.toString();

    // Parse progress: [download]  42.3% of ...
    const pct = line.match(/\[download\]\s+([\d.]+)%/);
    if (pct) jobs[jobId].progress = Math.floor(parseFloat(pct[1]));

    // Parse title from info line
    const titleMatch = line.match(/\[info\] (.+): Downloading/);
    if (titleMatch) jobs[jobId].title = titleMatch[1];
  });

  proc.on("close", (code: number) => {
    if (code === 0) {
      // Find the output file
      const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(jobId));
      if (files.length) {
        jobs[jobId].filename = files[0];
        // Extract clean title from filename (strip jobId prefix)
        const raw = files[0].replace(`${jobId}_`, "").replace(/\.[^.]+$/, "");
        if (!jobs[jobId].title) jobs[jobId].title = raw;
      }
      jobs[jobId].status = "done";
      jobs[jobId].progress = 100;
    } else {
      jobs[jobId].status = "error";
      jobs[jobId].error = "Download failed. Check the URL and try again.";
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const line = chunk.toString();
    if (jobs[jobId].status !== "done") {
      jobs[jobId].error = line.slice(0, 200);
    }
  });

  return NextResponse.json({ job_id: jobId });
}
