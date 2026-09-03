/**
 * Endpoint: GET /api/auth/me
 * Retrieves current authenticated user profile
 */

import { getCollection } from '../../lib/mongodb.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { getAuthenticatedUser } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse('Unauthorized: Please log in', 401, request, env);
  }

  try {
    const usersCol = await getCollection('users', env);
    const user = await usersCol.findOne({ userId: authUser.userId });

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
          createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
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
