# Champions Club

Stages one and two are complete: secure accounts/memberships, court and trial booking, reception/CRM, online/counter retail and inventory, waiter/POS and kitchen, shared invoices/payments/credits/refunds and durable jobs. Customer pages retain the approved black-and-orange design; staff workspaces retain the white design. Stage three adds owner financial/operational reports, reconciliation, business documents, people/payroll, scheduled reminders and a configurable verified Razorpay adapter. Local workflows are implemented; external/hardware acceptance remains open in REQUIREMENTS.md.

## Local setup

Requires Node.js **22.13+** (tested on 22.20.0), npm and PostgreSQL 18. Internet is needed once to install packages. After installation, the application, database, fonts, photographs, product illustrations, QR generation and local inbox run without internet.

```powershell
npm ci
npm run setup:env
npm run db:local
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3000**. In a separate terminal run `npm run worker` for email, scheduled membership reminders, hold expiry, waiting offers, CRM follow-ups and verified gateway capture jobs. Production-style local run: `npm run build`, then `npm start`. Keep the worker running during normal operation; checkout still rejects expired holds if the worker is temporarily stopped.

`db:local` uses the installed binaries at `C:/Program Files/PostgreSQL/18/bin`. Override `PG_BIN` for another installation. It creates an isolated persistent cluster in `.local/postgres` bound to **127.0.0.1:5433**. It never edits or uses the existing system cluster on 5432. Stop this cluster with `node scripts/local-postgres.mjs --stop`. On other operating systems, using your own PostgreSQL instance or Compose is recommended; set `DATABASE_URL` accordingly.

`setup:env` preserves existing configuration and generates a random Better Auth secret for a new `.env`. Use `.env.example` as the complete configuration reference. Seeding preserves existing rows, prices, stock, roles and memberships. It creates demo users with known credentials; use this seed only in a local demo database.

## Docker alternative

Docker was unavailable on the development host, so Compose is supplied but **not execution-tested**. Stop the local cluster first if it occupies 5433. Set `POSTGRES_PASSWORD` to a URL-safe password in `.env`, then:

```sh
docker compose up --build -d
docker compose run --rm app npm run db:seed
```

Compose starts PostgreSQL with a persistent volume, applies migrations before app/worker startup, and health-checks the database and application. The volume survives normal container shutdown. Use a new auth secret and no demo accounts for a real deployment.

## Demo accounts

All initial demo passwords: **Champions2026!**. Email addresses end in `@champions.local`.

| Email prefix | Role / initial scenario |
|---|---|
| member | Aarav, active Gold membership and receipt |
| new | Ananya, account without a membership on a fresh seed |
| junior | Riya, under-18 account eligible for Junior |
| expired | Karan, expired Silver membership and renewal prompt |
| owner | Priya, business settings, plans, staff access and local inbox |
| reception | Neha, calendar, walk-ins, check-in, memberships and CRM |
| cashier | Dev, counter inventory, waiter/POS and department billing |
| kitchen | Kabir, separate preparation queue and item amendments |

Demonstration actions persist. Ananya purchased and renewed Silver during browser verification. Her local account now has two contiguous saved terms, a QR card, two test receipts and an updated demo phone. Re-seeding does not erase this history.

## Judging walkthrough

1. Explore the four sport panels on Home with mouse, touch or keyboard. Inspect facilities, plan prices, shop previews and the clubhouse. Use the mobile navigation at narrow widths.
2. Open Book a Court or the landing trial action. Select sport/date/hour, review the server-priced five-minute hold, then confirm local checkout. Inspect the saved booking/receipt in My Account. Full slots offer waiting-list entry; closures show reasons and alternatives. Friday social sessions have participant capacity and waiting lists.
3. Browse 36 products, choose variants, add to cart and select pickup/delivery. Confirm the server-priced hold and inspect history/receipt. In Inventory, collect a pickup or dispatch/deliver an order, then inspect returns, restocking and stock movements. Counter sales share online inventory.
4. Sign in as `new`, `junior` or `expired`. Edit your profile. Purchase or renew a membership in **local payment mode**. Accept the displayed demo policy, confirm, reload and inspect your membership card, history, statement and printable receipt. No funds are collected.
5. Gold/Silver/Junior benefits and paid prices are snapshotted. Renewals append contiguous terms; immediate plan changes supersede current/future terms without deleting history. Junior requires a birth date and age under 18 at the new term start.
6. Revoke/reissue a QR from My Account. Repeated reads reuse the issued identifier; revoked identifiers fail staff lookup. QR identifies a person and never independently authorizes payment.
7. Sign in as `owner`. Edit business settings or a membership plan. New public reads reflect saved changes; old receipts/term snapshots stay intact. Look up `CC-DEMO-MEMBER`. Assign roles only to an existing account; assignments revoke that account's sessions.
8. Submit a website enquiry. Reception/owner sees the saved lead and notification. Assign staff, add notes/follow-ups, save a plan quote and convert to a linked account. An invited account must reset its password and verify its email; conversion alone does not activate paid membership. Reception processes memberships using the reviewed plan/policy checkout.
9. Sign up with a new email. Sign in as owner in another browser session, open Local test inbox, then open the verification link in the signup browser. Password reset works the same way. Run the worker to mark queued local mail delivered. The inbox is owner-only and disabled in SMTP mode.
10. Try staff URLs as a member and another member's receipt URL. APIs reject restricted access; receipt pages show a not-found view and disclose no receipt data.
11. In Reception, search an email/Champions ID or scan a QR, inspect the daily calendar, create a guest walk-in and confirm a manual payment. Check-in opens 30 minutes before the session and is single-use. Customer cancellation requires 12-hour notice; staff overrides require a reason.
12. In POS, open a guest/member table, add item notes and submit. In Kitchen, accept → cook → ready; the cashier marks served. Additions create new tickets. Settle partially or fully with local test/cash/card/UPI and close only after preparation and settlement complete. Preparation and payment remain independent.
13. Eligible members can run a tab within the configured limit; overdue charges block more credit. Finance shows charges, allocations, credits and refund status. Manual refunds remain pending until staff records the actual repayment with a reason.

## Architecture and contracts

- `src/app`: App Router pages and HTTP endpoints.
- `src/modules`: account, membership, billing, bookings, shop, clubhouse, CRM, operations queries/dispatch, public reads and durable mail/job services.
- `src/lib`: Prisma connection, Better Auth, server session/role guards, errors and client helpers.
- `src/components/ui`: shadcn-style Radix/CVA primitives customized for both club themes; `components.json` is ready for additional shadcn components.
- `prisma`: schema, idempotent seed and seven versioned migrations with exclusion/check constraints, quota/capacity triggers, calendar locks and immutable invoice guards.
- `src/worker.ts`: separate durable-job process, transactional outbox, SKIP LOCKED claims, stale-lease recovery and retry backoff.

See [API.md](API.md) for endpoint contracts and [SPEC.md](SPEC.md) for the full brief, assumptions and acceptance criteria. Money is integer paise; discounts round half-up once. Dates persist as UTC instants; the club timezone is Asia/Kolkata. Identity/role/ownership checks run server-side. Checkout and profile changes serialize per user; invoice origin and idempotency keys have unique constraints. An issued membership, invoice, payment allocation and checkout result commit together.

## Integration modes and LAN use

`PAYMENT_MODE=local` enables **LOCAL_SIMULATED** payments and labelled test receipts; no funds move. Use PAYMENT_MODE=razorpay only with the configured adapter below; other unconfigured modes return 503. Authorized staff can record **MANUAL_RECORDED** cash/card/UPI payments and partial settlements. These records are not gateway confirmations. Local refunds are simulated/recorded; manual refunds are pending until staff records repayment. The optional Razorpay adapter creates GATEWAY_VERIFIED allocations only after server verification of captured payments.

`EMAIL_MODE=local` stores verification/reset messages in PostgreSQL. `EMAIL_MODE=smtp` uses Nodemailer and requires `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASSWORD`, and `EMAIL_FROM`. SMTP was not configured or tested. Local mail processing resumes safely after a crash; real SMTP is at-least-once delivery and can duplicate an email if a process dies after provider acceptance but before saving delivery status. The worker uses stable Message-ID and transactional per-message dispatch locks, but SMTP itself does not guarantee exactly-once provider acceptance.

For LAN operation, change `BETTER_AUTH_URL` to the host's LAN origin and list all exact permitted origins in `TRUSTED_ORIGINS` (comma-separated), then restart. The app listens on 0.0.0.0; PostgreSQL remains loopback-only. Internet is unnecessary for local operations. The cart persists a draft, but reservations/payments require the server. Counter/POS item drafts now persist per staff account on the device; mutations fail visibly while disconnected and do not automatically replay. Review the table/member after reconnecting. ZXing camera scanning requires HTTPS or localhost and camera permission; manual entry is available.

## Verification

```sh
npm run lint
npm run typecheck
npm test
# App must be running and DB migrated/seeded; local modes required:
npm run test:integration
npm run build
```

Actual stage-two results on 2026-10-03: **4 unit tests + 30 real-PostgreSQL/HTTP integration tests passed**. TypeScript, ESLint and the optimized production build pass. Tests create uniquely named fixtures and clean up their own records; use a dedicated database in CI. The worker is paused during tests so it cannot claim fixture jobs.

All eight requested scenarios pass:

| Scenario | Verified outcome |
|---|---|
| Same court, simultaneous customers | Exactly one succeeds; direct overlapping SQL writes fail |
| Concurrent daily limit | Excess service and direct SQL bookings fail; ordinary/social sessions share quota |
| Final social place | Capacity respected; duplicate participants rejected; expiry/waiting recovery succeeds |
| Final online/counter SKU | Exactly one reserves stock; failed carts roll back all reservations |
| Identical checkout retries | One hold, one final payment/allocation; changed payload rejected |
| Cross-account access | Read/receipt/mutation denied; staff role and origin restrictions verified over HTTP |
| Expiry/cancel/return/refund | Correct stock/slots/charges adjusted once, including partial returns and delayed social jobs |
| POS/kitchen/history/billing | Independent persisted states, notes/additions, partial payments, credits and receipts agree |

Additional tests cover closure/reopening, FIFO offers, member benefit snapshots, tab limits, stale kitchen versions, delivery dispatch, CRM follow-up deduplication/conversion/reception memberships, immutable invoices and ledger balance guards. Existing foundation tests cover authentication, QR revocation, renewals, eligibility, stale prices and worker retry/lease recovery.

Stage-two browser verification: landing trial checkout → confirmed account history → reception check-in; variant/cart/local checkout → counter collection → restocked return; CRM note/quote/account conversion; guest POS item note → kitchen accepted/cooking/ready → served → local settlement → closed table. Desktop and 390px customer/staff layouts were inspected without horizontal overflow. Saved proof is in `.local/screenshots`. Browser actions persist as explicitly simulated demonstration records. Camera hardware/permission and SMTP/gateway delivery were not tested.

After the production build, `npm start` and the worker were restarted. `/api/health` returned `status: ok`, all three migrations were up to date, and a fresh production browser tab showed the saved served/paid/closed guest bill with ₹320 allocated and ₹0 outstanding, without browser console errors. The earlier development tab needed replacement after the server restart; no application change was needed.

GitHub Actions configuration is included but has not run remotely. Git was left untouched during implementation, as requested; the user subsequently authorized publishing to main in three logical commits with the final commit two minutes after the UI commit. All three publishing commits use chris2006777@gmail.com as author and committer. The upstream Prisma/pg adapter emits a non-blocking concurrent-query deprecation warning during nested transactional reads; all assertions pass.

## Remaining stages

All local Stage 3 workflows are implemented. Deployment acceptance remains open for actual SMTP/Razorpay, Docker, remote CI, camera hardware and physical disconnected LAN-device verification. See PLAN.md, REQUIREMENTS.md and JUDGING.md for the full audit and limits.

## Operational policies

Prices/benefits are calculated on the server and snapshotted. Court benefits use the session date; weekly complimentary sessions include active holds. Trial discount defaults to 50%; social participation to ₹300, delivery to ₹100 and member tabs to ₹5,000 due in seven days. The owner can edit these settings. Checkout rechecks membership identity before confirming a discounted hold.

Pickup stock remains reserved until collection; delivery consumes stock at dispatch. Cancelling an unfulfilled order releases its reservation. Returns can restock usable goods or record damaged goods without restocking. Partial returns credit their historical line price cumulatively, with exact final totals; the delivery fee is retained. Invoice/line snapshots cannot be edited after issue. Allocations and credits are bounded under invoice locks.

Customer cancellations respect the configured notice period; checked-in sessions require a reasoned staff override. Social cancellation credits participant invoices and releases the single court reservation. Waiting offers last 30 minutes by default, count toward quota and are confirmed through the usual checkout. Expiry and release jobs are durable and repeat-safe.

POS additions retain notes and create a new ticket revision/invoice. Items may be cancelled before cooking; later financial adjustments require an authorized staff reason. Bar items require age 21+ from a member birth date or staff-attested guest eligibility. Tables close only when all remaining tickets are served/cancelled and invoices settled. Manual refund recording confirms staff repayment; it does not send money through a gateway.

PostgreSQL connections explicitly use UTC, including the pg adapter, so a host configured for Asia/Kolkata cannot shift timestamptz values. UI display and booking day/week boundaries use Asia/Kolkata.


## Stage three workspaces and reminders

Owner Staff desk opens live operational actions and reports. Today/week/month/custom filters use inclusive Asia/Kolkata club dates. Sales are invoices issued in the range, collections are payments received in the range, credits and actual recorded refunds have their own dates, and outstanding includes older invoices through the end date. Click a total/department/method for all supporting records; exports use integer paise and escape spreadsheet formulas. Unallocated captured provider funds are visible separately. Utilization excludes current maintenance closures and counts a social court once; its denominator uses the current opening-hour policy.

Business documents saves quotes and issues one immutable invoice. It does not reserve courts/stock or activate a membership; fulfillment uses the normal department service. Receipts and quotes are printable. Cash reconciliation calculates opening float + linked cash receipts − actual linked refunds − payouts. Counted differences require an explanation, and closed shifts are immutable. Historical cash without a shift is explicitly unassigned.

People & payroll configures existing staff accounts, salary and activity; schedules/cancels shifts; approves/rejects leave; and finalizes immutable employee/pay/withholding snapshots. Staff can view only their own employment and payslips. Default withholding is 0%; the owner edits label/rate in Business settings. Leave salary adjustments are explicit, and bank salary disbursement/statutory filing are external. Seeded Neha/Dev/Kabir salaries are ₹28,000/₹26,000/₹35,000 per month, preserved on rerun.

Reminder defaults: seven days, one day and expiry day at 09:00 Asia/Kolkata. The owner edits offsets/hour in Business settings. Purchase/renewal records jobs/messages transactionally; the worker synchronizes existing terms within one minute. New renewals suppress queued notices for earlier terms, and dispatch rechecks the latest term under the membership lock. Messages include name, plan, expiry and `/memberships` renewal link.

Reminders & delivery shows actual per-message mode, scheduled time, delivery state, attempts and failures. Retry delivery is available only for failed messages. Local test inbox delivery sends no external email. SMTP configuration requires EMAIL_MODE=smtp, SMTP_HOST/PORT, EMAIL_FROM and optional SMTP_USER/PASSWORD; use TLS-enabled credentials from your mail service and restart app/worker. Failed configuration retries, then becomes FAILED, rather than claiming delivery. A post-provider-acceptance crash can still duplicate SMTP delivery; local database delivery is repeat-safe.

## Optional Razorpay configuration

Local judging needs no payment credentials or internet. To test a real adapter, set PAYMENT_MODE=razorpay with RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and a separate RAZORPAY_WEBHOOK_SECRET, then restart app/worker. Begin with provider **test** keys. Configure automatic capture and a `payment.captured` webhook at the externally reachable HTTPS `/api/payments/webhook` endpoint. The provider checkout script requires internet; core local operations do not. Follow [Razorpay's integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/).

Membership, booking/social/shop holds and eligible invoice settlement use server-created orders. Callback/raw webhook signatures, fetched capture status, order, INR currency and amount are verified before shared checkout. Durable capture jobs recover browser interruption; duplicate events and retries do not allocate twice. Provider success is never inferred from a client-selected method. Mock-provider tests exercise signature/capture/amount/retry handling without moving funds; **no sandbox/live test has been performed on this host**.

If a captured checkout expired/changed, it does not reclaim scarce stock/courts or activate membership. It becomes NEEDS_REVIEW, creates an owner notification and remains an unallocated collection in reports. Arrange repayment in the provider dashboard. The owner can verify one processed full exceptional repayment by provider refund ID in Reminders & delivery; this updates repayment/report history without initiating another transfer. Ordinary invoice gateway refunds are repaid externally before staff records confirmation in Billing. Split exceptional repayments and automatic provider refund initiation are outside this implementation.

## Contribution workflow

When Git use is authorized, each teammate should use their own named branch, make focused commits for their actual work, run the checks, and open a PR for review. Do not attribute generated work or fabricated commits to teammates. Stage 3 implementation used no Git/GitHub actions. The subsequent user request authorizes publication to STAGE3 in three focused commits, with two minutes before commit 2 and three minutes before commit 3. Both author and committer use Sanjay <sanjay.practically@gmail.com>; main is unchanged.

## Stage three verification — 3 October 2026

ESLint, TypeScript, all **4 unit tests**, all **43 real-PostgreSQL/HTTP integration tests** and the optimized production build pass. All seven migrations are up to date and `/api/health` returns `ok`. The added tests cover exact report records/CSV, cash closing races, HR access and immutable snapshots, due reminders/renewal suppression/SMTP failure, duplicate verified capture and processed exceptional repayment. Provider requests in tests are mocked; no real funds or external email were sent.

Browser inspection covered the approved landing, separate booking/membership/shop/clubhouse/account pages, QR card, owner reports/drill-downs, business documents, reconciliation, payroll, reception, POS, kitchen and reminder states. Desktop and 390px customer/staff layouts were inspected, including keyboard sport selection and report drill-down. Final polish disables started slots, gives report/slot buttons descriptive accessible labels, corrects social loading/error states and keeps shop search usable alongside the category selector. Saved proof is in `.local/screenshots/stage3-*.jpg`.

The application was restarted and retained the ₹1,000 local business invoice. Browser settlement shows an explicitly simulated receipt, ₹1,000 allocated and ₹0 outstanding; owner reports agree. A zero-float/count cash shift closed balanced, and Neha's September demo payslip preserves ₹28,000 salary/0% withholding. These are local demonstrations, with no salary disbursement or money collected. Production app and worker were restarted after testing.

See [REQUIREMENTS.md](REQUIREMENTS.md) for every specification area and all limits, [JUDGING.md](JUDGING.md) for demo accounts and the connected walkthrough, and [handoff.md](handoff.md) for continuation details. Docker, remote CI, physical camera/LAN devices and actual SMTP/Razorpay acceptance remain unperformed. The Prisma/pg concurrent-query deprecation warning is non-blocking; assertions pass.
