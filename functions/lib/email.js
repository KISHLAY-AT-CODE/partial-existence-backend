/**
 * functions/lib/email.js — Developer Notification & Verification Dispatcher
 * 
 * Sends instant verification/approval request to the developer (dev.vinyas.one@gmail.com)
 * when a blog owner requests backend SaaS service.
 */

export const DEVELOPER_EMAIL = 'dev.vinyas.one@gmail.com';

/**
 * Send developer verification email with 1-click Approve / Reject action links
 */
export async function sendDeveloperVerificationEmail(env, { websiteId, name, blogUrl, samplePostUrl, ownerEmail, verificationToken, hostUrl }) {
  const approveUrl = `${hostUrl}/api/admin/review?action=approve&websiteId=${encodeURIComponent(websiteId)}&token=${encodeURIComponent(verificationToken)}`;
  const rejectUrl = `${hostUrl}/api/admin/review?action=reject&websiteId=${encodeURIComponent(websiteId)}&token=${encodeURIComponent(verificationToken)}`;
  const dashboardUrl = `${hostUrl}/`;

  const subject = `[Action Required] New Blog Owner Request: "${name}" (${websiteId})`;
  
  const textContent = `
New SaaS Service Request Submitted:

- Blog Name: ${name}
- Website ID: ${websiteId}
- Blog Owner Email: ${ownerEmail}
- Blog Website URL: ${blogUrl}
- Sample Blog Page URL: ${samplePostUrl}

Action Links:
[APPROVE]: ${approveUrl}
[REJECT]: ${rejectUrl}
[DASHBOARD]: ${dashboardUrl}
  `.trim();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #080c0a; color: #e2e8f0; padding: 24px; margin: 0;">
      <div style="max-width: 580px; margin: 0 auto; background: #101814; border: 1px solid #2d4536; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
        <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: rgba(160, 192, 64, 0.15); color: #a0c040; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
          Partial Existence SaaS Engine
        </div>
        <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px;">New Blog Verification Request</h2>
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          A blog owner has registered their website and is requesting access to your backend auth & comments service.
        </p>

        <div style="background: rgba(0,0,0,0.4); border: 1px solid #1f3026; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
          <div style="margin-bottom: 8px;"><strong style="color: #a0c040;">Blog Name:</strong> <span style="color: #ffffff;">${name}</span></div>
          <div style="margin-bottom: 8px;"><strong style="color: #a0c040;">Website ID:</strong> <code style="color: #6ee7b7; background: #06120b; padding: 2px 6px; border-radius: 4px;">${websiteId}</code></div>
          <div style="margin-bottom: 8px;"><strong style="color: #a0c040;">Owner Email:</strong> <span style="color: #ffffff;">${ownerEmail}</span></div>
          <div style="margin-bottom: 8px;"><strong style="color: #a0c040;">Website URL:</strong> <a href="${blogUrl}" target="_blank" style="color: #38bdf8;">${blogUrl}</a></div>
          <div><strong style="color: #a0c040;">Sample Post URL:</strong> <a href="${samplePostUrl}" target="_blank" style="color: #38bdf8;">${samplePostUrl}</a></div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <a href="${approveUrl}" target="_blank" style="flex: 1; text-align: center; background: #a0c040; color: #050a06; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px; font-size: 14px;">
            ✓ Confirm & Approve
          </a>
          <a href="${rejectUrl}" target="_blank" style="flex: 1; text-align: center; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px; font-size: 14px;">
            ✗ Reject Access
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
          Sent to developer ${DEVELOPER_EMAIL} from Partial Existence Pages Engine.
        </p>
      </div>
    </body>
    </html>
  `;

  // 1. Try MailChannels (Free native on Cloudflare Pages)
  try {
    const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: DEVELOPER_EMAIL, name: 'Developer (Vinyas)' }],
          },
        ],
        from: {
          email: 'no-reply@partial-existence.pages.dev',
          name: 'Partial Existence SaaS Engine',
        },
        subject,
        content: [
          { type: 'text/plain', value: textContent },
          { type: 'text/html', value: htmlContent },
        ],
      }),
    });

    if (mailResponse.ok) {
      return { success: true, method: 'mailchannels' };
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Try Resend if API key is provided in env
  if (env?.RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Partial Existence <onboarding@resend.dev>',
          to: [DEVELOPER_EMAIL],
          subject,
          html: htmlContent,
        }),
      });

      if (resendRes.ok) {
        return { success: true, method: 'resend' };
      }
    } catch {}
  }

  // 3. Fallback: Log approval details and return direct action links
  console.log(`[Developer Notification for ${DEVELOPER_EMAIL}]:`, {
    websiteId,
    approveUrl,
    rejectUrl
  });

  return {
    success: true,
    method: 'direct_link',
    approveUrl,
    rejectUrl
  };
}
