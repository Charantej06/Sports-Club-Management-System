# Champions Club product specification

Build Champions Club, a complete sports-club management platform for an Odoo hackathon. The club offers tennis, padel, badminton and cricket. Any stack is allowed; using the Odoo framework itself is not mandatory.

Read the attached problem PDF. Treat this prompt as the authoritative product specification when it overrides the PDF. Explicit override: bookings are one hour long with hourly start times; ignore the half-hour start requirement.

HACKATHON EXPECTATIONS

The organizers explicitly require:
- Real-time or dynamic data sources. Static JSON is acceptable only for initial prototyping; operational features must use persisted records.
- A responsive, clean UI with consistent colors and layouts.
- Robust user-input validation.
- Intuitive navigation, appropriate menu placement and spacing.
- Proper Git usage involving every teammate.

They also value:
- Well-designed backend APIs, thoughtful data modelling and a local database.
- Code the team can understand and explain.
- Local/offline operation rather than complete dependence on internet or cloud services.
- Technologies used for a concrete purpose.

Build readable, maintainable code with clear business responsibilities. Give APIs explicit contracts, consistent error responses and appropriate HTTP methods/status codes. Validate and authorize every mutation. Use transactions and database constraints for critical correctness. Include migrations, appropriate indexes, useful documentation and meaningful tests. Avoid unnecessary abstraction, duplicated business rules and infrastructure that adds complexity without improving this application.

PROJECT WORKFLOW

Inspect the repository before changing it. Preserve useful existing work and dependencies.

Create:
- SPEC.md: complete requirements, assumptions and acceptance criteria.
- PLAN.md: three implementation stages with their current status.
- A concise AGENTS.md: architecture, coding conventions and verification expectations.
- README.md: setup, local operation, demo accounts and judging walkthrough, updated as implementation progresses.

Use reasonable, recorded defaults for unspecified operating hours, prices, discounts, capacities and policies. Make business settings editable. Ask only for genuinely blocking information.

Implement the first stage described at the end of this prompt. Later prompts will complete stages two and three. Do not silently discard requirements because they belong to a later stage.

STACK AND ARCHITECTURE

Use Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma, Better Auth, Zod, React Hook Form and TanStack Query. Use compatible maintained versions and commit the lockfile.

Use a modular monolith with feature modules and shared business services:
- API handlers authenticate, authorize, validate and delegate.
- Services implement business rules and transactions.
- Database code handles queries and database-specific operations.
- UI components handle presentation and interaction.
- A separate worker handles durable background jobs.

Use qrcode for QR generation and @zxing/browser for camera scanning.

Provide Docker Compose for local operation, persistent database storage, health checks, environment examples and GitHub Actions checks. Keep core operations independent of external email/payment services. Provide explicit local test modes and distinguish them from configured real integrations.

BRAND AND NAVIGATION

Name: Champions Club.
Shop: The Champions Shop.
Food and drinks: Clubhouse Kitchen & Bar.

Public/customer design:
- Premium athletic identity with black backgrounds, white typography and vivid orange accents.
- Strong sports photography, bold headline typography and deliberate spacing.
- Four interactive photographic panels representing tennis, padel, badminton and cricket. Selecting a panel reveals sport details and a booking action.
- Responsive touch-friendly mobile behavior, keyboard access and reduced-motion support.
- A coherent custom theme throughout customer pages, rather than an unchanged component-library theme.

Customer navigation:
Home, Book a Court, Memberships, The Champions Shop, Clubhouse, My Account.

Home is one landing page with previews. Booking, membership pricing/purchase, shop, clubhouse and account are separate functional destinations.

Landing sections:
- Four-sport hero.
- Club facilities and experience.
- Membership comparison with price previews.
- Selected shop products.
- Clubhouse preview.
- Trial-session booking.
- Enquiry/contact section.

