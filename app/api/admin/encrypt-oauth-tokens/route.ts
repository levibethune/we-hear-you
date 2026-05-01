import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "../../../lib/supabase-server";
import { getAuthUser, isSuperAdmin } from "../../../lib/dashboard-auth";
import { buildEncryptedTokenColumns } from "../../../../lib/crypto/oauth-helpers.js";

/**
 * One-time backfill: encrypt every plaintext token in oauth_connections
 * and null out the plaintext columns. Idempotent — rows with no plaintext
 * left are skipped.
 *
 * Restricted to super admins. Run once after migration 017 deploys.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getServerClient();
  const { data: rows, error } = await db
    .from("oauth_connections")
    .select("id, access_token, refresh_token");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let encrypted = 0;
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of rows ?? []) {
    if (!row.access_token && !row.refresh_token) {
      skipped++;
      continue;
    }
    try {
      const cols = await buildEncryptedTokenColumns({
        access_token: row.access_token ?? undefined,
        refresh_token: row.refresh_token ?? undefined,
      });
      const { error: updateError } = await db
        .from("oauth_connections")
        .update(cols)
        .eq("id", row.id);
      if (updateError) {
        failures.push({ id: row.id, reason: updateError.message });
      } else {
        encrypted++;
      }
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
