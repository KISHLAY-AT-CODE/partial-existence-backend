/**
 * Partial Existence SaaS Embed SDK & Smart Section Mapper
 * 
 * Auto-placement based on:
 * 1. Blog Website URL -> Maps the Sign-In / Account Section (Top-Right Header)
 * 2. Sample Blog Page URL -> Maps the Likes, Views & Comments Section (Blog Posts)
 */

(function () {
  'use strict';

  if (window.__PARTIAL_EXISTENCE_EMBED_LOADED__) return;
  window.__PARTIAL_EXISTENCE_EMBED_LOADED__ = true;

  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="embed.js"]') ||
    document.querySelector('script[src*="saas-embed.js"]');

  const websiteId =
    currentScript?.getAttribute('data-website-id') ||
    window.PARTIAL_EXISTENCE_WEBSITE_ID ||
    'partial-existence';

  const hostUrl = currentScript?.src
    ? new URL(currentScript.src).origin
    : 'https://partial-existence.pages.dev';

  /**
   * Helper: Extract current post slug from URL
   */
  function getCurrentSlug(postPattern) {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'general-post';
  }

  /**
   * Helper: Check if current page is a blog post based on sample pattern
   */
  function isBlogPostPage(postPattern) {
    const currentPath = window.location.pathname.toLowerCase();
    const pattern = (postPattern || '/posts/').toLowerCase();

    if (currentPath.includes(pattern)) return true;
    if (currentPath.includes('/posts/') || currentPath.includes('/blog/') || currentPath.includes('/article/')) return true;
    if (document.querySelector('article') || document.querySelector('.post-content') || document.querySelector('#post-content')) return true;

    return false;
  }

  /**
   * 1. Inject Subtle Footer Watermark
   */
  function injectWatermark() {
    if (document.getElementById('pe-saas-watermark')) return;

    const watermark = document.createElement('div');
    watermark.id = 'pe-saas-watermark';
    watermark.setAttribute('data-saas-tenant', websiteId);

    watermark.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      margin: 20px auto 10px auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 0.75rem;
      color: rgba(148, 163, 184, 0.7);
      letter-spacing: 0.02em;
      text-align: center;
      user-select: none;
      width: fit-content;
      max-width: 90%;
      z-index: 99;
      clear: both;
    `;

    const textSpan = document.createElement('span');
    textSpan.innerText = 'Maintained by ';

    const link = document.createElement('a');
    link.href = hostUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerText = 'Partial Existence Services';
    link.style.cssText = `
      color: #a0c040;
      text-decoration: none;
      font-weight: 500;
      margin-left: 3px;
      transition: color 0.18s ease;
    `;

    link.onmouseover = () => { link.style.color = '#b8e040'; link.style.textDecoration = 'underline'; };
    link.onmouseout = () => { link.style.color = '#a0c040'; link.style.textDecoration = 'none'; };

    watermark.appendChild(textSpan);
    watermark.appendChild(link);

    const footer = document.querySelector('footer') || document.getElementById('site-footer');
    if (footer) {
      footer.appendChild(watermark);
    } else if (document.body) {
      document.body.appendChild(watermark);
    }
  }

  /**
   * Main Initializer
   */
  async function initSaaS() {
    injectWatermark();

    // Fetch site routing patterns from backend
    try {
      const res = await fetch(`${hostUrl}/api/websites?websiteId=${encodeURIComponent(websiteId)}`);
      if (res.ok) {
        const siteData = await res.json();
        const postPattern = siteData.postPathPattern || '/posts/';

        // Auto-record pageview on blog post pages
        if (isBlogPostPage(postPattern)) {
          const slug = getCurrentSlug(postPattern);
          const deviceId = localStorage.getItem('pe_saas_device') || ('dev_' + Math.random().toString(36).substring(2, 9));
          localStorage.setItem('pe_saas_device', deviceId);

          fetch(`${hostUrl}/api/pageviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Website-Id': websiteId, 'X-Device-Id': deviceId },
            body: JSON.stringify({ slug, deviceId, websiteId })
          }).catch(() => {});
        }
      }
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSaaS);
  } else {
    initSaaS();
  }

  window.PartialExistenceSaaS = {
    websiteId,
    apiUrl: hostUrl,
    version: '1.2.0',
    reinject: initSaaS
  };
})();
