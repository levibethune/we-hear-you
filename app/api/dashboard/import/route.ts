import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { verifyTenantAccess, unauthorized, forbidden } from "../../../lib/dashboard-auth";
import { videoAskFetch } from "../../../lib/videoask-token";

async function getAnalyzer() {
  const { analyzeTranscription } = await import("../../../../lib/analyze.js");
  return analyzeTranscription;
}

async function getEncryptor() {
  const { encrypt } = await import("../../../../lib/crypto/pii.js");
  return encrypt;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenant_id, campaign_id, form_id } = body;

  const auth = await verifyTenantAccess(request, tenant_id, "admin");
  if (!auth) return tenant_id ? forbidden() : unauthorized();

  const db = getServerClient();
  const analyzeTranscription = await getAnalyzer();
  const encrypt = await getEncryptor();

  const { data: analysisConfig } = await db
    .from("analysis_configs")
    .select("system_prompt, output_schema, model")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  try {
    // Use videoAskFetch which handles token refresh + retry on 401/403
    const formsUrl = form_id
      ? `https://api.videoask.com/forms/${form_id}`
      : "https://api.videoask.com/forms";

    const formsRes = await videoAskFetch(tenant_id, formsUrl);

    if (!formsRes) {
      return NextResponse.json(
        { error: "VideoAsk is not connected. Use the Connect button to authorize access." },
        { status: 400 }
      );
    }

    if (!formsRes.ok) {
      return NextResponse.json(
        { error: "VideoAsk authorization expired. Please disconnect and reconnect your account." },
        { status: 401 }
      );
    }

    const formsData = await formsRes.json();
    const forms = form_id ? [formsData] : (formsData.items ?? formsData.results ?? [formsData]);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const form of forms) {
      let nextUrl: string | null = `https://api.videoask.com/forms/${form.form_id ?? form.id}/contacts`;

      while (nextUrl) {
        const contactsRes = await videoAskFetch(tenant_id, nextUrl);
        if (!contactsRes || !contactsRes.ok) break;

        const contactsData = await contactsRes.json();
        const contacts = contactsData.items ?? contactsData.results ?? [];

        // Process contacts in batches of 3 for parallelism
        for (let ci = 0; ci < contacts.length; ci += 3) {
          const batch = contacts.slice(ci, ci + 3);
          const results = await Promise.allSettled(batch.map(async (contact: Record<string, unknown>) => {
          try {
            const email = contact.email;
            const name = contact.name ?? contact.contact_name ?? null;

            if (!email) {
              return "skipped";
            }

            // Use the share URL to get transcription data (the API contact endpoint doesn't include it)
            const shareUrl = (contact.share_url as string) ?? null;
            if (!shareUrl) {
              return "skipped";
            }

            // Fetch the share page and extract __NEXT_DATA__
            const pageRes = await fetch(shareUrl, { headers: { "User-Agent": "WeHearYou/1.0" } });
            if (!pageRes.ok) {
              return "failed";
            }

            const html = await pageRes.text();
            const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (!dataMatch) {
              return "skipped";
            }

            const nextData = JSON.parse(dataMatch[1]);
            const contactData = nextData?.props?.pageProps?.contact;
            const answers = contactData?.answers ?? [];
            const transcriptionParts: string[] = [];
            let mediaUrl: string | null = null;

            for (const answer of answers) {
              if (answer.transcription) transcriptionParts.push(answer.transcription);
              if (!mediaUrl && answer.media_url) mediaUrl = answer.media_url;
            }

            const transcription = transcriptionParts.join("\n\n").trim();
            if (!transcription) {
              return "skipped";
            }

            const sourceResponseId = `va-import-${contact.contact_id ?? contact.id}`;

            const { data: existing } = await db
              .from("responses")
              .select("id")
              .eq("videoask_response_id", sourceResponseId)
              .eq("tenant_id", tenant_id)
              .limit(1);

            if (existing && existing.length > 0) return "skipped";

            const analysis = await analyzeTranscription(transcription, name, analysisConfig) as Record<string, unknown>;

            const [emailEnc, nameEnc, transcEnc] = await Promise.all([
              encrypt(email),
              encrypt(name),
              encrypt(transcription),
            ]);

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
                last_responded_at: (contactData?.created_at as string) ?? (contact.created_at as string) ?? new Date().toISOString(),
              }, { onConflict: "tenant_id,email" })
              .select("id")
              .single();

            if (pErr) return "failed";

            await db.from("responses").upsert({
              tenant_id,
              ...(campaign_id ? { campaign_id } : {}),
              person_id: person.id,
              transcription,
              transcription_encrypted: transcEnc,
              themes: (analysis.themes as string[]) ?? [],
              mood: analysis.mood as string,
              sentiment: analysis.sentiment as string,
              video_url: mediaUrl,
              videoask_response_id: sourceResponseId,
              source_type: "videoask-import",
              source_form_name: (html.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" | ")[1]?.trim()) ?? null,
              share_url: (contact.share_url as string) ?? null,
              raw_analysis: analysis,
            }, { onConflict: "videoask_response_id" });

            const { count } = await db
              .from("responses")
              .select("id", { count: "exact", head: true })
              .eq("person_id", person.id);

            await db.from("people").update({ response_count: count }).eq("id", person.id);

            return "imported";
          } catch {
            return "failed";
          }
          }));
          for (const r of results) {
            if (r.status === "fulfilled") {
              if (r.value === "imported") imported++;
              else if (r.value === "skipped") skipped++;
              else failed++;
            } else {
              failed++;
            }
          }
        }

        nextUrl = contactsData.next ?? null;
      }
    }

    console.log(`[import] Done: ${imported} imported, ${skipped} skipped, ${failed} failed`);
    return NextResponse.json({ imported, skipped, failed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Import failed";
    console.error("Bulk import failed:", message); return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
