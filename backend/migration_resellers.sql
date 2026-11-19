-- إنشاء جدول الموزعين (Resellers)
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

-- إضافة عمود الموزع لجدول الاشتراكات
ALTER TABLE subscriptions ADD COLUMN reseller_id INTEGER DEFAULT NULL;

-- إنشاء فهارس الموزعين لتسريع الاستعلام
CREATE INDEX IF NOT EXISTS idx_subscriptions_reseller_id ON subscriptions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_resellers_username ON resellers(username);
CREATE INDEX IF NOT EXISTS idx_resellers_email ON resellers(email);
