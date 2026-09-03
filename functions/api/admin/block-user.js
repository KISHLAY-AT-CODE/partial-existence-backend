/**
 * Endpoint: /api/admin/block-user
 * Methods:
 *   GET    - List blocked users for blog owner
 *   POST   - Block a user from commenting on a website
 *   DELETE - Unblock a user
 */

import { getContentDb } from '../../lib/db.js';
import { getAuthenticatedUser } from '../../lib/auth.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { DEVELOPER_EMAIL } from '../../lib/email.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser) {
    return errorResponse('Unauthorized: Blog owner login required', 401, request, env);
  }

  const url = new URL(request.url);
  const websiteId = url.searchParams.get('websiteId');

  try {
    const db = await getContentDb(env);
    let query;
    let params;

    if (authUser.email === DEVELOPER_EMAIL) {
      query = `SELECT b.website_id as websiteId, b.user_id as userId, b.email, b.reason, b.created_at as createdAt, w.name as websiteName
               FROM blocked_users b LEFT JOIN websites w ON b.website_id = w.website_id ORDER BY b.created_at DESC`;
      params = [];
    } else {
      query = `SELECT b.website_id as websiteId, b.user_id as userId, b.email, b.reason, b.created_at as createdAt, w.name as websiteName
               FROM blocked_users b INNER JOIN websites w ON b.website_id = w.website_id
               WHERE w.owner_user_id = ? OR w.admin_email = ? ORDER BY b.created_at DESC`;
      params = [authUser.userId, authUser.email];
    }

    const results = await db.prepare(query).bind(...params).all();
    return jsonResponse({ blockedUsers: results.results || [] }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser) {
    return errorResponse('Unauthorized: Blog owner login required to block users', 401, request, env);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON payload required', 400, request, env);
  }

  const { websiteId, userId, email, reason = 'Vulgar/abusive comments' } = body;
  if (!websiteId || !userId) {
    return errorResponse('websiteId and userId are required', 400, request, env);
  }

  const now = new Date().toISOString();

  try {
    const db = await getContentDb(env);

    // Verify ownership
    if (authUser.email !== DEVELOPER_EMAIL) {
      const site = await db
        .prepare('SELECT 1 FROM websites WHERE website_id = ? AND (owner_user_id = ? OR admin_email = ?)')
        .bind(websiteId, authUser.userId, authUser.email)
        .first();

      if (!site) {
        return errorResponse('Forbidden: You can only block users on your own blogs', 403, request, env);
      }
    }

    // Insert block record
    await db
      .prepare(
        `INSERT INTO blocked_users (website_id, user_id, email, blocked_by, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(website_id, user_id) DO UPDATE SET
           reason = excluded.reason,
           created_at = excluded.created_at`
      )
      .bind(websiteId, userId, email || '', authUser.email, reason, now)
      .run();

    return jsonResponse({ success: true, message: `User ${userId} has been blocked from commenting on ${websiteId}` }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser) {
    return errorResponse('Unauthorized: Blog owner login required to unblock users', 401, request, env);
  }

  const url = new URL(request.url);
  const websiteId = url.searchParams.get('websiteId');
  const userId = url.searchParams.get('userId');

  if (!websiteId || !userId) {
    return errorResponse('websiteId and userId query parameters are required', 400, request, env);
  }

  try {
    const db = await getContentDb(env);

    // Verify ownership
    if (authUser.email !== DEVELOPER_EMAIL) {
      const site = await db
        .prepare('SELECT 1 FROM websites WHERE website_id = ? AND (owner_user_id = ? OR admin_email = ?)')
        .bind(websiteId, authUser.userId, authUser.email)
        .first();

      if (!site) {
        return errorResponse('Forbidden: You can only unblock users on your own blogs', 403, request, env);
      }
    }

    await db
      .prepare('DELETE FROM blocked_users WHERE website_id = ? AND user_id = ?')
      .bind(websiteId, userId)
      .run();

    return jsonResponse({ success: true, message: `User ${userId} has been unblocked on ${websiteId}` }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
