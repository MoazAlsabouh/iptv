-- جدول الموزعين (Resellers)
CREATE TABLE IF NOT EXISTS resellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' | 'suspended'
  note TEXT,
  created_at TEXT NOT NULL
);

-- جدول الاشتراكات وأكواد التفعيل
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reseller_id INTEGER DEFAULT NULL,
  code TEXT UNIQUE NOT NULL,
  duration_days INTEGER NOT NULL,
  max_devices INTEGER DEFAULT 1,
  status TEXT DEFAULT 'unused', -- 'unused' | 'active' | 'suspended'
  note TEXT,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL
);

-- جدول الأجهزة المرتبطة بكل اشتراك
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  last_seen TEXT NOT NULL,
  UNIQUE(subscription_id, device_id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- فهارس لتسريع الاستعلام والتحقق
CREATE INDEX IF NOT EXISTS idx_subscriptions_code ON subscriptions(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_reseller_id ON subscriptions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_devices_sub_device ON devices(subscription_id, device_id);
CREATE INDEX IF NOT EXISTS idx_resellers_username ON resellers(username);
CREATE INDEX IF NOT EXISTS idx_resellers_email ON resellers(email);

-- جدول المفضلات للمستخدمين (قنوات وأفلام ومسلسلات)
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL, -- 'channel' | 'vod'
  item_data TEXT NOT NULL, -- بيانات العنصر بصيغة JSON
  created_at TEXT NOT NULL,
  UNIQUE(subscription_id, item_id, item_type),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_sub ON user_favorites(subscription_id);
CREATE INDEX IF NOT EXISTS idx_favorites_sub_type ON user_favorites(subscription_id, item_type);

-- جدول الإعدادات العامة وإعدادات سيرفرات الأفلام والمسلسلات
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- جدول تخصيص القنوات المختارة (Channel Overrides)
CREATE TABLE IF NOT EXISTS channel_overrides (
  id TEXT PRIMARY KEY,
  name TEXT,
  logo TEXT,
  category TEXT,
  stream_url TEXT,
  stream_type TEXT DEFAULT 'auto',
  is_hidden INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  sort_order INTEGER,
  is_custom INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_overrides_sort ON channel_overrides(sort_order);

-- جدول تخصيص مصادر الأفلام والمسلسلات العربية (VOD Source Overrides)
CREATE TABLE IF NOT EXISTS vod_source_overrides (
  tmdb_id TEXT PRIMARY KEY,
  title TEXT,
  media_type TEXT DEFAULT 'movie',
  youtube_url TEXT,
  use_youtube_primary INTEGER DEFAULT 0,
  archive_url TEXT,
  use_archive_primary INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vod_source_overrides_updated ON vod_source_overrides(updated_at);

-- جدول تخصيص سلاسل وباقات القنوات (Network Overrides)
CREATE TABLE IF NOT EXISTS network_overrides (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  keywords TEXT,
  sort_order INTEGER,
  is_hidden INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_overrides_sort ON network_overrides(sort_order);
