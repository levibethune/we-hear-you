import bcrypt from "bcryptjs";
import { getServiceClient } from "../supabase.js";

/**
 * API key authentication middleware.
 * Extracts Bearer token, verifies against bcrypt hash,
 * sets req.tenantId and req.scopes.
 */
export async function authenticate(req, res, requiredScope = "ingest") {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing API key" });
    return null;
  }

  const apiKey = authHeader.slice(7);

  if (!apiKey.startsWith("why_") || apiKey.length < 12) {
    res.status(401).json({ error: "Invalid API key format" });
    return null;
  }

  const prefix = apiKey.slice(0, 8);
  const supabase = getServiceClient();

  // Look up by prefix (indexed for fast lookup)
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, tenant_id, key_hash, scopes, is_active, expires_at")
    .eq("key_prefix", prefix)
    .eq("is_active", true);

  if (error || !keys || keys.length === 0) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }

  // Verify against bcrypt hash (there could be multiple keys with same prefix, rare but possible)
  let matchedKey = null;
  for (const key of keys) {
    if (await bcrypt.compare(apiKey, key.key_hash)) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }

  // Check expiration
  if (matchedKey.expires_at && new Date(matchedKey.expires_at) < new Date()) {
    res.status(401).json({ error: "API key expired" });
    return null;
  }

  // Check scope
  if (!matchedKey.scopes.includes(requiredScope) && !matchedKey.scopes.includes("admin")) {
    res.status(403).json({ error: "Insufficient scope", required: requiredScope });
    return null;
  }

  // Update last_used_at (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matchedKey.id)
    .then(() => {});

  return {
    tenantId: matchedKey.tenant_id,
    scopes: matchedKey.scopes,
    keyId: matchedKey.id,
  };
}
