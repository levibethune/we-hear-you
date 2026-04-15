import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, fields, personas } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  // Build context about what the tenant has configured
  const fieldDescriptions = (fields ?? [])
    .filter((f: { name: string }) => f.name)
    .map((f: { name: string; type: string; description: string }) =>
      `- ${f.name} (${f.type}): ${f.description}`
    )
    .join("\n");

  const personaDescriptions = (personas ?? [])
    .filter((p: { name: string }) => p.name)
    .map((p: { name: string; description: string; criteria: string }) =>
      `- ${p.name}: ${p.description} (criteria: ${p.criteria})`
    )
    .join("\n");

  // Fetch a few sample responses for context
  const db = getServerClient();
  const { data: samples } = await db
    .from("responses")
    .select("transcription")
    .eq("tenant_id", tenant_id)
    .limit(5);

  const sampleText = (samples ?? [])
    .map((s, i) => `Sample ${i + 1}: "${(s.transcription ?? "").slice(0, 200)}"`)
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are an expert at writing system prompts for AI analysis systems. Your job is to write a clear, effective system prompt that will guide an AI to analyze video transcription data.

The prompt should:
- Be concise and direct
- Focus on what the AI should analyze and how
- Reference the specific fields and personas configured
- NOT include any security language (that's handled separately)
- Sound professional but approachable

Return ONLY the prompt text, nothing else.`,
      messages: [{
        role: "user",
        content: `Write the best system prompt for an AI that analyzes video transcriptions with this configuration:

ANALYSIS FIELDS:
${fieldDescriptions || "No custom fields yet — use default themes, mood, sentiment."}

PERSONAS:
${personaDescriptions || "No personas defined yet."}

${sampleText ? `SAMPLE RESPONSES:\n${sampleText}` : "No sample responses yet."}

Write a system prompt that will produce the most useful, accurate analysis results given this setup.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ prompt: text.trim() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Suggestion failed";
    console.error("Suggest prompt failed:", msg); return NextResponse.json({ error: "Failed to generate suggestion. Please try again." }, { status: 500 });
  }
}
