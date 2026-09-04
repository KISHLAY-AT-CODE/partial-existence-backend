---
title: "Partial Existence SaaS — AI Agent & Developer Integration Specification"
version: "3.0.0"
target_system: "Partial Existence SaaS Platform"
backend_api_host: "https://partial-existence.pages.dev"
author: "dev.vinyas.one@gmail.com"
spec_type: "agent-executable-and-human-readable"
features:
  - authentication: "Dark Glassmorphism Modal + JWT Session + Floating Initials Avatar Widget"
  - profanity_filtering: "Stage 1 (In-Memory Regex) + Stage 2 (Gemini AI API) + Stage 3 (Database Lexicon) + Live Scanner UI"
  - comments: "Full Threaded/Chronological Comment Engine + Author Deletion + Real-Time Sanitization"
  - engagement: "Deduplicated Pageviews & Single-Click Like/Unlike with Local Storage Sync"
  - watermark: "Automated Non-Intrusive Footer Attribution"
---

# 🚀 Partial Existence SaaS — Integration Guide & Execution Playbook

This document serves as the **executable specification for AI coding agents** (e.g., Antigravity, Claude Code, Cursor, Copilot) as well as the **human developer manual** for integrating the Partial Existence SaaS commenting, authentication, AI profanity filtering, pageviews, and likes system into **any website or blogging engine** (Static HTML, Next.js, React, Astro, Vue, Hugo, Jekyll, WordPress, Ghost, Webflow, etc.).

---

## 📋 Executive Overview & Architecture

```
+-----------------------------------------------------------------------------------+
|                              HOST BLOGGING WEBSITE                                |
|                                                                                   |
|  [ Top Navigation ]                                 [ 👤 User Initials Avatar ]  |
|                                                     (Auto-mounted by embed.js)    |
|                                                                                   |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │ Post Title & Article Content                                                │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                   |
|  ┌─────────────────────────────────────────────────────────────────────────────┐  |
|  │ 💖 Likes (24)   💬 Comments (8)   👁️ Unique Views (142)                      │  |
|  │                                                                             │  |
|  │ [ Write a reflection / comment... ]                                         │  |
|  │   ↳ Triggers Animated AI Profanity Modal Scan & Gemini Verdict              │  |
|  │                                                                             │  |
|  │ [ Comment List with Instant Delete for Authors ]                            │  |
|  └─────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                   |
|  [ Footer: "Maintained by Partial Existence Services" (Auto-injected) ]          |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ HTTPS / JSON REST API
+-----------------------------------------------------------------------------------+
|                          PARTIAL EXISTENCE SAAS ENGINE                            |
|             (Cloudflare Workers / D1 Database / Node Express / MongoDB)           |
|                                                                                   |
|  • /api/auth/*         -> Register, Login, Session Verification, Account Deletion |
|  • /api/comments       -> Post, Retrieve, Delete, Profanity Verification          |
|  • /api/likes          -> Atomic Likes / Unlike with IP & Device Deduplication    |
|  • /api/pageviews      -> Unique View Counter with Client Device Fingerprinting   |
|  • /api/moderation/*   -> Gemini AI Model Multi-Layer Moderation Engine           |
|  • /api/websites       -> Developer Access Control & Status Verification          |
+-----------------------------------------------------------------------------------+
```

---

## ⚡ Quick Start: 1-Line Drop-In (Zero Build Step)

For standard HTML blogs, Webflow, Ghost, or static site generators:

### Step 1: Add the Script Tag
Place the following script tag in your `<head>` or before the closing `</body>` tag of your website:

```html
<script 
  src="https://partial-existence.pages.dev/embed.js" 
  data-website-id="YOUR_REGISTERED_WEBSITE_ID" 
  async>
</script>
```

> **Note**: Replace `YOUR_REGISTERED_WEBSITE_ID` with the Website ID granted in the Developer Dashboard (e.g., `partial-existence` or your custom domain slug).

### Step 2: Add the Post Interaction Container
Place this single `<div>` anywhere on your blog post page where you want the **Likes, Views, and Comments Section** to render:

