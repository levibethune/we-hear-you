import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../lib/analyze.js");
  return analyzeTranscription;
}

async function getEncryptor() {
  const { encrypt } = await import("../../../../lib/crypto/pii.js");
  return encrypt;
}

async function getSanitizer() {
  const { sanitizeTranscription } = await import("../../../../lib/middleware/sanitize.js");
  return sanitizeTranscription;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, url } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL — must be a real videoask.com domain
  let shareId: string;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.videoask.com" && parsed.hostname !== "videoask.com") {
      return NextResponse.json(
        { error: "That doesn\u2019t look like a VideoAsk link. The URL must be from videoask.com." },
        { status: 400 }
      );
    }
    const pathMatch = parsed.pathname.match(/^\/([a-z0-9]+)$/i);
    if (!pathMatch) {
      return NextResponse.json(
        { error: "Could not find a share ID in that URL. It should look like: https://www.videoask.com/abc123..." },
        { status: 400 }
      );
    }
    shareId = pathMatch[1];
  } catch {
    return NextResponse.json(
      { error: "That doesn\u2019t look like a valid URL." },
      { status: 400 }
    );
  }

  try {
    // Fetch the VideoAsk share page and extract __NEXT_DATA__
    const pageRes = await fetch(`https://www.videoask.com/${shareId}`, {
      headers: { "User-Agent": "WeHearYou/1.0" },
    });

    if (!pageRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch that VideoAsk link (${pageRes.status}). Make sure sharing is enabled.` },
        { status: 400 }
      );
    }

    const html = await pageRes.text();

    // Extract __NEXT_DATA__ JSON
    const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!dataMatch) {
      return NextResponse.json(
        { error: "Could not extract data from that page. The link may not be a shared answer." },
        { status: 400 }
      );
    }

    const nextData = JSON.parse(dataMatch[1]);
    const answer = nextData?.props?.pageProps?.answer;

    if (!answer) {
      return NextResponse.json(
        { error: "No answer data found. Make sure you\u2019re sharing an individual answer, not a form." },
        { status: 400 }
      );
    }

    const email = answer.contact_email;
    const name = answer.contact_name;

    // Extract form name from the page title: "Answer by Name | Form Name | Question"
    const pageTitle = nextData?.props?.pageProps?.answer?.form_metadata?.show_form_title
      ? ""
      : (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const titleParts = pageTitle.split(" | ");
    const sourceFormName = titleParts.length >= 2 ? titleParts[1]?.trim() : null;
    const transcription = answer.transcription;
    const mediaUrl = answer.media_url;
    const sourceResponseId = `va-link-${answer.answer_id ?? shareId}`;

    if (!transcription) {
      return NextResponse.json(
        { error: "This response doesn\u2019t have a transcription yet. VideoAsk may still be processing it." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "This response doesn\u2019t include an email address. We need an email to create a person record." },
        { status: 400 }
      );
    }

    const db = getServerClient();

    // Check if already imported FOR THIS TENANT (not globally)
    const { data: existing } = await db
      .from("responses")
      .select("id")
      .eq("videoask_response_id", sourceResponseId)
      .eq("tenant_id", tenant_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        imported: false,
        reason: "already_imported",
        message: "This response has already been imported.",
      });
    }

    // Get analysis config
    let configQuery = db
      .from("analysis_configs")
      .select("system_prompt, output_schema, model")
      .eq("is_active", true)
      .limit(1);

    if (campaign_id) {
      configQuery = configQuery.eq("campaign_id", campaign_id);
    } else {
      configQuery = configQuery.eq("tenant_id", tenant_id);
    }

    const { data: analysisConfig } = await configQuery.single();

    // Analyze
    const analyzeTranscription = await getAnalyzer();
    const encrypt = await getEncryptor();
    const sanitizeTranscription = await getSanitizer();

    const cleanTranscription = sanitizeTranscription(transcription);
    if (!cleanTranscription) {
      return NextResponse.json({ error: "Transcription is empty after cleaning" }, { status: 400 });
    }

    const analysis = await analyzeTranscription(cleanTranscription, name, analysisConfig) as Record<string, unknown>;

    // Encrypt PII
    const [emailEnc, nameEnc, transcEnc] = await Promise.all([
      encrypt(email),
      encrypt(name),
      encrypt(cleanTranscription),
    ]);

    // Upsert person
    const { data: person, error: pErr } = await db
      .from("people")
      .upsert({
        tenant_id,
        email,
        email_encrypted: emailEnc,
        name: name || undefined,
        name_encrypted: nameEnc,
        latest_mood: analysis.mood as string,
        latest_sentiment: analysis.sentiment as string,
        persona: (analysis.persona as string) || undefined,
        last_responded_at: answer.created_at ?? new Date().toISOString(),
      }, { onConflict: "tenant_id,email" })
      .select("id")
      .single();

    if (pErr) {
      return NextResponse.json({ error: "Failed to save person" }, { status: 500 });
    }

    // Insert response
    await db.from("responses").upsert({
      tenant_id,
      ...(campaign_id ? { campaign_id } : {}),
      person_id: person.id,
      transcription: cleanTranscription,
      transcription_encrypted: transcEnc,
      themes: (analysis.themes as string[]) ?? [],
      mood: analysis.mood as string,
      sentiment: analysis.sentiment as string,
      video_url: mediaUrl,
      videoask_response_id: sourceResponseId,
      source_type: "videoask-link",
      source_form_name: sourceFormName,
      share_url: answer.share_url ?? `https://www.videoask.com/${shareId}`,
      raw_analysis: analysis,
    }, { onConflict: "videoask_response_id" });

    // Update response count
    const { count } = await db
      .from("responses")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person.id);

    await db.from("people").update({ response_count: count }).eq("id", person.id);

    return NextResponse.json({
      imported: true,
      person: { id: person.id, name: name ?? email },
      analysis,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Import failed";
    console.error("Import link failed:", msg); return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
