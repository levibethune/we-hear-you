-- ============================================
-- 010_share_url.sql
-- Store original VideoAsk share URL per response
-- ============================================

ALTER TABLE responses ADD COLUMN share_url TEXT;
