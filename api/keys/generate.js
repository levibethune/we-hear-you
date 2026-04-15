import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authenticate } from "../../lib/middleware/auth.js";
import { getServiceClient } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Requires admin scope
  const auth = await authenticate(req, res, "admin");
  if (!auth) return;

  const { tenantId } = auth;
  const { name, scopes, expiresInDays } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Key name is required" });
  }

  const validScopes = ["ingest", "read", "admin"];
  const keyScopes = scopes || ["ingest"];
  for (const scope of keyScopes) {
    if (!validScopes.includes(scope)) {
      return res.status(400).json({ error: `Invalid scope: ${scope}` });
    }
  }

  try {
    // Generate key: why_ prefix + 32 random bytes
    const keyBytes = crypto.randomBytes(32);
    const plainKey = `why_${keyBytes.toString("hex")}`;
    const keyPrefix = plainKey.slice(0, 8);
    const keyHash = await bcrypt.hash(plainKey, 12);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const supabase = getServiceClient();
    const { data: created, error } = await supabase
      .from("api_keys")
      .insert({
        tenant_id: tenantId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
        scopes: keyScopes,
        expires_at: expiresAt,
      })
      .select("id, name, scopes, expires_at, created_at")
      .single();

    if (error) throw error;

    return res.status(201).json({
      id: created.id,
      key: plainKey, // Returned ONCE — store it securely
      name: created.name,
      scopes: created.scopes,
      expiresAt: created.expires_at,
      message: "Store this key securely. You will not see it again.",
    });
  } catch (error) {
    console.error("Key generation error:", error?.message || error);
    return res.status(500).json({ error: "Key generation failed" });
  }
}
