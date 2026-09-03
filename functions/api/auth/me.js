/**
 * Endpoint: /api/auth/me
 * Methods:
 *   GET    - Retrieves current authenticated user profile
 *   DELETE - Permanently deletes authenticated user account and data
 */

import { getAuthDb, getContentDb } from '../../lib/db.js';
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

export async function onRequestDelete(context) {
  const { request, env } = context;

  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse('Unauthorized: Please log in to delete account', 401, request, env);
  }

  try {
    const authDb = await getAuthDb(env);
    const contentDb = await getContentDb(env);

    // 1. Delete user from auth database
    await authDb
      .prepare('DELETE FROM users WHERE user_id = ? OR email = ?')
      .bind(authUser.userId, authUser.email)
      .run();

    // 2. Delete/cleanup user's comments from content database
    await contentDb
      .prepare('DELETE FROM comments WHERE user_id = ?')
      .bind(authUser.userId)
      .run();

    const res = jsonResponse(
      {
        success: true,
        message: 'Your account and associated reflections have been permanently deleted.',
      },
      200,
      request,
      env
    );

    // Clear session cookies
    const secureFlag = request.url.startsWith('https') ? 'Secure;' : '';
    res.headers.set(
      'Set-Cookie',
      `pe_auth_token=; Path=/; Max-Age=0; SameSite=Lax; ${secureFlag}`
    );

    return res;
  } catch (err) {
    return errorResponse(`Account deletion error: ${err.message}`, 500, request, env);
  }
}
