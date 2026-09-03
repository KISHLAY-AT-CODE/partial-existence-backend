/**
 * Endpoint: POST /api/auth/logout
 * Clears user session cookie
 */

import { jsonResponse } from '../../lib/cors.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const res = jsonResponse(
    {
      success: true,
      message: 'Logged out successfully',
    },
    200,
    request,
    env
  );

  // Clear pe_auth_token cookie
  const secureFlag = request.url.startsWith('https') ? 'Secure;' : '';
  res.headers.set(
    'Set-Cookie',
    `pe_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; ${secureFlag}`
  );

  return res;
}
