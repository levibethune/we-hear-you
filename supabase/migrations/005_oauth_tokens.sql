-- ============================================
-- 005_oauth_tokens.sql
-- Store OAuth tokens per tenant for integrations
-- ============================================

CREATE TABLE oauth_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,           -- 'videoask'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  provider_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_oauth_connections_tenant ON oauth_connections(tenant_id);

ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_oauth ON oauth_connections
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
