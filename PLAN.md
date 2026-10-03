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

## Stage 3 — Local workflows implemented; external acceptance pending
- Owner financial reporting uses club-day/week/month/custom ranges, separate invoiced sales/received collections/credits/recorded refunds/pending refunds and outstanding through the end date. Department/method drill-downs reproduce totals. CSV includes supporting records and escapes spreadsheet formulas.
- Utilization, low stock, latest-term membership expiry and unpaid clubhouse alerts are live. Owner business quote snapshots create one immutable invoice under concurrency; membership invoices continue through shared billing. Printable invoices/quotes and report exports work.
- Cash shifts attach receipts and actual refunds transactionally, record reasoned payouts and compare counted/expected cash. A discrepancy requires an explanation; finalized shifts are immutable. Unassigned historical cash is explicit.
- Employee records/configured salaries, non-overlapping shifts with reasoned cancellation, staff-owned leave requests, owner decisions, immutable finalized pay/tax snapshots and period withholding exports are implemented. Staff see only their own employment. Operational home actions and searchable owner/own-staff audit views use persisted data.
- Membership reminder jobs/messages are scheduled with purchase/renewal and synchronized for existing terms by the separate worker. Defaults are 7/1/0 days at 09:00 Asia/Kolkata; timings are editable. Renewal suppresses obsolete messages; dispatch locks/rechecks the latest term. Local delivery, SMTP retries/failure and owner retry controls report actual mode/status.
- Razorpay adapter supports server-priced membership/hold/invoice checkout, callback/raw webhook HMAC, verified capture amounts/currency/order, durable jobs and duplicate-safe allocations. Stale captured checkouts are visible as unallocated collections and require provider review/repayment. Processed full exceptional repayment is verified and recorded once. Provider acceptance remains untested without credentials.
- Cart and user-scoped counter/POS item drafts persist locally; mutations do not automatically queue offline. Approved landing/customer/staff themes are retained. Obsolete stage-one placeholder text is corrected; narrow staff navigation scrolls horizontally.
- Seven migrations are applied locally. Docker/env/CI files and README/API/REQUIREMENTS/JUDGING documentation cover the final workflows. No Git/GitHub action was performed. Final checks and browser/restart evidence are recorded in README and REQUIREMENTS.

Deployment acceptance remains open for configured SMTP/Razorpay sandbox/live delivery, actual camera and LAN-device verification, Docker execution and remote CI. SMTP cannot guarantee provider exactly-once acceptance across a post-send crash; payroll is configured withholding rather than statutory filing. See REQUIREMENTS.md for explicit limits. Do not interpret local implementation as completion of unperformed external acceptance.

## Decisions and limits
- Subsequent Stage 3 publishing authorization: three commits on STAGE3 only, with a two-minute then three-minute gap, using sanjay.practically@gmail.com for author and committer. Main must remain unchanged. Earlier Git prohibitions describe implementation before this explicit authorization.
- The pasted user brief is authoritative; no PDF was available in the attachments.
- Git was left untouched during stage-two implementation. The user subsequently authorized pushing to the existing main branch in three logical commits, then revised the timing to create commit three two minutes after commit two. All three publishing commits use chris2006777@gmail.com as author and committer.
- Customer design remains black/white/orange; staff workspaces remain white/grey/slate.
- Real gateway configuration is required for production online payments; local mode issues explicitly labelled simulated receipts. Manual records do not imply gateway verification.
- Local PostgreSQL uses an isolated cluster on 5433; the host cluster on 5432 is untouched.
