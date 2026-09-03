/**
 * Endpoint: GET /api/auth/me
 * Retrieves current authenticated user profile
 * Storage: Cloudflare D1 Database
 */

import { getAuthDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { getAuthenticatedUser } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse('Unauthorized: Please log in', 401, request, env);
  }

  try {
    const db = await getAuthDb(env);
    const user = await db
      .prepare('SELECT user_id as userId, name, email, created_at as createdAt FROM users WHERE user_id = ?')
      .bind(authUser.userId)
      .first();

    if (!user) {
      return errorResponse('User account not found', 404, request, env);
    }

    return jsonResponse(
      {
        authenticated: true,
        user: {
          id: user.userId,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