```html
<!-- The data-slug attribute identifies the unique blog post -->
<div id="partial-existence-interactions" data-slug="my-first-post"></div>
```

*That's it!* The script will automatically:
1. Verify website authorization with the developer backend.
2. Mount the floating **Sign In / Account Avatar** in the top right.
3. Fetch and display the post's **Views**, **Likes count**, and **Comments list**.
4. Intercept submissions to run the **Multi-Layer AI Profanity Scanner** with real-time UI status.
5. Auto-inject the discreet **Footer Watermark**.

---

## 🤖 Instructions for AI Coding Agents

If you are an **AI Coding Assistant** integrating this system into a repository, execute the following steps in sequence:

### Phase 1: Environment & Website Configuration
1. Inspect the host project's routing model (e.g. Next.js App Router, Pages Router, Vite React, Astro, or Static HTML).
2. Determine how unique post slugs are derived (e.g., `params.slug`, `window.location.pathname`, or frontmatter `slug`).
3. Set the global SaaS Website ID constant:
   ```javascript
   const PARTIAL_EXISTENCE_WEBSITE_ID = "YOUR_REGISTERED_WEBSITE_ID";
   const PARTIAL_EXISTENCE_API_URL = "https://partial-existence.pages.dev";
   ```

---

### Phase 2: React / Next.js Component Integration Pattern

For React, Next.js (App / Pages router), or Astro projects, you can use the direct Component pattern:

#### 1. API Client Helper (`lib/partialExistence.js`)
```javascript
const API_URL = "https://partial-existence.pages.dev";
const WEBSITE_ID = "YOUR_REGISTERED_WEBSITE_ID";

export function getDeviceId() {
  let id = localStorage.getItem("pe_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem("pe_device_id", id);
  }
  return id;
}

export function getAuthToken() {
  return localStorage.getItem("pe_saas_token") || null;
}

export async function fetchWithAuth(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    "X-Website-Id": WEBSITE_ID,
    "X-Device-Id": getDeviceId(),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };
  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
}
```

