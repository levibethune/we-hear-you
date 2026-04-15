/**
 * Slack notification sender.
 * Posts a formatted message to a Slack incoming webhook URL.
 */

function isBlockedUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(hostname)) return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
    return false;
  } catch { return true; }
}

export async function sendSlackNotification(flow, response, person) {
  const config = flow.action_config || {};
  if (!config.webhook_url) {
    return { error: "No Slack webhook URL configured" };
  }
  if (isBlockedUrl(config.webhook_url)) {
    return { error: "Blocked URL: private/internal addresses not allowed" };
  }

  const personLabel = person.name || person.email || "Someone";
  const persona = response.raw_analysis?.persona || person.persona || "—";
  const sentiment = response.sentiment || "—";
  const mood = response.mood || "—";
  const themes = (response.themes || []).slice(0, 5).join(", ");
  const transcriptPreview = (response.transcription || "").slice(0, 280);

  // Slack Block Kit message
  const payload = {
    text: `New response from ${personLabel}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🎙️ ${flow.name}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Person:*\n${personLabel}` },
          { type: "mrkdwn", text: `*Persona:*\n${persona}` },
          { type: "mrkdwn", text: `*Sentiment:*\n${sentiment}` },
          { type: "mrkdwn", text: `*Mood:*\n${mood}` },
        ],
      },
      ...(themes
        ? [{ type: "section", text: { type: "mrkdwn", text: `*Themes:* ${themes}` } }]
        : []),
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Transcript:*\n>${transcriptPreview}${response.transcription?.length > 280 ? "…" : ""}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Response →" },
            url: `https://app.wehearyou.io/dashboard/people/${person.id}`,
            style: "primary",
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(config.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const body = await res.text().catch(() => "");
    return { status: res.status, body: body.slice(0, 1024), payload };
  } catch (err) {
    return { error: err?.message || "Slack request failed", payload };
  }
}
