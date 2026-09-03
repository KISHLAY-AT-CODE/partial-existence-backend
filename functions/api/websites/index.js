/**
 * Endpoint: /api/websites
 * Methods:
 *   GET  (query registered website configuration & post patterns)
 *   POST (connect a website using only Blog URL & Sample Blog Page URL)
 */

import { getContentDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { isValidSlug } from '../../lib/validation.js';

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

/**
 * Extract blog post routing path pattern from a sample blog page URL
 * e.g., "https://site.com/posts/my-post" -> "/posts/"
 * e.g., "https://site.com/blog/2026/hello" -> "/blog/"
 * e.g., "https://user.github.io/repo/posts/item" -> "/repo/posts/"
 */
function extractPathPattern(siteUrlObj, postUrlObj) {
  if (!siteUrlObj || !postUrlObj) return '/posts/';
  
  const postPath = postUrlObj.pathname;
  const segments = postPath.split('/').filter(Boolean);

  if (segments.length >= 2) {
    // Remove the last slug component to get the directory pattern
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
  const websiteId =
    url.searchParams.get('websiteId') ||
    request.headers.get('x-website-id') ||
    'partial-existence';

  try {
    const db = await getContentDb(env);
    const site = await db
      .prepare(
        `SELECT website_id as websiteId, name, url, sample_post_url as samplePostUrl,
                post_path_pattern as postPathPattern, allowed_origins as allowedOrigins,
                admin_email as adminEmail, created_at as createdAt
         FROM websites WHERE website_id = ?`
      )
      .bind(websiteId)
      .first();

    if (!site) {
      return jsonResponse(
        {
          websiteId,
          name: websiteId === 'partial-existence' ? 'Partial Existence' : websiteId,
          url: '',
          samplePostUrl: '',
          postPathPattern: '/posts/',
          isRegistered: false,
        },
        200,
        request,
        env
      );
    }

    return jsonResponse(
      {
        ...site,
        isRegistered: true,
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

  const {
    url: rawSiteUrl,
    samplePostUrl: rawPostUrl,
    name: rawName,
    websiteId: customId,
    adminEmail
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

  // Derive website name and ID
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

  const cleanEmail = adminEmail ? String(adminEmail).trim().toLowerCase().slice(0, 120) : null;
  const now = new Date().toISOString();

  try {
    const db = await getContentDb(env);

    await db
      .prepare(
        `INSERT INTO websites (website_id, name, url, sample_post_url, post_path_pattern, allowed_origins, admin_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(website_id) DO UPDATE SET
           name = excluded.name,
           url = excluded.url,
           sample_post_url = excluded.sample_post_url,
           post_path_pattern = excluded.post_path_pattern,
           allowed_origins = excluded.allowed_origins,
           admin_email = excluded.admin_email,
           updated_at = excluded.updated_at`
      )
      .bind(
        websiteId,
        websiteName,
        siteUrlObj.href,
        samplePostObj.href,
        postPattern,
        siteOrigin,
        cleanEmail,
        now,
        now
      )
      .run();

    const hostUrl = new URL(request.url).origin;

    return jsonResponse(
      {
        success: true,
        message: 'Blog successfully connected! Sign-In and Comments sections mapped.',
        website: {
          websiteId,
          name: websiteName,
          blogUrl: siteUrlObj.href,
          samplePostUrl: samplePostObj.href,
          postPathPattern: postPattern,
          apiUrl: hostUrl,
        },
        sections: {
          signInLocation: 'Site-wide Header & Navigation (Extreme Top-Right on ' + siteUrlObj.origin + ')',
          interactionsLocation: 'All Blog Pages matching path pattern "' + postPattern + '*" (Likes, Views & Comments)',
          watermark: 'Subtle "Maintained by Partial Existence Services" at bottom of footer',
        },
        snippets: {
          embedScript: `<script src="${hostUrl}/embed.js" data-website-id="${websiteId}" async></script>`,
          siteConfig: `export const siteConfig = {\n  apiUrl: '${hostUrl}',\n  websiteId: '${websiteId}',\n};`,
        },
      },
      201,
      request,
      env
    );
  } catch (err) {
    return errorResponse(`Registration error: ${err.message}`, 500, request, env);
  }
}
