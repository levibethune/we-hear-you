-- ============================================
-- 011_jobs.sql
-- Background job queue for imports and analysis
-- ============================================

CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,           -- 'import_csv', 'import_links', 'reanalyze', 'bulk_reanalyze'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  params JSONB DEFAULT '{}',   -- job-specific input data
  progress JSONB DEFAULT '{"current": 0, "total": 0, "imported": 0, "skipped": 0, "failed": 0}',
  result JSONB,                -- final result summary
  error TEXT,                  -- error message if failed
  created_by UUID,             -- auth user who created the job
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_status ON jobs(status);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_jobs ON jobs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
