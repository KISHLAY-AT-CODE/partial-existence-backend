/**
 * Endpoint: /api/websites
 * Methods:
 *   GET  (query registered website configuration)
 *   POST (register or connect a new website to the SaaS platform)
 */

import { getContentDb } from '../../lib/db.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';
import { isValidSlug } from '../../lib/validation.js';

function normalizeOrigin(inputUrl) {
  try {
    const parsed = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
    return parsed.origin;
  } catch {
    return null;
  }
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
        `SELECT website_id as websiteId, name, url, allowed_origins as allowedOrigins,
                admin_email as adminEmail, created_at as createdAt
         FROM websites WHERE website_id = ?`
      )
      .bind(websiteId)
      .first();

    if (!site) {
      // Default fallback info
      return jsonResponse(
        {
          websiteId,
          name: websiteId === 'partial-existence' ? 'Partial Existence' : websiteId,
          url: '',
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

  const { name, url: siteUrl, websiteId: customId, adminEmail } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return errorResponse('Website name must be at least 2 characters long', 400, request, env);
  }

  if (!siteUrl || typeof siteUrl !== 'string') {
    return errorResponse('Valid website URL is required (e.g. https://myblog.com)', 400, request, env);
  }

  const origin = normalizeOrigin(siteUrl.trim());
  if (!origin) {
    return errorResponse('Invalid URL format', 400, request, env);
  }

  // Generate or sanitize websiteId
  let websiteId = customId ? String(customId).trim().toLowerCase() : '';
  if (!websiteId || !isValidSlug(websiteId)) {
    websiteId = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
  }

  const cleanName = name.trim().slice(0, 100);
  const cleanEmail = adminEmail ? String(adminEmail).trim().toLowerCase().slice(0, 120) : null;
  const now = new Date().toISOString();

  try {
    const db = await getContentDb(env);

    await db
      .prepare(
        `INSERT INTO websites (website_id, name, url, allowed_origins, admin_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(website_id) DO UPDATE SET
           name = excluded.name,
           url = excluded.url,
           allowed_origins = excluded.allowed_origins,
           admin_email = excluded.admin_email,
           updated_at = excluded.updated_at`
      )
      .bind(websiteId, cleanName, origin, origin, cleanEmail, now, now)
      .run();

    const hostUrl = new URL(request.url).origin;

    return jsonResponse(
      {
        success: true,
        message: 'Website successfully connected to SaaS backend!',
        website: {
          websiteId,
          name: cleanName,
          url: origin,
          apiUrl: hostUrl,
          adminEmail: cleanEmail,
        },
        snippets: {
          siteConfig: `export const siteConfig = {\n  apiUrl: '${hostUrl}',\n  websiteId: '${websiteId}',\n};`,
          scriptTag: `<script src="${hostUrl}/saas-embed.js" data-website-id="${websiteId}" async></script>`,
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
