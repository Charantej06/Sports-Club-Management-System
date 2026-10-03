# Implementation stages

## Stage 1 — Foundation and membership (complete)
Project configuration, PostgreSQL migrations, realistic persisted seeds, Better Auth signup/login/verification/reset/revocation, unique Champions IDs, role/ownership enforcement, shared public/staff themes, responsive photographic landing and separate public read destinations, account/profile, membership purchase/renewal/plan change, shared invoice/payment/allocation/idempotency foundations, opaque QR issue/lookup/revocation, editable business settings and plan prices, local email inbox and SMTP adapter, worker/outbox foundation, Docker Compose, CI checks and documentation.

Acceptance: run the app, demonstrate persistent purchase/renewal/profile, immutable invoice snapshots, real PostgreSQL concurrency/idempotency tests, restricted staff endpoints and record ownership; inspect desktop/mobile and fix failures. Record actual results in README.md.

## Stage 2 — Courts, shop and reception (planned)
Implement hourly one-hour reservation/hold service, future window/timezone rules, maintenance, member/guest/trial prices, concurrent court exclusion and per-member daily quota locks, cancellation/refunds, check-in and manual/camera scanning (@zxing/browser), Friday social event capacity/participation, FIFO waiting offers and durable expiry jobs. Shared membership pricing must evaluate the session date. Build reception booking and membership sales UI.

Add cart/variants/pickup/delivery checkout, stock locking/reservation rollback, stock movements, fulfillment, cancellation/returns, counter sales and inventory/low-stock workspace. Customer histories/statements link receipts back to each department. Test overlap, quota, social capacity, stock races, stale holds, refunds and authorization against PostgreSQL. Expand lead assignment/activities/quotes/conversion and front-desk notifications from persisted enquiry intake.

## Stage 3 — Clubhouse, operations and owner reporting (planned)
Waiter/cashier POS tables, guests/member lookup, additions, kitchen tickets/amendments/optimistic versions, served state, open tabs, settlement, spending limits/overdue restrictions, cash/card/UPI and verified gateway distinction, reasoned adjustments/refunds. Separate kitchen preparation workspace. Shifts, reconciliation and department reports.

Build owner date-filtered sales/collections/refunds/outstanding metrics with drill-down, utilization/expiry/low stock/unpaid alerts, business invoices/quotes/exports; employees/shifts/leave/salary/finalized payslips/configurable tax summaries. Integrate transactional membership reminders (7, 1, 0 days), obsolete-job suppression and retries, durable hold/waiting jobs, gateway signature verification/deduplication and real integrations. Test worker crash/retry safety, concurrent kitchen edits, cash reconciliation and every total. Complete LAN/disconnected-draft experience and final judging walkthrough.

## Decisions and limits
- Pasted user brief is authoritative; no PDF was available in the attachments.
- The user subsequently authorized publishing to Charantej06/Sports-Club-Management-System with no more than eight commits. Preserve the existing initial commit and add seven logical feature commits.
- Stage 1 must not pretend bookings, stock checkout, POS or reminder scheduling are operational.
- Real gateway configuration is deliberately required before accepting online production payments; local mode issues explicitly labelled simulated receipts.
- Local PostgreSQL can use an isolated cluster on 5433; do not modify the existing host cluster on 5432.
