-- ============================================
-- 004_security_hardening.sql
-- Per-tenant email uniqueness + constraint fixes
-- ============================================

-- Drop the global email unique constraint
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_email_key;

-- Add per-tenant email unique constraint
-- Same email can exist in different tenants, but not twice in the same tenant
CREATE UNIQUE INDEX idx_people_tenant_email ON people(tenant_id, email);
