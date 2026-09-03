/**
 * functions/lib/db.js — Cloudflare D1 Dual-Database Helper & Schema Manager
 *
 * Supports:
 * 1. Content & Metrics Store (env.CONTENT_DB || env.DB) -> websites, posts, comments, viewers, likers
 * 2. Dedicated User Identity Store (env.AUTH_DB || env.DB) -> users
 */

let isContentSchemaInitialized = false;
let isAuthSchemaInitialized = false;

const CONTENT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS websites (
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
  );`,
  `CREATE TABLE IF NOT EXISTS posts (
    website_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (website_id, slug)
  );`,
  `CREATE TABLE IF NOT EXISTS viewers (
    website_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    device_id TEXT NOT NULL,
    viewed_at TEXT NOT NULL,
    PRIMARY KEY (website_id, slug, device_id)
  );`,
  `CREATE TABLE IF NOT EXISTS likers (
    website_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    device_id TEXT NOT NULL,
    liked_at TEXT NOT NULL,
    PRIMARY KEY (website_id, slug, device_id)
  );`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    user_id TEXT NOT NULL,
    author TEXT NOT NULL,
    is_verified INTEGER DEFAULT 1,
    email_hash TEXT,
    subscribe_updates INTEGER DEFAULT 0,
    text TEXT NOT NULL,
    author_token TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(website_id, slug, created_at DESC);`
];

const AUTH_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    website_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`
];

/**
 * Get Content & Metrics D1 Database (env.CONTENT_DB or env.DB)
 * @param {object} env - Cloudflare Pages environment
 * @returns {Promise<D1Database>}
 */
export async function getContentDb(env) {
  const db = env?.CONTENT_DB || env?.DB;
  if (!db) {
    throw new Error(
      'Cloudflare D1 binding "DB" (or "CONTENT_DB") is missing. Please add a D1 database binding named "DB" in Cloudflare Pages Settings > Functions > D1 Database Bindings.'
    );
  }

  if (!isContentSchemaInitialized) {
    for (const stmt of CONTENT_STATEMENTS) {
      try {
        await db.prepare(stmt).run();
      } catch (err) {
        // Table or index may already exist
      }
    }
    isContentSchemaInitialized = true;
  }

  return db;
}

/**
 * Get Dedicated Auth/User D1 Database (env.AUTH_DB or env.DB)
 * @param {object} env - Cloudflare Pages environment
 * @returns {Promise<D1Database>}
 */
export async function getAuthDb(env) {
  const db = env?.AUTH_DB || env?.DB;
  if (!db) {
    throw new Error(
      'Cloudflare D1 binding "AUTH_DB" (or "DB") is missing. Please add a D1 database binding named "DB" in Cloudflare Pages Settings > Functions > D1 Database Bindings.'
    );
  }

  if (!isAuthSchemaInitialized) {
    for (const stmt of AUTH_STATEMENTS) {
      try {
        await db.prepare(stmt).run();
      } catch (err) {
        // Table or index may already exist
      }
    }
    isAuthSchemaInitialized = true;
  }

  return db;
}

/**
 * Unified alias for content/metrics operations
 */
export async function getDb(env) {
  return getContentDb(env);
}
