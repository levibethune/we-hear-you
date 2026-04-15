-- ============================================
-- 003_domain_provisioning.sql
-- Domain-based auto-provisioning for tenants
-- ============================================

-- Add allowed_domains and default_role to tenants
ALTER TABLE tenants ADD COLUMN allowed_domains TEXT[] DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN default_role TEXT DEFAULT 'viewer';

-- Index for domain lookups
CREATE INDEX idx_tenants_allowed_domains ON tenants USING gin(allowed_domains);

-- Simplify roles: only 'owner', 'admin', 'viewer'
-- owner = Levi / tenant creator (full control + billing)
-- admin = domain-provisioned users (manage configs, personas, keys)
-- viewer = read-only access to data
COMMENT ON COLUMN tenants.default_role IS 'Role assigned to auto-provisioned users. Usually admin or viewer.';
