/**
 * VideoAsk adapter.
 * Normalizes VideoAsk webhook payloads into the universal ingest shape.
 */
export function normalize(payload) {
  const email = extractField(payload, "email");
  const name = extractField(payload, "name");
  const transcription = payload?.transcription;
  const mediaUrl = payload?.media_url;
  const sourceResponseId = payload?.id || payload?.response_id;

  return {
    email,
    name,
    transcription,
    mediaUrl,
    sourceResponseId,
    rawMeta: {
      provider: "videoask",
      originalId: sourceResponseId,
    },
  };
}

/**
 * Fetch the video/media URL from a VideoAsk share URL.
 * Scrapes the __NEXT_DATA__ from the public share page.
 * Returns the media_url string or null if unavailable.
 */
export async function fetchVideoUrl(shareUrl) {
  if (!shareUrl) return null;

  try {
    const parsed = new URL(shareUrl);
    if (parsed.hostname !== "www.videoask.com" && parsed.hostname !== "videoask.com") {
      return null;
    }
    const pathMatch = parsed.pathname.match(/^\/([a-z0-9]+)$/i);
    if (!pathMatch) return null;

    const res = await fetch(`https://www.videoask.com/${pathMatch[1]}`, {
      headers: { "User-Agent": "WeHearYou/1.0" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const dataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!dataMatch) return null;

    const nextData = JSON.parse(dataMatch[1]);
    return nextData?.props?.pageProps?.answer?.media_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract a contact field from the VideoAsk webhook payload.
 * VideoAsk structures vary — this handles common formats.
 */
function extractField(payload, field) {
  if (payload?.[field]) return payload[field];

  if (payload?.contact?.[field]) return payload.contact[field];

  const answers = payload?.answers || payload?.form_answers || [];
  for (const answer of answers) {
    const label = (answer.label || answer.field_name || "").toLowerCase();
    if (label.includes(field)) return answer.value || answer.text;
  }

  return null;
}