Staff and owner design:
- White cards and work surfaces, cool light-grey backgrounds, charcoal/slate text and restrained orange accents.
- Meaningful status colors, clearly labelled.
- Practical, readable layouts focused on daily tasks.
- Reception, waiter/cashier, kitchen, inventory, enquiries and owner administration have role-appropriate navigation.
- Combine waiter and cashier functions within a coherent POS workspace. Give the kitchen a separate preparation screen.

ACCOUNTS AND AUTHORIZATION

Every account is linked to an email and receives a unique Champions ID, enforced by the database. Customer identity exists even without paid membership.

Support member, reception, cashier/waiter, kitchen and owner permissions.

Implement signup, login, logout, expiring sessions, revocation and appropriate verification/reset flows. Use Better Auth's supported security protections. Staff onboarding and role assignment are owner-controlled; public signup cannot assign privileged roles.

Check authorization and record ownership at every protected entry point. Member identity comes from the authenticated session. Customers cannot access another customer's bookings, orders, statements or card by changing an identifier.

Customer accounts show profile, booking history, purchases, receipts and outstanding charges.

MEMBERSHIPS AND QR CARDS

Gold, Silver and Junior plans have configurable prices, duration, court benefits and shop/cafeteria discounts. Junior has under-18 eligibility.

Membership can be purchased online or processed by reception. Support renewal, expiry and plan changes while preserving membership history.

Use shared membership/pricing rules across all departments. Define court eligibility at the session date and purchase eligibility at checkout. Snapshot confirmed prices and discounts so later plan changes preserve historical records.

An active membership displays a virtual card with member name, Champions ID, plan styling, validity and QR code.

Without membership, show account information/history and a Get a Membership invitation in the card position. Expired membership shows a renewal prompt while retaining history.

The QR contains an opaque revocable card identifier, not personal information. Generate the identifier when issuing the card and reuse it thereafter. Authorized staff resolve it to current member details. Reception can check in bookings; cashiers/waiters can identify benefits and view permitted history. Prevent duplicate check-ins and provide manual lookup when camera access fails. A QR card identifies a member; it does not independently authorize payment.

BOOKINGS AND SOCIAL PLAY

Provide sport/court/date selection, one-hour sessions, hourly starts, configurable future booking window and opening hours.

Support:
- Member pricing, guest/walk-in pricing and free/discounted sessions according to plan.
- Reception booking for phone callers and walk-ins.
- Maximum two sessions per member per club day.
- Temporary checkout holds with server-controlled expiry.
- Confirmation, cancellation policy, check-in and history.
- Maintenance closures and alternative available sessions.
- Cancellation waiting lists.

Prevent overlapping active reservations on the same court, including concurrent requests. Enforce the daily limit under concurrency too. Use PostgreSQL transactions, appropriate locks and an overlap constraint. Store times consistently and apply daily rules in the configured club timezone.

Friday social play reserves the court once. Participants reserve places within that event, subject to configured capacity. Prevent duplicate participation and capacity races. Count social participation toward the same two-session daily allowance by default.

Waiting-list offers go to the earliest eligible customer, expire after a configurable acceptance window and recheck eligibility/quota/availability on acceptance.

THE CHAMPIONS SHOP

Create a substantial realistic catalogue:
- Tennis rackets, balls, strings, grips and bags.
- Padel rackets, balls, grips and accessories.
- Badminton rackets, shuttlecocks, strings and shoes.
- Cricket bats, balls, gloves, pads, helmets and kit bags.
- Apparel, socks, towels, bottles and general accessories.

Include categories, product details, images, relevant sizes/variants, prices, availability, cart, membership benefits and receipts.

Customers choose club pickup or delivery and see order progress. Staff handle counter sales, stock arrivals, low-stock alerts, collection, dispatch, cancellation, returns and stock corrections.

Online and counter sales share one inventory pool. Reserve stock atomically; insufficient stock rolls back the whole checkout. Abandoned/cancelled orders release reservations. Fulfillment and returns create recorded stock movements.

CLUBHOUSE KITCHEN & BAR

Build the waiter/POS workspace:
- Tables and occupancy.
- Member identification or guest service.
- Menu items, quantities, notes and unavailable items.
- Submission to kitchen.
- Additional items on the same bill.
- Served status, open tabs and settlement.

