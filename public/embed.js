/**
 * Partial Existence SaaS Embed SDK & Automatic Watermark Script
 * 
 * Usage:
 * <script src="https://partial-existence.pages.dev/embed.js" data-website-id="your-website-id" async></script>
 */

(function () {
  'use strict';

  // Prevent duplicate execution
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
   * Automatically Inject Subtle & Irremovable Watermark into page
   */
  function injectWatermark() {
    if (document.getElementById('pe-saas-watermark')) return;

    const watermark = document.createElement('div');
    watermark.id = 'pe-saas-watermark';
    watermark.setAttribute('data-saas-tenant', websiteId);

    // Subtle & elegant styling without any emojis or dots
    watermark.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      margin: 18px auto 8px auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 0.76rem;
      color: rgba(148, 163, 184, 0.75);
      letter-spacing: 0.03em;
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

    link.onmouseover = function () {
      link.style.color = '#b8e040';
      link.style.textDecoration = 'underline';
    };
    link.onmouseout = function () {
      link.style.color = '#a0c040';
      link.style.textDecoration = 'none';
    };

    watermark.appendChild(textSpan);
    watermark.appendChild(link);

    // Target footer or body
    const footer = document.querySelector('footer') || document.getElementById('site-footer');
    if (footer) {
      footer.appendChild(watermark);
    } else if (document.body) {
      document.body.appendChild(watermark);
    }
  }

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWatermark);
  } else {
    injectWatermark();
  }

  // Export lightweight client helper
  window.PartialExistenceSaaS = {
    websiteId: websiteId,
    apiUrl: hostUrl,
    version: '1.0.0',
    reinject: injectWatermark
  };
})();
