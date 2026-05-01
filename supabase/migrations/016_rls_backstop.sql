-- ============================================
-- 016_rls_backstop.sql
-- Close two RLS gaps:
--   1. insight_cache had no RLS at all — readable via anon key.
--   2. tenants had policies but ENABLE ROW LEVEL SECURITY was never run,
--      so the policies were decorative. Webhook secrets exposed.
-- Server-side dashboard routes use the service role and bypass RLS;
-- these policies are a backstop against direct anon-key access.
-- ============================================

-- Insight cache: scope to tenant membership
ALTER TABLE insight_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_insight_cache ON insight_cache
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- Tenants: enable RLS so the existing SELECT policies (member_tenants,
-- super_admin_tenants from migration 002) actually take effect.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
