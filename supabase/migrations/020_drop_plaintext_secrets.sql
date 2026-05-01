-- ============================================
-- 020_drop_plaintext_secrets.sql
-- After running the backfill admin endpoints from migration 017/018,
-- every existing row has its encrypted column populated and its
-- plaintext column nulled. The application code no longer reads or
-- writes the plaintext columns, so drop them.
--
-- Run this AFTER deploying the matching code (which removes plaintext
-- references from SELECTs and helpers). Otherwise the live app will
-- error on missing columns until the deploy lands.
-- ============================================

ALTER TABLE oauth_connections
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;

ALTER TABLE tenants
  DROP COLUMN webhook_secret;
