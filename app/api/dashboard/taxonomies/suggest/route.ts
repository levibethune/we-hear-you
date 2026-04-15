import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "../../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../../lib/dashboard-auth";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, existing_personas } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();

  // Fetch a sample of responses for analysis
  const { data: responses } = await db
    .from("responses")
    .select("transcription, themes, mood, sentiment, raw_analysis")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!responses || responses.length === 0) {
    return NextResponse.json({
      error: "No responses to analyze yet. Import or collect some responses first.",
    }, { status: 400 });
  }

  // Build a summary of the response data for Claude
  const responseSummaries = responses.map((r, i) => {
    const themes = (r.themes ?? []).join(", ");
    const transcript = (r.transcription ?? "").slice(0, 500);
    const persona = (r.raw_analysis as Record<string, unknown>)?.persona ?? "unclassified";
    return `Response ${i + 1} [mood: ${r.mood}, sentiment: ${r.sentiment}, themes: ${themes}, current persona: ${persona}]:\n${transcript}`;
  }).join("\n\n---\n\n");

  const existingContext = existing_personas && existing_personas.length > 0
    ? `\n\nCurrently defined personas:\n${existing_personas.map((p: { name: string; description: string; criteria: string }) =>
        `- ${p.name}: ${p.description} (criteria: ${p.criteria})`
      ).join("\n")}\n\nConsider whether these existing personas are sufficient or if gaps exist. You may suggest refinements to existing personas AND new ones.`
    : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `You are an expert qualitative researcher. Your job is to analyze a set of video response transcriptions and identify distinct persona types among the respondents.

A persona is a recurring pattern of attitudes, behaviors, and perspectives that groups multiple respondents together. Good personas are:
- Mutually exclusive (a person fits one, not many)
- Collectively exhaustive (most responses should fit somewhere)
- Actionable (knowing someone's persona should inform how you engage them)
- Named intuitively (the name alone should convey the vibe)

Return your suggestions as a JSON array using the analysis_result tool.${existingContext}`,
      tools: [{
        name: "analysis_result",
        description: "Submit the suggested personas based on response analysis.",
        input_schema: {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Short, intuitive persona name (e.g., 'Champion', 'Skeptic', 'Silent Majority')",
                  },
                  description: {
                    type: "string",
                    description: "One-sentence description of who this persona is",
                  },
                  criteria: {
                    type: "string",
                    description: "What signals in a transcription indicate this persona — specific language patterns, sentiments, themes",
                  },
                  confidence: {
                    type: "string",
                    enum: ["strong", "moderate", "emerging"],
                    description: "How clearly this persona shows up in the data. 'strong' = many clear examples, 'moderate' = several examples, 'emerging' = a few hints",
                  },
                  example_quotes: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-2 short quotes from the responses that exemplify this persona",
                  },
                },
                required: ["name", "description", "criteria", "confidence"],
              },
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              description: "Responses or patterns that don't fit neatly into any suggested persona — potential new categories to watch for",
            },
            summary: {
              type: "string",
              description: "Brief overall assessment of the response landscape and persona distribution",
            },
          },
          required: ["personas", "summary"],
        },
      }],
      tool_choice: { type: "tool", name: "analysis_result" },
      messages: [{
        role: "user",
        content: `Analyze these ${responses.length} responses and suggest personas that capture the distinct types of respondents:\n\n${responseSummaries}`,
      }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Suggestion failed";
    console.error("Persona suggestion failed:", msg); return NextResponse.json({ error: "Failed to generate suggestions. Please try again." }, { status: 500 });
  }
}
