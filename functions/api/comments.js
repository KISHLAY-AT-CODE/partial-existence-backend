/**
 * Endpoint: /api/comments
 * Methods:
 *   GET    (fetch comments for a post)
 *   POST   (submit a comment — authenticated or guest with recaptcha)
 *   DELETE (remove a comment by owner)
 * Storage: Cloudflare D1 Database
 */

import { getDb } from '../lib/db.js';
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

async function verifyRecaptcha(token, env) {
  const secretKey = env?.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return true; // If no captcha key configured, pass
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
    const db = await getDb(env);
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
      userId: c.userId || null,
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

  // If not authenticated, verify reCAPTCHA if secret key is configured
  if (!authUser && env?.RECAPTCHA_SECRET_KEY) {
    const isHuman = await verifyRecaptcha(body.recaptchaToken, env);
    if (!isHuman) {
      return errorResponse('reCAPTCHA verification failed. Please complete the captcha.', 400, request, env);
    }
  }

  const { slug, author, text, email, subscribeUpdates } = validation.data;
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const authorName = authUser ? authUser.name : author;
  const emailToHash = authUser ? authUser.email : email;
  const emailHash = await sha256Hex(emailToHash);
  const authorToken = body.authorToken ? String(body.authorToken).slice(0, 100) : null;

  try {
    const db = await getDb(env);

    await db
      .prepare(
        `INSERT INTO comments (id, website_id, slug, user_id, author, is_verified, email_hash, subscribe_updates, text, author_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        commentId,
        websiteId,
        slug,
        authUser ? authUser.userId : null,
        authorName,
        authUser ? 1 : 0,
        emailHash,
        subscribeUpdates ? 1 : 0,
        text,
        authorToken,
        now
      )
      .run();

    return jsonResponse(
      {
        success: true,
        comment: {
          id: commentId,
          slug,
          userId: authUser ? authUser.userId : null,
          author: authorName,
          isVerified: Boolean(authUser),
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
    const db = await getDb(env);

    const targetComment = await db
      .prepare('SELECT user_id as userId, author_token as authorToken FROM comments WHERE id = ? AND website_id = ?')
      .bind(id, websiteId)
      .first();

    if (!targetComment) {
      return errorResponse('Comment not found', 404, request, env);
    }

    const isOwner =
      (authUser && targetComment.userId === authUser.userId) ||
      (token && targetComment.authorToken === token);

    if (!isOwner) {
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
