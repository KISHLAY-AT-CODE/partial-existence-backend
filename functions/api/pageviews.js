/**
 * Endpoint: /api/pageviews
 * Methods: GET (query view count), POST (record a unique pageview per device)
 * Multi-tenant SaaS with device deduplication.
 */

import { getCollection } from '../lib/mongodb.js';
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
    const col = await getCollection('websites', env);
    const websiteDoc = await col.findOne(
      { websiteId },
      { projection: { [`posts.${slug}.views`]: 1 } }
    );

    const views = websiteDoc?.posts?.[slug]?.views || 0;

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
    const col = await getCollection('websites', env);
    const now = new Date();

    // Check if device already viewed this post to prevent redundant view increments
    const existingDoc = await col.findOne(
      { websiteId },
      { projection: { [`posts.${slug}.viewers`]: 1, [`posts.${slug}.views`]: 1 } }
    );

    const currentPost = existingDoc?.posts?.[slug];
    const viewers = currentPost?.viewers || [];
    const hasViewed = viewers.includes(deviceId);

    let updatedViews = currentPost?.views || 0;

    if (!hasViewed) {
      const result = await col.findOneAndUpdate(
        { websiteId },
        {
          $inc: { [`posts.${slug}.views`]: 1 },
          $addToSet: { [`posts.${slug}.viewers`]: deviceId },
          $set: {
            updatedAt: now,
            [`posts.${slug}.slug`]: slug,
            [`posts.${slug}.updatedAt`]: now,
          },
          $setOnInsert: {
            websiteId,
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      const doc = result?.value || result;
      updatedViews = doc?.posts?.[slug]?.views || 1;
    }

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
