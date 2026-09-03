/**
 * Endpoint: POST /api/auth/register
 * Register a new user in the platform
 * Storage: Cloudflare D1 Database
 */

import { getDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { hashPassword, createAuthToken } from '../../lib/auth.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, env);
  }

  const { name, email, password, websiteId = 'partial-existence' } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return errorResponse('Name must be at least 2 characters long', 400, request, env);
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return errorResponse('Valid email address is required', 400, request, env);
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return errorResponse('Password must be at least 6 characters long', 400, request, env);
  }

  const cleanName = name.trim().slice(0, 50);
  const cleanEmail = email.trim().toLowerCase();

  try {
    const db = await getDb(env);

    const existingUser = await db
      .prepare('SELECT user_id FROM users WHERE email = ?')
      .bind(cleanEmail)
      .first();

    if (existingUser) {
      return errorResponse('An account with this email already exists. Please sign in.', 409, request, env);
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO users (user_id, name, email, password_hash, website_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, cleanName, cleanEmail, passwordHash, websiteId, now, now)
      .run();

    // Create session token
    const token = await createAuthToken(
      { userId, email: cleanEmail, name: cleanName },
      env?.AUTH_SECRET
    );

    const userPayload = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      createdAt: now,
    };

    const res = jsonResponse(
      {
        success: true,
        user: userPayload,
        token,
      },
      201,
      request,
      env
    );

    // Set cookie: pe_auth_token
    const secureFlag = request.url.startsWith('https') ? 'Secure;' : '';
    res.headers.set(
      'Set-Cookie',
      `pe_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax; ${secureFlag}`
    );

    return res;
  } catch (err) {
    return errorResponse(`Registration error: ${err.message}`, 500, request, env);
  }
}
