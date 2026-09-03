/**
 * Endpoint: /api/comments
 * Methods:
 *   GET    (fetch comments for a post)
 *   POST   (submit a comment — authenticated or guest)
 *   DELETE (remove a comment)
 * Multi-tenant SaaS with verified author support.
 */

import { getCollection } from '../lib/mongodb.js';
import { jsonResponse, errorResponse } from '../lib/cors.js';
import { isValidSlug, validateCommentInput } from '../lib/validation.js';
import { getAuthenticatedUser } from '../lib/auth.js';

async function sha256Hex(str) {
  if (!str) return null;
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    return errorResponse('Valid "slug" query parameter is required', 400, request, env);
  }

  try {
    const col = await getCollection('websites', env);
    const websiteDoc = await col.findOne(
      { websiteId },
      { projection: { [`posts.${slug}.comments`]: 1 } }
    );

    const comments = (websiteDoc?.posts?.[slug]?.comments || []).slice().reverse();
    const formatted = comments.map((c) => ({
      id: c.id,
      slug,
      userId: c.userId || null,
      author: c.author,
      isVerified: Boolean(c.isVerified),
      emailHash: c.emailHash || null,
      subscribeUpdates: Boolean(c.subscribeUpdates),
      text: c.text,
      date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    }));

    return jsonResponse(
      {
        websiteId,
        slug,
        comments: formatted,
        count: formatted.length,
      },
      200,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

async function verifyRecaptcha(token, env) {
  const secretKey = env?.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return false;
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON payload required', 400, request, env);
  }

  const websiteId =
    request.headers.get('x-website-id') ||
    body.websiteId ||
    env?.WEBSITE_ID ||
    'partial-existence';

  const authUser = await getAuthenticatedUser(request, env);

  const validation = validateCommentInput(body);
  if (!validation.valid) {
    return errorResponse(validation.error, 400, request, env);
  }

  // If not authenticated, require reCAPTCHA verification
  if (!authUser) {
    const isHuman = await verifyRecaptcha(body.recaptchaToken, env);
    if (!isHuman) {
      return errorResponse('reCAPTCHA verification failed. Please complete the captcha.', 400, request, env);
    }
  }

  const { slug, author, text, email, subscribeUpdates } = validation.data;
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();

  // Determine author attributes: authenticated vs guest
  const authorName = authUser ? authUser.name : author;
  const emailToHash = authUser ? authUser.email : email;
  const emailHash = await sha256Hex(emailToHash);

  const commentDoc = {
    id: commentId,
    userId: authUser ? authUser.userId : null,
    author: authorName,
    isVerified: Boolean(authUser),
    emailHash,
    subscribeUpdates: Boolean(subscribeUpdates),
    text,
    authorToken: body.authorToken ? String(body.authorToken).slice(0, 100) : null,
    createdAt: now,
  };

  try {
    const col = await getCollection('websites', env);
    await col.updateOne(
      { websiteId },
      {
        $push: { [`posts.${slug}.comments`]: commentDoc },
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
      { upsert: true }
    );

    return jsonResponse(
      {
        success: true,
        comment: {
          id: commentId,
          slug,
          userId: commentDoc.userId,
          author: commentDoc.author,
          isVerified: commentDoc.isVerified,
          emailHash: commentDoc.emailHash,
          subscribeUpdates: commentDoc.subscribeUpdates,
          text,
          date: now.toISOString(),
        },
      },
      201,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token') || request.headers.get('x-author-token');
  const websiteId =
    request.headers.get('x-website-id') ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  if (!id || typeof id !== 'string') {
    return errorResponse('Valid "id" parameter is required', 400, request, env);
  }

  const authUser = await getAuthenticatedUser(request, env);

  if (!token && !authUser) {
    return errorResponse('Unauthorized: Author token or user login required to delete comment', 401, request, env);
  }

  try {
    const col = await getCollection('websites', env);
    const websiteDoc = await col.findOne({ websiteId });

    if (!websiteDoc || !websiteDoc.posts) {
      return errorResponse('Comment not found', 404, request, env);
    }

    let foundPostSlug = null;
    let targetComment = null;

    for (const [postSlug, postData] of Object.entries(websiteDoc.posts)) {
      if (Array.isArray(postData?.comments)) {
        const c = postData.comments.find((item) => item.id === id);
        if (c) {
          foundPostSlug = postSlug;
          targetComment = c;
          break;
        }
      }
    }

    if (!targetComment) {
      return errorResponse('Comment not found', 404, request, env);
    }

    // Ownership check: match authenticated user ID OR matching author token
    const isOwner =
      (authUser && targetComment.userId === authUser.userId) ||
      (token && targetComment.authorToken === token);

    if (!isOwner) {
      return errorResponse('Forbidden: You can only delete your own comments', 403, request, env);
    }

    await col.updateOne(
      { websiteId },
      {
        $pull: { [`posts.${foundPostSlug}.comments`]: { id } },
        $set: { updatedAt: new Date() },
      }
    );

    return jsonResponse({ success: true, message: 'Comment deleted', id }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
