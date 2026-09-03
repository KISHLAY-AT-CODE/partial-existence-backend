/**
 * Endpoint: /api/stats
 * Method: GET (Aggregate blog stats for the requested website)
 */

import { getCollection } from '../lib/mongodb.js';
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
    const col = await getCollection('websites', env);
    const websiteDoc = await col.findOne({ websiteId });

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    if (websiteDoc?.posts) {
      for (const post of Object.values(websiteDoc.posts)) {
        totalViews += Number(post.views || 0);
        totalLikes += Number(post.likes || 0);
        if (Array.isArray(post.comments)) {
          totalComments += post.comments.length;
        }
      }
    }

    return jsonResponse(
      {
        websiteId,
        totalViews,
        totalLikes,
        totalComments,
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
