import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  const auth = await verifyTenantAccess(request, tenantId, "viewer");
  if (!auth) return tenantId ? forbidden() : unauthorized();

  const { id } = await params;
  const db = getServerClient();

  const [personResult, responsesResult] = await Promise.all([
    db.from("people")
      .select("id, name, email, persona, latest_mood, latest_sentiment, response_count, created_at, updated_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single(),
    db.from("responses")
      .select("id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, created_at")
      .eq("person_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (personResult.error) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  return NextResponse.json({
    person: personResult.data,
    responses: responsesResult.data ?? [],
  });
}
