import { encrypt, decrypt } from "./pii.js";

/**
 * Read a decrypted OAuth token field from an oauth_connections row.
 * Prefers the encrypted column; falls back to the plaintext column for
 * rows that haven't been backfilled yet. Returns null if neither exists.
 *
 * @param {object | null | undefined} connection - row from oauth_connections
 * @param {"access_token" | "refresh_token"} field
 * @returns {Promise<string | null>}
 */
export async function readOAuthToken(connection, field) {
  if (!connection) return null;
  const encryptedField = `${field}_encrypted`;
  const enc = connection[encryptedField];
  if (enc) return decrypt(enc);
  return connection[field] ?? null;
}

/**
 * Build the columns to write when upserting an oauth_connections row.
 * Encrypts access + refresh tokens, nulls out the plaintext columns so
 * we don't keep two copies around.
 *
 * @param {{ access_token?: string|null, refresh_token?: string|null }} tokens
 * @returns {Promise<object>} columns to merge into your upsert payload
 */
export async function buildEncryptedTokenColumns({ access_token, refresh_token }) {
  const cols = {};
  if (access_token !== undefined) {
    cols.access_token_encrypted = access_token ? await encrypt(access_token) : null;
    cols.access_token = null;
  }
  if (refresh_token !== undefined) {
    cols.refresh_token_encrypted = refresh_token ? await encrypt(refresh_token) : null;
    cols.refresh_token = null;
  }
  return cols;
}

/**
 * Columns to select when reading a connection — fetches both the
 * encrypted column and the plaintext fallback in one query.
 */
export const OAUTH_TOKEN_SELECT = "access_token, refresh_token, access_token_encrypted, refresh_token_encrypted";
