import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { getAuthUser, isSuperAdmin } from "../../../lib/dashboard-auth";

/**
 * One-time backfill: encrypt every plaintext tenants.webhook_secret and
 * null out the plaintext column. Idempotent — rows already encrypted
 * are skipped.
 *
 * Restricted to super admins. Run once after migration 018 deploys.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { encrypt } = await import("../../../../lib/crypto/pii.js");
  const db = getServerClient();
  const { data: rows, error } = await db
    .from("tenants")
    .select("id, webhook_secret, webhook_secret_encrypted");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let encrypted = 0;
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of rows ?? []) {
    if (row.webhook_secret_encrypted) { skipped++; continue; }
    if (!row.webhook_secret) { skipped++; continue; }
    try {
      const enc = await encrypt(row.webhook_secret);
      const { error: updateError } = await db
        .from("tenants")
        .update({ webhook_secret_encrypted: enc, webhook_secret: null })
        .eq("id", row.id);
      if (updateError) failures.push({ id: row.id, reason: updateError.message });
      else encrypted++;
    } catch (err) {
      failures.push({ id: row.id, reason: err instanceof Error ? err.message : "unknown" });
    }
  }

  return NextResponse.json({
    total: rows?.length ?? 0,
    encrypted,
    skipped,
    failures,
  });
}
