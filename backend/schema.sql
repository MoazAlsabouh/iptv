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
