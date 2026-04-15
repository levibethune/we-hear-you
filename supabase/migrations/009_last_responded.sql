-- ============================================
-- 009_last_responded.sql
-- Track when a person last actually responded
-- ============================================

ALTER TABLE people ADD COLUMN last_responded_at TIMESTAMPTZ;

-- Backfill from existing responses
UPDATE people SET last_responded_at = (
  SELECT MAX(created_at) FROM responses WHERE responses.person_id = people.id
);
