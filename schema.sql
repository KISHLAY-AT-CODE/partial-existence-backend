CREATE TABLE IF NOT EXISTS websites (
  website_id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sample_post_url TEXT,
  post_path_pattern TEXT,
  allowed_origins TEXT,
  admin_email TEXT,
  status TEXT DEFAULT 'pending',
  verification_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  website_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (website_id, slug)
);

CREATE TABLE IF NOT EXISTS viewers (
  website_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  device_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (website_id, slug, device_id)
);

CREATE TABLE IF NOT EXISTS likers (
  website_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  device_id TEXT NOT NULL,
  liked_at TEXT NOT NULL,
  PRIMARY KEY (website_id, slug, device_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  user_id TEXT,
  author TEXT NOT NULL,
  is_verified INTEGER DEFAULT 0,
  email_hash TEXT,
  subscribe_updates INTEGER DEFAULT 0,
  text TEXT NOT NULL,
  author_token TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  website_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profanity_words (
  word TEXT PRIMARY KEY,
  language TEXT DEFAULT 'unknown',
  category TEXT DEFAULT 'general',
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_users (
  website_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  blocked_by TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (website_id, user_id)
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip TEXT NOT NULL,
  website_id TEXT NOT NULL,
  user_id TEXT,
  blocked_by TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (ip, website_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(website_id, slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profanity_words ON profanity_words(word);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_lookup ON blocked_ips(website_id, ip);
CREATE INDEX IF NOT EXISTS idx_blocked_users_lookup ON blocked_users(website_id, user_id);
