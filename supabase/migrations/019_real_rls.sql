-- ============================================
-- 019_real_rls.sql
-- Replace RLS policies that depend on `current_setting('app.tenant_id')`
-- with policies keyed to auth.uid() via tenant_members. The app code
-- never set app.tenant_id, so these policies were always evaluating to
-- false (RLS effectively off for service-role queries; defense-in-depth
-- absent for anon-key queries).
--
-- Newer tables (campaigns, flows, flow_executions, in_app_notifications,
-- digest_queue, video_feeds) already use the correct pattern and are
-- skipped here.
-- ============================================

-- people
DROP POLICY IF EXISTS tenant_isolation_people ON people;
CREATE POLICY tenant_isolation_people ON people
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- responses
DROP POLICY IF EXISTS tenant_isolation_responses ON responses;
CREATE POLICY tenant_isolation_responses ON responses
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- sources
DROP POLICY IF EXISTS tenant_isolation_sources ON sources;
CREATE POLICY tenant_isolation_sources ON sources
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- analysis_configs
DROP POLICY IF EXISTS tenant_isolation_configs ON analysis_configs;
CREATE POLICY tenant_isolation_configs ON analysis_configs
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- taxonomies
DROP POLICY IF EXISTS tenant_isolation_taxonomies ON taxonomies;
CREATE POLICY tenant_isolation_taxonomies ON taxonomies
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- api_keys
DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
CREATE POLICY tenant_isolation_api_keys ON api_keys
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- oauth_connections
DROP POLICY IF EXISTS tenant_isolation_oauth ON oauth_connections;
CREATE POLICY tenant_isolation_oauth ON oauth_connections
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- jobs
DROP POLICY IF EXISTS tenant_isolation_jobs ON jobs;
CREATE POLICY tenant_isolation_jobs ON jobs
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));
