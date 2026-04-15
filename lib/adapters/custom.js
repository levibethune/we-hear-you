/**
 * Custom adapter.
 * Accepts payloads that already match (or nearly match) the universal shape.
 * Use this for sources that don't have a dedicated adapter.
 */
export function normalize(payload) {
  return {
    email: payload?.email || null,
    name: payload?.name || null,
    transcription: payload?.transcription || null,
    mediaUrl: payload?.media_url || payload?.mediaUrl || null,
    sourceResponseId: payload?.source_response_id || payload?.id || null,
    rawMeta: payload?.meta || {},
  };
}
