/**
 * Endpoint: /api/stats
 * Method: GET (Aggregate blog stats for the requested website)
 * Storage: Cloudflare D1 Database
 */

import { getDb } from '../lib/db.js';
import { jsonResponse, errorResponse } from '../lib/cors.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const websiteId =
    request.headers.get('x-website-id') ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  try {
    const db = await getDb(env);

    const [postStats, commentStats] = await Promise.all([
      db
        .prepare(
          `SELECT COALESCE(SUM(views), 0) as totalViews, COALESCE(SUM(likes), 0) as totalLikes
           FROM posts WHERE website_id = ?`
        )
        .bind(websiteId)
        .first(),
      db
        .prepare(`SELECT COUNT(*) as totalComments FROM comments WHERE website_id = ?`)
        .bind(websiteId)
        .first(),
    ]);

    return jsonResponse(
      {
        websiteId,
        totalViews: Number(postStats?.totalViews || 0),
        totalLikes: Number(postStats?.totalLikes || 0),
        totalComments: Number(commentStats?.totalComments || 0),
        timestamp: new Date().toISOString(),
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
