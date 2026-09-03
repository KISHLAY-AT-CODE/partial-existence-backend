/**
 * Endpoint: /api/likes
 * Methods: GET (query like count), POST (like or unlike a post)
 * Multi-tenant SaaS with device/user tracking.
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
      { projection: { [`posts.${slug}.likes`]: 1 } }
    );

    const likes = Math.max(0, websiteDoc?.posts?.[slug]?.likes || 0);

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
  const incrementValue = isUnlike ? -1 : 1;

  try {
    const col = await getCollection('websites', env);

    if (isUnlike) {
      const existingDoc = await col.findOne(
        { websiteId },
        { projection: { [`posts.${slug}.likes`]: 1 } }
      );
      const currentLikes = existingDoc?.posts?.[slug]?.likes || 0;
      if (currentLikes <= 0) {
        return jsonResponse({ success: true, websiteId, slug, likes: 0 }, 200, request, env);
      }
    }

    const now = new Date();
    const updateOp = isUnlike
      ? {
          $inc: { [`posts.${slug}.likes`]: incrementValue },
          $pull: { [`posts.${slug}.likers`]: deviceId },
          $set: {
            updatedAt: now,
            [`posts.${slug}.slug`]: slug,
            [`posts.${slug}.updatedAt`]: now,
          },
          $setOnInsert: {
            websiteId,
            createdAt: now,
          },
        }
      : {
          $inc: { [`posts.${slug}.likes`]: incrementValue },
          $addToSet: { [`posts.${slug}.likers`]: deviceId },
          $set: {
            updatedAt: now,
            [`posts.${slug}.slug`]: slug,
            [`posts.${slug}.updatedAt`]: now,
          },
          $setOnInsert: {
            websiteId,
            createdAt: now,
          },
        };

    const result = await col.findOneAndUpdate(
      { websiteId },
      updateOp,
      { upsert: true, returnDocument: 'after' }
    );

    const doc = result?.value || result;
    const updatedLikes = Math.max(0, doc?.posts?.[slug]?.likes || 0);

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
