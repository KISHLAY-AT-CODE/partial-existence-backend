/**
 * Database Initialization & Seed Script for SaaS Multi-Tenant Platform
 *
 * Populates sample counts, users, and ensures indexes for:
 * - websiteId: 'partial-existence'
 * - sample user account
 */

import { MongoClient } from 'mongodb';
import crypto from 'crypto';

// Load .env if present
try {
  if (process.loadEnvFile) {
    process.loadEnvFile(new URL('.env', import.meta.url));
  }
} catch {
  // Ignore if .env is missing or already set in process.env
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'partial_existence';
const WEBSITE_ID = process.env.WEBSITE_ID || 'partial-existence';

function hashEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function seed() {
  console.log(`Connecting to MongoDB: ${MONGODB_URI.split('@').pop()} / DB: ${DB_NAME}...`);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // 1. Ensure collections & indexes
  const websitesCol = db.collection('websites');
  const usersCol = db.collection('users');

  await websitesCol.createIndex({ websiteId: 1 }, { unique: true });
  await usersCol.createIndex({ email: 1 }, { unique: true });
  await usersCol.createIndex({ userId: 1 }, { unique: true });

  const now = new Date();
  const sampleEmail = 'kishlay@example.com';
  const sampleUserId = 'usr_kishlay_admin';

  // 2. Seed Default User
  await usersCol.updateOne(
    { email: sampleEmail },
    {
      $set: {
        userId: sampleUserId,
        name: 'Kishlay',
        email: sampleEmail,
        passwordHash: hashPasswordSync('Password123!'),
        websites: [WEBSITE_ID],
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // 3. Seed Website Document
  const initialWebsiteDoc = {
    websiteId: WEBSITE_ID,
    name: 'Partial Existence',
    url: 'https://kishlay-at-code.github.io/partial-existence',
    createdAt: now,
    updatedAt: now,
    posts: {
      'mushishi-review': {
        slug: 'mushishi-review',
        views: 24,
        viewers: ['dev_sample_viewer_1'],
        likes: 12,
        likers: ['dev_sample_viewer_1'],
        comments: [
          {
            id: `cmt_${Date.now()}_seed`,
            userId: sampleUserId,
            author: 'Kishlay',
            isVerified: true,
            emailHash: hashEmail(sampleEmail),
            subscribeUpdates: true,
            text: 'A show where almost nothing is solved, and that is exactly the point.',
            authorToken: null,
            createdAt: now,
          },
        ],
        updatedAt: now,
      },
      'vinyas-journey': {
        slug: 'vinyas-journey',
        views: 18,
        viewers: ['dev_sample_viewer_2'],
        likes: 7,
        likers: ['dev_sample_viewer_2'],
        comments: [],
        updatedAt: now,
      },
    },
  };

  await websitesCol.updateOne(
    { websiteId: WEBSITE_ID },
    {
      $set: initialWebsiteDoc,
    },
    { upsert: true }
  );

  console.log('✅ SaaS Platform collections (websites, users) seeded successfully!');
  await client.close();
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
