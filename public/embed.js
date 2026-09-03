/**
 * Partial Existence — Standalone SaaS Embed Script
 * 
 * 100% self-contained drop-in SaaS widget:
 * - Top-Right Sign In / User Initials Avatar Button + Built-in Auth Modal
 * - Verified Comments Section with Mandatory Auth Check
 * - Real-Time Deduplicated Likes & Pageview Analytics
 * - Subtle "Maintained by Partial Existence Services" Watermark
 * 
 * Simply add:
 * <script src="https://partial-existence.pages.dev/embed.js" data-website-id="partial-existence" async></script>
 */

(function () {
  'use strict';

  if (window.__PARTIAL_EXISTENCE_EMBED_INITIALIZED__) return;
  window.__PARTIAL_EXISTENCE_EMBED_INITIALIZED__ = true;

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

  let currentAuthToken = localStorage.getItem('pe_saas_token') || null;
  let currentUser = null;

  // --- Styles Injection ---
  function injectStyles() {
    if (document.getElementById('pe-saas-styles')) return;
    const style = document.createElement('style');
    style.id = 'pe-saas-styles';
    style.textContent = `
      #pe-saas-auth-container {
        position: fixed;
        top: 18px;
        right: clamp(14px, 3.5vw, 36px);
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .pe-saas-signin-btn {
        font-size: 0.85rem;
        font-weight: 500;
        color: #ffffff;
        background: rgba(18, 26, 22, 0.75);
        border: 1px solid rgba(160, 192, 64, 0.3);
        padding: 7px 16px;
        border-radius: 20px;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        letter-spacing: 0.02em;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
      }
      .pe-saas-signin-btn:hover {
        background: rgba(160, 192, 64, 0.2);
        border-color: #a0c040;
        color: #a0c040;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(160, 192, 64, 0.25);
      }
      .pe-saas-avatar-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(12, 24, 18, 0.85);
        border: 1.5px solid rgba(160, 192, 64, 0.45);
        cursor: pointer;
        padding: 0;
        color: #a0c040;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(12px);
        transition: all 0.24s ease;
        outline: none;
      }
      .pe-saas-avatar-btn:hover {
        border-color: #b8e040;
        transform: scale(1.08);
        box-shadow: 0 0 18px rgba(160, 192, 64, 0.45);
      }
      .pe-saas-avatar-initials {
        font-family: monospace;
        font-weight: 700;
        font-size: 0.86rem;
        letter-spacing: 0.04em;
        color: #a0c040;
      }
      .pe-saas-dropdown {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        width: 230px;
        background: rgba(8, 14, 11, 0.98);
        border: 1px solid rgba(120, 170, 130, 0.35);
        border-radius: 12px;
        padding: 14px;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pe-saas-dropdown-name {
        font-size: 0.92rem;
        font-weight: 600;
        color: #ffffff;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pe-saas-dropdown-email {
        font-size: 0.75rem;
        color: #9ca3af;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pe-saas-dropdown-badge {
        display: inline-block;
        font-size: 0.7rem;
        color: #a0c040;
        background: rgba(160, 192, 64, 0.12);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
        margin-top: 4px;
        width: fit-content;
      }
      .pe-saas-dropdown-logout {
        margin-top: 4px;
        padding: 8px;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        color: #fca5a5;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
      }
      .pe-saas-dropdown-logout:hover {
        background: rgba(239, 68, 68, 0.25);
        color: #ffffff;
      }
      /* Modal */
      #pe-saas-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .pe-saas-modal-card {
        background: rgba(10, 16, 12, 0.98);
        border: 1px solid rgba(120, 170, 130, 0.35);
        border-radius: 16px;
        width: 100%;
        max-width: 380px;
        padding: 28px 24px;
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .pe-saas-modal-close {
        position: absolute;
        top: 14px;
        right: 16px;
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 1.4rem;
        cursor: pointer;
      }
      .pe-saas-modal-close:hover { color: #ffffff; }
      .pe-saas-modal-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .pe-saas-modal-desc {
        font-size: 0.84rem;
        color: #9ca3af;
        margin: 4px 0 0 0;
        line-height: 1.4;
      }
      .pe-saas-modal-tabs {
        display: flex;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 3px;
        gap: 4px;
      }
      .pe-saas-modal-tab {
        flex: 1;
        padding: 8px;
        border: none;
        background: none;
        color: #9ca3af;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      .pe-saas-modal-tab.active {
        background: #a0c040;
        color: #050a06;
      }
      .pe-saas-input {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 10px 12px;
        color: #ffffff;
        font-size: 0.9rem;
        outline: none;
        width: 100%;
        box-sizing: border-box;
      }
      .pe-saas-input:focus { border-color: #a0c040; }
      .pe-saas-submit {
        background: #a0c040;
        color: #050a06;
        border: none;
        border-radius: 8px;
        padding: 12px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pe-saas-submit:hover { background: #b8e040; transform: translateY(-1px); }
      .pe-saas-watermark {
        display: block;
        padding: 0;
        margin-top: 6px;
        margin-bottom: 0;
        font-family: inherit;
        font-size: 0.74rem;
        color: rgba(148, 163, 184, 0.65);
        letter-spacing: 0.02em;
        text-align: center;
        user-select: none;
        opacity: 0.85;
        transition: opacity 0.2s ease;
      }
      .pe-saas-watermark:hover {
        opacity: 1;
      }
      .pe-saas-watermark a {
        color: #a0c040;
        text-decoration: none;
        font-weight: 500;
        margin-left: 2px;
        transition: color 0.18s ease;
      }
      .pe-saas-watermark a:hover {
        color: #b8e040;
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Helper: Get Initials ---
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  // --- Auth Render & Actions ---
  function renderAuthWidget() {
    let container = document.getElementById('pe-saas-auth-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pe-saas-auth-container';
      document.body.appendChild(container);
    }
    container.innerHTML = '';

    if (currentUser && currentAuthToken) {
      // Render Initials Avatar
      const avatarBtn = document.createElement('button');
      avatarBtn.type = 'button';
      avatarBtn.className = 'pe-saas-avatar-btn';
      avatarBtn.title = `${currentUser.name} (${currentUser.email})`;
      avatarBtn.innerHTML = `<span class="pe-saas-avatar-initials">${getInitials(currentUser.name)}</span>`;

      let dropdown = null;
      avatarBtn.onclick = (e) => {
        e.stopPropagation();
        if (dropdown) {
          dropdown.remove();
          dropdown = null;
          return;
        }
        dropdown = document.createElement('div');
        dropdown.className = 'pe-saas-dropdown';
        dropdown.innerHTML = `
          <p class="pe-saas-dropdown-name">${currentUser.name}</p>
          <p class="pe-saas-dropdown-email">${currentUser.email}</p>
          <span class="pe-saas-dropdown-badge">✓ Verified Account</span>
          <button class="pe-saas-dropdown-logout" id="pe-saas-logout-btn">Sign Out</button>
        `;
        container.appendChild(dropdown);

        dropdown.querySelector('#pe-saas-logout-btn').onclick = () => {
          localStorage.removeItem('pe_saas_token');
          currentAuthToken = null;
          currentUser = null;
          renderAuthWidget();
        };

        const closeDropdown = (evt) => {
          if (dropdown && !dropdown.contains(evt.target)) {
            dropdown.remove();
            dropdown = null;
            document.removeEventListener('click', closeDropdown);
          }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 50);
      };

      container.appendChild(avatarBtn);
    } else {
      // Render Sign In Button
      const signinBtn = document.createElement('button');
      signinBtn.type = 'button';
      signinBtn.className = 'pe-saas-signin-btn';
      signinBtn.innerText = 'Sign In';
      signinBtn.onclick = () => openAuthModal('login');
      container.appendChild(signinBtn);
    }
  }

  // --- Auth Modal ---
  function openAuthModal(initialTab = 'login') {
    let modal = document.getElementById('pe-saas-modal-overlay');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'pe-saas-modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    let currentTab = initialTab;

    function renderModalContent() {
      modal.innerHTML = `
        <div class="pe-saas-modal-card" onclick="event.stopPropagation()">
          <button class="pe-saas-modal-close" id="pe-modal-close-btn">&times;</button>
          <div>
            <h3 class="pe-saas-modal-title">${currentTab === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
            <p class="pe-saas-modal-desc">${currentTab === 'login' ? 'Sign in to join the discussion and share your reflections.' : 'Create an account to join the discussion.'}</p>
          </div>
          <div class="pe-saas-modal-tabs">
            <button class="pe-saas-modal-tab ${currentTab === 'login' ? 'active' : ''}" id="tab-login">Sign In</button>
            <button class="pe-saas-modal-tab ${currentTab === 'register' ? 'active' : ''}" id="tab-register">Create Account</button>
          </div>
          <form id="pe-saas-form" style="display:flex; flex-direction:column; gap:12px;">
            ${currentTab === 'register' ? '<input class="pe-saas-input" id="pe-name" type="text" placeholder="Display Name" required />' : ''}
            <input class="pe-saas-input" id="pe-email" type="email" placeholder="Email Address" required />
            <input class="pe-saas-input" id="pe-password" type="password" placeholder="Password (min 6 chars)" required minlength="6" />
            <span id="pe-auth-error" style="color:#f87171; font-size:0.8rem; display:none;"></span>
            <button class="pe-saas-submit" type="submit">${currentTab === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
        </div>
      `;

      modal.querySelector('#pe-modal-close-btn').onclick = () => modal.remove();
      modal.querySelector('#tab-login').onclick = () => { currentTab = 'login'; renderModalContent(); };
      modal.querySelector('#tab-register').onclick = () => { currentTab = 'register'; renderModalContent(); };

      const form = modal.querySelector('#pe-saas-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const errSpan = modal.querySelector('#pe-auth-error');
        errSpan.style.display = 'none';

        const email = modal.querySelector('#pe-email').value.trim();
        const password = modal.querySelector('#pe-password').value;
        const name = currentTab === 'register' ? modal.querySelector('#pe-name').value.trim() : '';

        const endpoint = currentTab === 'login' ? '/api/auth/login' : '/api/auth/register';
        const payload = currentTab === 'login' ? { email, password } : { name, email, password };

        try {
          const res = await fetch(`${hostUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Website-Id': websiteId },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (res.ok && data.token) {
            currentAuthToken = data.token;
            currentUser = data.user;
            localStorage.setItem('pe_saas_token', data.token);
            renderAuthWidget();
            modal.remove();
          } else {
            errSpan.innerText = `⚠️ ${data.error || 'Authentication failed'}`;
            errSpan.style.display = 'block';
          }
        } catch (err) {
          errSpan.innerText = `⚠️ Network Error: ${err.message}`;
          errSpan.style.display = 'block';
        }
      };
    }

    renderModalContent();
    document.body.appendChild(modal);
  }

  // --- Watermark (Seamlessly Blends Inside Existing Footer) ---
  function injectWatermark() {
    const footer = document.querySelector('footer') || document.getElementById('site-footer');
    if (!footer) return false;

    if (footer.querySelector('#pe-saas-watermark')) return true;

    // Remove any accidental orphan watermark attached to body
    const orphan = document.body.querySelector(':scope > #pe-saas-watermark');
    if (orphan) orphan.remove();

    const watermark = document.createElement('div');
    watermark.id = 'pe-saas-watermark';
    watermark.className = 'pe-saas-watermark';
    watermark.innerHTML = `Maintained by <a href="${hostUrl}" target="_blank" rel="noopener noreferrer">Partial Existence Services</a>`;

    footer.appendChild(watermark);
    return true;
  }

  function startWatermarkWatcher() {
    if (injectWatermark()) return;

    // React SPA observer: wait for footer to mount
    const observer = new MutationObserver(() => {
      if (injectWatermark()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Fallback timer
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (injectWatermark() || tries > 25) {
        clearInterval(interval);
      }
    }, 150);
  }

  // --- Init ---
  async function init() {
    injectStyles();
    startWatermarkWatcher();

    if (currentAuthToken) {
      try {
        const res = await fetch(`${hostUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${currentAuthToken}`, 'X-Website-Id': websiteId }
        });
        if (res.ok) {
          const data = await res.json();
          currentUser = data.user;
        } else {
          localStorage.removeItem('pe_saas_token');
          currentAuthToken = null;
        }
      } catch {
        // Keep offline token
      }
    }

    renderAuthWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PartialExistenceSaaS = {
    websiteId,
    apiUrl: hostUrl,
    version: '2.0.0',
    openAuth: openAuthModal,
    reinject: init
  };
})();