Build the kitchen screen:
- Incoming orders with table/order number, quantities, notes and waiting time.
- Accepted, cooking and ready states.
- Clear indication of additions/amendments.
- Preparation status independent of payment status.
- Safe handling of concurrent staff updates.

Apply membership discounts automatically on the final bill. Support eligible member tabs, configured spending limits and overdue restrictions.

Record cash, card and UPI payments, receipts, permitted item cancellations, refunds and adjustments with reasons. Distinguish cashier-recorded payments from gateway-verified payments. Provide shift closing and daily cafeteria/bar reports.

SHARED BILLING

Use a shared billing service for membership, court, shop and cafeteria charges.

Store itemized invoices, payments, allocations, credits/refunds and outstanding balances. Each originating transaction generates its charge once.

Implement checkout idempotency: the same key and payload returns the original result; reuse with a different payload is rejected. Calculate prices and totals on the server. Use integer paise or precise decimals with an explicit rounding policy.

A member statement combines department charges while retaining each transaction's identity. Include partial/full settlement and receipts. Gateway integrations must verify provider events and tolerate duplicate delivery.

RECEPTION, WEBSITE AND CRM

Public pages read stored plans, catalogue and availability through deliberately limited public responses.

Trial booking uses the same booking service as ordinary reservations.

Enquiries create saved leads and immediate in-app front-desk notifications. Support assignment, follow-up reminders, activity history, quotes and conversion into membership. Preserve the lead's history when linked to a member.

OWNER AND STAFF ADMINISTRATION

Owner workspace:
- Today, this week, this month and custom-date filters.
- Membership, courts/social play, shop and kitchen/bar breakdowns.
- Invoiced sales, collections by payment method, refunds and outstanding balances as distinct figures.
- Drill-down to records supporting every total.
- Court utilization, low stock, expiring memberships and unpaid tabs.
- Membership and business-client invoices, quotes and report exports.
- Cash-shift reconciliation: opening cash + receipts − refunds − payouts, compared with counted cash, with discrepancy explanations.
- Employee records, shifts, leave approval, configured salary records, finalized payslip snapshots and configurable tax summaries.

Operational staff home shows actionable arrivals, check-ins, kitchen delays, ready orders, pending collections, unpaid tabs, low stock and enquiries awaiting follow-up.

EMAILS AND BACKGROUND WORK

Send membership expiry reminders seven days before expiry, one day before expiry and on expiry day. Timings are configurable.

Include name, plan, expiry and renewal link. Preserve delivery status and retries. Renewals suppress obsolete reminders. Prevent duplicate processing.

Support configured real email delivery and a local test inbox.

Use durable background jobs for reminders, abandoned holds and waiting-list offers. Record related jobs alongside business changes transactionally. Keep retries safe. Sensitive actions write audit records with actor, action, affected record, timestamp and relevant reason; never log passwords or session secrets.

QUALITY AND DEMONSTRATION

Seed data is acceptable for catalogue, menu, demo users and initial scenarios. Subsequent actions must persist and update related screens.

Provide responsive layouts, accessible forms, visible validation, consistent navigation and useful loading/empty/error/success states.

Use browser verification where available. Test permissions, ownership, concurrency, stock, idempotency, cancellation/refunds and worker retries against real PostgreSQL.

Support local LAN operation without internet. Disconnected devices may retain safe drafts, but must not confirm scarce resources without server validation.

Keep Git history reviewable. Document how teammates can contribute through their own branches, commits and PRs; do not fabricate their contributions.

NOW IMPLEMENT STAGE 1

Complete project setup, database schema/migrations, realistic seeds, authentication/permissions, shared UI themes, the landing page and customer navigation, public read views, account/profile, membership purchase/renewal and QR card generation.

Implement the shared billing foundations needed for membership purchase. Record the remaining booking, commerce, staff and notification integrations in PLAN.md for stages two and three.

