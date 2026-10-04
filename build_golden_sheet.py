import os
import subprocess
import shutil
import fitz

def build_html():
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Champions Club - API Golden One-Shot Sheet</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  @page {
    size: A4 portrait;
    margin: 12mm 10mm 12mm 10mm;
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-left {
      content: "Champions Club - API Golden Reference Sheet";
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 8.5pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Header banner */
  .header-banner {
    background: linear-gradient(135deg, #09090b 0%, #18181b 65%, #27272a 100%);
    color: #ffffff;
    padding: 18px 20px;
    border-radius: 8px;
    margin-bottom: 12px;
    border-left: 6px solid #f97316;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-title-box h1 {
    font-size: 18pt;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title-box h1 .orange {
    color: #f97316;
  }

  .header-title-box p {
    font-size: 9pt;
    color: #cbd5e1;
    margin-top: 4px;
    max-width: 520px;
    line-height: 1.35;
  }

  .header-badges {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  .tech-pill {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    padding: 2.5px 8px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-family: 'JetBrains Mono', monospace;
    color: #f1f5f9;
    font-weight: 500;
  }

  /* Core Architecture Bar */
  .system-spec-bar {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .spec-item {
    display: flex;
    flex-direction: column;
  }

  .spec-label {
    font-size: 6.8pt;
    text-transform: uppercase;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.04em;
  }

  .spec-val {
    font-size: 8pt;
    font-weight: 600;
    color: #0f172a;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Index / Summary Matrix */
  .index-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .index-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
    margin-bottom: 8px;
  }

  .index-head h3 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #0f172a;
  }

  .index-head span {
    font-size: 7.5pt;
    font-family: 'JetBrains Mono', monospace;
    color: #64748b;
  }

  .index-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .index-col h4 {
    font-size: 7.8pt;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    margin-bottom: 4px;
    letter-spacing: 0.03em;
  }

  .index-list {
    list-style: none;
    font-size: 7.2pt;
    line-height: 1.45;
  }

  .index-list li {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }

  .index-list .idx-title {
    color: #334155;
    font-weight: 500;
  }

  .index-list .idx-ep {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6.8pt;
    color: #0284c7;
    font-weight: 600;
  }

  /* Section Title */
  .section-divider {
    padding: 7px 12px;
    margin: 14px 0 9px 0;
    border-radius: 5px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    page-break-after: avoid;
    break-after: avoid;
  }

  .section-divider.member-sec {
    background: #09090b;
    color: #ffffff;
    border-left: 5px solid #f97316;
  }

  .section-divider.owner-sec {
    background: #0f172a;
    color: #ffffff;
    border-left: 5px solid #0ea5e9;
  }

  .section-divider h2 {
    font-size: 10.5pt;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .section-divider .sec-tag {
    font-size: 7.5pt;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 600;
  }

  /* API Feature Card */
  .api-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    margin-bottom: 9px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
  }

  .api-card-header {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 5px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ep-box {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .m-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7pt;
    font-weight: 700;
    padding: 1.5px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
  }

  .m-get { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .m-post { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .m-patch { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
  .m-delete { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }

  .ep-route {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.2pt;
    font-weight: 700;
    color: #0f172a;
  }

  .feat-title {
    font-size: 8.5pt;
    font-weight: 700;
    color: #334155;
    margin-left: 4px;
  }

  .role-pill {
    font-size: 6.8pt;
    font-weight: 700;
    padding: 1.5px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-family: 'JetBrains Mono', monospace;
  }

  .rp-public { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .rp-member { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
  .rp-staff { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
  .rp-kitchen { background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }
  .rp-owner { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }
  .rp-webhook { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

  .api-card-body {
    padding: 7px 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .left-desc {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .desc-text {
    font-size: 8pt;
    color: #334155;
    line-height: 1.35;
    margin-bottom: 5px;
  }

  .rules-box {
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 4px;
    padding: 5px 8px;
    display: flex;
    flex-direction: column;
    gap: 2.5px;
  }

  .rule-row {
    font-size: 7.2pt;
    color: #475569;
    display: flex;
    align-items: flex-start;
    gap: 4px;
    line-height: 1.3;
  }

  .rule-row strong {
    color: #1e293b;
  }

  .bullet {
    color: #f97316;
    font-weight: 800;
  }

  .right-code {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .code-block {
    background: #09090b;
    color: #f8fafc;
    border-radius: 4px;
    padding: 5px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 6.8pt;
    line-height: 1.3;
    position: relative;
    border: 1px solid #27272a;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .code-lbl {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 5.8pt;
    color: #71717a;
    text-transform: uppercase;
    font-weight: 700;
  }

  .c-kw { color: #f43f5e; font-weight: 600; }
  .c-str { color: #38bdf8; }
  .c-key { color: #fb923c; }
  .c-num { color: #a78bfa; }
  .c-com { color: #71717a; font-style: italic; }

  .appendix-box {
    background: #09090b;
    color: #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 14px;
    border-top: 3px solid #f97316;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .appendix-title {
    font-size: 9pt;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }

  .appendix-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 7.2pt;
    line-height: 1.4;
  }

  .appendix-item h5 {
    color: #f97316;
    font-size: 7.5pt;
    margin-bottom: 3px;
  }
</style>
</head>
<body>

  <!-- COVER BANNER -->
  <div class="header-banner">
    <div class="header-title-box">
      <h1>CHAMPIONS <span class="orange">CLUB</span></h1>
      <p><strong>Complete API Golden Cheat Sheet</strong> - Exhaustive developer reference covering Member Client Flows (Booking, Cart Checkout, Pass, Payments) and Owner/Staff Operations (Mission Control, QR Scanner, POS, Kitchen KDS, Inventory, HR & Reports).</p>
    </div>
    <div class="header-badges">
      <div class="tech-pill">Next.js App Router Monolith</div>
      <div class="tech-pill">PostgreSQL + Prisma Source of Truth</div>
      <div class="tech-pill">All Currencies in Integer Paise (INR)</div>
      <div class="tech-pill">Asia/Kolkata Club-Day Rules</div>
    </div>
  </div>

  <!-- SPECS BAR -->
  <div class="system-spec-bar">
    <div class="spec-item">
      <span class="spec-label">Session Authentication</span>
      <span class="spec-val">Better-Auth (HTTP-Only Cookie/Bearer)</span>
    </div>
    <div class="spec-item">
      <span class="spec-label">Mutation Idempotency</span>
      <span class="spec-val">Header: Idempotency-Key &lt;UUID&gt;</span>
    </div>
    <div class="spec-item">
      <span class="spec-label">Advisory & Concurrency Locks</span>
      <span class="spec-val">pg_advisory_xact_lock & SELECT FOR UPDATE</span>
    </div>
    <div class="spec-item">
      <span class="spec-label">Security & Audit</span>
      <span class="spec-val">Immutable Invoices & Mandatory Audit Reasons</span>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="index-box">
    <div class="index-head">
      <h3>API Feature Directory (33 Comprehensive Endpoints)</h3>
      <span>Quick-Reference Navigation</span>
    </div>
    <div class="index-grid">
      <div class="index-col">
        <h4>Part 1: Member & Public Client Features</h4>
        <ul class="index-list">
          <li><span class="idx-title">1. Public Catalog & Club Info</span> <span class="idx-ep">GET /api/public</span></li>
          <li><span class="idx-title">2. Court Availability Slot Grid</span> <span class="idx-ep">GET /api/public/availability</span></li>
          <li><span class="idx-title">3. Court Slot Booking Hold</span> <span class="idx-ep">POST /api/operations/booking</span></li>
          <li><span class="idx-title">4. Booking Confirm & Cancel</span> <span class="idx-ep">POST /api/operations/booking/:id</span></li>
          <li><span class="idx-title">5. Shop Cart Hold & Checkout</span> <span class="idx-ep">POST /api/operations/order</span></li>
          <li><span class="idx-title">6. Shop Confirm & Member Cancel</span> <span class="idx-ep">POST /api/operations/order/:id</span></li>
          <li><span class="idx-title">7. Membership Plan Subscription</span> <span class="idx-ep">POST /api/me/membership</span></li>
          <li><span class="idx-title">8. Digital QR Pass (Gate Key)</span> <span class="idx-ep">GET|POST|DEL /api/me/card</span></li>
          <li><span class="idx-title">9. Member Profile & Statement</span> <span class="idx-ep">GET|PATCH /api/me</span></li>
          <li><span class="idx-title">10. Immutable Tax Invoices</span> <span class="idx-ep">GET /api/me/invoices/:id</span></li>
          <li><span class="idx-title">11. Payment Gateway Intents</span> <span class="idx-ep">POST|PATCH /api/payments</span></li>
          <li><span class="idx-title">12. Social Mix-In Sessions</span> <span class="idx-ep">GET|POST /api/operations/social</span></li>
          <li><span class="idx-title">13. Court Waiting List Queue</span> <span class="idx-ep">POST /api/operations/waiting</span></li>
          <li><span class="idx-title">14. Public Enquiry Ingestion</span> <span class="idx-ep">POST /api/enquiries</span></li>
          <li><span class="idx-title">15. Member Better-Auth Engine</span> <span class="idx-ep">POST /api/auth/*</span></li>
        </ul>
      </div>
      <div class="index-col">
        <h4>Part 2: Owner & Staff Operations</h4>
        <ul class="index-list">
          <li><span class="idx-title">16. Owner Mission Control Home</span> <span class="idx-ep">GET /api/staff/home</span></li>
          <li><span class="idx-title">17. Reception Scanner & Lookup</span> <span class="idx-ep">GET /api/staff/lookup</span></li>
          <li><span class="idx-title">18. Court Closures & Check-In</span> <span class="idx-ep">POST /api/operations/closure</span></li>
          <li><span class="idx-title">19. Clubhouse POS & Dining Bills</span> <span class="idx-ep">POST /api/operations/bill</span></li>
          <li><span class="idx-title">20. Kitchen Display System (KDS)</span> <span class="idx-ep">POST /api/operations/kitchen</span></li>
          <li><span class="idx-title">21. Shop Inventory Stock Adjust</span> <span class="idx-ep">POST /api/operations/stock</span></li>
          <li><span class="idx-title">22. Shop Fulfillment & Returns</span> <span class="idx-ep">POST /api/operations/order/:id</span></li>
          <li><span class="idx-title">23. In-Person Billing & Payments</span> <span class="idx-ep">POST /api/operations/payment/:id</span></li>
          <li><span class="idx-title">24. Cash Drawer Shift Balancing</span> <span class="idx-ep">POST /api/staff/admin (cash)</span></li>
          <li><span class="idx-title">25. Financial & Operational Reports</span> <span class="idx-ep">GET /api/staff/reports</span></li>
          <li><span class="idx-title">26. HR Roster, Leaves & Payroll</span> <span class="idx-ep">GET /api/staff/payroll-export</span></li>
          <li><span class="idx-title">27. Operating Hours & Rules</span> <span class="idx-ep">PATCH /api/staff/settings</span></li>
          <li><span class="idx-title">28. Plan Pricing & Perks Config</span> <span class="idx-ep">PATCH /api/staff/plans</span></li>
          <li><span class="idx-title">29. Staff Role Delegation</span> <span class="idx-ep">PATCH /api/staff/users</span></li>
          <li><span class="idx-title">30. Security Audit Trail Logs</span> <span class="idx-ep">GET /api/staff/admin (audit)</span></li>
          <li><span class="idx-title">31. CRM Lead Conversion Pipeline</span> <span class="idx-ep">POST /api/operations/crm/:id</span></li>
          <li><span class="idx-title">32. Outbox Mail Queue & Retries</span> <span class="idx-ep">GET|POST /api/staff/inbox</span></li>
          <li><span class="idx-title">33. Razorpay Webhook Ingestion</span> <span class="idx-ep">POST /api/payments/webhook</span></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- SECTION 1: MEMBER & CLIENT FEATURES -->
  <!-- ======================================================== -->
  <div class="section-divider member-sec">
    <h2>PART 1: MEMBER & PUBLIC CLIENT-FACING FEATURES</h2>
    <span class="sec-tag">15 Features</span>
  </div>

  <!-- 1. Public Discovery -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/public</span>
        <span class="feat-title">1. Public Club Discovery & Facilities Catalog</span>
      </div>
      <span class="role-pill rp-public">Public</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Returns active courts, four sports (Tennis, Padel, Badminton, Cricket), membership tier previews with pricing in paise, highlighted shop gear, clubhouse menu highlights, and club operating rules.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Zero Cache Stale:</strong> Real-time dynamic fetch from PostgreSQL for courts and active plans.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>No Auth Required:</strong> Used by public landing page hero and visitors.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X GET https://club.champions.com/api/public
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"settings"</span>: { <span class="c-key">"openHour"</span>: <span class="c-num">6</span>, <span class="c-key">"closeHour"</span>: <span class="c-num">23</span>, <span class="c-key">"bookingWindowDays"</span>: <span class="c-num">7</span> },
    <span class="c-key">"sports"</span>: [<span class="c-str">"tennis"</span>, <span class="c-str">"padel"</span>, <span class="c-str">"badminton"</span>, <span class="c-str">"cricket"</span>],
    <span class="c-key">"plans"</span>: [{ <span class="c-key">"id"</span>: <span class="c-str">"gold"</span>, <span class="c-key">"name"</span>: <span class="c-str">"Gold"</span>, <span class="c-key">"monthlyPaise"</span>: <span class="c-num">500000</span> }]
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 2. Availability -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/public/availability</span>
        <span class="feat-title">2. Court Availability Grid & Real-Time Slot Finder</span>
      </div>
      <span class="role-pill rp-public">Public / Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Calculates hourly court availability for a chosen sport and calendar date in Asia/Kolkata timezone. Evaluates confirmed reservations, court maintenance closures, and live 15-minute transactional holds.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Params:</strong> <code>sport</code> (enum) and <code>date</code> (ISO <code>YYYY-MM-DD</code>).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>States:</strong> Evaluates <code>AVAILABLE</code>, <code>HOLD</code>, <code>BOOKED</code>, or <code>CLOSED</code>.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Fetch API</span>
<span class="c-kw">const</span> res = <span class="c-kw">await</span> fetch(<span class="c-str">"/api/public/availability?sport=padel&date=2026-10-04"</span>);
<span class="c-kw">const</span> { data } = <span class="c-kw">await</span> res.json();
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"sport"</span>: <span class="c-str">"padel"</span>, <span class="c-key">"date"</span>: <span class="c-str">"2026-10-04"</span>,
    <span class="c-key">"courts"</span>: [{ <span class="c-key">"id"</span>: <span class="c-str">"crt_padel_1"</span>, <span class="c-key">"name"</span>: <span class="c-str">"Padel Center Court"</span> }],
    <span class="c-key">"slots"</span>: [{ <span class="c-key">"hour"</span>: <span class="c-num">18</span>, <span class="c-key">"courtId"</span>: <span class="c-str">"crt_padel_1"</span>, <span class="c-key">"available"</span>: <span class="c-kw">true</span> }]
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 3. Court Slot Hold -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/booking</span>
        <span class="feat-title">3. Court Booking Slot Hold (1-Hour Booking Engine)</span>
      </div>
      <span class="role-pill rp-member">Member / Guest</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Places a 15-minute hold on a 1-hour court slot. Enforces club settings: 7-day advance booking window, hourly start times (e.g. 18:00, 19:00), active court checks, and member daily/peak quotas.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Advisory Lock:</strong> <code>courtLock(tx, courtId, startsAt)</code> prevents race conditions.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Header:</strong> Requires <code>Idempotency-Key: &lt;UUID&gt;</code> to prevent duplicate holds.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Trial Session:</strong> Set <code>trial: true</code> for first-time prospective customer trials.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/booking \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: b7f1e9a2-4c8d-4e92-91f3-7e4a8b9c0d1e"</span> \
  -d <span class="c-str">'{"courtId":"crt_ten_1","day":"2026-10-04","hour":19,"trial":false}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"res_hold_9921"</span>,
  <span class="c-key">"status"</span>: <span class="c-str">"HOLD"</span>,
  <span class="c-key">"courtId"</span>: <span class="c-str">"crt_ten_1"</span>,
  <span class="c-key">"holdUntil"</span>: <span class="c-str">"2026-10-03T18:15:00.000Z"</span>,
  <span class="c-key">"totalPaise"</span>: <span class="c-num">120000</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 4. Booking Action -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/booking/[id]</span>
        <span class="feat-title">4. Court Booking Confirmation & Member Cancellation</span>
      </div>
      <span class="role-pill rp-member">Member / Staff</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Converts held booking to CONFIRMED or performs early cancellation. Calculates membership perks (deducting free monthly court hours or tier discount) and generates an immutable tax invoice.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>confirm</code>: Deducts free tier hours or generates invoice. Paid via LOCAL/GATEWAY.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>cancel</code>: Allowed &gt;12h before start; automatically issues full credit note.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>checkin</code>: Member self check-in upon arrival at the clubhouse.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">TypeScript Fetch (Confirm)</span>
<span class="c-kw">await</span> fetch(<span class="c-str">"/api/operations/booking/res_hold_9921"</span>, {
  method: <span class="c-str">"POST"</span>,
  headers: { <span class="c-str">"Content-Type"</span>: <span class="c-str">"application/json"</span>, <span class="c-str">"Idempotency-Key"</span>: crypto.randomUUID() },
  body: JSON.stringify({ action: <span class="c-str">"confirm"</span>, method: <span class="c-str">"LOCAL"</span> })
});
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"status"</span>: <span class="c-str">"CONFIRMED"</span>,
  <span class="c-key">"invoiceId"</span>: <span class="c-str">"inv_crt_8841"</span>,
  <span class="c-key">"tierPerksApplied"</span>: { <span class="c-key">"freeHourUsed"</span>: <span class="c-kw">true</span>, <span class="c-key">"chargedPaise"</span>: <span class="c-num">0</span> },
  <span class="c-key">"confirmedAt"</span>: <span class="c-str">"2026-10-03T18:02:14.000Z"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 5. Shop Cart Hold -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/order</span>
        <span class="feat-title">5. The Champions Shop - Cart Hold & Checkout</span>
      </div>
      <span class="role-pill rp-member">Member / Guest</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Places a 15-minute stock reservation on up to 30 items. Applies tier member discounts (e.g. 15% off for Gold members) and handles in-club counter collection or courier shipping.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Stock Concurrency:</strong> <code>SELECT FOR UPDATE</code> locks variants and increments <code>reserved</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Delivery Address:</strong> Validates street, city, 6-digit Indian PIN, and phone.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Header:</strong> Requires <code>Idempotency-Key: &lt;UUID&gt;</code>.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">JSON Payload</span>
{
  <span class="c-key">"items"</span>: [{ <span class="c-key">"variantId"</span>: <span class="c-str">"var_head_padel"</span>, <span class="c-key">"quantity"</span>: <span class="c-num">1</span> }],
  <span class="c-key">"delivery"</span>: <span class="c-kw">false</span>,
  <span class="c-key">"channel"</span>: <span class="c-str">"ONLINE"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"ord_hold_4421"</span>,
  <span class="c-key">"status"</span>: <span class="c-str">"HOLD"</span>,
  <span class="c-key">"holdUntil"</span>: <span class="c-str">"2026-10-03T18:15:00.000Z"</span>,
  <span class="c-key">"subtotalPaise"</span>: <span class="c-num">1240000</span>,
  <span class="c-key">"discountPaise"</span>: <span class="c-num">186000</span>,
  <span class="c-key">"totalPaise"</span>: <span class="c-num">1054000</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 6. Shop Order Action -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/order/[id]</span>
        <span class="feat-title">6. Shop Order Confirmation & Stock Release</span>
      </div>
      <span class="role-pill rp-member">Member / Staff</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Member converts held cart order into a paid order, or cancels hold early to immediately release reserved stock back into available inventory.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>confirm</code>: Decrements <code>stock</code>, releases <code>reserved</code>, issues paid invoice.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>cancel</code>: Decrements <code>reserved</code> count atomically; marks order <code>CANCELLED</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Strict ownership: Enforces session <code>userId == order.userId</code>.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/order/ord_hold_4421 \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: a1b2c3d4-e5f6-47a8-b9c0-123456789abc"</span> \
  -d <span class="c-str">'{"action":"confirm","method":"LOCAL"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"status"</span>: <span class="c-str">"PAID"</span>,
  <span class="c-key">"invoiceId"</span>: <span class="c-str">"inv_shp_3319"</span>,
  <span class="c-key">"readyForPickup"</span>: <span class="c-kw">true</span>,
  <span class="c-key">"pickupCode"</span>: <span class="c-str">"CC-4421"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 7. Membership Purchase -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/me/membership</span>
        <span class="feat-title">7. Membership Subscription Purchase & Tier Upgrades</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Purchases or renews a membership plan (Bronze, Silver, Gold, Platinum). Validates age restrictions, creates an immutable membership snapshot, and issues paid invoice.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Account Lock:</strong> <code>memberLock(tx, userId)</code> enforces transaction safety.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Periods:</strong> <code>MONTHLY</code> or <code>ANNUAL</code> (saves 2 months fee).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Immutable Snapshot:</strong> Preserves plan terms and perks even if plan is updated later.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">JSON Payload</span>
{
  <span class="c-key">"planId"</span>: <span class="c-str">"gold"</span>,
  <span class="c-key">"period"</span>: <span class="c-str">"ANNUAL"</span>,
  <span class="c-key">"dob"</span>: <span class="c-str">"1994-06-15"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 201 Created</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"id"</span>: <span class="c-str">"mem_active_0192"</span>,
    <span class="c-key">"status"</span>: <span class="c-str">"ACTIVE"</span>,
    <span class="c-key">"plan"</span>: { <span class="c-key">"name"</span>: <span class="c-str">"Gold"</span>, <span class="c-key">"freeCourtHours"</span>: <span class="c-num">8</span>, <span class="c-key">"shopDiscount"</span>: <span class="c-num">15</span> },
    <span class="c-key">"startsAt"</span>: <span class="c-str">"2026-10-03T18:00:00.000Z"</span>,
    <span class="c-key">"endsAt"</span>: <span class="c-str">"2027-10-03T18:00:00.000Z"</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 8. QR Pass -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="m-badge m-delete">DEL</span>
        <span class="ep-route">/api/me/card</span>
        <span class="feat-title">8. Digital Membership QR Pass (Touchless Gate Key)</span>
      </div>
      <span class="role-pill rp-member">Member (Active)</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Manages the member's cryptographic QR club pass. Scanned at front gates, reception check-in, and clubhouse POS for table tabs.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>GET</code>: Generates signed QR PNG (<code>data:image/png;base64,...</code>) encoding <code>champions:card:&lt;token&gt;</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST</code>: Issues new card with 24-byte cryptographically secure token.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>DELETE</code>: Immediately revokes card; invalidates QR scanner token in DB.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Fetch API (GET QR)</span>
<span class="c-kw">const</span> res = <span class="c-kw">await</span> fetch(<span class="c-str">"/api/me/card"</span>);
<span class="c-kw">const</span> { data } = <span class="c-kw">await</span> res.json();
<span class="c-com">// data.qr provides base64 image data URL</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"qr"</span>: <span class="c-str">"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAP..."</span>,
    <span class="c-key">"issuedAt"</span>: <span class="c-str">"2026-10-01T09:30:00.000Z"</span>,
    <span class="c-key">"revoked"</span>: <span class="c-kw">false</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 9. Profile & Statement -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-patch">PATCH</span>
        <span class="ep-route">/api/me</span>
        <span class="feat-title">9. Member Profile, Account Statement & History</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Full customer account statement and profile editor. Returns Champions ID (<code>CC-XXXX</code>), active tier perks, court history, shop purchases, active clubhouse tabs, and wallet balance.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>GET</code>: Scoped strictly to session user; prevents IDOR identifier tampering.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>PATCH</code>: Updates display name (2-80 chars) and notifications preferences.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">PATCH /api/me</span>
<span class="c-kw">await</span> fetch(<span class="c-str">"/api/me"</span>, {
  method: <span class="c-str">"PATCH"</span>,
  headers: { <span class="c-str">"Content-Type"</span>: <span class="c-str">"application/json"</span> },
  body: JSON.stringify({ name: <span class="c-str">"Alex Mercer"</span> })
});
        </div>
        <div class="code-block">
          <span class="code-lbl">GET /api/me Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"user"</span>: { <span class="c-key">"id"</span>: <span class="c-str">"usr_alex"</span>, <span class="c-key">"championsId"</span>: <span class="c-str">"CC-9F38A1"</span>, <span class="c-key">"name"</span>: <span class="c-str">"Alex Mercer"</span> },
    <span class="c-key">"membership"</span>: { <span class="c-key">"plan"</span>: { <span class="c-key">"name"</span>: <span class="c-str">"Gold"</span> }, <span class="c-key">"status"</span>: <span class="c-str">"ACTIVE"</span> },
    <span class="c-key">"activeTabs"</span>: [],
    <span class="c-key">"recentReservations"</span>: [{ <span class="c-key">"id"</span>: <span class="c-str">"res_882"</span>, <span class="c-key">"court"</span>: <span class="c-str">"Court 1"</span> }]
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 10. Tax Invoices -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/me/invoices/[id]</span>
        <span class="feat-title">10. Immutable Tax Invoice & Receipt Retrieval</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Retrieves an itemized, tamper-evident tax invoice / receipt for court booking, shop merchandise, dining bill, or membership subscription fees.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Ownership Check:</strong> Validates user session owns the requested invoice ID.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>GST Accounting:</strong> Returns gross total, GST tax basis points, payments applied, and balance.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X GET https://club.champions.com/api/me/invoices/inv_crt_8841 \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"number"</span>: <span class="c-str">"INV-2026-00491"</span>,
    <span class="c-key">"department"</span>: <span class="c-str">"COURT"</span>,
    <span class="c-key">"totalPaise"</span>: <span class="c-num">120000</span>,
    <span class="c-key">"lines"</span>: [{ <span class="c-key">"description"</span>: <span class="c-str">"Tennis Court 1 (19:00 - 20:00)"</span>, <span class="c-key">"totalPaise"</span>: <span class="c-num">120000</span> }],
    <span class="c-key">"balance"</span>: { <span class="c-key">"paid"</span>: <span class="c-num">120000</span>, <span class="c-key">"outstanding"</span>: <span class="c-num">0</span> }
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 11. Payments Gateway -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="m-badge m-patch">PATCH</span>
        <span class="ep-route">/api/payments</span>
        <span class="feat-title">11. Online Payment Intents & Razorpay Checkout</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Unified online payment gateway. Handles intent creation, local mock checkout for development, and cryptographic Razorpay HMAC SHA256 signature verification.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>POST</code>: Creates intent (<code>BOOKING</code>, <code>SHOP</code>, <code>MEMBERSHIP</code>, <code>BILL</code>).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>PATCH</code>: Validates signature (<code>orderId|paymentId</code>) with secret key.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Enqueues <code>GATEWAY_CAPTURE</code> worker job for guaranteed background capture.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">POST /api/payments (Create Intent)</span>
{
  <span class="c-key">"kind"</span>: <span class="c-str">"SHOP"</span>,
  <span class="c-key">"orderId"</span>: <span class="c-str">"ord_hold_4421"</span>,
  <span class="c-key">"amountPaise"</span>: <span class="c-num">1054000</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">PATCH /api/payments (Verify Signature)</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"intent_uuid_here"</span>,
  <span class="c-key">"paymentId"</span>: <span class="c-str">"pay_G8y3L09dKa11"</span>,
  <span class="c-key">"signature"</span>: <span class="c-str">"9a8b7c6d5e4f...64hexChars"</span>
}
<span class="c-com">// Returns { data: { id: "...", state: "COMPLETED" } }</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 12. Social Mix-In -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/social</span>
        <span class="feat-title">12. Social Mix-In Sessions & Open Matchmaking</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Open club mix-in matchmaking sessions (e.g. Saturday Morning Padel Social). Members view upcoming sessions and reserve a spot up to the session's player cap.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>GET</code>: Lists scheduled social sessions with current spots remaining.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../social/:id</code> with <code>{"action":"join"}</code>: Reserves participant place.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Prevents overbooking once max capacity is reached.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Join Social Session</span>
<span class="c-kw">await</span> fetch(<span class="c-str">"/api/operations/social/soc_padel_sat"</span>, {
  method: <span class="c-str">"POST"</span>,
  headers: { <span class="c-str">"Content-Type"</span>: <span class="c-str">"application/json"</span>, <span class="c-str">"Idempotency-Key"</span>: crypto.randomUUID() },
  body: JSON.stringify({ action: <span class="c-str">"join"</span> })
});
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"joined"</span>: <span class="c-kw">true</span>,
  <span class="c-key">"session"</span>: {
    <span class="c-key">"title"</span>: <span class="c-str">"Weekend Padel Open Mix-in"</span>,
    <span class="c-key">"startsAt"</span>: <span class="c-str">"2026-10-10T10:00:00.000Z"</span>,
    <span class="c-key">"spotsLeft"</span>: <span class="c-num">3</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 13. Waitlist -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/waiting</span>
        <span class="feat-title">13. Court Waiting List Queue (Auto Backfill)</span>
      </div>
      <span class="role-pill rp-member">Member</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Places member on a FIFO waiting list for fully booked court hours. If a booking is cancelled, background worker dispatches slot offers to waitlisted members.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>POST /api/operations/waiting</code>: Registers interest for court, day, and hour.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../waiting/:id</code> (action: <code>cancel</code>): Leaves waitlist.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Ensures no duplicate entries for the same user and time slot.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Join Waitlist</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/waiting \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: e1a2b3c4-d5e6-47f8-a9b0-123456789abc"</span> \
  -d <span class="c-str">'{"courtId":"crt_ten_1","day":"2026-10-04","hour":19}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"wait_8192"</span>,
  <span class="c-key">"status"</span>: <span class="c-str">"WAITING"</span>,
  <span class="c-key">"position"</span>: <span class="c-num">1</span>,
  <span class="c-key">"slot"</span>: { <span class="c-key">"day"</span>: <span class="c-str">"2026-10-04"</span>, <span class="c-key">"hour"</span>: <span class="c-num">19</span> }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 14. Enquiries -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/enquiries</span>
        <span class="feat-title">14. Public Enquiry Ingestion (Lead Pipeline)</span>
      </div>
      <span class="role-pill rp-public">Public</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Captures prospective customer inquiries from the public website contact form. Ingests data directly into the Staff/Owner CRM pipeline.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span>Validates email, phone regex, sport preference, and message (10-1000 chars).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Enforces same-origin request protection (CSRF defense).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Initial lead status set to <code>NEW</code>; notifies staff on mission control.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/enquiries \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -d <span class="c-str">'{"name":"Sarah Connor","email":"sarah@sky.net","phone":"+919876543210","sport":"tennis","message":"Interested in coaching"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 201 Created</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"id"</span>: <span class="c-str">"lead_0918"</span>,
    <span class="c-key">"status"</span>: <span class="c-str">"NEW"</span>,
    <span class="c-key">"createdAt"</span>: <span class="c-str">"2026-10-03T18:05:00.000Z"</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 15. Auth -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/auth/[...all]</span>
        <span class="feat-title">15. Member Authentication & Session Engine (Better-Auth)</span>
      </div>
      <span class="role-pill rp-public">Public / Session</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Authentication suite powered by Better-Auth. Manages signup, login, session tokens, signout, and password resets with secure rate limiting.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>sign-up/email</code>: Automatically generates unique <code>CC-XXXX</code> Champions ID.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>sign-in/email</code>: Sets secure HTTP-only cookie with 7-day expiration.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>DB rate limiter: Max 5 signups/min, 10 signins/min.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Sign-Up Request</span>
<span class="c-kw">await</span> fetch(<span class="c-str">"/api/auth/sign-up/email"</span>, {
  method: <span class="c-str">"POST"</span>,
  headers: { <span class="c-str">"Content-Type"</span>: <span class="c-str">"application/json"</span> },
  body: JSON.stringify({ name: <span class="c-str">"Devlin Vance"</span>, email: <span class="c-str">"devlin@example.com"</span>, password: <span class="c-str">"SuperSecure123!"</span> })
});
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"user"</span>: {
    <span class="c-key">"id"</span>: <span class="c-str">"usr_d8f2a"</span>,
    <span class="c-key">"name"</span>: <span class="c-str">"Devlin Vance"</span>,
    <span class="c-key">"role"</span>: <span class="c-str">"MEMBER"</span>,
    <span class="c-key">"championsId"</span>: <span class="c-str">"CC-B81C92"</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- SECTION 2: OWNER & STAFF DESK OPERATIONS -->
  <!-- ======================================================== -->
  <div class="section-divider owner-sec">
    <h2>PART 2: OWNER & STAFF DESK OPERATIONS</h2>
    <span class="sec-tag">18 Operations</span>
  </div>

  <!-- 16. Mission Control -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/staff/home</span>
        <span class="feat-title">16. Owner Mission Control & Operational KPI Counters</span>
      </div>
      <span class="role-pill rp-owner">Owner / Staff</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Live executive summary of club activity counters for the active club day. Powers notification badges across Reception, Cashier/POS, Inventory, and Kitchen screens.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Reception:</strong> Today's arrivals pending check-in, checked-in count, overdue CRM leads.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>POS / Kitchen:</strong> Ready tickets, unpaid clubhouse charges, tickets &gt;15 min old.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Inventory:</strong> Low-stock product variants (&le; 5 units).</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X GET https://club.champions.com/api/staff/home \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: [
    { <span class="c-key">"label"</span>: <span class="c-str">"Today's arrivals to check in"</span>, <span class="c-key">"count"</span>: <span class="c-num">14</span>, <span class="c-key">"tab"</span>: <span class="c-str">"reception"</span> },
    { <span class="c-key">"label"</span>: <span class="c-str">"Ready kitchen tickets"</span>, <span class="c-key">"count"</span>: <span class="c-num">2</span>, <span class="c-key">"tab"</span>: <span class="c-str">"pos"</span> },
    { <span class="c-key">"label"</span>: <span class="c-str">"Low-stock variants"</span>, <span class="c-key">"count"</span>: <span class="c-num">3</span>, <span class="c-key">"tab"</span>: <span class="c-str">"inventory"</span> },
    { <span class="c-key">"label"</span>: <span class="c-str">"Kitchen tickets older than 15 min"</span>, <span class="c-key">"count"</span>: <span class="c-num">1</span>, <span class="c-key">"tab"</span>: <span class="c-str">"kitchen"</span> }
  ]
}
        </div>
      </div>
    </div>
  </div>

  <!-- 17. QR Lookup -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/staff/lookup</span>
        <span class="feat-title">17. Reception QR Scanner & Member Identity Verification</span>
      </div>
      <span class="role-pill rp-staff">Reception / Cashier / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Front-desk search and camera scanner endpoint. Resolves camera QR payloads (<code>champions:card:&lt;token&gt;</code>), Champions ID (<code>CC-XXXX</code>), or email addresses.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Revocation Check:</strong> Throws 404 <code>CARD_INVALID</code> if token was revoked.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Returns member name, Champions ID, active tier plan, perks, and expiration date.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Authorized for RECEPTION, CASHIER, and OWNER roles.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Scan QR Token Query</span>
<span class="c-kw">curl</span> -G https://club.champions.com/api/staff/lookup \
  --data-urlencode <span class="c-str">"q=champions:card:7d3f8a9e2c4180..."</span> \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"id"</span>: <span class="c-str">"usr_alex_09"</span>,
    <span class="c-key">"name"</span>: <span class="c-str">"Alex Mercer"</span>,
    <span class="c-key">"championsId"</span>: <span class="c-str">"CC-9F38A1"</span>,
    <span class="c-key">"membership"</span>: {
      <span class="c-key">"plan"</span>: { <span class="c-key">"name"</span>: <span class="c-str">"Platinum"</span>, <span class="c-key">"discount"</span>: <span class="c-num">20</span> },
      <span class="c-key">"endsAt"</span>: <span class="c-str">"2027-04-12T00:00:00.000Z"</span>
    }
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 18. Closures -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/closure</span>
        <span class="feat-title">18. Court Maintenance Closures & Reception Check-In</span>
      </div>
      <span class="role-pill rp-staff">Reception / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Imposes scheduled or emergency court closures (rain, lighting repairs, private tournaments). Prevents bookings during closure window and records mandatory staff reason.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>POST /api/operations/closure</code>: Creates active court closure interval.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../closure/:id</code>: Lifts closure with audit reason.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Front desk checkin: <code>POST /api/operations/booking/:id</code> (action: <code>checkin</code>).</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Add Court Closure</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/closure \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: a1b2c3d4-..."</span> \
  -d <span class="c-str">'{"courtId":"crt_padel_2","startsAt":"2026-10-04T12:00:00Z","endsAt":"2026-10-04T16:00:00Z","reason":"Turf re-surfacing"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Lift Closure (POST .../closure/:id)</span>
{
  <span class="c-key">"reason"</span>: <span class="c-str">"Maintenance completed early, court certified"</span>
}
<span class="c-com">// Returns { data: { active: false, liftedAt: "2026-10-04T14:30:00Z" } }</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 19. Clubhouse POS -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/bill</span>
        <span class="feat-title">19. Clubhouse POS & Dining Table Billing</span>
      </div>
      <span class="role-pill rp-staff">Cashier / Waiter / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Point-of-Sale dining system. Opens table orders, fires tickets to kitchen, puts charges on member room tabs, splits payments (Cash/Card/UPI), and manages adjustments.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>POST /bill</code>: Opens bill with items; fires revision 1 kitchen ticket.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../bill/:id</code>: Actions: <code>add</code> (fire new round), <code>pay</code> (settle invoice), <code>tab</code> (charge member), <code>close</code> (free table), <code>cancelItem</code> (with reason).</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Open Table Bill (POST /bill)</span>
{
  <span class="c-key">"tableId"</span>: <span class="c-str">"table_04"</span>,
  <span class="c-key">"userId"</span>: <span class="c-str">"usr_alex_09"</span>,
  <span class="c-key">"ageConfirmed"</span>: <span class="c-kw">true</span>,
  <span class="c-key">"items"</span>: [{ <span class="c-key">"menuId"</span>: <span class="c-str">"mnu_craft_burger"</span>, <span class="c-key">"quantity"</span>: <span class="c-num">2</span>, <span class="c-key">"note"</span>: <span class="c-str">"Medium rare"</span> }]
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"bill_ord_7719"</span>,
  <span class="c-key">"table"</span>: <span class="c-str">"Table 4"</span>,
  <span class="c-key">"status"</span>: <span class="c-str">"OPEN"</span>,
  <span class="c-key">"ticketsFired"</span>: <span class="c-num">1</span>,
  <span class="c-key">"netPaise"</span>: <span class="c-num">112000</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 20. Kitchen KDS -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/kitchen</span>
        <span class="feat-title">20. Kitchen Display System (KDS) & Prep Progression</span>
      </div>
      <span class="role-pill rp-kitchen">Kitchen / Cashier / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Kitchen touchscreen ticket progression system. Manages meal prep lifecycle with optimistic version concurrency to prevent simultaneous chef tap conflicts.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>States:</strong> <code>ACCEPTED</code> &rarr; <code>COOKING</code> &rarr; <code>READY</code> &rarr; <code>SERVED</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Version Lock:</strong> Requires passing current <code>version</code> integer; increments on update.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Tickets older than 15 minutes trigger urgent badge on Owner/Staff desk.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">JSON Payload</span>
{
  <span class="c-key">"ticketId"</span>: <span class="c-str">"tkt_9931"</span>,
  <span class="c-key">"version"</span>: <span class="c-num">1</span>,
  <span class="c-key">"state"</span>: <span class="c-str">"COOKING"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"tkt_9931"</span>,
  <span class="c-key">"state"</span>: <span class="c-str">"COOKING"</span>,
  <span class="c-key">"version"</span>: <span class="c-num">2</span>,
  <span class="c-key">"updatedAt"</span>: <span class="c-str">"2026-10-03T18:10:00.000Z"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 21. Stock Adjustment -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/stock</span>
        <span class="feat-title">21. Shop Inventory Management & Stock Adjustments</span>
      </div>
      <span class="role-pill rp-staff">Cashier / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Performs audited manual inventory adjustments (stock count reconciliation, shrinkage, delivery restock, damaged gear) with strict row-level database locking.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Row Lock:</strong> Applies <code>SELECT FOR UPDATE</code> on <code>ProductVariant</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Logs mandatory audit entry with actor ID, previous/new stock, and reason.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/stock \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: d1f2e3a4-..."</span> \
  -d <span class="c-str">'{"variantId":"var_wilson_balls","change":12,"reason":"Restocked from distributor"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"variantId"</span>: <span class="c-str">"var_wilson_balls"</span>,
  <span class="c-key">"previousStock"</span>: <span class="c-num">4</span>,
  <span class="c-key">"newStock"</span>: <span class="c-num">16</span>,
  <span class="c-key">"recordedAt"</span>: <span class="c-str">"2026-10-03T18:12:00.000Z"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 22. Shop Fulfillment -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/order/[id]</span>
        <span class="feat-title">22. Shop Fulfillment (Click-and-Collect & Courier)</span>
      </div>
      <span class="role-pill rp-staff">Cashier / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Staff fulfillment workflow for shop orders. Handles in-club pickup handover, courier package dispatch, delivery confirmation, and customer product returns.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>collect</code>: Handed over at front desk; marks order <code>COLLECTED</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>dispatch</code>: Stores courier tracking number (e.g. BlueDart/Delhivery).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>return</code>: Restocks items optionally and creates credit memo.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Courier Dispatch Request</span>
{
  <span class="c-key">"action"</span>: <span class="c-str">"dispatch"</span>,
  <span class="c-key">"tracking"</span>: <span class="c-str">"BLUEDART-IND-991204"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Customer Return Request</span>
{
  <span class="c-key">"action"</span>: <span class="c-str">"return"</span>,
  <span class="c-key">"reason"</span>: <span class="c-str">"Size exchange"</span>,
  <span class="c-key">"returns"</span>: [{ <span class="c-key">"variantId"</span>: <span class="c-str">"var_shirt_l"</span>, <span class="c-key">"quantity"</span>: <span class="c-num">1</span>, <span class="c-key">"restock"</span>: <span class="c-kw">true</span> }]
}
        </div>
      </div>
    </div>
  </div>

  <!-- 23. Manual Payment -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/payment/[id]</span>
        <span class="feat-title">23. In-Person Billing & Manual Payment Processing</span>
      </div>
      <span class="role-pill rp-staff">Reception / Cashier / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Applies in-person payments (CASH, CARD, UPI) against any invoice ID. Connects cash payments directly to cashier's open shift drawer and updates linked bills.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Cash Drawer Link:</strong> If method is <code>CASH</code>, requires active cash shift.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Atomically allocates payment against invoice; recalculates outstanding paise.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">cURL Request</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/payment/inv_crt_8841 \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Idempotency-Key: c9d8e7..."</span> \
  -d <span class="c-str">'{"method":"UPI","amountPaise":120000}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"paid"</span>: <span class="c-kw">true</span>,
  <span class="c-key">"invoiceId"</span>: <span class="c-str">"inv_crt_8841"</span>,
  <span class="c-key">"method"</span>: <span class="c-str">"UPI"</span>,
  <span class="c-key">"amountPaise"</span>: <span class="c-num">120000</span>,
  <span class="c-key">"balanceRemaining"</span>: <span class="c-num">0</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 24. Cash Shifts -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/staff/admin?area=cash</span>
        <span class="feat-title">24. Cash Drawer Shifts & Daily Register Balancing</span>
      </div>
      <span class="role-pill rp-staff">Cashier / Reception / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Register float and cashier shift management. Staff open drawers with starting float, record midday petty cash payouts, and perform end-of-shift cash balancing.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>cashOpen</code>: Starts shift with float (<code>openingPaise</code>).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>cashPayout</code>: Records petty cash expenses with audit reason.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>cashClose</code>: Calculates expected vs counted cash, logging any discrepancy.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">POST /api/staff/admin (Cash Close)</span>
{
  <span class="c-key">"action"</span>: <span class="c-str">"cashClose"</span>,
  <span class="c-key">"id"</span>: <span class="c-str">"shift_cash_401"</span>,
  <span class="c-key">"countedPaise"</span>: <span class="c-num">1450000</span>,
  <span class="c-key">"reason"</span>: <span class="c-str">"Shift handover, drawer balanced"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"shiftId"</span>: <span class="c-str">"shift_cash_401"</span>,
  <span class="c-key">"expectedPaise"</span>: <span class="c-num">1450000</span>,
  <span class="c-key">"countedPaise"</span>: <span class="c-num">1450000</span>,
  <span class="c-key">"differencePaise"</span>: <span class="c-num">0</span>,
  <span class="c-key">"closedAt"</span>: <span class="c-str">"2026-10-03T21:00:00.000Z"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 25. Reports -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/staff/reports</span>
        <span class="feat-title">25. Financial & Operational Reports with CSV Export</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Executive analytics engine. Breaks down sales by club department (Courts, Shop, Clubhouse, Memberships), payment methods, credits, refunds, and aging receivables.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Presets:</strong> <code>today</code>, <code>thisWeek</code>, <code>thisMonth</code>, <code>lastMonth</code>, or custom dates.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>Operational:</strong> Set <code>area=operations</code> for court utilization & peak hours.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><strong>CSV Download:</strong> Set <code>format=csv</code> for direct file attachment export.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Download CSV Report</span>
<span class="c-kw">curl</span> -G https://club.champions.com/api/staff/reports \
  -d <span class="c-str">"preset=thisMonth"</span> -d <span class="c-str">"format=csv"</span> \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span> \
  -o champions-october-report.csv
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK (JSON mode)</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"grossPaise"</span>: <span class="c-num">48200000</span>,
    <span class="c-key">"byDepartment"</span>: {
      <span class="c-key">"COURT"</span>: <span class="c-num">18400000</span>, <span class="c-key">"MEMBERSHIP"</span>: <span class="c-num">21000000</span>,
      <span class="c-key">"SHOP"</span>: <span class="c-num">5200000</span>, <span class="c-key">"CLUBHOUSE"</span>: <span class="c-num">3600000</span>
    }
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 26. HR & Payroll -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/staff/payroll-export</span>
        <span class="feat-title">26. HR Roster, Leaves & Automated Payroll Finalization</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Staff HR administration module. Creates employee salary profiles, schedules shifts, approves/rejects leaves, and calculates monthly payslips with Indian tax withholding.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../admin</code> (action: <code>payslip</code>): Finalizes salary with adjustments.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>GET /api/staff/payroll-export</code>: Generates payroll reconciliation CSV.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">POST /api/staff/admin (Payslip)</span>
{
  <span class="c-key">"action"</span>: <span class="c-str">"payslip"</span>,
  <span class="c-key">"employeeId"</span>: <span class="c-str">"emp_head_coach"</span>,
  <span class="c-key">"period"</span>: <span class="c-str">"2026-10"</span>,
  <span class="c-key">"adjustmentPaise"</span>: <span class="c-num">0</span>,
  <span class="c-key">"reason"</span>: <span class="c-str">"Regular monthly salary"</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">GET /api/staff/payroll-export (CSV)</span>
Payslip,Employee,Period,Gross paise,Tax label,Tax bps,Net paise
psl_01,Coach Rahul,2026-10,8000000,PTAX,200,7840000
PERIOD_SUMMARY,All matching,2026-10,8000000,PTAX,200,7840000
        </div>
      </div>
    </div>
  </div>

  <!-- 27. Settings -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-patch">PATCH</span>
        <span class="ep-route">/api/staff/settings</span>
        <span class="feat-title">27. Club Operating Rules & Dynamic Settings Editor</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Dynamically configures club business parameters: operating hours, advance reservation window, cancellation policies, guest fees, and GST tax percentages.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>GET</code>: Reads current club operational configuration.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>PATCH</code>: Updates parameters in real time without code deployment.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Zod validation ensures <code>openHour &lt; closeHour</code> and valid integer ranges.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">PATCH /api/staff/settings</span>
<span class="c-kw">curl</span> -X PATCH https://club.champions.com/api/staff/settings \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -d <span class="c-str">'{"openHour":6,"closeHour":23,"bookingWindowDays":14,"cancellationWindowHours":12}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"openHour"</span>: <span class="c-num">6</span>,
    <span class="c-key">"closeHour"</span>: <span class="c-num">23</span>,
    <span class="c-key">"bookingWindowDays"</span>: <span class="c-num">14</span>,
    <span class="c-key">"cancellationWindowHours"</span>: <span class="c-num">12</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 28. Plans Config -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-patch">PATCH</span>
        <span class="ep-route">/api/staff/plans</span>
        <span class="feat-title">28. Membership Plan Tier Pricing & Perks Editor</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Owner editor for membership plan tiers. Adjusts monthly & annual fees (paise), free court hours allocation, and store/dining discount percentages.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span>Preserves existing member benefits (historical snapshots immutable).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>New pricing takes effect immediately for new subscribers and renewals.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">PATCH /api/staff/plans</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"gold"</span>,
  <span class="c-key">"monthlyPaise"</span>: <span class="c-num">550000</span>,
  <span class="c-key">"annualPaise"</span>: <span class="c-num">5500000</span>,
  <span class="c-key">"freeCourtHours"</span>: <span class="c-num">10</span>,
  <span class="c-key">"shopDiscount"</span>: <span class="c-num">15</span>
}
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"id"</span>: <span class="c-str">"gold"</span>,
    <span class="c-key">"name"</span>: <span class="c-str">"Gold"</span>,
    <span class="c-key">"monthlyPaise"</span>: <span class="c-num">550000</span>,
    <span class="c-key">"freeCourtHours"</span>: <span class="c-num">10</span>,
    <span class="c-key">"updatedAt"</span>: <span class="c-str">"2026-10-03T18:20:00.000Z"</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 29. Role Delegation -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-patch">PATCH</span>
        <span class="ep-route">/api/staff/users</span>
        <span class="feat-title">29. Staff Access Control & Role Delegation</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Promotes, demotes, or assigns operational privileges across staff accounts. Public signup cannot assign privileged roles.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><strong>Supported Roles:</strong> <code>MEMBER</code>, <code>RECEPTION</code>, <code>CASHIER</code>, <code>KITCHEN</code>, <code>OWNER</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Executes inside transaction; records immutable audit entry.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Assign Role Request</span>
<span class="c-kw">curl</span> -X PATCH https://club.champions.com/api/staff/users \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span> \
  -d <span class="c-str">'{"userId":"usr_samuel","role":"CASHIER"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"name"</span>: <span class="c-str">"Samuel Green"</span>,
    <span class="c-key">"role"</span>: <span class="c-str">"CASHIER"</span>,
    <span class="c-key">"updatedAt"</span>: <span class="c-str">"2026-10-03T18:22:00.000Z"</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 30. Audit Logs -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="ep-route">/api/staff/admin?area=audit</span>
        <span class="feat-title">30. System Security Audit Trail & Forensics Inspection</span>
      </div>
      <span class="role-pill rp-owner">Owner / Staff</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Cursor-paginated security audit trail capturing every sensitive action, actor ID, entity ID, changes, and mandatory justification reasons.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span>Owners search club-wide actions, actors, or entities via query <code>q</code>.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Non-owner staff accounts can view only their own activity log.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Query Audit Trail</span>
<span class="c-kw">curl</span> -G https://club.champions.com/api/staff/admin \
  -d <span class="c-str">"area=audit"</span> -d <span class="c-str">"q=card.revoke"</span> \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"data"</span>: {
    <span class="c-key">"rows"</span>: [{
      <span class="c-key">"id"</span>: <span class="c-str">"aud_9981"</span>, <span class="c-key">"actorId"</span>: <span class="c-str">"usr_alex"</span>,
      <span class="c-key">"action"</span>: <span class="c-str">"card.revoke"</span>, <span class="c-key">"reason"</span>: <span class="c-str">"Lost phone with QR"</span>,
      <span class="c-key">"createdAt"</span>: <span class="c-str">"2026-10-03T17:40:00.000Z"</span>
    }],
    <span class="c-key">"next"</span>: <span class="c-kw">null</span>
  }
}
        </div>
      </div>
    </div>
  </div>

  <!-- 31. CRM Lead Follow-up -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/operations/crm/[id]</span>
        <span class="feat-title">31. CRM Pipeline & Sales Lead Follow-up Management</span>
      </div>
      <span class="role-pill rp-staff">Reception / Owner</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Sales conversion pipeline for public inquiries. Progresses leads: <code>NEW</code> &rarr; <code>CONTACTED</code> &rarr; <code>QUALIFIED</code> &rarr; <code>TRIAL_BOOKED</code> &rarr; <code>CONVERTED</code>.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span>Schedules follow-up alarms (<code>followUpAt</code> timestamp).</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Logs interaction notes and links directly to free trial bookings.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Update Lead Pipeline</span>
<span class="c-kw">curl</span> -X POST https://club.champions.com/api/operations/crm/lead_0918 \
  -H <span class="c-str">"Content-Type: application/json"</span> \
  -d <span class="c-str">'{"status":"TRIAL_BOOKED","notes":"Booked padel trial","followUpAt":"2026-10-05T09:00:00Z"}'</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">Response 200 OK</span>
{
  <span class="c-key">"id"</span>: <span class="c-str">"lead_0918"</span>,
  <span class="c-key">"status"</span>: <span class="c-str">"TRIAL_BOOKED"</span>,
  <span class="c-key">"followUpAt"</span>: <span class="c-str">"2026-10-05T09:00:00.000Z"</span>,
  <span class="c-key">"updatedAt"</span>: <span class="c-str">"2026-10-03T18:25:00.000Z"</span>
}
        </div>
      </div>
    </div>
  </div>

  <!-- 32. Mail Queue -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-get">GET</span>
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/staff/inbox</span>
        <span class="feat-title">32. Outbox Mail Queue & Dead-Letter Job Retry</span>
      </div>
      <span class="role-pill rp-owner">Owner Only</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Monitors background email queue (reminders, password resets, verification emails). In local mode, exposes virtual inbox; in production, allows retrying failed jobs.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span><code>GET /api/staff/inbox</code>: Reads captured outgoing emails in local test mode.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span><code>POST .../admin</code> (action: <code>retryMail</code>): Re-triggers failed email jobs.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">GET /api/staff/inbox (View Mails)</span>
<span class="c-kw">curl</span> -X GET https://club.champions.com/api/staff/inbox \
  -H <span class="c-str">"Cookie: better-auth.session_token=..."</span>
        </div>
        <div class="code-block">
          <span class="code-lbl">POST /api/staff/admin (Retry Job)</span>
{
  <span class="c-key">"action"</span>: <span class="c-str">"retryMail"</span>,
  <span class="c-key">"id"</span>: <span class="c-str">"job_mail_99182"</span>
}
<span class="c-com">// Returns { data: { retried: true, status: "PENDING" } }</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 33. Webhook -->
  <div class="api-card">
    <div class="api-card-header">
      <div class="ep-box">
        <span class="m-badge m-post">POST</span>
        <span class="ep-route">/api/payments/webhook</span>
        <span class="feat-title">33. Razorpay Payment Gateway Webhook Dispatcher</span>
      </div>
      <span class="role-pill rp-webhook">Gateway Webhook</span>
    </div>
    <div class="api-card-body">
      <div class="left-desc">
        <p class="desc-text">Ingests asynchronous server-to-server webhook notifications from payment provider. Guarantees zero missed payments even if customer closes browser during checkout.</p>
        <div class="rules-box">
          <div class="rule-row"><span class="bullet">•</span><span>Validates <code>x-razorpay-signature</code> HMAC SHA256 header using webhook secret.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Verifies payment amount matches database intent amount.</span></div>
          <div class="rule-row"><span class="bullet">•</span><span>Deduplicates and enqueues durable <code>GATEWAY_CAPTURE</code> worker job.</span></div>
        </div>
      </div>
      <div class="right-code">
        <div class="code-block">
          <span class="code-lbl">Webhook Headers</span>
POST /api/payments/webhook HTTP/1.1
x-razorpay-signature: e3b0c44298fc1c149afbf4c8996fb92427ae41e...
Content-Type: application/json
        </div>
        <div class="code-block">
          <span class="code-lbl">Payload & Response</span>
{
  <span class="c-key">"event"</span>: <span class="c-str">"payment.captured"</span>,
  <span class="c-key">"payload"</span>: {
    <span class="c-key">"payment"</span>: {
      <span class="c-key">"entity"</span>: { <span class="c-key">"id"</span>: <span class="c-str">"pay_G8y3L09d"</span>, <span class="c-key">"amount"</span>: <span class="c-num">1054000</span>, <span class="c-key">"currency"</span>: <span class="c-str">"INR"</span> }
    }
  }
}
<span class="c-com">// Returns 200 OK: {"data": {"queued": true}}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- APPENDIX -->
  <div class="appendix-box">
    <div class="appendix-title">
      <span>Architectural Standards & Conventions</span>
      <span style="font-size:7pt; color:#94a3b8; font-family:'JetBrains Mono',monospace;">Champions Club Monolith</span>
    </div>
    <div class="appendix-grid">
      <div class="appendix-item">
        <h5>Standard Error Response Contract</h5>
        <p>All errors throw <code>AppError</code> returning status 4xx/5xx: <br>
        <code>{"error": {"code": "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "BOOKING_WINDOW" | "COURT_CLOSED" | "STOCK_UNAVAILABLE" | "CARD_INVALID", "message": "...", "status": 4xx}}</code></p>
      </div>
      <div class="appendix-item">
        <h5>Currency & Financial Rules</h5>
        <p>All monetary values stored in strictly positive integer paise (₹1 = 100 paise; e.g. ₹500.00 = 50000 paise). Invoices are immutable historical snapshots. Payments allocate atomically against invoice IDs.</p>
      </div>
    </div>
  </div>

</body>
</html>
"""

def main():
    workspace = r"d:\ODOO-Sports-Club-System"
    html_file = os.path.join(workspace, "api_cheatsheet.html")
    pdf_file = os.path.join(workspace, "Champions_Club_API_CheatSheet.pdf")
    artifact_dir = r"C:\Users\chriz\.gemini\antigravity\brain\cef4d921-a33e-480f-abbe-b2dae1f7ff3b"
    artifact_pdf = os.path.join(artifact_dir, "Champions_Club_API_CheatSheet.pdf")
    
    html = build_html()
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Generated {html_file}")
    
    edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        html_file
    ]
    print("Executing Edge headless PDF compiler...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Edge error:", res.stderr)
        return
        
    size = os.path.getsize(pdf_file)
    print(f"PDF generated: {pdf_file} ({size} bytes)")
    
    # Copy to artifacts
    shutil.copy(pdf_file, artifact_pdf)
    print(f"Copied to artifact directory: {artifact_pdf}")
    
    # Verify PDF with PyMuPDF
    doc = fitz.open(pdf_file)
    total_pages = len(doc)
    print(f"Total Pages: {total_pages}")
    for idx, page in enumerate(doc):
        text = page.get_text()
        first_line = text.split("\n")[0] if text else "EMPTY"
        print(f"Page {idx+1}: {len(text)} chars | First: {first_line[:40]}")
        
    # Render preview images of pages 1 and 2
    p1 = doc[0].get_pixmap(dpi=150)
    p1.save(os.path.join(workspace, "api_sheet_preview_p1.png"))
    if total_pages > 1:
        p2 = doc[1].get_pixmap(dpi=150)
        p2.save(os.path.join(workspace, "api_sheet_preview_p2.png"))
    print("Saved preview images.")

if __name__ == "__main__":
    main()
