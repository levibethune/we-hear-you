const MAX_TRANSCRIPTION_LENGTH = 50000;

/**
 * Sanitize transcription input before sending to Claude.
 * Strips control characters and enforces length limits.
 */
export function sanitizeTranscription(transcription) {
  if (!transcription || typeof transcription !== "string") {
    return null;
  }

  // Strip control characters (keep newlines and tabs)
  let clean = transcription.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Enforce max length
  if (clean.length > MAX_TRANSCRIPTION_LENGTH) {
    clean = clean.slice(0, MAX_TRANSCRIPTION_LENGTH);
  }

  // Collapse excessive whitespace (3+ newlines → 2)
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim() || null;
}
