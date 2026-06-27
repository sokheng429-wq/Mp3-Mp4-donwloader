import { NextRequest, NextResponse } from "next/server";
import { jobs } from "../../start/route";
import path from "path";
import fs from "fs";

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs[jobId];

  if (!job?.filename) {
    return new NextResponse("File not found", { status: 404 });
  }

  const filePath = path.join(DOWNLOAD_DIR, job.filename);
  if (!fs.existsSync(filePath)) {
    return new NextResponse("File not found on disk", { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  // Strip the jobId prefix to get the real filename
  const cleanName = job.filename.replace(`${jobId}_`, "");
  const ext = path.extname(cleanName).toLowerCase();
  const mimeType = ext === ".mp3" ? "audio/mpeg" : "video/mp4";

  // HTTP headers only allow ASCII (0-255).
  // Titles with Khmer, Japanese, emoji etc. must use RFC 5987 encoding.
  // - filename="download.mp4"        → ASCII fallback for old browsers
  // - filename*=UTF-8''<encoded>     → full unicode name for modern browsers
  const asciiFallback = `download${ext}`;
  const encodedName = encodeURIComponent(cleanName);
  const contentDisposition =
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": contentDisposition,
      "Content-Length": buffer.length.toString(),
    },
  });
}
