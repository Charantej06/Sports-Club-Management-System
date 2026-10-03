import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Read uploaded screenshot
const imagePath = "C:/Users/chriz/.gemini/antigravity/brain/beee4031-afee-4316-9017-50e30e64d814/.user_uploaded/media_1791039855705.png";
const imageBase64 = readFileSync(imagePath).toString("base64");
const imageSrc = `data:image/png;base64,${imageBase64}`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Champions Club — Staff Desk Features & Auth Deep Dive</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4;
    margin: 11mm 11mm 13mm 11mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 9.5px;
      color: #94a3b8;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e2430;
    background: #ffffff;
    line-height: 1.5;
    font-size: 12px;
    margin: 0;
    padding: 0;
  }

  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .force-page-break { page-break-before: always; break-before: page; }

  /* Cover Banner */
  .cover {
    background: linear-gradient(135deg, #090a0d 0%, #151821 60%, #1e1914 100%);
    color: #ffffff;
    padding: 18px 22px;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid #2d3139;
  }

  .cover-eyebrow {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #ff7836;
    margin-bottom: 3px;
  }

  .cover h1 {
    font-size: 19px;
    font-weight: 800;
    line-height: 1.25;
    margin: 0 0 5px 0;
    letter-spacing: -0.025em;
    color: #ffffff;
  }

  .cover-subtitle {
    font-size: 11px;
    color: #c2c7d0;
    margin: 0 0 8px 0;
    line-height: 1.4;
  }

  .cover-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 9.5px;
    color: #8b92a0;
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 6px;
  }

  .cover-meta strong { color: #ffffff; }

  h2 {
    font-size: 14.5px;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 2px solid #ff6b2c;
    padding-bottom: 3px;
    margin-top: 12px;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
    page-break-after: avoid;
  }

  h3 {
    font-size: 12.5px;
    font-weight: 700;
    color: #1e293b;
    margin-top: 8px;
    margin-bottom: 3px;
    page-break-after: avoid;
  }

  p { margin: 0 0 5px 0; }

  /* Feature Box */
  .feature-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 9px;
    page-break-inside: avoid;
  }

  .feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }

  .feature-title {
    font-weight: 700;
    font-size: 12.5px;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .feature-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .badge-owner { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
  .badge-all { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

  .workflow-list {
    margin: 4px 0;
    padding-left: 16px;
  }

  .workflow-list li {
    margin-bottom: 3px;
    font-size: 11px;
    line-height: 1.45;
  }

  /* Code Card */
  .code-card {
    background: #0b0f17;
    border: 1px solid #1e2638;
    border-radius: 5px;
    margin: 5px 0 8px 0;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .code-header {
    background: #151b27;
    color: #94a3b8;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 9.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-bottom: 1px solid #1e2638;
    display: flex;
    justify-content: space-between;
  }

  pre {
    margin: 0;
    padding: 6px 10px;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 9.5px;
    line-height: 1.4;
  }

  code {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 10px;
    background: #f1f3f7;
    color: #c2410c;
    padding: 1px 3.5px;
    border-radius: 3px;
    border: 1px solid #e2e6ec;
  }

  pre .keyword { color: #f472b6; font-weight: 600; }
  pre .func { color: #60a5fa; }
  pre .str { color: #34d399; }
  pre .comment { color: #64748b; font-style: italic; }
  pre .type { color: #fbbf24; }

  /* Callouts */
  .callout {
    padding: 8px 12px;
    border-radius: 5px;
    margin: 6px 0;
    font-size: 11px;
    line-height: 1.45;
    border-left: 3.5px solid #ff6b2c;
    background: #fff7ed;
    color: #9a3412;
    page-break-inside: avoid;
  }

  .callout.info { border-left-color: #3b82f6; background: #eff6ff; color: #1e40af; }
  .callout.success { border-left-color: #10b981; background: #ecfdf5; color: #065f46; }
  .callout.warning { border-left-color: #f59e0b; background: #fffbeb; color: #92400e; }

  .callout-title { font-weight: 700; font-size: 11px; margin-bottom: 2px; }

  /* Grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 6px 0; }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 7px 9px;
    page-break-inside: avoid;
  }

  /* Screenshot container */
  .screenshot-container {
    display: flex;
    gap: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    margin: 6px 0;
    align-items: flex-start;
    page-break-inside: avoid;
  }

  .screenshot-img-wrap {
    flex: 0 0 115px;
    background: #f1f5f9;
    border-radius: 4px;
    padding: 3px;
    border: 1px solid #cbd5e1;
    text-align: center;
  }

  .screenshot-img {
    max-width: 100%;
    height: auto;
    border-radius: 3px;
    display: block;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0;
    font-size: 10.5px;
    page-break-inside: avoid;
  }

  th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
  }

  td {
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="cover avoid-break">
    <div class="cover-eyebrow">CHAMPIONS CLUB TECHNICAL & FEATURE GUIDE</div>
    <h1>Staff Desk Workspaces, Better Auth & Member QR System</h1>
    <div class="cover-subtitle">Detailed functional walkthrough of every Staff Desk feature from the navigation sidebar, how Better Auth operates under the hood, and how the cryptographic member QR cards are issued, rendered, and verified.</div>
    <div class="cover-meta">
      <div><strong>Monolith:</strong> Next.js 16 · React 19 · Prisma 7 · PostgreSQL</div>
      <div><strong>Auth Engine:</strong> Better Auth (v1.7.7)</div>
      <div><strong>QR Suite:</strong> qrcode + @zxing/browser</div>
      <div><strong>Focus:</strong> Real-world Operations & Workflows</div>
    </div>
  </div>

  <!-- SECTION: WHAT IS BETTER AUTH -->
  <div class="avoid-break">
    <h2>1. What is Better Auth & Why It's Used Here</h2>
    <p><strong>Better Auth</strong> is a TypeScript-first, self-hosted authentication library for Next.js and Node.js. Unlike third-party cloud auth providers (Clerk, Auth0, Firebase), Better Auth runs <strong>100% inside this application</strong> and writes directly to our local PostgreSQL database using Prisma.</p>

    <div class="grid-2">
      <div class="card">
        <strong>❌ Cloud SaaS Auth (Clerk / Auth0)</strong>
        <p style="font-size: 10px; margin: 2px 0 0 0;">Stores user records on external servers, requires monthly paid fees, adds 200ms+ network roundtrips, breaks relational joins with bookings/orders, and cannot run offline.</p>
      </div>
      <div class="card">
        <strong>✅ Better Auth (Self-Hosted in Champions Club)</strong>
        <p style="font-size: 10px; margin: 2px 0 0 0;">Zero monthly fees. All user accounts, sessions, password hashes, and rate-limits live directly inside PostgreSQL tables. Works offline with zero third-party dependencies.</p>
      </div>
    </div>

    <h3>The 5 Database Tables Better Auth Controls</h3>
    <div class="grid-3">
      <div class="card">
        <strong>1. <code>User</code></strong>
        <p style="font-size: 10px; color:#475569; margin: 2px 0 0 0;">Stores identity: name, email, role (MEMBER, CASHIER, etc.), Champions ID (CC-XXXXX), and emailVerified status.</p>
      </div>
      <div class="card">
        <strong>2. <code>Session</code></strong>
        <p style="font-size: 10px; color:#475569; margin: 2px 0 0 0;">Active browser sessions (token, userId, expiresAt, ipAddress) linked to an <code>httpOnly</code> cookie.</p>
      </div>
      <div class="card">
        <strong>3. <code>Account</code></strong>
        <p style="font-size: 10px; color:#475569; margin: 2px 0 0 0;">Stores password hashes (argon2/scrypt). Kept isolated from profile information.</p>
      </div>
    </div>
    <div class="grid-2" style="margin-top: 4px;">
      <div class="card">
        <strong>4. <code>Verification</code></strong>
        <p style="font-size: 10px; color:#475569; margin: 2px 0 0 0;">Transient 1-hour cryptographic tokens for email verification links and password resets.</p>
      </div>
      <div class="card">
        <strong>5. <code>RateLimit</code></strong>
        <p style="font-size: 10px; color:#475569; margin: 2px 0 0 0;">Database-backed sliding window counters (5 signups/min, 10 signins/min) stopping brute-force attacks without Redis.</p>
      </div>
    </div>
  </div>

  <!-- SECTION: HOW AUTH WORKS -->
  <div class="avoid-break" style="margin-top: 8px;">
    <h2>2. Authentication & The "Dual Guard" Rule</h2>
    <p>When a user registers or logs in, how does the system prevent privilege escalation and enforce immediate role changes?</p>

    <div class="callout success">
      <div class="callout-title">🛡️ Security Invariant: Zero Privilege Escalation at Signup</div>
      In <code>src/lib/auth.ts</code>, both <code>role</code> and <code>championsId</code> have <code>input: false</code>. A transactional database hook forces every public signup to <code>role = "MEMBER"</code> and generates a random Champions ID (e.g. <code>CC-4A92F1</code>). Even if an attacker injects <code>{ "role": "OWNER" }</code> into the HTTP payload, it is rejected by Better Auth.
    </div>

    <p><strong>The Dual Guard (<code>src/lib/access.ts</code>):</strong> Most apps trust a session cookie or JWT for 7 days. But what if the Owner demotes an employee from <code>RECEPTION</code> to <code>MEMBER</code>? A cached cookie would let them keep snooping on bookings! Champions Club uses a 2-step verification on every request:</p>
    <ol style="padding-left: 16px; margin: 3px 0; font-size: 11px;">
      <li>Better Auth validates the cryptographic session cookie token.</li>
      <li><strong>Immediate Database Lookup:</strong> The server re-reads the fresh <code>User</code> row directly from PostgreSQL. If the role was changed or revoked, access is denied <strong>instantaneously</strong> on that exact HTTP request!</li>
    </ol>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="force-page-break"></div>

  <!-- SECTION: DETAILED BREAKDOWN OF THE SCREENSHOT -->
  <div class="avoid-break">
    <h2>3. Deep Dive into the Staff Workspace (Your Screenshot)</h2>
    <p>The screenshot you shared shows the <strong>Owner Navigation Sidebar</strong> in <code>src/components/staff-desk.tsx</code>. When a user with the <code>OWNER</code> role logs in and visits <code>/staff</code>, they have complete operational control over these 6 core functions:</p>

    <div class="screenshot-container">
      <div class="screenshot-img-wrap">
        <img src="${imageSrc}" alt="Staff Sidebar" class="screenshot-img" />
        <div style="font-size: 8.5px; color:#64748b; margin-top: 2px; font-weight:600;">Staff Sidebar UI</div>
      </div>
      <div class="screenshot-details">
        <p style="margin:0 0 3px 0; font-size:11px; font-weight:700; color:#0f172a;">Menu Items in Screenshot:</p>
        <ul class="workflow-list" style="margin:0; padding-left:14px;">
          <li><strong>📋 Club desk:</strong> The main operations dashboard showing live counters and actionable tasks.</li>
          <li><strong>[ ] Member lookup:</strong> Identity station for scanning QR cards or searching by Champions ID / email.</li>
          <li><strong>⚙ Business settings:</strong> Owner configuration for operating hours, booking windows, and tab limits.</li>
          <li><strong>👥 Membership plans:</strong> Plan designer for prices (in paise), terms, and discount basis points.</li>
          <li><strong>👥 Staff access:</strong> Role management panel for promoting staff and revoking active sessions.</li>
          <li><strong>✉ Local test inbox:</strong> In-browser email viewer for offline verification links & password resets.</li>
        </ul>
      </div>
    </div>

    <!-- FEATURE 1: CLUB DESK -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">1. 📋 Club Desk (Tab: <code>id: "today"</code>) — Active Tab</span>
        <span class="feature-badge badge-all">All Staff & Owner</span>
      </div>
      <p><strong>What it is:</strong> The front-line operational cockpit that staff see the moment they open the app.</p>
      <p><strong>What it does on screen:</strong></p>
      <ul class="workflow-list">
        <li><strong>Live Action Badges:</strong> Queries <code>GET /api/staff/home</code> every 5 seconds to display large metric cards:
          <em>"Today's Court Bookings: 8"</em>, <em>"Unread CRM Enquiries: 3"</em>, <em>"Low Stock Inventory Items: 2"</em>, <em>"Open Kitchen Tickets: 4"</em>, and <em>"Active Cash Shift: OPEN"</em>.
        </li>
        <li><strong>One-Click Workflow Navigation:</strong> Clicking any metric card immediately switches the view to that specific workspace. For example, clicking "3 Unread Enquiries" instantly opens the CRM desk so reception can respond to the customer.</li>
        <li><strong>Role Banner:</strong> Displays the logged-in staff member's name and role badge (e.g. <em>"Hello, Arjun. Reception workspace"</em>).</li>
      </ul>
    </div>

    <!-- FEATURE 2: MEMBER LOOKUP -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">2. [ ] Member Lookup (Tab: <code>id: "lookup"</code>)</span>
        <span class="feature-badge badge-all">Reception, Cashiers, Owner</span>
      </div>
      <p><strong>What it is:</strong> The customer identification station used at Reception, Pro Shop, and Clubhouse dining.</p>
      <p><strong>Real-World Workflow:</strong></p>
      <ul class="workflow-list">
        <li><strong>Scenario:</strong> A customer walks up to the tennis desk to check in or arrives at the clubhouse restaurant table.</li>
        <li><strong>Camera QR Scan:</strong> Staff clicks <strong>"Scan QR camera"</strong>. The device webcam activates. The customer holds up their phone displaying their digital QR card from <code>/account</code>. The camera decodes the QR token in under 200 milliseconds.</li>
        <li><strong>Manual Fallback:</strong> If the customer doesn't have their phone, staff can type their <strong>Champions ID</strong> (e.g., <code>CC-4A92F1</code>) or registered <strong>email address</strong>.</li>
        <li><strong>Output Shown to Staff:</strong> The system displays the member's full name, Champions ID, active membership tier (e.g. <em>"Gold Plan · 25% court, 15% shop, 10% clubhouse discount"</em>), and the plan expiration date.</li>
        <li><strong>Security Rule:</strong> It verifies identity and eligibility; it <strong>never automatically debits money</strong> or exposes passwords.</li>
      </ul>
    </div>

    <!-- FEATURE 3: BUSINESS SETTINGS -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">3. ⚙ Business Settings (Tab: <code>id: "settings"</code>)</span>
        <span class="feature-badge badge-owner">Owner Exclusive</span>
      </div>
      <p><strong>What it is:</strong> The owner's policy control room where club operating rules are established and stored in the <code>ClubSettings</code> table.</p>
      <p><strong>Key Rules Controlled by the Owner:</strong></p>
      <ul class="workflow-list">
        <li><strong>Club Hours:</strong> Opening (e.g. <code>06:00</code>) and Closing hour (e.g. <code>23:00</code> Asia/Kolkata). Courts cannot be booked outside these hours.</li>
        <li><strong>Booking Window (Days):</strong> (Default: <code>14</code> days). Members cannot reserve slots months in advance, preventing slot hoarding.</li>
        <li><strong>Daily Session Limit:</strong> (Default: <code>2</code> sessions). Prevents a single player from booking 5 hours of courts in a single day.</li>
        <li><strong>Checkout Hold Duration:</strong> (Default: <code>5</code> minutes). When a player clicks "Book", the court is locked for 5 minutes. If they abandon checkout or close their laptop, the database worker automatically releases the slot for other members.</li>
        <li><strong>Cancellation Notice Hours:</strong> (Default: <code>12</code> hours). Customers must cancel at least 12 hours before game time to receive a refund/credit. Cancellations inside 12 hours require staff override with a recorded reason.</li>
        <li><strong>Member Bar Tab Limit:</strong> (Default: <code>₹5,000</code> / 500,000 paise). The maximum credit a member can run up at the restaurant/bar before their account is blocked from further credit.</li>
        <li><strong>Automated Reminder Schedule:</strong> (Default: <code>7, 1, 0</code> days). The background worker automatically schedules expiry reminder emails 7 days before, 1 day before, and on the day a membership expires at 09:00 AM.</li>
      </ul>
    </div>
  </div>

  <!-- ==================== PAGE 3 ==================== -->
  <div class="force-page-break"></div>

  <div class="avoid-break">
    <!-- FEATURE 4: MEMBERSHIP PLANS -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">4. 👥 Membership Plans (Tab: <code>id: "plans"</code>)</span>
        <span class="feature-badge badge-owner">Owner Exclusive</span>
      </div>
      <p><strong>What it is:</strong> The product catalog designer where the owner builds and modifies membership packages (Standard, Gold, Junior).</p>
      <p><strong>What the Owner Configures:</strong></p>
      <ul class="workflow-list">
        <li><strong>Plan Price in Integer Paise:</strong> Stored as integers to prevent rounding bugs (e.g. ₹12,000 is stored as <code>1200000</code>).</li>
        <li><strong>Term Duration:</strong> Number of days the membership lasts (e.g. <code>365</code> days for annual, <code>30</code> days for monthly).</li>
        <li><strong>Discounts in Basis Points:</strong> 100 basis points = 1%. For example, setting <code>courtDiscountBps = 2500</code> grants a <strong>25% discount</strong> on all court reservations.</li>
        <li><strong>Clubhouse & Shop Discounts:</strong> Separate discount percentages for restaurant dining and pro shop merchandise.</li>
        <li><strong>Free Weekly Court Quotas:</strong> Complimentary court hours granted to premium tiers (e.g. Gold members receive 1 free session per week).</li>
        <li><strong>Plan Versioning & Immutability:</strong> If the owner raises Gold membership from ₹12,000 to ₹15,000, <strong>existing members are not affected</strong>. Past invoices and purchased memberships retain their historical price snapshot forever. The new price receives a fresh <code>planVersion</code> timestamp.</li>
      </ul>
    </div>

    <!-- FEATURE 5: STAFF ACCESS -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">5. 👥 Staff Access (Tab: <code>id: "users"</code>)</span>
        <span class="feature-badge badge-owner">Owner Exclusive</span>
      </div>
      <p><strong>What it is:</strong> The owner's employee onboarding and Role-Based Access Control (RBAC) portal.</p>
      <p><strong>How an Employee is Granted Staff Access:</strong></p>
      <ol class="workflow-list">
        <li>The employee registers a regular account on <code>/signup</code> with their email address.</li>
        <li>The Owner opens <strong>Staff access</strong>, types the employee's email, and chooses their role from the dropdown:
          <div style="margin: 4px 0;">
            <span class="feature-badge badge-all" style="margin-right: 4px;">RECEPTION</span> Court calendar, check-ins, CRM lead quotes, member lookup.<br>
            <span class="feature-badge badge-all" style="margin-right: 4px;">CASHIER</span> Waiter POS tables, shop counter checkout, cash reconciliation.<br>
            <span class="feature-badge badge-all" style="margin-right: 4px;">KITCHEN</span> Kitchen Display System (KDS), cooking queue, marking tickets ready.<br>
            <span class="feature-badge badge-owner" style="margin-right: 4px;">OWNER</span> Unrestricted master access to payroll, finance, settings, and reports.
          </div>
        </li>
        <li><strong>Instant Session Revocation:</strong> The moment the owner clicks <em>"Assign role"</em>, the server updates the database AND runs:
          <code>await tx.session.deleteMany({ where: { userId: user.id } })</code>.
          This terminates all active sessions across all devices for that employee, forcing them to sign in again with their new staff permissions.
        </li>
      </ol>
    </div>

    <!-- FEATURE 6: LOCAL TEST INBOX -->
    <div class="feature-box">
      <div class="feature-header">
        <span class="feature-title">6. ✉ Local Test Inbox (Tab: <code>id: "inbox"</code>)</span>
        <span class="feature-badge badge-owner">Owner Exclusive (Local Mode)</span>
      </div>
      <p><strong>What it is:</strong> An embedded, in-browser email client built specifically for local development, hackathons, and offline testing.</p>
      <p><strong>Why it exists & how to use it:</strong></p>
      <ul class="workflow-list">
        <li>Real SMTP providers (SendGrid, AWS SES) require credit cards, domain verification, and an internet connection.</li>
        <li>When running locally (<code>EMAIL_MODE=local</code>), the server intercepts all outgoing emails (signup verification, password reset links, membership expiry notices) and writes them to PostgreSQL's <code>MailMessage</code> table.</li>
        <li>Staff/Developers simply open this tab to see outgoing emails in real-time.</li>
        <li>Inside the email body is a blue link: <strong>"Open secure local link ↗"</strong>. Clicking it verifies your test account or resets your password immediately with zero external dependencies!</li>
      </ul>
    </div>
  </div>

  <!-- ==================== PAGE 4 ==================== -->
  <div class="force-page-break"></div>

  <!-- SECTION: HOW QR IS MADE AND SCANNED -->
  <div class="avoid-break">
    <h2>4. How the Member QR Card is Made (Generation)</h2>
    <p>Every active member receives a digital membership card on their <code>/account</code> dashboard (generated in <code>src/modules/account/cards.ts</code>).</p>

    <div class="grid-2">
      <div class="card">
        <strong>Step 1: Opaque Cryptographic Token</strong>
        <p style="font-size: 10.5px; margin: 3px 0 0 0;">The server checks that the user has an active membership, then generates a 48-character random hex token:</p>
        <pre><span class="keyword">const</span> token = <span class="func">randomBytes</span>(24).<span class="func">toString</span>(<span class="str">"hex"</span>);
<span class="keyword">await</span> tx.memberCard.<span class="func">upsert</span>({
  where: { userId },
  create: { userId, token },
  update: { token, revokedAt: <span class="keyword">null</span>, issuedAt: now }
});</pre>
      </div>

      <div class="card">
        <strong>Step 2: Base64 PNG Rendering</strong>
        <p style="font-size: 10.5px; margin: 3px 0 0 0;">The payload <code>champions:card:&lt;token&gt;</code> is converted into a PNG data URL using the <code>qrcode</code> package:</p>
        <pre><span class="keyword">const</span> qr = <span class="keyword">await</span> QRCode.<span class="func">toDataURL</span>(
  <span class="str">\`champions:card:\${card.token}\`</span>,
  { width: 240, margin: 2, errorCorrectionLevel: <span class="str">"M"</span> }
);</pre>
      </div>
    </div>

    <div class="callout warning">
      <div class="callout-title">🔒 The Opaque Token Principle (Zero Personal Data in QR)</div>
      The QR matrix <strong>never contains the member's name, email, phone number, balance, or discounts</strong>. If someone takes a photo of the card, they acquire zero credentials. Members can click <strong>"Revoke card"</strong> anytime on <code>/account</code> to invalidate the token immediately.
    </div>
  </div>

  <div class="avoid-break" style="margin-top: 10px;">
    <h2>5. How the Member QR Card is Read & Verified</h2>
    <p>Scanning is handled by staff via <code>MemberFinder</code> in <code>src/components/staff-operations.tsx</code>.</p>

    <div class="grid-2">
      <div class="card">
        <strong>📷 1. Live Camera Stream (@zxing/browser)</strong>
        <p style="font-size: 10.5px; margin: 3px 0 0 0;">Accesses the webcam via WebRTC. Zebra Crossing decodes video frames continuously:</p>
        <pre><span class="keyword">const</span> reader = <span class="keyword">new</span> <span class="type">BrowserQRCodeReader</span>();
<span class="keyword">await</span> reader.<span class="func">decodeFromVideoDevice</span>(
  <span class="keyword">undefined</span>, videoRef, (res, err, controls) =&gt; {
    <span class="keyword">if</span> (res) {
      controls.<span class="func">stop</span>(); <span class="comment">// Stop camera once read</span>
      <span class="func">lookupMemberApi</span>(res.<span class="func">getText</span>());
    }
  }
);</pre>
      </div>

      <div class="card">
        <strong>🔍 2. Database Resolution (/api/staff/lookup)</strong>
        <p style="font-size: 10.5px; margin: 3px 0 0 0;">The server validates the token and confirms that <code>revokedAt</code> is null:</p>
        <pre><span class="keyword">const</span> token = query.<span class="func">slice</span>(15);
<span class="keyword">const</span> card = <span class="keyword">await</span> db.memberCard.<span class="func">findUnique</span>({
  where: { token }, include: { user: <span class="keyword">true</span> }
});
<span class="keyword">if</span> (!card || card.revokedAt) <span class="keyword">throw new</span> <span class="type">AppError</span>(404, <span class="str">"CARD_INVALID"</span>);
<span class="keyword">const</span> membership = <span class="keyword">await</span> <span class="func">currentMembership</span>(card.userId);
<span class="keyword">return</span> { name: card.user.name, membership };</pre>
      </div>
    </div>

    <div class="callout info">
      <div class="callout-title">⚠️ Identification ≠ Payment Authority</div>
      In poorly designed club systems, scanning a QR card automatically charges the user or opens an unlimited bar tab. In Champions Club, <strong>a QR scan ONLY identifies who the player is and which membership tier they hold</strong>. Any financial transaction (paying an invoice, recording a cash/UPI payment, court booking) requires a separate, explicit payment authorization flow.
    </div>
  </div>

  <!-- SECTION: SUMMARY CHEATSHEET -->
  <div class="avoid-break" style="margin-top: 10px;">
    <h2>6. Summary Reference Table for Frontend Work</h2>
    <table>
      <thead>
        <tr>
          <th>Subsystem</th>
          <th>Component File</th>
          <th>What You Need to Know When Editing Frontend</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Auth Client</strong></td>
          <td><code>src/lib/auth-client.ts</code></td>
          <td>Call <code>authClient.signIn.email()</code>, <code>authClient.signOut()</code>, or <code>authClient.useSession()</code>.</td>
        </tr>
        <tr>
          <td><strong>Staff Desk UI</strong></td>
          <td><code>src/components/staff-desk.tsx</code></td>
          <td>Tabs filter dynamically by <code>user.role</code>. Only <code>OWNER</code> sees Settings, Plans, Access, and Inbox.</td>
        </tr>
        <tr>
          <td><strong>QR Display</strong></td>
          <td><code>src/components/account.tsx</code></td>
          <td>Renders base64 data URL returned by <code>GET /api/me/card</code> inside the member card view.</td>
        </tr>
        <tr>
          <td><strong>QR Camera</strong></td>
          <td><code>src/components/staff-operations.tsx</code></td>
          <td><code>MemberFinder</code> manages webcam stream, ZXing barcode decoding, and API lookup.</td>
        </tr>
      </tbody>
    </table>
  </div>

</body>
</html>`;

const htmlPath = resolve("docs/Champions_Club_Auth_and_Staff_Guide.html");
writeFileSync(htmlPath, htmlContent, "utf-8");

const pdfPath = resolve("docs/Champions_Club_Auth_and_Staff_Guide.pdf");
const artifactPdfPath = "C:/Users/chriz/.gemini/antigravity/brain/beee4031-afee-4316-9017-50e30e64d814/Champions_Club_Auth_and_Staff_Guide.pdf";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
console.log("Compiling feature-rich PDF with Chrome headless...");

const res = spawnSync(chromePath, [
  "--headless",
  "--disable-gpu",
  "--run-all-compositor-stages-before-draw",
  `--print-to-pdf=${pdfPath}`,
  "--no-pdf-header-footer",
  htmlPath
], { stdio: "inherit" });

if (res.error) {
  console.error("Chrome error:", res.error);
  process.exit(1);
}

try {
  const pdfBytes = readFileSync(pdfPath);
  writeFileSync(artifactPdfPath, pdfBytes);
} catch (e) {
  console.warn("Artifact copy warning:", e.message);
}

console.log("Updated feature-rich PDF compiled successfully at:", pdfPath);
