import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../../lib/analyze.js");
  return analyzeTranscription;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id } = body;

  // Requires admin role
  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  const { data: config } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .single();

  if (!config) {
    return NextResponse.json({ error: "No analysis config found" }, { status: 404 });
  }

  // Cap at 200 responses to avoid timeout/cost explosion
  const { data: responses } = await db
    .from("responses")
    .select("id, transcription, person_id")
    .eq("tenant_id", tenant_id)
    .limit(200);

  if (!responses || responses.length === 0) {
    return NextResponse.json({ reanalyzed: 0 });
  }

  const analyzeTranscription = await getAnalyzer();
  let processed = 0;

  for (let i = 0; i < responses.length; i += 5) {
    const batch = responses.slice(i, i + 5);
    await Promise.all(
      batch.map(async (response) => {
        try {
          const analysis = await analyzeTranscription(
            response.transcription,
            null,
            config
          ) as Record<string, unknown>;

          await db
            .from("responses")
            .update({
              raw_analysis: analysis,
              themes: (analysis.themes as string[]) ?? [],
              mood: analysis.mood as string,
              sentiment: analysis.sentiment as string,
            })
            .eq("id", response.id);

          if (analysis.persona) {
            await db
              .from("people")
              .update({
                persona: analysis.persona as string,
                latest_mood: analysis.mood as string,
                latest_sentiment: analysis.sentiment as string,
              })
              .eq("id", response.person_id);
          }

          processed++;
        } catch (err) {
          console.error(`Re-analysis failed for response ${response.id}:`, err);
        }
      })
    );
  }

  return NextResponse.json({ reanalyzed: processed, total: responses.length });
}
