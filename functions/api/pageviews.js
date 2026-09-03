/**
 * Endpoint: /api/pageviews
 * Methods: GET (query view count), POST (record a unique pageview per device)
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
      .prepare('SELECT views FROM posts WHERE website_id = ? AND slug = ?')
      .bind(websiteId, slug)
      .first();

    const views = row ? Number(row.views || 0) : 0;

    return jsonResponse(
      {
        websiteId,
        slug,
        views,
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
    // Body may be empty
  }

  const slug = body.slug || url.searchParams.get('slug');
  const websiteId =
    request.headers.get('x-website-id') ||
    body.websiteId ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  const deviceId =
    request.headers.get('x-device-id') ||
    body.deviceId ||
    url.searchParams.get('deviceId') ||
    'anonymous_device';

  if (!slug || !isValidSlug(slug)) {
    return errorResponse('Valid "slug" is required to record a pageview', 400, request, env);
  }

  try {
    const db = await getDb(env);
    const now = new Date().toISOString();

    // Check if device already viewed this post
    const viewer = await db
      .prepare('SELECT device_id FROM viewers WHERE website_id = ? AND slug = ? AND device_id = ?')
      .bind(websiteId, slug, deviceId)
      .first();

    const hasViewed = Boolean(viewer);

    if (!hasViewed) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO posts (website_id, slug, views, likes, created_at, updated_at)
             VALUES (?, ?, 1, 0, ?, ?)
             ON CONFLICT(website_id, slug) DO UPDATE SET views = views + 1, updated_at = ?`
          )
          .bind(websiteId, slug, now, now, now),
        db
          .prepare(
            `INSERT OR IGNORE INTO viewers (website_id, slug, device_id, viewed_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(websiteId, slug, deviceId, now),
      ]);
    }

    const post = await db
      .prepare('SELECT views FROM posts WHERE website_id = ? AND slug = ?')
      .bind(websiteId, slug)
      .first();

    const updatedViews = post ? Number(post.views || 0) : 1;

    return jsonResponse(
      {
        success: true,
        websiteId,
        slug,
        views: updatedViews,
        isNewView: !hasViewed,
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
