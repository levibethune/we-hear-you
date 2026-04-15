-- ============================================
-- 007_bulk_actions.sql
-- Add is_hidden flag for bulk hide/show actions
-- ============================================

ALTER TABLE people ADD COLUMN is_hidden BOOLEAN DEFAULT false;
ALTER TABLE responses ADD COLUMN is_hidden BOOLEAN DEFAULT false;

CREATE INDEX idx_people_hidden ON people(tenant_id, is_hidden);
CREATE INDEX idx_responses_hidden ON responses(tenant_id, is_hidden);
