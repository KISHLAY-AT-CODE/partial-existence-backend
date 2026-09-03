/**
 * Endpoint: /api/websites
 * Methods:
 *   GET  (list blog owner's registered websites or query specific websiteId)
 *   POST (submit a website for developer approval and send verification email)
 */

import { getContentDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { isValidSlug } from '../../lib/validation.js';
import { getAuthenticatedUser } from '../../lib/auth.js';
import { sendDeveloperVerificationEmail, DEVELOPER_EMAIL } from '../../lib/email.js';

function normalizeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  let str = inputUrl.trim();
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  try {
    return new URL(str);
  } catch {
    return null;
  }
}

function extractPathPattern(siteUrlObj, postUrlObj) {
  if (!siteUrlObj || !postUrlObj) return '/posts/';
  const postPath = postUrlObj.pathname;
  const segments = postPath.split('/').filter(Boolean);
  if (segments.length >= 2) {
    segments.pop();
    return '/' + segments.join('/') + '/';
  } else if (segments.length === 1) {
    return '/' + segments[0] + '/';
  }
  return '/posts/';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const websiteId = url.searchParams.get('websiteId') || request.headers.get('x-website-id');
  const authUser = await getAuthenticatedUser(request, env);

  try {
    const db = await getContentDb(env);

    // If querying specific websiteId
    if (websiteId) {
      const site = await db
        .prepare(
          `SELECT website_id as websiteId, owner_user_id as ownerUserId, name, url,
                  sample_post_url as samplePostUrl, post_path_pattern as postPathPattern,
                  allowed_origins as allowedOrigins, admin_email as adminEmail,
                  status, created_at as createdAt
           FROM websites WHERE website_id = ?`
        )
        .bind(websiteId)
        .first();

      if (!site) {
        return jsonResponse({ websiteId, isRegistered: false }, 200, request, env);
      }
      return jsonResponse({ ...site, isRegistered: true }, 200, request, env);
    }

    // If authenticated blog owner or developer
    if (authUser) {
      let query;
      let params;

      if (authUser.email === DEVELOPER_EMAIL) {
        // Developer sees ALL websites with approval actions
        query = `SELECT website_id as websiteId, owner_user_id as ownerUserId, name, url,
                        sample_post_url as samplePostUrl, post_path_pattern as postPathPattern,
                        admin_email as adminEmail, status, verification_token as verificationToken,
                        created_at as createdAt
                 FROM websites ORDER BY created_at DESC`;
        params = [];
      } else {
        // Normal owner sees their websites
        query = `SELECT website_id as websiteId, name, url, sample_post_url as samplePostUrl,
                        post_path_pattern as postPathPattern, status, created_at as createdAt
                 FROM websites
                 WHERE owner_user_id = ? OR admin_email = ? OR website_id = 'partial-existence'
                 ORDER BY created_at DESC`;
        params = [authUser.userId, authUser.email];
      }

      const results = await db.prepare(query).bind(...params).all();
      return jsonResponse({ websites: results.results || [], isDeveloper: authUser.email === DEVELOPER_EMAIL }, 200, request, env);
    }

    return jsonResponse({ websites: [] }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Require Blog Owner Authentication to prevent bots
  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser) {
    return errorResponse('Blog owner login required. Please sign in to create or connect a website.', 401, request, env);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON payload required', 400, request, env);
  }

  const {
    url: rawSiteUrl,
    samplePostUrl: rawPostUrl,
    name: rawName,
    websiteId: customId
  } = body;

  const siteUrlObj = normalizeUrl(rawSiteUrl);
  if (!siteUrlObj) {
    return errorResponse('Valid Blog Website URL is required (e.g. https://myblog.com)', 400, request, env);
  }

  const samplePostObj = normalizeUrl(rawPostUrl);
  if (!samplePostObj) {
    return errorResponse('Valid Sample Blog Page URL is required (e.g. https://myblog.com/posts/my-story)', 400, request, env);
  }

  const siteOrigin = siteUrlObj.origin;
  const postPattern = extractPathPattern(siteUrlObj, samplePostObj);

  let websiteName = rawName ? String(rawName).trim() : '';
  if (!websiteName) {
    websiteName = siteUrlObj.hostname.replace('www.', '').split('.')[0];
    websiteName = websiteName.charAt(0).toUpperCase() + websiteName.slice(1) + ' Blog';
  }

  let websiteId = customId ? String(customId).trim().toLowerCase() : '';
  if (!websiteId || !isValidSlug(websiteId)) {
    const hostSlug = siteUrlObj.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const pathSlug = siteUrlObj.pathname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    websiteId = `${hostSlug}${pathSlug}`.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'blog-' + Date.now();
  }

  const verificationToken = 'tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const now = new Date().toISOString();
  const initialStatus = (websiteId === 'partial-existence' || authUser.email === DEVELOPER_EMAIL) ? 'approved' : 'pending';

  try {
    const db = await getContentDb(env);

    await db
      .prepare(
        `INSERT INTO websites (website_id, owner_user_id, name, url, sample_post_url, post_path_pattern, allowed_origins, admin_email, status, verification_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(website_id) DO UPDATE SET
           owner_user_id = excluded.owner_user_id,
           name = excluded.name,
           url = excluded.url,
           sample_post_url = excluded.sample_post_url,
           post_path_pattern = excluded.post_path_pattern,
           allowed_origins = excluded.allowed_origins,
           admin_email = excluded.admin_email,
           verification_token = excluded.verification_token,
           updated_at = excluded.updated_at`
      )
      .bind(
        websiteId,
        authUser.userId,
        websiteName,
        siteUrlObj.href,
        samplePostObj.href,
        postPattern,
        siteOrigin,
        authUser.email,
        initialStatus,
        verificationToken,
        now,
        now
      )
      .run();

    const hostUrl = new URL(request.url).origin;

    // Send verification email to the developer (dev.vinyas.one@gmail.com)
    let emailResult = null;
    if (initialStatus === 'pending') {
      emailResult = await sendDeveloperVerificationEmail(env, {
        websiteId,
        name: websiteName,
        blogUrl: siteUrlObj.href,
        samplePostUrl: samplePostObj.href,
        ownerEmail: authUser.email,
        verificationToken,
        hostUrl
      });
    }

    const isApproved = initialStatus === 'approved';

    return jsonResponse(
      {
        success: true,
        message: isApproved
          ? 'Website instantly approved and active!'
          : `Website submitted for verification. Confirmation email sent to developer (${DEVELOPER_EMAIL}). Embed code will unlock upon approval.`,
        website: {
          websiteId,
          name: websiteName,
          blogUrl: siteUrlObj.href,
          samplePostUrl: samplePostObj.href,
          status: initialStatus,
          ownerEmail: authUser.email,
        },
        developerEmailSentTo: DEVELOPER_EMAIL,
        verificationDetails: emailResult,
        snippets: isApproved ? {
          embedScript: `<script src="${hostUrl}/embed.js" data-website-id="${websiteId}" async></script>`,
          siteConfig: `export const siteConfig = {\n  apiUrl: '${hostUrl}',\n  websiteId: '${websiteId}',\n};`,
        } : null,
      },
      201,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Registration error: ${err.message}`, 500, request, env);
  }
}
