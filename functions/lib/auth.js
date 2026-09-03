/**
 * functions/lib/auth.js — Authentication, Hashing & Token Helpers
 * Compatible with both Node.js runtime and Cloudflare Workers (Web Crypto API)
 */

const DEFAULT_SECRET = 'pe_saas_auth_secret_jwt_hmac_2026_salt_key_default';

/**
 * Hash a password with cryptographic salt using Web Crypto / subtle
 */
export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const passBytes = enc.encode(password);

  const combined = new Uint8Array(salt.length + passBytes.length);
  combined.set(salt, 0);
  combined.set(passBytes, salt.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashHex = bytesToHex(new Uint8Array(hashBuffer));
  const saltOutHex = bytesToHex(salt);

  return `${saltOutHex}:${hashHex}`;
}

/**
 * Verify password against stored salt:hash
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, expectedHashHex] = storedHash.split(':');
  const computed = await hashPassword(password, saltHex);
  const [, computedHashHex] = computed.split(':');
  return computedHashHex === expectedHashHex;
}

/**
 * Generate HMAC-SHA256 signed Auth Token
 */
export async function createAuthToken(payload, secretKey = DEFAULT_SECRET, expiresInSeconds = 30 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encHeader}.${encPayload}`;

  const key = await getHmacKey(secretKey);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));
  const encSignature = base64UrlEncodeBytes(new Uint8Array(signature));

  return `${dataToSign}.${encSignature}`;
}

/**
 * Verify and decode HMAC-SHA256 Auth Token
 */
export async function verifyAuthToken(token, secretKey = DEFAULT_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encHeader, encPayload, encSignature] = parts;
  const dataToSign = `${encHeader}.${encPayload}`;

  try {
    const key = await getHmacKey(secretKey);
    const signatureBytes = base64UrlDecodeToBytes(encSignature);
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(dataToSign));

    if (!isValid) return null;

    const payloadJson = base64UrlDecode(encPayload);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract auth token from Request headers or cookies
 */
export function extractAuthToken(request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie') || '';
  const match = cookieHeader.match(/pe_auth_token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Authenticate request helper
 */
export async function getAuthenticatedUser(request, env) {
  const secret = env?.AUTH_SECRET || DEFAULT_SECRET;
  const token = extractAuthToken(request);
  if (!token) return null;
  return await verifyAuthToken(token, secret);
}

// --- Cryptographic Utility Helpers ---
async function getHmacKey(secretStr) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(str) {
  return base64UrlEncodeBytes(new TextEncoder().encode(str));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function base64UrlDecodeToBytes(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
