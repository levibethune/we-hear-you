-- ============================================
-- 012_insight_cache.sql
-- Cache audience insights per tenant
-- ============================================

CREATE TABLE insight_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  insight TEXT,
  response_count_at_generation INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now()
);
