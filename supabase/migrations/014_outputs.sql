-- Outputs: Notifications + Video Feeds

-- 1. Extend flows table with category column
ALTER TABLE flows ADD COLUMN category TEXT NOT NULL DEFAULT 'flow';
-- 'flow' = custom webhook, 'notification' = pre-built notification output

-- 2. In-app notifications (delivered to dashboard bell)
CREATE TABLE in_app_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  trigger_record_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_by JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_in_app_tenant_created ON in_app_notifications(tenant_id, created_at DESC);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_in_app ON in_app_notifications
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- 3. Email digest queue
CREATE TABLE digest_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE NOT NULL,
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_digest_pending ON digest_queue(flow_id, sent_at) WHERE sent_at IS NULL;

ALTER TABLE digest_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_digest ON digest_queue
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- 4. Video feeds
CREATE TABLE video_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  conditions JSONB NOT NULL DEFAULT '[]',
  condition_logic TEXT NOT NULL DEFAULT 'all',
  safety_required JSONB NOT NULL DEFAULT '{"no_pii": true, "no_profanity": true, "no_hate_speech": true, "on_topic": true}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_video_feeds_slug ON video_feeds(slug);
CREATE INDEX idx_video_feeds_tenant ON video_feeds(tenant_id);

ALTER TABLE video_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_video_feeds ON video_feeds
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));
