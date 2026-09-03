# Partial Existence — Cloudflare Pages Serverless Backend

A serverless edge backend powered by **Cloudflare Pages Functions** and **MongoDB Atlas** for the [Partial Existence Blog](https://kishlay-at-code.github.io/partial-existence).

Provides high-performance endpoints for:
- 👁️ **Pageviews** tracking
- ❤️ **Likes** count & toggling
- 💬 **Comments** storage & retrieval
- 📊 **Aggregate Blog Statistics**

---

## 📁 Directory Structure

```
partial-existence-backend/
├── functions/
│   ├── _middleware.js     # CORS handling, preflights & security headers
│   ├── api/
│   │   ├── comments.js    # GET / POST / DELETE comments
│   │   ├── likes.js       # GET / POST likes
│   │   ├── pageviews.js   # GET / POST view counter
│   │   └── stats.js       # GET aggregate totals
│   └── lib/
│       ├── mongodb.js     # MongoDB connection pooling
│       ├── cors.js        # Strict CORS origins & response helper
│       └── validation.js  # Input sanitization & security checks
├── public/
│   └── index.html         # Status / health check landing page
├── wrangler.toml          # Cloudflare Pages configuration
├── .env.example           # Environment variable template
└── package.json           # Scripts and dependencies
```

---

## 🚀 Setup & Deployment Guide

### Step 1: Set up MongoDB Atlas (Free Tier)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Create a free **M0 Cluster** (Shared).
3. Under **Security > Database Access**:
   - Create a database user with username and a strong password.
4. Under **Security > Network Access**:
   - Add `0.0.0.0/0` (Allow access from anywhere, required for serverless edge functions).
5. Click **Connect > Drivers > Node.js**:
   - Copy your connection string:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```

---

### Step 2: Deploying to Cloudflare Pages

#### Method A: 1-Click via Cloudflare Dashboard (Recommended)

1. Push this repository or the `partial-existence-backend` folder to GitHub.
2. Open your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages > Create application > Pages > Connect to Git**.
3. Select your repository:
   - **Framework preset**: `None`
   - **Build output directory**: `public`
   - **Root directory**: `partial-existence-backend` (or leave empty if it is its own repo)
4. Go to **Settings > Environment variables > Production**:
   - Add `MONGODB_URI`: `mongodb+srv://<user>:<password>@...`
   - Add `MONGODB_DB_NAME`: `partial_existence`
   - Add `ALLOWED_ORIGINS`: `https://kishlay-at-code.github.io,http://localhost:5173,http://127.0.0.1:5173`
5. Click **Save and Deploy**. Cloudflare will assign a URL such as `https://partial-existence-backend.pages.dev`.

#### Method B: Deploy using Wrangler CLI

```bash
cd "partial-existence-backend"
npm install
npx wrangler pages deploy public
```

---

### Step 3: Local Development & Testing

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your MongoDB connection string in `.env`.
3. Start the local Cloudflare Pages dev server:
   ```bash
   npm run dev
   ```
4. Access the API locally at `http://localhost:8788`.

---

## 📡 API Reference

### 1. Pageviews
* **`GET /api/pageviews?slug=mushishi-reflection`**
  ```json
  { "slug": "mushishi-reflection", "views": 42 }
  ```
* **`POST /api/pageviews`**
  ```json
  { "slug": "mushishi-reflection" }
  ```

### 2. Likes
* **`GET /api/likes?slug=mushishi-reflection`**
  ```json
  { "slug": "mushishi-reflection", "likes": 15 }
  ```
* **`POST /api/likes`**
  ```json
  { "slug": "mushishi-reflection", "action": "like" }
  // or action: "unlike"
  ```

### 3. Comments
* **`GET /api/comments?slug=mushishi-reflection`**
  ```json
  {
    "slug": "mushishi-reflection",
    "count": 1,
    "comments": [
      {
        "id": "cmt_1700000000000_abc123",
        "slug": "mushishi-reflection",
        "author": "Kishlay",
        "text": "Quiet mastery of atmosphere.",
        "date": "2026-08-29T17:00:00.000Z"
      }
    ]
  }
  ```
* **`POST /api/comments`**
  ```json
  {
    "slug": "mushishi-reflection",
    "author": "Kishlay",
    "text": "A poetic reflection on solitude and nature."
  }
  ```

### 4. Blog Overview Stats
* **`GET /api/stats`**
  ```json
  {
    "totalViews": 1280,
    "totalLikes": 340,
    "totalComments": 48,
    "timestamp": "2026-08-29T17:15:00.000Z"
  }
  ```

---

## 🔒 Security Features Built-in

- **NoSQL Injection Defense**: Explicit query selectors with strong type validation.
- **Cross-Origin Resource Sharing (CORS)**: Strict origin matching (`https://kishlay-at-code.github.io`).
- **Input Sanitization**: Comment inputs sanitized and capped to prevent payload abuse.
- **Security Headers**: Standard headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.
