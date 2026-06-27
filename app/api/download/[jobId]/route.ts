import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { jobs } from "../../start/route";

// This route runs on the Node.js runtime (needs fs + streams)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

// Pick a sensible Content-Type from the file extension
function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs[jobId];

  // Figure out which file to serve. Prefer the filename recorded on the job,
  // but fall back to scanning the downloads folder by jobId prefix so a serving
  // works even if the in-memory record was lost.
  let filename = job?.filename;
  if (!filename && fs.existsSync(DOWNLOAD_DIR)) {
    const match = fs.readdirSync(DOWNLOAD_DIR).find(f => f.startsWith(jobId));
    if (match) filename = match;
  }

  if (!filename) {
    return NextResponse.json(
      { error: "File not found or not ready yet." },
      { status: 404 }
    );
  }

  const filePath = path.join(DOWNLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File no longer available." }, { status: 404 });
  }

  const ext = path.extname(filename);
  // Strip the "<jobId>_" prefix so the user gets a clean filename
  const downloadName = filename.replace(`${jobId}_`, "") || `download${ext}`;

  const stat = fs.statSync(filePath);
  const nodeStream = fs.createReadStream(filePath);
  // Convert the Node stream to a Web ReadableStream so we can stream the
  // response without loading the whole file into memory (mp4 files are large).
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  // RFC 5987 encoding so non-ASCII titles (e.g. Khmer) work in the filename
  const asciiName = downloadName.replace(/[^\x20-\x7E]/g, "_");
  const utf8Name = encodeURIComponent(downloadName);

  return new Response(webStream, {
    headers: {
      "Content-Type": contentTypeFor(ext),
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "no-store",
    },
  });
}
