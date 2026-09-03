/**
 * Standalone Local Development Server for Partial Existence Backend
 *
 * Runs on http://127.0.0.1:5000
 * Multi-Tenant SaaS Blog Engagement & Authentication Platform
 */

import http from 'http';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

// Load .env if present
try {
  if (process.loadEnvFile) {
    process.loadEnvFile(new URL('.env', import.meta.url));
  }
} catch {
  // Ignore if .env is missing or already set in process.env
}

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'partial_existence';
const AUTH_SECRET = process.env.AUTH_SECRET || 'pe_saas_auth_secret_jwt_hmac_2026_salt_key_default';

let dbClient = null;
let db = null;

// --- Auth & Hashing Helpers ---
function hashPasswordSync(password, saltHex = null) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPasswordSync(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, expectedHashHex] = storedHash.split(':');
  const computed = hashPasswordSync(password, saltHex);
  const [, computedHashHex] = computed.split(':');
  return computedHashHex === expectedHashHex;
}

function createTokenSync(payload, expiresInSeconds = 30 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const dataToSign = `${encHeader}.${encPayload}`;

  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(dataToSign);
  const encSignature = hmac.digest('base64url');

  return `${dataToSign}.${encSignature}`;
}

function verifyTokenSync(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encHeader, encPayload, encSignature] = parts;
  const dataToSign = `${encHeader}.${encPayload}`;

  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(dataToSign);
  const expectedSignature = hmac.digest('base64url');

  if (encSignature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function hashEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function extractTokenFromReq(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers['cookie'] || '';
  const match = cookieHeader.match(/pe_auth_token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

function getAuthUserFromReq(req) {
  const token = extractTokenFromReq(req);
  if (!token) return null;
  return verifyTokenSync(token);
}

async function initMongo() {
  try {
    dbClient = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
    });
    await dbClient.connect();
    db = dbClient.db(DB_NAME);
    console.log(`[MongoDB] Connected successfully to "${DB_NAME}" at ${MONGODB_URI.split('@').pop()}`);

    // Create indexes
    await db.collection('websites').createIndex({ websiteId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ userId: 1 }, { unique: true });
  } catch (err) {
    console.error(`[MongoDB] Connection error:`, err.message);
  }
}

function setCorsHeaders(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, x-author-token, x-device-id, x-website-id'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function sendJson(res, data, status = 200, origin = '*', cookieHeader = null) {
  setCorsHeaders(res, origin);
  if (cookieHeader) {
    res.setHeader('Set-Cookie', cookieHeader);
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status = 400, origin = '*') {
  sendJson(res, { error: message }, status, origin);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return false;
  if (!token) return false;

  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: params,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[reCAPTCHA] Verification error:', err.message);
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '*';
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  if (!db) {
    return sendError(res, 'Database not connected yet', 503, origin);
  }

  const websitesCol = db.collection('websites');
  const usersCol = db.collection('users');

  const websiteId =
    req.headers['x-website-id'] ||
    url.searchParams.get('websiteId') ||
    process.env.WEBSITE_ID ||
    'partial-existence';

  const deviceId =
    req.headers['x-device-id'] ||
    url.searchParams.get('deviceId') ||
    'anonymous_device';

  const authUser = getAuthUserFromReq(req);

  try {
    // ==========================================
    // AUTH ROUTING
    // ==========================================

    // 1. Register: POST /api/auth/register
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const { name, email, password, websiteId: targetWeb = websiteId } = body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return sendError(res, 'Name must be at least 2 characters long', 400, origin);
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return sendError(res, 'Valid email address is required', 400, origin);
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters long', 400, origin);
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim().slice(0, 50);

      const existing = await usersCol.findOne({ email: cleanEmail });
      if (existing) {
        return sendError(res, 'An account with this email already exists. Please sign in.', 409, origin);
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const passwordHash = hashPasswordSync(password);
      const now = new Date();

      const userDoc = {
        userId,
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        websites: [targetWeb],
        createdAt: now,
        updatedAt: now,
      };

      await usersCol.insertOne(userDoc);

      const token = createTokenSync({ userId, email: cleanEmail, name: cleanName });
      const cookieHeader = `pe_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;

      return sendJson(
        res,
        {
          success: true,
          user: { id: userId, name: cleanName, email: cleanEmail, createdAt: now.toISOString() },
          token,
        },
        201,
        origin,
        cookieHeader
      );
    }

    // 2. Login: POST /api/auth/login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const { email, password, websiteId: targetWeb = websiteId } = body;

      if (!email || !password) {
        return sendError(res, 'Email and password are required', 400, origin);
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await usersCol.findOne({ email: cleanEmail });

      if (!user) {
        return sendError(res, 'Invalid email or password', 401, origin);
      }

      const isValid = verifyPasswordSync(password, user.passwordHash);
      if (!isValid) {
        return sendError(res, 'Invalid email or password', 401, origin);
      }

      if (targetWeb && Array.isArray(user.websites) && !user.websites.includes(targetWeb)) {
        await usersCol.updateOne({ userId: user.userId }, { $addToSet: { websites: targetWeb } });
      }

      const token = createTokenSync({ userId: user.userId, email: user.email, name: user.name });
      const cookieHeader = `pe_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;

      return sendJson(
        res,
        {
          success: true,
          user: {
            id: user.userId,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          },
          token,
        },
        200,
        origin,
        cookieHeader
      );
    }

    // 3. Logout: POST /api/auth/logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const cookieHeader = `pe_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      return sendJson(res, { success: true, message: 'Logged out successfully' }, 200, origin, cookieHeader);
    }

    // 4. Me: GET /api/auth/me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      if (!authUser) {
        return sendError(res, 'Unauthorized: Please log in', 401, origin);
      }

      const user = await usersCol.findOne({ userId: authUser.userId });
      if (!user) {
        return sendError(res, 'User account not found', 404, origin);
      }

      return sendJson(
        res,
        {
          authenticated: true,
          user: {
            id: user.userId,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          },
        },
        200,
        origin
      );
    }

    // ==========================================
    // ENGAGEMENT ROUTING (PAGEVIEWS, LIKES, COMMENTS, STATS)
    // ==========================================

    // --- PAGEVIEWS ---
    if (pathname === '/api/pageviews') {
      if (req.method === 'GET') {
        const slug = url.searchParams.get('slug');
        if (!slug) return sendError(res, 'Missing "slug" parameter', 400, origin);

        const websiteDoc = await websitesCol.findOne(
          { websiteId },
          { projection: { [`posts.${slug}.views`]: 1 } }
        );
        const views = websiteDoc?.posts?.[slug]?.views || 0;
        return sendJson(res, { websiteId, slug, views }, 200, origin);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        const slug = body.slug || url.searchParams.get('slug');
        const devId = body.deviceId || deviceId;

        if (!slug) return sendError(res, 'Missing "slug"', 400, origin);

        const now = new Date();

        // Check if device already viewed this post to prevent redundant view increments
        const existingDoc = await websitesCol.findOne(
          { websiteId },
          { projection: { [`posts.${slug}.viewers`]: 1, [`posts.${slug}.views`]: 1 } }
        );

        const currentPost = existingDoc?.posts?.[slug];
        const viewers = currentPost?.viewers || [];
        const hasViewed = viewers.includes(devId);

        let updatedViews = currentPost?.views || 0;

        if (!hasViewed) {
          const result = await websitesCol.findOneAndUpdate(
            { websiteId },
            {
              $inc: { [`posts.${slug}.views`]: 1 },
              $addToSet: { [`posts.${slug}.viewers`]: devId },
              $set: {
                updatedAt: now,
                [`posts.${slug}.slug`]: slug,
                [`posts.${slug}.updatedAt`]: now,
              },
              $setOnInsert: {
                websiteId,
                createdAt: now,
              },
            },
            { upsert: true, returnDocument: 'after' }
          );

          const doc = result?.value || result;
          updatedViews = doc?.posts?.[slug]?.views || 1;
        }

        return sendJson(
          res,
          { success: true, websiteId, slug, views: updatedViews, isNewView: !hasViewed },
          200,
          origin
        );
      }
    }

    // --- LIKES ---
    if (pathname === '/api/likes') {
      if (req.method === 'GET') {
        const slug = url.searchParams.get('slug');
        if (!slug) return sendError(res, 'Missing "slug" parameter', 400, origin);

        const websiteDoc = await websitesCol.findOne(
          { websiteId },
          { projection: { [`posts.${slug}.likes`]: 1 } }
        );
        const likes = Math.max(0, websiteDoc?.posts?.[slug]?.likes || 0);
        return sendJson(res, { websiteId, slug, likes }, 200, origin);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        const { slug, action, liked } = body;
        const devId = body.deviceId || deviceId;

        if (!slug) return sendError(res, 'Missing "slug"', 400, origin);

        const isUnlike = action === 'unlike' || action === 'decrement' || liked === false;
        const inc = isUnlike ? -1 : 1;

        if (isUnlike) {
          const currentDoc = await websitesCol.findOne(
            { websiteId },
            { projection: { [`posts.${slug}.likes`]: 1 } }
          );
          const currentLikes = currentDoc?.posts?.[slug]?.likes || 0;
          if (currentLikes <= 0) {
            return sendJson(res, { success: true, websiteId, slug, likes: 0 }, 200, origin);
          }
        }

        const now = new Date();
        const updateOp = isUnlike
          ? {
              $inc: { [`posts.${slug}.likes`]: inc },
              $pull: { [`posts.${slug}.likers`]: devId },
              $set: {
                updatedAt: now,
                [`posts.${slug}.slug`]: slug,
                [`posts.${slug}.updatedAt`]: now,
              },
              $setOnInsert: { websiteId, createdAt: now },
            }
          : {
              $inc: { [`posts.${slug}.likes`]: inc },
              $addToSet: { [`posts.${slug}.likers`]: devId },
              $set: {
                updatedAt: now,
                [`posts.${slug}.slug`]: slug,
                [`posts.${slug}.updatedAt`]: now,
              },
              $setOnInsert: { websiteId, createdAt: now },
            };

        const result = await websitesCol.findOneAndUpdate({ websiteId }, updateOp, {
          upsert: true,
          returnDocument: 'after',
        });

        const doc = result?.value || result;
        const likes = Math.max(0, doc?.posts?.[slug]?.likes || 0);
        return sendJson(res, { success: true, websiteId, slug, likes }, 200, origin);
      }
    }

    // --- COMMENTS ---
    if (pathname === '/api/comments') {
      if (req.method === 'GET') {
        const slug = url.searchParams.get('slug');
        if (!slug) return sendError(res, 'Missing "slug" parameter', 400, origin);

        const websiteDoc = await websitesCol.findOne(
          { websiteId },
          { projection: { [`posts.${slug}.comments`]: 1 } }
        );

        const comments = (websiteDoc?.posts?.[slug]?.comments || []).slice().reverse();
        const formatted = comments.map((c) => ({
          id: c.id,
          slug,
          userId: c.userId || null,
          author: c.author,
          isVerified: Boolean(c.isVerified),
          emailHash: c.emailHash || null,
          subscribeUpdates: Boolean(c.subscribeUpdates),
          text: c.text,
          date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        }));

        return sendJson(res, { websiteId, slug, comments: formatted, count: formatted.length }, 200, origin);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        const { slug, author, text, email, subscribeUpdates, authorToken, recaptchaToken } = body;
        if (!slug || !text?.trim()) {
          return sendError(res, 'Valid "slug" and comment "text" are required', 400, origin);
        }

        // If not authenticated, require reCAPTCHA
        if (!authUser) {
          const isHuman = await verifyRecaptcha(recaptchaToken);
          if (!isHuman) {
            return sendError(res, 'reCAPTCHA verification failed. Please complete the captcha.', 400, origin);
          }
        }

        const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();

        const authorName = authUser ? authUser.name : (author || 'Anonymous').trim().slice(0, 50);
        const emailToHash = authUser ? authUser.email : email;
        const hashed = hashEmail(emailToHash);

        const commentDoc = {
          id: commentId,
          userId: authUser ? authUser.userId : null,
          author: authorName,
          isVerified: Boolean(authUser),
          emailHash: hashed,
          subscribeUpdates: Boolean(subscribeUpdates),
          text: text.trim().slice(0, 2000),
          authorToken: body.authorToken ? String(authorToken).slice(0, 100) : null,
          createdAt: now,
        };

        await websitesCol.updateOne(
          { websiteId },
          {
            $push: { [`posts.${slug}.comments`]: commentDoc },
            $set: {
              updatedAt: now,
              [`posts.${slug}.slug`]: slug,
              [`posts.${slug}.updatedAt`]: now,
            },
            $setOnInsert: {
              websiteId,
              createdAt: now,
            },
          },
          { upsert: true }
        );

        return sendJson(
          res,
          {
            success: true,
            comment: {
              id: commentId,
              slug,
              userId: commentDoc.userId,
              author: commentDoc.author,
              isVerified: commentDoc.isVerified,
              emailHash: commentDoc.emailHash,
              subscribeUpdates: commentDoc.subscribeUpdates,
              text: commentDoc.text,
              date: now.toISOString(),
            },
          },
          201,
          origin
        );
      }

      if (req.method === 'DELETE') {
        const id = url.searchParams.get('id');
        const token = url.searchParams.get('token') || req.headers['x-author-token'];

        if (!id) return sendError(res, 'Missing "id" parameter', 400, origin);
        if (!token && !authUser) {
          return sendError(res, 'Unauthorized: Author token or login required to delete comment', 401, origin);
        }

        const websiteDoc = await websitesCol.findOne({ websiteId });
        if (!websiteDoc || !websiteDoc.posts) {
          return sendError(res, 'Comment not found', 404, origin);
        }

        let foundPostSlug = null;
        let targetComment = null;

        for (const [postSlug, postData] of Object.entries(websiteDoc.posts)) {
          if (Array.isArray(postData?.comments)) {
            const c = postData.comments.find((item) => item.id === id);
            if (c) {
              foundPostSlug = postSlug;
              targetComment = c;
              break;
            }
          }
        }

        if (!targetComment) {
          return sendError(res, 'Comment not found', 404, origin);
        }

        const isOwner =
          (authUser && targetComment.userId === authUser.userId) ||
          (token && targetComment.authorToken === token);

        if (!isOwner) {
          return sendError(res, 'Forbidden: You can only delete your own comments', 403, origin);
        }

        await websitesCol.updateOne(
          { websiteId },
          {
            $pull: { [`posts.${foundPostSlug}.comments`]: { id } },
            $set: { updatedAt: new Date() },
          }
        );

        return sendJson(res, { success: true, deletedCount: 1, id }, 200, origin);
      }
    }

    // --- STATS ---
    if (pathname === '/api/stats' && req.method === 'GET') {
      const websiteDoc = await websitesCol.findOne({ websiteId });
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;

      if (websiteDoc?.posts) {
        for (const post of Object.values(websiteDoc.posts)) {
          totalViews += Number(post.views || 0);
          totalLikes += Number(post.likes || 0);
          if (Array.isArray(post.comments)) {
            totalComments += post.comments.length;
          }
        }
      }

      return sendJson(
        res,
        {
          websiteId,
          totalViews,
          totalLikes,
          totalComments,
          timestamp: new Date().toISOString(),
        },
        200,
        origin
      );
    }

    // Root status
    if (pathname === '/') {
      return sendJson(
        res,
        {
          status: 'online',
          platform: 'SaaS Blog Engagement & Auth Engine',
          websiteId,
          dbName: DB_NAME,
        },
        200,
        origin
      );
    }

    sendError(res, 'Endpoint not found', 404, origin);
  } catch (err) {
    sendError(res, err.message, 500, origin);
  }
});

initMongo().then(() => {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[API Server] SaaS Local server running at http://127.0.0.1:${PORT}`);
  });
});