Run the application, verify persistence and access restrictions, and inspect desktop/mobile views where browser tools are available. Fix failures before reporting completion. Report actual validation results and external dependencies still requiring configuration.

## Recorded defaults and stage-one acceptance criteria

The pasted brief is the full authoritative scope. The unavailable problem PDF has not been reconstructed or assumed. Stage two and three requirements remain above and in PLAN.md. The user subsequently authorized publishing to Charantej06/Sports-Club-Management-System with at most eight commits; preserve its initial history.

| Setting | Default / policy |
|---|---|
| Club timezone | Asia/Kolkata; timestamps UTC; local day/week boundaries in this zone |
| Opening / future window | 06:00–23:00 daily; 14 days ahead; hourly starts, exactly 60 minutes |
| Court guest hourly prices | Tennis ₹800, padel ₹1,200, badminton ₹500, cricket ₹600 |
| Courts | 3 tennis, 2 padel, 4 indoor badminton, 2 cricket nets |
| Membership terms | 90 days; Gold ₹12,000, Silver ₹6,500, Junior ₹3,500 |
| Court/shop/food discounts | Gold 25/15/15%, Silver 15/5/5%, Junior 20/10/10% |
| Free sessions/week | Gold 2, Silver 0, Junior 1; Monday-start club week, stage-two integration |
| Eligibility | Junior under 18 on term start; self-declared birth date; staff verification later |
| Renewal / plan change | Renewal appended to last unexpired term; changes immediate, supersede future terms; no proration |
| Tax / rounding | Prices inclusive; no separately calculated sales tax in local demo; discounts half-up once to paise |
| Cancellation / holds | 12-hour notice, 5-minute holds, 30-minute waiting offers; stage-two integration |
| Friday social play | Capacity 12; counts toward two sessions per day; stage-two service |
| Member tab | ₹5,000 limit; overdue restriction and credit checks stage three |
| Payments | Explicit simulated local mode only now; every other mode disables purchase until gateway configured |
| Email | Local durable inbox by default; SMTP configurable; expiry scheduling stage three (7,1,0 days) |
| Catalogue/menu | 36 products with realistic categories/variants/stock, 14 menu items, 8 dining tables |
| Bar | Demo policy age 21+; real operating policy/licensing validation belongs to deployment setup |
| Contact / property | Fictional Bengaluru address and contact details; illustrative photos of venues |

Stage-one acceptance:
- Migration succeeds on real PostgreSQL; exclusion, uniqueness and value constraints enforce critical stored invariants.
- Seeds initialize real records and preserve operational changes on rerun.
- Every account has unique DB-enforced email/Champions ID. Public signup cannot set privileges. Owner assignment revokes affected sessions.
- Signup, login/logout, verification/reset, session expiry and revocation use Better Auth. All protected routes/pages enforce sessions, roles and ownership.
- Landing is black/white/orange with four accessible photographic sport selectors. Separate court, membership, shop, clubhouse and account destinations read persisted records. Staff theme is light/grey/slate with orange accents.
- Purchase/renewal/change validate policy/eligibility and commit membership history, immutable price/benefit snapshot, one invoice, payment allocation, audit and idempotency result atomically. Concurrent duplicate requests cannot double-charge or overlap terms.
- A current term displays a stable opaque QR card; no membership displays invitation; expiry displays renewal; revocation invalidates old token. Staff lookup reveals only permitted benefit fields.
- Profile updates persist; old invoices retain issued customer/price snapshots. Own statement reflects allocations and credits.
- Enquiry intake persists lead + staff notification in one transaction. Advanced CRM remains scheduled.
- Durable local verification/reset delivery supports retries and stale-lease recovery; production SMTP/provider duplicate risk is documented.
- Docker/env/CI files and setup/demo instructions exist. Actual host test results and unconfigured integrations are disclosed.
- Desktop/mobile checks, validation, permissions, membership concurrency/idempotency/ownership and worker retry tests run before stage completion.

## Stage-two scope update and acceptance (2026-10-03)

