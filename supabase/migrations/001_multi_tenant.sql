-- ============================================
-- 001_multi_tenant.sql
-- Adds multi-tenancy, API keys, configurable
-- analysis, and RLS to We Hear You
-- ============================================

-- Tenants
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Keys (scoped to tenant)
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{ingest}',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Sources (webhook configs per tenant)
CREATE TABLE sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analysis Configs (per-tenant prompt + output schema)
CREATE TABLE analysis_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  output_schema JSONB NOT NULL,
  model TEXT DEFAULT 'claude-sonnet-4-6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Taxonomies (tenant-defined sorting buckets)
CREATE TABLE taxonomies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  buckets JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Modify existing tables
-- ============================================

-- Add tenant_id to people and responses
ALTER TABLE people ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE responses ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE responses ADD COLUMN source_type TEXT;
ALTER TABLE responses ADD COLUMN raw_analysis JSONB;

-- PII encryption columns
ALTER TABLE people ADD COLUMN email_encrypted JSONB;
ALTER TABLE people ADD COLUMN name_encrypted JSONB;
ALTER TABLE responses ADD COLUMN transcription_encrypted JSONB;

-- Indexes for tenant scoping
CREATE INDEX idx_people_tenant_id ON people(tenant_id);
CREATE INDEX idx_responses_tenant_id ON responses(tenant_id);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so these policies are defense-in-depth
-- for any future client-side access or less-privileged roles
CREATE POLICY tenant_isolation_people ON people
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_responses ON responses
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_sources ON sources
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_configs ON analysis_configs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_taxonomies ON taxonomies
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_api_keys ON api_keys
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ============================================
-- Default analysis config (seed data)
-- This gets cloned for new tenants who don't
-- customize their analysis.
-- ============================================

-- We'll insert this per-tenant during provisioning,
-- but here's the template for reference:
COMMENT ON TABLE analysis_configs IS
  'Default output_schema: {"type":"object","properties":{"themes":{"type":"array","items":{"type":"string"},"description":"2-5 short theme labels"},"mood":{"type":"string","description":"Single word emotional tone"},"sentiment":{"type":"string","enum":["positive","negative","mixed","neutral"]}},"required":["themes","mood","sentiment"]}';
