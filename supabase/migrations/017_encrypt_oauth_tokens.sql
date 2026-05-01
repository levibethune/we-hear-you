-- ============================================
-- 017_encrypt_oauth_tokens.sql
-- Encrypt OAuth access + refresh tokens at rest. Plaintext columns
-- become nullable while we transition; a follow-up migration drops
-- them once the backfill admin endpoint has run for every tenant.
-- ============================================

ALTER TABLE oauth_connections
  ADD COLUMN access_token_encrypted JSONB,
  ADD COLUMN refresh_token_encrypted JSONB;

-- Allow plaintext to be nulled out as rows are encrypted in place
ALTER TABLE oauth_connections
  ALTER COLUMN access_token DROP NOT NULL;