The stage-two request supersedes the earlier stage-one-only instruction and includes reception/CRM, bookings/social/waiting, complete shop/inventory, waiter/POS/kitchen and shared partial settlement/credits/refunds. Preserve the approved black-and-orange customer theme and white staff theme. Git was left untouched during implementation. The subsequent publishing request authorizes three logical commits and a push to the existing main branch, with revised timing: commit three two minutes after commit two. All three publishing commits use chris2006777@gmail.com as author and committer.

Operational defaults: trial discount 50%, social place ₹300, delivery fee ₹100, member tab due in seven days. Existing two-session daily quota, weekly complimentary benefits, five-minute holds, 30-minute waiting offers, 12-hour cancellation notice and ₹5,000 tab limit apply. Owner settings remain editable. Quote snapshots are estimates valid for seven days; membership processing reviews the current plan and policy.

Reception can process a paid membership for an invited account, but online sign-in still requires email verification. Account conversion sends a password-reset/verification invitation; it never activates a membership by itself. Cash/card/UPI are authorized manual records. Local checkout/refunds are simulated; production gateway verification is still an external stage-three integration. Manual refunds require a pending-to-recorded staff confirmation after repayment.

Database acceptance now includes exclusion-protected hourly court occupancy, closure/calendar serialization, direct-write concurrent daily quota and social-capacity enforcement, one social court reservation, duplicate participant prevention, shared online/counter stock locks, immutable invoice/line snapshots and bounded allocations/credits. Checkout and sensitive state changes are audited, authorized, idempotent and transactional. Worker jobs release/reoffer expired resources once.

Stage-two verification must cover all eight user scenarios against real PostgreSQL: same-court races, daily-quota races, last social place, last SKU, identical checkout retries, cross-account denial, expiry/cancellation/return/refund resource adjustment, and consistent POS/kitchen/customer/billing persistence. Browser inspection covers desktop/mobile and complete representative operational journeys. Actual results and unconfigured camera/SMTP/gateway dependencies are recorded in README.md and PLAN.md. Reporting, reconciliation, HR/payroll, scheduled membership reminders and external gateways remain stage three.

## Stage-three scope and acceptance audit (2026-10-03)

The current request authorizes Stage 3 and a full-product audit. The earlier stage-one/stage-two-only scope statements are historical. The current Git/GitHub prohibition supersedes all earlier publishing permission. Preserve the approved four-sport customer composition and white staff workspaces.

Stage-three local implementation includes owner reports/drill-downs/exports/alerts, business quotes/invoices, cash reconciliation, employees/shifts/leave/finalized payslips/configured withholding summaries, operational home/audit screens and scheduled expiry reminders. The Razorpay adapter implements server verification and durable duplicate-safe capture processing; external provider acceptance needs credentials. REQUIREMENTS.md maps every specification area to code/evidence and lists unperformed acceptance and material limits. JUDGING.md demonstrates the connected customer journey and concurrency/reminder/reconciliation proofs.

Recorded Stage 3 defaults: reminders at 09:00 Asia/Kolkata with editable 7/1/0-day offsets; configurable payroll withholding defaults to 0 basis points; low-stock alert means at most five unreserved units; salary/leave adjustments are explicit owner entries. Cash without an open shift is retained as unassigned and shown separately. Financial filters include both club dates; outstanding is calculated through the exclusive midnight after the end date and includes earlier invoices.

Status: local workflows implemented; production/external acceptance remains open. No claims are made for actual SMTP delivery, live/sandbox funds, provider exactly-once SMTP acceptance, camera hardware, disconnected physical LAN devices, Docker execution or remote CI. Full completion must not be declared until those required deployment checks are completed or the limitations are explicitly accepted.

Subsequent publishing authorization: the user requests three focused Stage 3 commits on STAGE3, never main, with at least two minutes between commits 1/2 and three minutes between commits 2/3. Author and committer use Sanjay <sanjay.practically@gmail.com>. This explicit permission supersedes the implementation-time Git prohibition for this publication only.
