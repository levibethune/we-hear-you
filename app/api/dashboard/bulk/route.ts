import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../lib/analyze.js");
  return analyzeTranscription;
}

type BulkAction = "hide" | "unhide" | "delete" | "move" | "reanalyze";
type BulkTarget = "people" | "responses";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, action, target, ids, move_to_tenant_id } = body as {
    tenant_id: string;
    action: BulkAction;
    target: BulkTarget;
    ids: string[];
    move_to_tenant_id?: string;
  };

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "No items selected" }, { status: 400 });
  }

  // Cap bulk operations to prevent abuse
  const maxIds = action === "reanalyze" ? 25 : 100;
  if (ids.length > maxIds) {
    return NextResponse.json({ error: `Maximum ${maxIds} items per bulk action` }, { status: 400 });
  }

  if (!["hide", "unhide", "delete", "move", "reanalyze"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!["people", "responses"].includes(target)) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  const db = getServerClient();

  if (action === "hide") {
    const { error } = await db
      .from(target)
      .update({ is_hidden: true })
      .in("id", ids)
      .eq("tenant_id", tenant_id);

    if (error) return NextResponse.json({ error: "Failed to hide items" }, { status: 500 });

    // If hiding people, also hide their responses
    if (target === "people") {
      await db
        .from("responses")
        .update({ is_hidden: true })
        .in("person_id", ids)
        .eq("tenant_id", tenant_id);
    }

    return NextResponse.json({ success: true, action: "hidden", count: ids.length });
  }

  if (action === "unhide") {
    const { error } = await db
      .from(target)
      .update({ is_hidden: false })
      .in("id", ids)
      .eq("tenant_id", tenant_id);

    if (error) return NextResponse.json({ error: "Failed to unhide items" }, { status: 500 });

    if (target === "people") {
      await db
        .from("responses")
        .update({ is_hidden: false })
        .in("person_id", ids)
        .eq("tenant_id", tenant_id);
    }

    return NextResponse.json({ success: true, action: "unhidden", count: ids.length });
  }

  if (action === "delete") {
    // If deleting people, delete their responses first
    if (target === "people") {
      await db
        .from("responses")
        .delete()
        .in("person_id", ids)
        .eq("tenant_id", tenant_id);
    }

    const { error } = await db
      .from(target)
      .delete()
      .in("id", ids)
      .eq("tenant_id", tenant_id);

    if (error) return NextResponse.json({ error: "Failed to delete items" }, { status: 500 });

    return NextResponse.json({ success: true, action: "deleted", count: ids.length });
  }

  if (action === "move") {
    if (!move_to_tenant_id) {
      return NextResponse.json({ error: "Destination organization required" }, { status: 400 });
    }

    // Verify user has access to destination tenant
    const destAuth = await verifyTenantAccess(request, move_to_tenant_id, "admin");
    if (!destAuth) {
      return NextResponse.json({ error: "You don\u2019t have admin access to the destination organization" }, { status: 403 });
    }

    if (target === "people") {
      // Move people and their responses
      const { error: peopleErr } = await db
        .from("people")
        .update({ tenant_id: move_to_tenant_id })
        .in("id", ids)
        .eq("tenant_id", tenant_id);

      if (peopleErr) return NextResponse.json({ error: "Failed to move people" }, { status: 500 });

      await db
        .from("responses")
        .update({ tenant_id: move_to_tenant_id })
        .in("person_id", ids)
        .eq("tenant_id", tenant_id);
    } else {
      // Move responses only
      const { error: respErr } = await db
        .from("responses")
        .update({ tenant_id: move_to_tenant_id })
        .in("id", ids)
        .eq("tenant_id", tenant_id);

      if (respErr) return NextResponse.json({ error: "Failed to move responses" }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "moved", count: ids.length });
  }

  if (action === "reanalyze") {
    const analyzeTranscription = await getAnalyzer();

    // Get analysis config
    const { data: config } = await db
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    let responseIds: string[] = [];

    if (target === "responses") {
      responseIds = ids;
    } else {
      // For people, get all their response IDs
      const { data: responses } = await db
        .from("responses")
        .select("id")
        .in("person_id", ids)
        .eq("tenant_id", tenant_id);
      responseIds = (responses ?? []).map((r) => r.id);
    }

    // Fetch responses and re-analyze in batches of 3
    let processed = 0;
    for (let i = 0; i < responseIds.length; i += 3) {
      const batch = responseIds.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async (respId) => {
          try {
            const { data: resp } = await db
              .from("responses")
              .select("id, transcription, person_id")
              .eq("id", respId)
              .eq("tenant_id", tenant_id)
              .single();

            if (!resp?.transcription) return;

            const analysis = await analyzeTranscription(resp.transcription, null, config) as Record<string, unknown>;

            await db
              .from("responses")
              .update({
                raw_analysis: analysis,
                themes: (analysis.themes as string[]) ?? [],
                mood: analysis.mood as string,
                sentiment: analysis.sentiment as string,
              })
              .eq("id", resp.id)
              .eq("tenant_id", tenant_id);

            if (analysis.persona || analysis.mood || analysis.sentiment) {
              await db
                .from("people")
                .update({
                  latest_mood: analysis.mood as string,
                  latest_sentiment: analysis.sentiment as string,
                  persona: (analysis.persona as string) || undefined,
                })
                .eq("id", resp.person_id)
                .eq("tenant_id", tenant_id);
            }

            processed++;
          } catch (err) {
            console.error(`Re-analysis failed for ${respId}:`, err instanceof Error ? err.message : err);
          }
        })
      );
    }

    return NextResponse.json({ success: true, action: "reanalyzed", count: processed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
