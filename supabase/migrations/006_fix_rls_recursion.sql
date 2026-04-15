-- ============================================
-- 006_fix_rls_recursion.sql
-- Fix infinite recursion in tenant_members RLS
-- ============================================

-- Drop the recursive manage policy
DROP POLICY IF EXISTS tenant_members_manage ON tenant_members;

-- Replace with non-recursive policies for insert/update/delete
-- These use a security definer function to avoid the recursion

CREATE OR REPLACE FUNCTION check_tenant_admin(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY tenant_members_insert ON tenant_members
  FOR INSERT WITH CHECK (
    check_tenant_admin(tenant_id)
  );

CREATE POLICY tenant_members_update ON tenant_members
  FOR UPDATE USING (
    check_tenant_admin(tenant_id)
  );

CREATE POLICY tenant_members_delete ON tenant_members
  FOR DELETE USING (
    check_tenant_admin(tenant_id)
  );
