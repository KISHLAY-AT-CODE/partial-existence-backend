/**
 * CORS and Security Headers Helper for Cloudflare Pages Functions
 */

const DEFAULT_ALLOWED = [
  'https://kishlay-at-code.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configuredOrigins = env?.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : DEFAULT_ALLOWED;

  const isAllowed = configuredOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return origin.toLowerCase() === allowed.toLowerCase();
  });

  const allowOrigin = isAllowed ? origin : (configuredOrigins[0] || 'https://kishlay-at-code.github.io');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Website-Id, X-Device-Id, X-Author-Token, x-website-id, x-device-id, x-author-token',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

export function jsonResponse(data, status = 200, request, env) {
  const headers = {
    'Content-Type': 'application/json',
    ...getCorsHeaders(request, env),
  };

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function errorResponse(message, status = 400, request, env) {
  return jsonResponse({ error: message }, status, request, env);
}
