-- Cloudflare D1 Database Schema for Partial Existence SaaS Blog

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

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(website_id, slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
