/**
 * Cloudflare Pages Functions Global Middleware
 * Handles CORS preflight (OPTIONS) and attaches default security headers
 */

import { getCorsHeaders } from './lib/cors.js';

export async function onRequest(context) {
  const { request, env, next } = context;

  // Handle preflight OPTIONS requests immediately
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, env),
    });
  }

  try {
    const response = await next();
    const headers = new Headers(response.headers);
    const cors = getCorsHeaders(request, env);

    Object.entries(cors).forEach(([key, val]) => {
      headers.set(key, val);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request, env),
      },
    });
  }
}
