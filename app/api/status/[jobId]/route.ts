import { NextRequest, NextResponse } from "next/server";
import { jobs } from "../../start/route";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs[jobId];
  if (!job) return NextResponse.json({ status: "unknown", progress: 0 });
  return NextResponse.json(job);
}
