/**
 * Endpoint: /api/comments
 * Methods:
 *   GET    (fetch comments for a post OR fetch all comments for blog owner moderation)
 *   POST   (submit a comment — MANDATORY sign-in & English/Hindi/Hinglish/Tamil profanity filter)
 *   DELETE (remove a comment by author OR by verified blog owner/developer)
 * Storage: Cloudflare D1 Database
 */

import { getContentDb } from '../lib/db.js';
import { jsonResponse, errorResponse } from '../lib/cors.js';
import { isValidSlug, validateCommentInput } from '../lib/validation.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { checkProfanity } from '../lib/profanity.js';
import { DEVELOPER_EMAIL } from '../lib/email.js';

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
  const isOwnerView = url.searchParams.get('owner') === 'true';
  const slug = url.searchParams.get('slug');
  const websiteId =
    request.headers.get('x-website-id') ||
    url.searchParams.get('websiteId') ||
    env?.WEBSITE_ID ||
    'partial-existence';

  try {
    const db = await getContentDb(env);

    // 1. Blog Owner Moderation View: List all comments on owner's blogs
    if (isOwnerView) {
      const authUser = await getAuthenticatedUser(request, env);
      if (!authUser) {
        return errorResponse('Unauthorized: Blog owner login required', 401, request, env);
      }

      let commentsQuery;
      let params;

      if (authUser.email === DEVELOPER_EMAIL) {
        // Developer sees comments across all blogs
        commentsQuery = `
          SELECT c.id, c.website_id as websiteId, c.slug, c.user_id as userId,
                 c.author, c.text, c.created_at as date, w.name as websiteName
          FROM comments c
          LEFT JOIN websites w ON c.website_id = w.website_id
          ORDER BY c.created_at DESC
          LIMIT 100
        `;
        params = [];
      } else {
        // Blog owner sees comments on their own blogs
        commentsQuery = `
          SELECT c.id, c.website_id as websiteId, c.slug, c.user_id as userId,
                 c.author, c.text, c.created_at as date, w.name as websiteName
          FROM comments c
          INNER JOIN websites w ON c.website_id = w.website_id
          WHERE w.owner_user_id = ? OR w.admin_email = ? OR (c.website_id = 'partial-existence' AND ? = 'partial-existence')
          ORDER BY c.created_at DESC
          LIMIT 100
        `;
        params = [authUser.userId, authUser.email, websiteId];
      }

      const results = await db.prepare(commentsQuery).bind(...params).all();
      return jsonResponse({ comments: results.results || [] }, 200, request, env);
    }

    // 2. Post Discussion Thread View
    if (!slug || !isValidSlug(slug)) {
      return errorResponse('Valid "slug" query parameter is required', 400, request, env);
    }

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

  // 2. Multi-Language Profanity Filter (English, Hindi, Hinglish, Tamil)
  const profanityCheck = checkProfanity(text);
  if (profanityCheck.hasProfanity) {
    return errorResponse(profanityCheck.message, 400, request, env);
  }

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
      .prepare('SELECT user_id as userId, website_id as websiteId FROM comments WHERE id = ?')
      .bind(id)
      .first();

    if (!targetComment) {
      return errorResponse('Comment not found', 404, request, env);
    }

    // Check Authorization:
    // Allowed if:
    // 1. Author of the comment
    // 2. Developer (dev.vinyas.one@gmail.com)
    // 3. Blog Owner of the website where comment is posted
    const isAuthor = targetComment.userId === authUser.userId;
    const isDeveloper = authUser.email === DEVELOPER_EMAIL;

    let isBlogOwner = false;
    if (!isAuthor && !isDeveloper) {
      const siteOwner = await db
        .prepare('SELECT 1 FROM websites WHERE website_id = ? AND (owner_user_id = ? OR admin_email = ?)')
        .bind(targetComment.websiteId, authUser.userId, authUser.email)
        .first();
      if (siteOwner) isBlogOwner = true;
    }

    if (!isAuthor && !isDeveloper && !isBlogOwner) {
      return errorResponse('Forbidden: You do not have permission to delete this comment', 403, request, env);
    }

    await db
      .prepare('DELETE FROM comments WHERE id = ?')
      .bind(id)
      .run();

    return jsonResponse({ success: true, message: 'Comment deleted successfully', id }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}
