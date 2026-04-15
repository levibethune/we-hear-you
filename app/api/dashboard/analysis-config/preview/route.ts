import { NextRequest, NextResponse } from "next/server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../../lib/analyze.js");
  return analyzeTranscription;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, transcription, system_prompt, output_schema, model } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!transcription) {
    return NextResponse.json({ error: "transcription required" }, { status: 400 });
  }

  const capped = transcription.slice(0, 10000);

  const allowedModels = ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4"];
  const safeModel = allowedModels.includes(model) ? model : "claude-sonnet-4-6";

  try {
    const analyzeTranscription = await getAnalyzer();
    const result = await analyzeTranscription(capped, null, {
      system_prompt,
      output_schema,
      model: safeModel,
    });

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    console.error("Preview failed:", message);
    return NextResponse.json({ error: "Analysis preview failed. Please try again." }, { status: 500 });
  }
}
