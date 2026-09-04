/**
 * Endpoint: /api/admin/review
 * Methods:
 *   GET, POST (Developer 1-Click Approval / Rejection Handler)
 */

import { getContentDb } from '../../lib/db.js';
import { DEVELOPER_EMAIL } from '../../lib/email.js';
import { getAuthenticatedUser } from '../../lib/auth.js';
import { jsonResponse, errorResponse } from '../../lib/cors.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser || authUser.email !== DEVELOPER_EMAIL) {
    return errorResponse(`Unauthorized: Developer access required (${DEVELOPER_EMAIL})`, 403, request, env);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Valid JSON body required', 400, request, env);
  }

  const { websiteId, action } = body;
  if (!websiteId || !action) {
    return errorResponse('websiteId and action (approve/reject/delete) are required', 400, request, env);
  }

  const act = action.toLowerCase();
  const now = new Date().toISOString();

  try {
    const db = await getContentDb(env);

    if (act === 'delete') {
      await db.prepare('DELETE FROM websites WHERE website_id = ?').bind(websiteId).run();
      await db.prepare('DELETE FROM comments WHERE website_id = ?').bind(websiteId).run().catch(() => {});
      await db.prepare('DELETE FROM pageviews WHERE website_id = ?').bind(websiteId).run().catch(() => {});
      await db.prepare('DELETE FROM likes WHERE website_id = ?').bind(websiteId).run().catch(() => {});
      await db.prepare('DELETE FROM blocked_users WHERE website_id = ?').bind(websiteId).run().catch(() => {});

      return jsonResponse({
        success: true,
        websiteId,
        status: 'deleted',
        message: `Proposal / website "${websiteId}" permanently deleted from database`
      }, 200, request, env);
    }

    let newStatus = 'approved';
    let statusMsg = 'granted / approved';

    if (act === 'revoke' || act === 'suspend') {
      newStatus = 'revoked';
      statusMsg = 'revoked';
    } else if (act === 'reject') {
      newStatus = 'rejected';
      statusMsg = 'rejected';
    } else if (act === 'grant' || act === 'approve') {
      newStatus = 'approved';
      statusMsg = 'granted access';
    }

    await db
      .prepare('UPDATE websites SET status = ?, updated_at = ? WHERE website_id = ?')
      .bind(newStatus, now, websiteId)
      .run();

    return jsonResponse({
      success: true,
      websiteId,
      status: newStatus,
      message: `Website "${websiteId}" access has been ${statusMsg} by developer.`
    }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const authUser = await getAuthenticatedUser(request, env);

  if (!authUser || authUser.email !== DEVELOPER_EMAIL) {
    return errorResponse(`Unauthorized: Developer access required (${DEVELOPER_EMAIL})`, 403, request, env);
  }

  const url = new URL(request.url);
  const websiteId = url.searchParams.get('websiteId');

  if (!websiteId) {
    return errorResponse('websiteId parameter is required', 400, request, env);
  }

  try {
    const db = await getContentDb(env);
    await db.prepare('DELETE FROM websites WHERE website_id = ?').bind(websiteId).run();
    await db.prepare('DELETE FROM comments WHERE website_id = ?').bind(websiteId).run().catch(() => {});
    await db.prepare('DELETE FROM pageviews WHERE website_id = ?').bind(websiteId).run().catch(() => {});
    await db.prepare('DELETE FROM likes WHERE website_id = ?').bind(websiteId).run().catch(() => {});
    await db.prepare('DELETE FROM blocked_users WHERE website_id = ?').bind(websiteId).run().catch(() => {});

    return jsonResponse({
      success: true,
      websiteId,
      status: 'deleted',
      message: `Website "${websiteId}" permanently deleted from database`
    }, 200, request, env);
  } catch (err) {
    return errorResponse(`Database error: ${err.message}`, 500, request, env);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action'); // 'approve' or 'reject'
  const websiteId = url.searchParams.get('websiteId');
  const token = url.searchParams.get('token');

  if (!websiteId || !action) {
    return new Response('Invalid approval request parameters.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const act = action.toLowerCase();
  let newStatus = 'approved';
  if (act === 'revoke' || act === 'suspend') newStatus = 'revoked';
  else if (act === 'reject') newStatus = 'rejected';
  else if (act === 'grant' || act === 'approve') newStatus = 'approved';

  const isApprove = newStatus === 'approved';
  const isRevoke = newStatus === 'revoked';
  const now = new Date().toISOString();

  try {
    const db = await getContentDb(env);

    // Verify website exists
    const site = await db
      .prepare('SELECT website_id as websiteId, name, url, status, verification_token as token FROM websites WHERE website_id = ?')
      .bind(websiteId)
      .first();

    if (!site) {
      return new Response('Website not found.', { status: 404 });
    }

    // If token was generated and supplied, verify match
    if (token && site.token && site.token !== token) {
      return new Response('Unauthorized: Invalid verification token.', { status: 403 });
    }

    // Update status
    await db
      .prepare('UPDATE websites SET status = ?, updated_at = ? WHERE website_id = ?')
      .bind(newStatus, now, websiteId)
      .run();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Blog Access Status — Partial Existence</title>
        <style>
          body { background: #070908; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #101814; border: 1px solid ${isApprove ? '#a0c040' : isRevoke ? '#f87171' : '#ef4444'}; border-radius: 16px; padding: 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; background: ${isApprove ? 'rgba(160, 192, 64, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isApprove ? '#a0c040' : '#f87171'}; font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
          h1 { margin: 0 0 12px 0; color: #ffffff; font-size: 24px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; }
          .meta { background: rgba(0,0,0,0.35); padding: 12px; border-radius: 8px; text-align: left; font-size: 13px; margin-bottom: 24px; }
          .btn { display: inline-block; background: #a0c040; color: #050a06; font-weight: 700; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${isApprove ? '✓ Access Granted' : isRevoke ? '🔒 Access Revoked' : '✗ Access Rejected'}</div>
          <h1>${isApprove ? 'Blog Owner Access Granted' : isRevoke ? 'Blog Access Revoked' : 'Application Rejected'}</h1>
          <p>
            ${isApprove
              ? `Website <strong>"${site.name}"</strong> has been approved to use Partial Existence SaaS engine. Embed script credentials and backend API are now active.`
              : isRevoke
              ? `Access for website <strong>"${site.name}"</strong> has been revoked by the developer. All live blog interactions are now paused.`
              : `Website <strong>"${site.name}"</strong> has been rejected from accessing the backend service.`}
          </p>
          <div class="meta">
            <div><strong>Website ID:</strong> <code>${site.websiteId}</code></div>
            <div><strong>Domain:</strong> ${site.url}</div>
            <div><strong>Status:</strong> ${newStatus.toUpperCase()}</div>
            <div><strong>Reviewed By:</strong> ${DEVELOPER_EMAIL}</div>
            <div><strong>Timestamp:</strong> ${now}</div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <a class="btn" href="${url.origin}/">Open SaaS Dashboard &rarr;</a>
            ${isApprove ? `<a class="btn" style="background: rgba(160, 192, 64, 0.15); color: #a0c040; border: 1px solid #a0c040;" href="${url.origin}/AGENT_WILL_INTEGRATE.md" download="AGENT_WILL_INTEGRATE.md">📥 Download Integration Specs (AGENT_WILL_INTEGRATE.md)</a>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    return new Response(`Database error: ${err.message}`, { status: 500 });
  }
}
