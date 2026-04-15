import crypto from "crypto";

/**
 * Verify a webhook signature using HMAC-SHA256.
 * Returns true if valid, sends error response and returns false if not.
 */
export function verifyWebhookSignature(req, res, secret) {
  // If no secret configured for this tenant, skip verification
  if (!secret) return true;

  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];

  if (!signature) {
    res.status(401).json({ error: "Missing webhook signature" });
    return false;
  }

  // Replay protection: reject requests older than 5 minutes
  if (timestamp) {
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
      res.status(401).json({ error: "Webhook timestamp expired" });
      return false;
    }
  }

  // Build canonical string
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const canonical = timestamp ? `${timestamp}.${body}` : body;

  // Compute expected signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  // Timing-safe comparison
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return false;
    }
  } catch {
    res.status(401).json({ error: "Invalid webhook signature" });
    return false;
  }

  return true;
}