#### 2. Interactions Component (`components/BlogInteractions.jsx`)
```jsx
import React, { useState, useEffect } from 'react';
import { fetchWithAuth, getDeviceId } from '../lib/partialExistence';

export default function BlogInteractions({ slug }) {
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Load Likes, Views, Comments
  useEffect(() => {
    async function loadData() {
      try {
        // Record pageview
        fetchWithAuth('/api/pageviews', {
          method: 'POST',
          body: JSON.stringify({ slug, deviceId: getDeviceId() })
        }).then(r => r.json()).then(d => d && setViews(d.views || 0));

        // Get comments & likes
        const [cRes, lRes] = await Promise.all([
          fetchWithAuth(`/api/comments?slug=${encodeURIComponent(slug)}`),
          fetchWithAuth(`/api/likes?slug=${encodeURIComponent(slug)}`)
        ]);
        const cData = await cRes.json();
        const lData = await lRes.json();
        if (cData?.comments) setComments(cData.comments);
        if (lData?.likes !== undefined) setLikes(lData.likes);
      } catch (err) {
        console.error('Failed to load blog interactions:', err);
      }
    }
    if (slug) loadData();
  }, [slug]);

  // Handle Like Toggle
  async function toggleLike() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    await fetchWithAuth('/api/likes', {
      method: 'POST',
      body: JSON.stringify({ slug, action: nextLiked ? 'like' : 'unlike', deviceId: getDeviceId() })
    });
  }

  // Handle Comment Submission with AI Profanity Check
  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;

    setLoading(true);
    setScanning(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithAuth('/api/comments', {
        method: 'POST',
        body: JSON.stringify({ slug, text: commentText })
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        setErrorMsg(data.warning || data.message || data.error || 'Comment rejected by moderation filter.');
      } else if (data.comment) {
        setComments(prev => [data.comment, ...prev]);
        setCommentText('');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission error');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }

  return (
    <div className="pe-interactions-container" style={{ margin: '2.5rem 0', fontFamily: 'sans-serif' }}>
      {/* Action Buttons: Likes, Comments, Views */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={toggleLike} style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '20px', border: '1px solid #a0c040', background: liked ? '#a0c040' : 'transparent', color: liked ? '#000' : '#a0c040' }}>
          ♥ {likes} Likes
        </button>
        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>👁️ {views} Views</span>
        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>💬 {comments.length} Comments</span>
      </div>

      {/* AI Profanity Scanning Notification */}
      {scanning && (
        <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '12px', marginBottom: '1rem', color: '#93c5fd' }}>
          🛡️ <strong>AI Profanity Filter:</strong> Analyzing comment safety and content policies...
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px', marginBottom: '1rem', color: '#fca5a5' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Comment Form */}
      <form onSubmit={submitComment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !commentText.trim()} style={{ alignSelf: 'flex-start', padding: '8px 20px', borderRadius: '6px', background: '#a0c040', color: '#050a06', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          {loading ? 'Submitting...' : 'Post Comment'}
        </button>
      </form>

      {/* Comments List */}
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {comments.map(c => (
          <div key={c.id} style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong style={{ color: '#f1f5f9' }}>{c.author}</strong>
              <span>{new Date(c.date).toLocaleDateString()}</span>
            </div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem' }}>{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🛡️ Multi-Tier Profanity & Moderation Lifecycle

Every comment passes through 3 sequential safety layers:

| Layer | Type | Execution Speed | Action Trigger |
| :--- | :--- | :--- | :--- |
| **Stage 1** | In-Memory Regex & Toxic Lexicon | `< 2ms` | Instant rejection for known slurs and offensive spam words. |
| **Stage 2** | Google Gemini AI Safety API | `~300-800ms` | Contextual AI reasoning for hate speech, harassment, sexually explicit content, and harassment. |
| **Stage 3** | Database-Stored Banlist | `< 15ms` | Synced tenant-specific prohibited terms configured in the dashboard. |

### Handling Safety Responses in API:
When a comment contains profanity, the API returns a structured HTTP 400 response:
```json
{
  "success": false,
  "error": "Comment contains prohibited content",
  "warning": "Your comment was flagged by our automated safety filters.",
  "title": "Content Policy Warning",
  "isProfanity": true,
  "accountNotice": "Repeated violations will result in account suspension."
}
```

---

## 🔒 Security & Access Control Verification

1. **Tenant Isolation**: All API requests MUST include the `X-Website-Id` header (or `websiteId` body field).
2. **Author Token / JWT**: Authenticated actions require `Authorization: Bearer <token>` or `x-author-token: <deviceId>`.
3. **CORS Policy**: The SaaS backend permits all approved origins with standard headers: `Content-Type, Authorization, X-Website-Id, X-Device-Id, x-author-token`.
4. **Developer Kill-Switch**: If a website's access is revoked by the developer, the API immediately returns `{ error: "Website access revoked by administrator" }` and the script stops execution.

---

## 🧪 Verification & Automated Testing Script (AI Agent Executable)

AI Agents can execute this shell script to verify that the SaaS backend and integration endpoints are operational:

```bash
# 1. Health Check & Options Preflight
curl -i -X OPTIONS https://partial-existence.pages.dev/api/comments \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"

# 2. Test Unique Pageview Increment
curl -X POST https://partial-existence.pages.dev/api/pageviews \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: partial-existence" \
  -d '{"slug": "test-integration-post", "deviceId": "agent-test-device"}'

# 3. Test Like Count Retrieval
curl "https://partial-existence.pages.dev/api/likes?slug=test-integration-post&websiteId=partial-existence"

# 4. Test Comments Retrieval
curl "https://partial-existence.pages.dev/api/comments?slug=test-integration-post&websiteId=partial-existence"
```

---

## 📬 Developer Support & Status Inquiries

For approval acceleration, custom domain mapping, or quota upgrades:
- **Developer & Platform Administrator**: `dev.vinyas.one@gmail.com`
- **Dashboard URL**: `https://partial-existence.pages.dev`
- **Engine Version**: `3.0.0-saas`
