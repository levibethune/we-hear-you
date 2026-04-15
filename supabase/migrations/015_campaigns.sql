-- Campaigns: grouping layer between organizations and data

-- 1. Create campaigns table
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  form_names TEXT[] NOT NULL DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_tenant_active ON campaigns(tenant_id) WHERE NOT is_archived;
CREATE UNIQUE INDEX idx_campaigns_tenant_default ON campaigns(tenant_id) WHERE is_default = true;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_campaigns ON campaigns
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- 2. Create a "Default" campaign for every existing tenant
INSERT INTO campaigns (tenant_id, name, slug, description, is_default)
SELECT id, 'Default', 'default', 'Auto-created campaign for existing data', true
FROM tenants;

-- 3. Add campaign_id columns (nullable initially for backfill)
ALTER TABLE responses ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE analysis_configs ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE taxonomies ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE flows ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE video_feeds ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE in_app_notifications ADD COLUMN campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE jobs ADD COLUMN campaign_id UUID REFERENCES campaigns(id);

-- Drop existing unique constraint on insight_cache before altering
ALTER TABLE insight_cache DROP CONSTRAINT IF EXISTS insight_cache_tenant_id_key;
ALTER TABLE insight_cache ADD COLUMN campaign_id UUID REFERENCES campaigns(id);

-- 4. Backfill all existing rows to their tenant's Default campaign
UPDATE responses r SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = r.tenant_id AND c.is_default = true
AND r.campaign_id IS NULL;

UPDATE analysis_configs ac SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = ac.tenant_id AND c.is_default = true
AND ac.campaign_id IS NULL;

UPDATE taxonomies t SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = t.tenant_id AND c.is_default = true
AND t.campaign_id IS NULL;

UPDATE flows f SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = f.tenant_id AND c.is_default = true
AND f.campaign_id IS NULL;

UPDATE video_feeds vf SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = vf.tenant_id AND c.is_default = true
AND vf.campaign_id IS NULL;

UPDATE jobs j SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = j.tenant_id AND c.is_default = true
AND j.campaign_id IS NULL;

UPDATE insight_cache ic SET campaign_id = c.id
FROM campaigns c WHERE c.tenant_id = ic.tenant_id AND c.is_default = true
AND ic.campaign_id IS NULL;

-- 5. Set NOT NULL on tables that require it
ALTER TABLE responses ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE analysis_configs ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE taxonomies ALTER COLUMN campaign_id SET NOT NULL;

-- 6. Create indexes
CREATE INDEX idx_responses_campaign ON responses(campaign_id);
CREATE INDEX idx_responses_tenant_campaign ON responses(tenant_id, campaign_id);
CREATE INDEX idx_analysis_configs_campaign ON analysis_configs(campaign_id);
CREATE UNIQUE INDEX idx_analysis_configs_campaign_active ON analysis_configs(campaign_id) WHERE is_active = true;
CREATE INDEX idx_taxonomies_campaign ON taxonomies(campaign_id);
CREATE UNIQUE INDEX idx_taxonomies_campaign_personas ON taxonomies(campaign_id) WHERE name = 'Personas';
CREATE INDEX idx_flows_campaign ON flows(campaign_id);
CREATE INDEX idx_video_feeds_campaign ON video_feeds(campaign_id);

-- 7. Updated unique index for insight_cache (null campaign_id = org aggregate)
CREATE UNIQUE INDEX idx_insight_cache_scope ON insight_cache(tenant_id, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'));
