/**
 * Endpoint: /api/comments
 * Methods:
 *   GET    (fetch approved comments for blog post OR all comments for blog owner moderation)
 *   POST   (submit a comment — holds flagged comments for blog owner review)
 *   PUT    (approve a held comment by blog owner)
 *   DELETE (delete a comment by author OR blog owner)
 * Storage: Cloudflare D1 Database
 */

import { getContentDb } from '../lib/db.js';
import { jsonResponse, errorResponse } from '../lib/cors.js';
import { isValidSlug, validateCommentInput } from '../lib/validation.js';
import { getAuthenticatedUser } from '../lib/auth.js';
import { detectProfanity3Stage, checkProfanity } from '../lib/profanity.js';
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

    // 1. Blog Owner Moderation View: List all comments (approved and held) on owner's blogs
    if (isOwnerView) {
      const authUser = await getAuthenticatedUser(request, env);
      if (!authUser) {
        return errorResponse('Unauthorized: Blog owner login required', 401, request, env);
      }

      let commentsQuery;
      let params;

      if (authUser.email === DEVELOPER_EMAIL) {
        commentsQuery = `
          SELECT c.id, c.website_id as websiteId, c.slug, c.user_id as userId,
                 c.author, c.text, c.status, c.flagged_reason as flaggedReason,
                 c.created_at as date, w.name as websiteName
          FROM comments c
          LEFT JOIN websites w ON c.website_id = w.website_id
          ORDER BY (CASE WHEN c.status = 'held_for_review' THEN 0 ELSE 1 END), c.created_at DESC
          LIMIT 150
        `;
        params = [];
      } else {
        commentsQuery = `
          SELECT c.id, c.website_id as websiteId, c.slug, c.user_id as userId,
                 c.author, c.text, c.status, c.flagged_reason as flaggedReason,
                 c.created_at as date, w.name as websiteName
          FROM comments c
          INNER JOIN websites w ON c.website_id = w.website_id
          WHERE w.owner_user_id = ? OR w.admin_email = ? OR (c.website_id = 'partial-existence' AND ? = 'partial-existence')
          ORDER BY (CASE WHEN c.status = 'held_for_review' THEN 0 ELSE 1 END), c.created_at DESC
          LIMIT 150
        `;
        params = [authUser.userId, authUser.email, websiteId];
      }

      const results = await db.prepare(commentsQuery).bind(...params).all();
      return jsonResponse({ comments: results.results || [] }, 200, request, env);
    }

    // 2. Public Blog Readers: Only return 'approved' comments
    if (!slug || !isValidSlug(slug)) {
      return errorResponse('Valid "slug" query parameter is required', 400, request, env);
    }

    const queryResult = await db
      .prepare(
        `SELECT id, slug, user_id as userId, author, is_verified as isVerified,
                email_hash as emailHash, subscribe_updates as subscribeUpdates,
                text, created_at as date
         FROM comments
         WHERE website_id = ? AND slug = ? AND (status = 'approved' OR status IS NULL)
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

  // 1. Enforce Authentication
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

  try {
    const db = await getContentDb(env);

    // 2. Check if user is blocked by blog owner
    const isBlocked = await db
      .prepare('SELECT 1 FROM blocked_users WHERE website_id = ? AND user_id = ?')
      .bind(websiteId, authUser.userId)
      .first();

    if (isBlocked) {
      return errorResponse('You have been blocked from commenting on this blog by the blog owner.', 403, request, env);
    }

    // 3. 3-Stage Multi-Language & AI Profanity Shield
    const profanityResult = await detectProfanity3Stage(text, { db, isMongo: false, env });
    if (profanityResult.hasProfanity) {
      return jsonResponse(
        {
          success: false,
          isProfanity: true,
          stage: profanityResult.stage,
          title: profanityResult.title || 'Content Policy & Account Warning',
          message: profanityResult.message || 'Inappropriate or offensive language was detected in your comment.',
          warning:
            profanityResult.warning ||
            'Warning: Inappropriate or offensive language detected. Please adhere to community guidelines. Your account will be permanently blocked if this behavior continues.',
          accountNotice:
            profanityResult.accountNotice ||
            'Strict Policy: Repeated profanity or abusive language will lead to immediate account suspension and blocking across all discussions.',
          error:
            profanityResult.warning ||
            profanityResult.message ||
            'Warning: Inappropriate or offensive language detected. Continued violations will result in your account being blocked.',
          detectedWords: profanityResult.detectedWords,
        },
        400,
        request,
        env
      );
    }

    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const emailHash = await sha256Hex(authUser.email);

    await db
      .prepare(
        `INSERT INTO comments (id, website_id, slug, user_id, author, is_verified, email_hash, subscribe_updates, text, author_token, status, flagged_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        commentId,
        websiteId,
        slug,
        authUser.userId,
        authUser.name,
        1,
        emailHash,
        subscribeUpdates ? 1 : 0,
        text,
        authUser.userId,
        'approved',
        null,
        now
      )
      .run();

    return jsonResponse(
      {
        success: true,
        message: 'Reflection posted successfully.',
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

export async function onRequestPut(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser) {
    return errorResponse('Unauthorized: Blog owner login required', 401, request, env);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON body required', 400, request, env);
  }

  const { commentId, action = 'approve' } = body;
  if (!commentId) {
    return errorResponse('commentId is required', 400, request, env);
  }

  try {
    const db = await getContentDb(env);
    const target = await db
      .prepare('SELECT id, website_id as websiteId FROM comments WHERE id = ?')
      .bind(commentId)
      .first();

    if (!target) {
      return errorResponse('Comment not found', 404, request, env);
    }

    // Verify blog owner permission
    if (authUser.email !== DEVELOPER_EMAIL) {
      const isOwner = await db
        .prepare('SELECT 1 FROM websites WHERE website_id = ? AND (owner_user_id = ? OR admin_email = ?)')
        .bind(target.websiteId, authUser.userId, authUser.email)
        .first();

      if (!isOwner) {
        return errorResponse('Forbidden: You can only approve comments on your own blogs', 403, request, env);
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'held_for_review';
    await db
      .prepare('UPDATE comments SET status = ? WHERE id = ?')
      .bind(newStatus, commentId)
      .run();

    return jsonResponse({ success: true, message: `Comment ${commentId} is now ${newStatus}` }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

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
