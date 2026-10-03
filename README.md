# Champions Club

Stage 1 of the sports-club platform: a premium public site, real PostgreSQL records, secure accounts, memberships, local checkout, receipts, QR cards and an owner/staff foundation. Courts, shop and clubhouse have separate persisted read views; operational reservations, retail checkout and POS remain in PLAN.md for stages 2–3.

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

Open **http://localhost:3000**. In a separate terminal run `npm run worker` for email processing. Production-style local run: `npm run build`, then `npm start`.

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
| reception | Neha, member lookup and incoming enquiries |
| cashier | Dev, benefit lookup; waiter/cashier POS planned |
| kitchen | Kabir, preparation workspace foundation |

Demonstration actions persist. Ananya purchased and renewed Silver during browser verification. Her local account now has two contiguous saved terms, a QR card, two test receipts and an updated demo phone. Re-seeding does not erase this history.

## Judging walkthrough

1. Explore the four sport panels on Home with mouse, touch or keyboard. Inspect facilities, plan prices, shop previews and the clubhouse. Use the mobile navigation at narrow widths.
2. Open Book a Court. Change sport/date: hourly, one-hour availability reads reservations and closures from PostgreSQL and refreshes every 30 seconds. The preview cannot reserve a slot.
3. Browse 36 shop products; filter by sport, category or text and view variants/stock. Browse the stored clubhouse menu and unavailable-item labels.
4. Sign in as `new`, `junior` or `expired`. Edit your profile. Purchase or renew a membership in **local payment mode**. Accept the displayed demo policy, confirm, reload and inspect your membership card, history, statement and printable receipt. No funds are collected.
5. Gold/Silver/Junior benefits and paid prices are snapshotted. Renewals append contiguous terms; immediate plan changes supersede current/future terms without deleting history. Junior requires a birth date and age under 18 at the new term start.
6. Revoke/reissue a QR from My Account. Repeated reads reuse the issued identifier; revoked identifiers fail staff lookup. QR identifies a person and never independently authorizes payment.
7. Sign in as `owner`. Edit business settings or a membership plan. New public reads reflect saved changes; old receipts/term snapshots stay intact. Look up `CC-DEMO-MEMBER`. Assign roles only to an existing account; assignments revoke that account's sessions.
8. Submit a website enquiry. Reception/owner sees the persisted lead and immediate front-desk notification count. Lead activities/conversion come in stage two.
9. Sign up with a new email. Sign in as owner in another browser session, open Local test inbox, then open the verification link in the signup browser. Password reset works the same way. Run the worker to mark queued local mail delivered. The inbox is owner-only and disabled in SMTP mode.
10. Try staff URLs as a member and another member's receipt URL. APIs reject restricted access; receipt pages show a not-found view and disclose no receipt data.

## Architecture and contracts

- `src/app`: App Router pages and HTTP endpoints.
- `src/modules`: account, membership, shared billing, public read queries and durable mail services.
- `src/lib`: Prisma connection, Better Auth, server session/role guards, errors and client helpers.
- `src/components/ui`: shadcn-style Radix/CVA primitives customized for both club themes; `components.json` is ready for additional shadcn components.
- `prisma`: schema, idempotent demo seed and versioned SQL migration with PostgreSQL exclusion/check constraints.
- `src/worker.ts`: separate durable-job process, transactional outbox, SKIP LOCKED claims, stale-lease recovery and retry backoff.

See [API.md](API.md) for endpoint contracts and [SPEC.md](SPEC.md) for the full brief, assumptions and acceptance criteria. Money is integer paise; discounts round half-up once. Dates persist as UTC instants; the club timezone is Asia/Kolkata. Identity/role/ownership checks run server-side. Checkout and profile changes serialize per user; invoice origin and idempotency keys have unique constraints. An issued membership, invoice, payment allocation and checkout result commit together.

## Integration modes and LAN use

`PAYMENT_MODE=local` enables **LOCAL_SIMULATED** payments and explicitly labelled test receipts. Every other value disables purchase with 503 until a verified gateway adapter is implemented. Cash/card/UPI recording, allocations for partial settlements and refunds have schema foundations; their workflow integrations are planned.

`EMAIL_MODE=local` stores verification/reset messages in PostgreSQL. `EMAIL_MODE=smtp` uses Nodemailer and requires `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASSWORD`, and `EMAIL_FROM`. SMTP was not configured or tested. Local mail processing resumes safely after a crash; real SMTP is at-least-once delivery and can duplicate an email if a process dies after provider acceptance but before saving delivery status. Provider deduplication is a stage-three integration.

For LAN operation, change `BETTER_AUTH_URL` to the host's LAN origin and list all exact permitted origins in `TRUSTED_ORIGINS` (comma-separated), then restart. The app listens on 0.0.0.0; PostgreSQL remains loopback-only. Internet is unnecessary for club operations in local mode. Safe offline drafts and disconnected-device UX are scheduled for the later operational stages. Camera scanning is installed for stage two; browsers generally require HTTPS or localhost for camera access.

## Verification

```sh
npm run lint
npm run typecheck
npm test
# App must be running and DB migrated/seeded; local modes required:
npm run test:integration
npm run build
```

Actual results on 2026-10-03: TypeScript passed, ESLint passed, **4 unit tests + 12 real-PostgreSQL/HTTP integration tests passed**, and optimized Next.js production build passed. Integration tests cover authorization/ownership, cross-origin rejection, concurrent checkout replay and payload mismatch, competing purchase keys, contiguous renewal, plan-change history, Junior/profile eligibility, court overlap/stock constraints, QR reuse/revocation, privileged signup rejection, verification/reset/session revocation, stale-price rejection with original checkout replay, and worker failure/stale-lease/retry safety. Tests create uniquely named records and clean up only their own records; use a dedicated database in CI.

Browser verification: desktop navigation and sport selection; 390px mobile home/menu/account/checkout with no horizontal overflow; persistent Silver purchase and renewal, contiguous history, profile save/reload and printable receipt; owner login, member benefit lookup, settings save, plan edit/reload with immutable historical invoice, local inbox and saved website enquiry/front-desk notification verified. Plan prices were restored to demo defaults after verification. Saved screenshots are in .local/screenshots. A development-browser loading error was recovered in a fresh tab.

GitHub Actions configuration is included; it has not been run remotely. The implementation is organized into seven feature commits following the original repository commit. Teammates should contribute through their own branches, commits and PRs and run these checks; no teammate contributions are fabricated.

## Remaining stages

Stage 2 connects scarce-resource booking/holds/check-in/social play/waiting lists, retail cart/inventory/fulfillment/returns and reception/CRM workflows. Stage 3 connects waiter/kitchen/POS/tabs, reconciliation/reports/HR/payroll, scheduled expiry reminders, verified payment integrations and exports. Full scope is retained in PLAN.md and SPEC.md.
