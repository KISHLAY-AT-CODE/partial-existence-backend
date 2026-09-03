/**
 * Endpoint: POST /api/auth/login
 * User Sign In for the SaaS platform
 * Storage: Cloudflare D1 Database
 */

import { getAuthDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { verifyPassword, createAuthToken } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, request, env);
  }

  const { email, password } = body;

  if (!email || !password) {
    return errorResponse('Email and password are required', 400, request, env);
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const db = await getAuthDb(env);
    const user = await db
      .prepare(
        `SELECT user_id as userId, name, email, password_hash as passwordHash, created_at as createdAt
         FROM users WHERE email = ?`
      )
      .bind(cleanEmail)
      .first();

    if (!user) {
      return errorResponse('Invalid email or password', 401, request, env);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return errorResponse('Invalid email or password', 401, request, env);
    }

    const token = await createAuthToken(
      { userId: user.userId, email: user.email, name: user.name },
      env?.AUTH_SECRET
    );

    const userPayload = {
      id: user.userId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    const res = jsonResponse(
      {
        success: true,
        user: userPayload,
        token,
      },
      200,
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
    return errorResponse(`Login error: ${err.message}`, 500, request, env);
  }
}
