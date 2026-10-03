# Implementation stages

## Stage 1 — Foundation and membership (complete)
Project setup, PostgreSQL migrations/seeds, Better Auth verification/reset/revocation, Champions IDs, ownership/roles, approved customer/staff themes, landing/public reads, profile, membership purchase/renewal/change, shared billing/idempotency, QR issue/lookup/revocation, owner settings/plans, local email/SMTP adapter, durable worker, Docker/CI configuration and documentation.

## Stage 2 — Courts, reception, shop and clubhouse (complete)
- Hourly holds, member/guest/trial pricing, complimentary weekly benefits, reception walk-ins, cancellation, check-in, closures/reopening, alternatives and Friday social play are operational. PostgreSQL exclusion, court locks, member quota triggers and event-capacity triggers protect concurrent writes. Social play uses one court reservation and separate participant places.
- FIFO waiting offers recover after expiry/cancellation through durable jobs. Ineligible or already participating customers are skipped; contested customer locks retry without jumping the queue. The landing trial action opens the real booking checkout.
- Reception has a live daily calendar, member search, manual/QR lookup, check-in and membership processing. CRM saves enquiries, notifications, assignment, activities, follow-ups, quotes and account conversion/invitations.
- The 36-product catalogue has variants and a persistent draft cart. Online and counter checkout reserve the same stock. Pickup/delivery, collection/dispatch, order history, receipts, cancellation, partial returns, restocking and audited corrections are operational.
- Waiter/POS tables support members/guests, notes, additions, tabs and partial settlement. Separate kitchen tickets show amendments with guarded preparation versions. Preparation and payment states are independent; bill history, kitchen and finance read the same persisted records.
- Shared billing calculates server prices, snapshots invoice lines, allocates partial/full payments, creates credits/refunds and deduplicates checkout. Cash/card/UPI are manual records; local payments are clearly simulated. Ownership, roles, reasons, audit records and state guards are enforced. Mutations invalidate queries and refresh server views.

Acceptance verified on 2026-10-03 against the isolated PostgreSQL 18 database: all eight requested race, quota, capacity, inventory, retry, ownership, resource-release and cross-department consistency scenarios pass. Tests include direct SQL constraint tests and HTTP access tests. Browser journeys verified trial booking/check-in, shop checkout/collection/return, CRM quotation/conversion, kitchen preparation and POS settlement, plus desktop and 390px customer/staff layouts. Camera hardware, SMTP and a real payment gateway are not configured/tested. See README.md for check results and operating instructions.

The current request moves operational POS/kitchen and settlement/refunds from the original stage three into stage two.

## Stage 3 — Owner reporting and external integrations (planned)
Owner date-filtered sales/collections/refunds/outstanding reports with drill-down, utilization/expiry/low-stock/unpaid alerts, exports, shifts/reconciliation, employees/leave/salary/finalized payslips and configurable tax summaries.

Scheduled membership reminders (7, 1, 0 days), verified payment-gateway integration/signature verification/provider deduplication, disconnected-device drafts and final judging walkthrough. Hold/waiting/follow-up jobs, worker retry safety and concurrent kitchen version checks are already implemented. Compose and GitHub Actions still need execution in their respective environments.

## Decisions and limits
- The pasted user brief is authoritative; no PDF was available in the attachments.
- Git was left untouched during stage-two implementation. The user subsequently authorized pushing to the existing main branch in three logical commits, then revised the timing to create commit three two minutes after commit two. All three publishing commits use chris2006777@gmail.com as author and committer.
- Customer design remains black/white/orange; staff workspaces remain white/grey/slate.
- Real gateway configuration is required for production online payments; local mode issues explicitly labelled simulated receipts. Manual records do not imply gateway verification.
- Local PostgreSQL uses an isolated cluster on 5433; the host cluster on 5432 is untouched.
