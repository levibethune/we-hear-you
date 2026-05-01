-- ============================================
-- 018_encrypt_webhook_secrets.sql
-- Encrypt tenants.webhook_secret at rest. Webhook secrets sign incoming
-- ingest requests; if leaked, an attacker can forge any tenant's data.
-- Migration is additive; an admin endpoint backfills existing rows and
-- nulls the plaintext column.
-- ============================================

ALTER TABLE tenants
  ADD COLUMN webhook_secret_encrypted JSONB;
