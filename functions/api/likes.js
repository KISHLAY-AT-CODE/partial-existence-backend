/**
 * Endpoint: /api/likes
 * Methods: GET (query like count), POST (like or unlike a post)
 * Storage: Cloudflare D1 Database
 */

import { getDb } from '../lib/db.js';
import { jsonResponse, errorResponse } from '../lib/cors.js';
import { isValidSlug } from '../lib/validation.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const websiteId =
    request.headers.get('x-website-id') ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  if (!slug || !isValidSlug(slug)) {
    return errorResponse('Valid "slug" parameter is required', 400, request, env);
  }

  try {
    const db = await getDb(env);
    const row = await db
      .prepare('SELECT likes FROM posts WHERE website_id = ? AND slug = ?')
      .bind(websiteId, slug)
      .first();

    const likes = row ? Math.max(0, Number(row.likes || 0)) : 0;

    return jsonResponse(
      {
        websiteId,
        slug,
        likes,
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON body required', 400, request, env);
  }

  const { slug, action } = body;
  const websiteId =
    request.headers.get('x-website-id') ||
    body.websiteId ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  const deviceId =
    request.headers.get('x-device-id') ||
    body.deviceId ||
    'anonymous_device';

  if (!slug || !isValidSlug(slug)) {
    return errorResponse('Valid "slug" is required', 400, request, env);
  }

  const isUnlike = action === 'unlike' || action === 'decrement' || body.liked === false;
  const now = new Date().toISOString();

  try {
    const db = await getDb(env);

    if (isUnlike) {
      await db.batch([
        db
          .prepare(
            `UPDATE posts SET likes = MAX(0, likes - 1), updated_at = ?
             WHERE website_id = ? AND slug = ?`
          )
          .bind(now, websiteId, slug),
        db
          .prepare(
            `DELETE FROM likers WHERE website_id = ? AND slug = ? AND device_id = ?`
          )
          .bind(websiteId, slug, deviceId),
      ]);
    } else {
      await db.batch([
        db
          .prepare(
            `INSERT INTO posts (website_id, slug, views, likes, created_at, updated_at)
             VALUES (?, ?, 0, 1, ?, ?)
             ON CONFLICT(website_id, slug) DO UPDATE SET likes = likes + 1, updated_at = ?`
          )
          .bind(websiteId, slug, now, now, now),
        db
          .prepare(
            `INSERT OR IGNORE INTO likers (website_id, slug, device_id, liked_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(websiteId, slug, deviceId, now),
      ]);
    }

    const post = await db
      .prepare('SELECT likes FROM posts WHERE website_id = ? AND slug = ?')
      .bind(websiteId, slug)
      .first();

    const updatedLikes = post ? Math.max(0, Number(post.likes || 0)) : 0;

    return jsonResponse(
      {
        success: true,
        websiteId,
        slug,
        likes: updatedLikes,
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
