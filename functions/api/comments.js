/**
 * Endpoint: /api/comments
 * Methods:
 *   GET    (fetch verified comments for a post)
 *   POST   (submit a comment — MANDATORY sign-in required)
 *   DELETE (remove a comment by authenticated author)
 * Storage: Cloudflare D1 Database
 */

import { getContentDb } from '../lib/db.js';
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
    const db = await getContentDb(env);
    const queryResult = await db
      .prepare(
        `SELECT id, slug, user_id as userId, author, is_verified as isVerified,
                email_hash as emailHash, subscribe_updates as subscribeUpdates,
                text, created_at as date
         FROM comments
         WHERE website_id = ? AND slug = ?
         ORDER BY created_at DESC`
      )
      .bind(websiteId, slug)
      .all();

    const comments = (queryResult.results || []).map((c) => ({
      id: c.id,
      slug: c.slug,
      userId: c.userId,
      author: c.author,
      isVerified: Boolean(c.isVerified),
      emailHash: c.emailHash || null,
      subscribeUpdates: Boolean(c.subscribeUpdates),
      text: c.text,
      date: c.date,
    }));

    return jsonResponse(
      {
        websiteId,
        slug,
        comments,
        count: comments.length,
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

  // 1. Enforce Mandatory Authentication
  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse(
      'Authentication required. Please sign in or register to join the discussion.',
      401,
      request,
      env
    );
  }

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

  const validation = validateCommentInput({
    ...body,
    author: authUser.name,
    email: authUser.email,
  });

  if (!validation.valid) {
    return errorResponse(validation.error, 400, request, env);
  }

  const { slug, text, subscribeUpdates } = validation.data;
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();
  const emailHash = await sha256Hex(authUser.email);

  try {
    const db = await getContentDb(env);

    await db
      .prepare(
        `INSERT INTO comments (id, website_id, slug, user_id, author, is_verified, email_hash, subscribe_updates, text, author_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        commentId,
        websiteId,
        slug,
        authUser.userId,
        authUser.name,
        1, // Verified user account
        emailHash,
        subscribeUpdates ? 1 : 0,
        text,
        authUser.userId,
        now
      )
      .run();

    return jsonResponse(
      {
        success: true,
        comment: {
          id: commentId,
          slug,
          userId: authUser.userId,
          author: authUser.name,
          isVerified: true,
          emailHash,
          subscribeUpdates: Boolean(subscribeUpdates),
          text,
          date: now,
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
  const websiteId =
    request.headers.get('x-website-id') ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  if (!id || typeof id !== 'string') {
    return errorResponse('Valid "id" parameter is required', 400, request, env);
  }

  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse('Unauthorized: You must be logged in to delete comments', 401, request, env);
  }

  try {
    const db = await getContentDb(env);

    const targetComment = await db
      .prepare('SELECT user_id as userId FROM comments WHERE id = ? AND website_id = ?')
      .bind(id, websiteId)
      .first();

    if (!targetComment) {
      return errorResponse('Comment not found', 404, request, env);
    }

    if (targetComment.userId !== authUser.userId) {
      return errorResponse('Forbidden: You can only delete your own comments', 403, request, env);
    }

    await db
      .prepare('DELETE FROM comments WHERE id = ? AND website_id = ?')
      .bind(id, websiteId)
      .run();

    return jsonResponse({ success: true, message: 'Comment deleted', id }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
