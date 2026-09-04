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
      /* SaaS Profanity Moderation Dialogue Box */
      #pe-saas-profanity-overlay {
        position: fixed;
        inset: 0;
        background: rgba(10, 15, 20, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        animation: peFadeIn 0.25s ease-out forwards;
      }
      @keyframes peFadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      .pe-saas-profanity-card {
        background: linear-gradient(145deg, rgba(20, 28, 36, 0.96), rgba(12, 18, 24, 0.98));
        border: 1px solid rgba(147, 197, 253, 0.35);
        border-radius: 1rem;
        padding: 2rem 2.25rem;
        max-width: 440px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.8), 0 0 35px -5px rgba(59, 130, 246, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f0f6fc;
      }
      .pe-saas-shield-wrap {
        position: relative;
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.25rem;
      }
      .pe-saas-shield-radar {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid rgba(59, 130, 246, 0.55);
        animation: peRadar 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
      }
      @keyframes peRadar {
        0% { transform: scale(0.6); opacity: 0.9; }
        70% { transform: scale(1.4); opacity: 0.15; box-shadow: 0 0 25px rgba(96, 165, 250, 0.6); }
        100% { transform: scale(1.6); opacity: 0; }
      }
      .pe-saas-shield-icon {
        font-size: 2rem;
        z-index: 2;
        filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.7));
      }
      .pe-saas-profanity-title {
        font-size: 1.15rem;
        font-weight: 600;
        color: #f0f6fc;
        margin: 0 0 0.5rem 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
      }
      .pe-saas-scramble-badge {
        font-family: monospace;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.22em;
        background: linear-gradient(90deg, #f43f5e, #fbbf24, #34d399, #38bdf8, #a78bfa, #ec4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        display: inline-block;
        padding: 2px 10px;
        background-color: rgba(15, 23, 42, 0.7);
        border-radius: 6px;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .pe-saas-profanity-desc {
        font-size: 0.82rem;
        line-height: 1.45;
        color: #94a3b8;
        margin: 0 0 1.5rem 0;
        max-width: 320px;
      }
      .pe-saas-symbols-track {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        padding: 0.65rem 1.15rem;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 9999px;
      }
      .pe-saas-symbol {
        font-family: monospace;
        font-size: 1.25rem;
        font-weight: 700;
        display: inline-block;
      }
      .pe-saas-progress-track {
        width: 100%;
        height: 4px;
        background: rgba(30, 41, 59, 0.8);
        border-radius: 9999px;
        overflow: hidden;
        position: relative;
      }
      .pe-saas-progress-bar {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 40%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
        border-radius: 9999px;
        animation: peIndeterminate 1.6s ease-in-out infinite;
      }
      @keyframes peIndeterminate {
        0% { left: -40%; width: 30%; }
        50% { left: 30%; width: 50%; }
        100% { left: 100%; width: 30%; }
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
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
            <button class="pe-saas-dropdown-logout" id="pe-saas-logout-btn">Sign Out</button>
            <button type="button" id="pe-saas-delete-btn" style="background:none; border:none; color:#f87171; font-size:0.75rem; cursor:pointer; padding:4px; text-decoration:underline; opacity:0.8; transition:opacity 0.2s;">
              Delete Account
            </button>
          </div>
        `;
        container.appendChild(dropdown);

        dropdown.querySelector('#pe-saas-logout-btn').onclick = () => {
          localStorage.removeItem('pe_saas_token');
          currentAuthToken = null;
          currentUser = null;
          renderAuthWidget();
        };

        dropdown.querySelector('#pe-saas-delete-btn').onclick = async () => {
          if (!confirm('Are you sure you want to permanently delete your account and all reflections? This action cannot be undone.')) return;
          try {
            const res = await fetch(`${hostUrl}/api/auth/me`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${currentAuthToken}`, 'X-Website-Id': websiteId }
            });
            if (res.ok) {
              alert('Your account has been deleted.');
              localStorage.removeItem('pe_saas_token');
              currentAuthToken = null;
              currentUser = null;
              renderAuthWidget();
            } else {
              const d = await res.json();
              alert(`Error: ${d.error || 'Failed to delete account'}`);
            }
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
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
            <div id="pe-saas-easter-egg" style="display:none; background: rgba(160, 192, 64, 0.18); border: 1.5px solid #a0c040; border-radius: 10px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s ease; box-shadow: 0 0 20px rgba(160, 192, 64, 0.3);">
              <div style="font-weight: 700; color: #b8e040; font-size: 0.88rem; margin-bottom: 3px;">🕵️ Hidden Copyright Verifier</div>
              <div style="font-size: 0.78rem; color: #ffffff; text-decoration: underline;">Click here to access Partial Existence SaaS Engine &rarr;</div>
            </div>
            <input class="pe-saas-input" id="pe-password" type="password" placeholder="Password (min 6 chars)" required minlength="6" />
            <span id="pe-auth-error" style="color:#f87171; font-size:0.8rem; display:none;"></span>
            <button class="pe-saas-submit" type="submit">${currentTab === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
        </div>
      `;

      modal.querySelector('#pe-modal-close-btn').onclick = () => modal.remove();
      modal.querySelector('#tab-login').onclick = () => { currentTab = 'login'; renderModalContent(); };
      modal.querySelector('#tab-register').onclick = () => { currentTab = 'register'; renderModalContent(); };

      // Easter Egg: Hidden Copyright Verifier
      const emailInput = modal.querySelector('#pe-email');
      const easterEgg = modal.querySelector('#pe-saas-easter-egg');

      emailInput.oninput = () => {
        if (emailInput.value.trim().toLowerCase() === 'whoami@gmail.com') {
          easterEgg.style.display = 'block';
        } else {
          easterEgg.style.display = 'none';
        }
      };

      easterEgg.onclick = () => {
        window.open(hostUrl, '_blank', 'noopener,noreferrer');
      };

      const form = modal.querySelector('#pe-saas-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const errSpan = modal.querySelector('#pe-auth-error');
        errSpan.style.display = 'none';

        const email = modal.querySelector('#pe-email').value.trim();
        const password = modal.querySelector('#pe-password').value;
        const name = currentTab === 'register' ? modal.querySelector('#pe-name').value.trim() : '';

        // If verifier email, trigger redirection directly
        if (email.toLowerCase() === 'whoami@gmail.com') {
          window.open(hostUrl, '_blank', 'noopener,noreferrer');
          modal.remove();
          return;
        }

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

    // Check approval status with backend
    try {
      const siteRes = await fetch(`${hostUrl}/api/websites?websiteId=${encodeURIComponent(websiteId)}`);
      if (siteRes.ok) {
        const siteData = await siteRes.json();
        if (websiteId !== 'partial-existence' && siteData.status && siteData.status !== 'approved') {
          console.warn(`[Partial Existence SaaS]: Website "${websiteId}" is pending developer approval (dev.vinyas.one@gmail.com).`);
          return;
        }
      }
    } catch {
      // Fallback
    }

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

  // --- SaaS Profanity Moderation Dialogue Box Controller ---
  let moderationInterval = null;

  function showModerationDialog(options = {}) {
    hideModerationDialog();

    const overlay = document.createElement('div');
    overlay.id = 'pe-saas-profanity-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Looking for profanity words');

    const title = options.title || 'Looking for profanity words...';
    const subtitle = options.subtitle || 'Verifying content against safety datasets, AI moderation & database filters';
    const chars = ['$', '%', '^', '&', '*', '#', '@', '!'];

    overlay.innerHTML = `
      <div class="pe-saas-profanity-card" onclick="event.stopPropagation()">
        <div class="pe-saas-shield-wrap">
          <div class="pe-saas-shield-radar"></div>
          <div class="pe-saas-shield-icon">🛡️</div>
        </div>
        <h4 class="pe-saas-profanity-title">
          <span>${title}</span>
          <span class="pe-saas-scramble-badge" id="pe-saas-scramble-text">$%^&*#@!</span>
        </h4>
        <p class="pe-saas-profanity-desc">${subtitle}</p>
        <div class="pe-saas-symbols-track" aria-hidden="true">
          ${chars.map((c, i) => `<span class="pe-saas-symbol" style="color: ${['#34d399', '#fbbf24', '#38bdf8', '#a78bfa', '#f472b6', '#f43f5e', '#60a5fa', '#fb923c'][i]}">${c}</span>`).join('')}
        </div>
        <div class="pe-saas-progress-track">
          <div class="pe-saas-progress-bar"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const badge = overlay.querySelector('#pe-saas-scramble-text');
    moderationInterval = setInterval(() => {
      if (badge) {
        badge.innerText = [...chars].sort(() => 0.5 - Math.random()).join('');
      }
    }, 110);
  }

  function hideModerationDialog() {
    if (moderationInterval) {
      clearInterval(moderationInterval);
      moderationInterval = null;
    }
    const overlay = document.getElementById('pe-saas-profanity-overlay');
    if (overlay) overlay.remove();
  }

  async function postCommentWithModeration(slug, text, extra = {}) {
    showModerationDialog();
    try {
      const res = await fetch(`${hostUrl}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Website-Id': websiteId,
          ...(currentAuthToken ? { 'Authorization': `Bearer ${currentAuthToken}` } : {})
        },
        body: JSON.stringify({
          slug,
          text,
          author: currentUser?.name || 'Anonymous',
          email: currentUser?.email || null,
          websiteId,
          ...extra
        })
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      hideModerationDialog();
    }
  }

  window.PartialExistenceSaaS = {
    websiteId,
    apiUrl: hostUrl,
    version: '3.0.0-saas',
    openAuth: openAuthModal,
    showModerationScan: showModerationDialog,
    hideModerationScan: hideModerationDialog,
    postCommentWithModeration,
    reinject: init
  };
})();
