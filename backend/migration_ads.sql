-- ==========================================
-- مايجريشن إنشاء جداول الإعلانات الذكية وقواعدها لقنوات «بث 24»
-- ==========================================

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 15,
  max_impressions INTEGER DEFAULT NULL,
  current_impressions INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(is_active);

CREATE TABLE IF NOT EXISTS channel_ad_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL, -- معرف القناة أو 'ALL' لجميع القنوات
  ad_id TEXT NOT NULL,      -- مرتبط بـ ads.id
  trigger_type TEXT NOT NULL, -- 'EPISODE_COUNT' أو 'TIME_INTERVAL'
  trigger_value INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channel_ad_rules_channel ON channel_ad_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_ad_rules_ad ON channel_ad_rules(ad_id);
