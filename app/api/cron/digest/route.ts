import { NextRequest, NextResponse } from "next/server";

// Vercel Cron handler. Runs weekly to send email digests.
// Auth: Vercel Cron sends an "Authorization: Bearer <CRON_SECRET>" header.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processDigests } = await import("../../../../lib/notifications/digest.js");
  const result = await processDigests();

  return NextResponse.json(result);
}
