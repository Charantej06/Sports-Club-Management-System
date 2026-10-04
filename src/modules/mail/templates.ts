/**
 * Champions Club – HTML email templates.
 *
 * All templates share a consistent brand shell (black/white/orange).
 * Each function returns { subject, text, html } ready to pass to queueMail.
 */

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function shell(content: string, preheader = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>Champions Club</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e8e8e8; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 16px 56px; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 40px; }
    .mark { width: 34px; height: 34px; background: #f97316; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
    .wordmark { font-size: 13px; font-weight: 800; letter-spacing: .22em; color: #fff; text-transform: uppercase; }
    .wordmark span { color: #f97316; }
    .card { background: #141414; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 40px 36px; }
    h1 { font-size: 26px; font-weight: 700; color: #fff; line-height: 1.25; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.65; color: #b0b0b0; margin-bottom: 16px; }
    .btn { display: inline-block; margin: 24px 0 8px; background: #f97316; color: #fff !important; text-decoration: none !important; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; letter-spacing: .01em; }
    .url-block { margin-top: 20px; padding: 14px 16px; background: rgba(255,255,255,.05); border-radius: 8px; border: 1px solid rgba(255,255,255,.07); word-break: break-all; font-size: 12px; color: #888; }
    .url-block a { color: #f97316; }
    .divider { height: 1px; background: rgba(255,255,255,.08); margin: 32px 0; }
    .chip { display: inline-block; background: rgba(249,115,22,.12); color: #fb923c; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 20px; }
    .footer { margin-top: 36px; font-size: 12px; color: #555; text-align: center; line-height: 1.8; }
    .footer a { color: #888; text-decoration: none; }
    .preheader { display: none !important; visibility: hidden; font-size: 1px; color: transparent; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }
    @media (max-width:580px) { .card { padding: 28px 20px; } }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(preheader)}</div>
  <div class="wrap">
    <div class="logo">
      <div class="mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <div class="wordmark">CHAMPIONS<span>CLUB</span></div>
    </div>
    <div class="card">${content}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Champions Club. All rights reserved.<br/>
      You're receiving this email because you have an account at Champions Club.
    </div>
  </div>
</body>
</html>`;
}

/** Welcome / email verification email sent on sign-up and sign-in before verification. */
export function verificationEmail(name: string, url: string) {
  const first = name.split(" ")[0] || name;
  const subject = "Welcome to Champions Club — verify your email";
  const text = `Hello ${name},

Verify your Champions Club email address by clicking the link below.

${url}

This link expires in one hour. If you did not create an account, you can safely ignore this email.

— Champions Club`;

  const html = shell(
    `<div class="chip">Email verification</div>
    <h1>You're almost in, ${escapeHtml(first)}.</h1>
    <p>Thanks for joining Champions Club. Click the button below to verify your email address and activate your account.</p>
    <a class="btn" href="${escapeHtml(url)}">Verify my email</a>
    <div class="url-block">Or copy this link into your browser:<br/><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#666;">This link expires in <strong style="color:#999">one hour</strong>. If you didn't create an account at Champions Club, you can safely ignore this email.</p>`,
    `Verify your email to activate your Champions Club account.`,
  );

  return { subject, text, html };
}

/** Password reset email sent when a user requests a reset link. */
export function resetPasswordEmail(name: string, url: string) {
  const first = name.split(" ")[0] || name;
  const subject = "Reset your Champions Club password";
  const text = `Hello ${name},

We received a request to reset the password on your Champions Club account.

Reset your password: ${url}

This link expires in one hour. If you did not request a password reset, your account is safe — just ignore this email.

— Champions Club`;

  const html = shell(
    `<div class="chip">Password reset</div>
    <h1>Reset your password, ${escapeHtml(first)}.</h1>
    <p>We received a request to reset the password on your Champions Club account. Click the button below to choose a new password.</p>
    <a class="btn" href="${escapeHtml(url)}">Reset my password</a>
    <div class="url-block">Or copy this link into your browser:<br/><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#666;">This link expires in <strong style="color:#999">one hour</strong>. If you did not request a password reset, your account is safe — you can ignore this email.</p>`,
    `Reset your Champions Club password — link expires in 1 hour.`,
  );

  return { subject, text, html };
}

/** Membership expiry reminder sent by the background worker. */
export function membershipReminderEmail(
  name: string,
  planName: string,
  expiryDate: string,
  daysLeft: number,
) {
  const first = name.split(" ")[0] || name;
  const daysLabel =
    daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const subject = `Your ${planName} membership expires ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}`;
  const membershipsUrl = `${BASE_URL}/memberships`;
  const text = `Hello ${name},

Your ${planName} membership expires on ${expiryDate} (Asia/Kolkata) — ${daysLabel}.

Renew now to keep your court discounts, shop benefits and access to all club facilities.

${membershipsUrl}

— Champions Club`;

  const urgencyColor = daysLeft === 0 ? "#ef4444" : daysLeft <= 3 ? "#f97316" : "#22c55e";
  const urgencyLabel = daysLeft === 0 ? "Expires today" : daysLeft <= 3 ? "Expiring soon" : "Upcoming expiry";

  const html = shell(
    `<div class="chip" style="background:${urgencyColor}22;color:${urgencyColor};">${urgencyLabel}</div>
    <h1>Time to renew, ${escapeHtml(first)}.</h1>
    <p>Your <strong style="color:#fff">${escapeHtml(planName)}</strong> membership expires on <strong style="color:#fff">${escapeHtml(expiryDate)}</strong> — <strong style="color:${urgencyColor}">${daysLabel}</strong>.</p>
    <p>Renewing keeps your court discounts, shop benefits and everything else that comes with your membership.</p>
    <a class="btn" href="${escapeHtml(membershipsUrl)}">Renew my membership</a>
    <div class="divider"></div>
    <p style="font-size:13px;color:#666;">You're receiving this reminder because you have an active ${escapeHtml(planName)} membership at Champions Club.</p>`,
    `Your ${escapeHtml(planName)} membership expires ${daysLabel} — renew now.`,
  );

  return { subject, text, html };
}

/** Owner-triggered test email to verify SMTP delivery is working. */
export function testDeliveryEmail(name: string) {
  const subject = "Champions Club test email";
  const now = new Date().toUTCString();
  const text = `Hello ${name},

This is a test message from the Champions Club owner workspace.

If you can read this in your inbox, email delivery is working correctly.

Sent: ${now}

— Champions Club`;

  const html = shell(
    `<div class="chip" style="background:rgba(34,197,94,.12);color:#22c55e;">Test message</div>
    <h1>Email delivery is working. ✓</h1>
    <p>Hello ${escapeHtml(name)}, this test message was sent from the Champions Club owner workspace.</p>
    <p>If you're reading this in your inbox, your SMTP configuration is correct and email delivery is working end-to-end.</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#666;">Sent: ${now}</p>`,
    `Champions Club test email — delivery confirmed.`,
  );

  return { subject, text, html };
}

