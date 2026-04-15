-- Filter & Flow: automated actions triggered by response analysis

CREATE TABLE flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_on TEXT NOT NULL DEFAULT 'both',
  conditions JSONB NOT NULL DEFAULT '[]',
  condition_logic TEXT NOT NULL DEFAULT 'all',
  action_type TEXT NOT NULL DEFAULT 'webhook',
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flows_tenant_active ON flows(tenant_id, is_active);

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flows ON flows
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

CREATE TABLE flow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_record_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_status_code INT,
  response_body TEXT,
  error TEXT,
  payload_sent JSONB,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flow_executions_flow ON flow_executions(flow_id, created_at DESC);
CREATE INDEX idx_flow_executions_tenant ON flow_executions(tenant_id, created_at DESC);

ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_executions ON flow_executions
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));
