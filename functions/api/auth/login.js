/**
 * Endpoint: POST /api/auth/login
 * User Sign In for the SaaS platform
 */

import { getCollection } from '../../lib/mongodb.js';
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

  const { email, password, websiteId = 'partial-existence' } = body;

  if (!email || !password) {
    return errorResponse('Email and password are required', 400, request, env);
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const usersCol = await getCollection('users', env);
    const user = await usersCol.findOne({ email: cleanEmail });

    if (!user) {
      return errorResponse('Invalid email or password', 401, request, env);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return errorResponse('Invalid email or password', 401, request, env);
    }

    // Associate website with user if not already present
    if (websiteId && Array.isArray(user.websites) && !user.websites.includes(websiteId)) {
      await usersCol.updateOne({ userId: user.userId }, { $addToSet: { websites: websiteId } });
    }

    const token = await createAuthToken(
      { userId: user.userId, email: user.email, name: user.name },
      env?.AUTH_SECRET
    );

    const userPayload = {
      id: user.userId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
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
