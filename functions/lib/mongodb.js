/**
 * MongoDB client connection caching for Cloudflare Pages Functions
 */

import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase(env) {
  const uri = env?.MONGODB_URI;
  const dbName = env?.MONGODB_DB_NAME || 'partial_existence';

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getCollection(name, env) {
  const { db } = await connectToDatabase(env);
  return db.collection(name);
}
