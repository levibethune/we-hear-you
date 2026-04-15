-- ============================================
-- 008_source_form.sql
-- Track which form/source each response came from
-- ============================================

ALTER TABLE responses ADD COLUMN source_form_name TEXT;
CREATE INDEX idx_responses_source_form ON responses(tenant_id, source_form_name);
