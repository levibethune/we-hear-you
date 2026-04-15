-- ============================================
-- 002_dashboard_auth.sql
-- Links auth.users to tenants for dashboard access
-- ============================================

-- Tenant members: maps Supabase auth users to tenants with roles
CREATE TABLE tenant_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user_id ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant_id ON tenant_members(tenant_id);

-- Enable RLS
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY tenant_members_select ON tenant_members
  FOR SELECT USING (user_id = auth.uid());

-- Owners/admins can manage members in their tenants
CREATE POLICY tenant_members_manage ON tenant_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

-- RLS policies for dashboard access (via tenant_members)
CREATE POLICY dashboard_people ON people
  FOR SELECT USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY dashboard_responses ON responses
  FOR SELECT USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY dashboard_sources ON sources
  FOR SELECT USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY dashboard_configs ON analysis_configs
  FOR ALL USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY dashboard_taxonomies ON taxonomies
  FOR ALL USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY dashboard_api_keys_read ON api_keys
  FOR SELECT USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Tenants: members can see their own tenants
CREATE POLICY member_tenants ON tenants
  FOR SELECT USING (
    id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid())
  );

-- Super-admin function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email IN ('levibethune@gmail.com')
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super-admin can see all tenants
CREATE POLICY super_admin_tenants ON tenants
  FOR SELECT USING (is_super_admin());
