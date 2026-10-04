# Champions Club — Sports Club Management System

> A complete, full-stack sports-club management platform built for the Odoo Hackathon.  
> Covers every department from member sign-up through court booking, retail, kitchen, billing and owner reporting — all running locally with no external dependencies.

---

## ⚡ Quick Start: How to Run in 60 Seconds

### Prerequisites
- **Node.js**: `v22.13.0` or later (tested on Node `22.20.0`) — run `node --version` to confirm
- **PostgreSQL**: PostgreSQL 18
- **Package Manager**: npm (bundled with Node)

### Setup Commands

```powershell
# 1. Install dependencies (internet needed only once)
npm ci

# 2. Generate .env with a secure random auth secret (preserves any custom variables)
npm run setup:env

# 3. Start the isolated local PostgreSQL 18 cluster on port 5433
npm run db:local

# 4. Generate Prisma client & apply all database migrations
npm run db:generate
npm run db:migrate

# 5. Seed demo users, 36 products, courts, clubhouse menu, and sample invoices
npm run db:seed

# 6. Start the Next.js web application
npm run dev

# 7. In a separate terminal, start the durable background worker daemon
npm run worker
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

> **One-Command Alternative**: If you prefer running both the Next.js app and the worker in a single terminal, use `npm run dev:all`.

---

## 🔑 Demo Accounts Quick Reference

All demo user accounts are pre-seeded with password: **`Champions2026!`**

| Email | Role | Scenario & What to Test |
|---|---|---|
| `owner@champions.local` | **Owner** | Full admin: revenue reports, cash shift audits, business settings, plans, staff payroll, and local inbox. |
| `reception@champions.local` | **Reception** | Daily court calendar, QR check-in, walk-in reservations, CRM leads & quotes, and membership intake. |
| `cashier@champions.local` | **Cashier / Waiter** | Counter retail sales, live dining POS, member tabs, bill settlement, and cash shift closing. |
| `kitchen@champions.local` | **Kitchen** | Real-time preparation queue (`Accept` → `Cook` → `Ready`), amended ticket versions, and dietary alerts. |
| `member@champions.local` | **Member** | Active Gold member (Aarav), digital Champions QR ID card, court reservations, order history, and receipts. |
| `new@champions.local` | **Member** | Fresh user (Ananya) without a membership (test self-serve membership purchase flow). |
| `junior@champions.local` | **Member** | Under-18 junior account (Riya), eligible for age-restricted Junior plan. |
| `expired@champions.local` | **Member** | Expired silver member (Karan), showing automatic renewal prompts and lapsed benefits. |

> All demonstration actions **persist**. Re-running seed does not erase your local purchase or booking history.

---

## Table of Contents

1. [What Is Champions Club?](#1-what-is-champions-club)
2. [System Overview](#2-system-overview)
3. [Architecture](#3-architecture)
   - [3.1 High-Level Architecture Overview](#31-system-architecture-overview)
   - [3.2 Enterprise Monolith & Persistence Layer](#32-enterprise-monolith--persistence-layer)
   - [3.3 Request Lifecycle](#33-request-lifecycle)
   - [3.4 Module Map](#34-module-map)
4. [Tech Stack](#4-tech-stack)
5. [Local Setup](#5-local-setup)
6. [Environment Variables](#6-environment-variables)
7. [Demo Accounts](#7-demo-accounts)
8. [System Workflows](#8-system-workflows)
   - [8.1 Accounts & Authentication](#81-accounts--authentication)
   - [8.2 Memberships & QR Cards](#82-memberships--qr-cards)
   - [8.3 Court Booking & Social Play](#83-court-booking--social-play)
   - [8.4 The Champions Shop](#84-the-champions-shop)
   - [8.5 Clubhouse Kitchen & Bar](#85-clubhouse-kitchen--bar)
   - [8.6 Reception & CRM](#86-reception--crm)
   - [8.7 Shared Billing & Payments](#87-shared-billing--payments)
   - [8.8 Owner Reports & Administration](#88-owner-reports--administration)
   - [8.9 Background Worker & Emails](#89-background-worker--emails)
9. [Integration Modes](#9-integration-modes)
10. [Database](#10-database)
11. [Testing & Verification](#11-testing--verification)
12. [Docker](#12-docker)
13. [LAN & Offline Operation](#13-lan--offline-operation)
14. [Operational Policies](#14-operational-policies)
15. [Judging Walkthrough](#15-judging-walkthrough)
16. [Contributing](#16-contributing)

---

## 1. What Is Champions Club?

**Champions Club** is a production-grade sports-club management system for a multi-sport club offering **Tennis, Padel, Badminton and Cricket**. It is a single-application monolith that handles every department of club operations — from member sign-up and court booking, through retail and kitchen POS, to owner financial reporting and payroll.

| Department | Who uses it |
|---|---|
| Customer portal and membership | Members / public |
| Court booking and social play | Members, reception |
| Retail shop | Online shoppers, counter cashiers |
| Clubhouse kitchen and bar POS | Waiters, kitchen staff, cashiers |
| Reception and CRM | Reception team |
| Financial reporting and reconciliation | Owner / management |
| HR, payroll and shift management | Owner, staff |
| Email delivery and background jobs | Automated worker |

The platform operates **fully offline** after the initial package install. No payment gateway, cloud email or third-party account is required for any local demo or judging session.

---

## 2. System Overview

Champions Club is split into eight functional systems, each owned by a corresponding source module under `src/modules/`:

| System | Module | Description |
|---|---|---|
| **Accounts** | `account` | Sign-up, login, profile, session management, Champions ID, QR card |
| **Membership** | `membership` | Plans, purchase, renewal, benefit snapshots, eligibility, term history |
| **Bookings** | `bookings` | Court scheduling, hourly holds, social play, waiting lists, check-in |
| **Shop** | `shop` | 36-product catalogue, variants, cart, online and counter checkout, inventory |
| **Clubhouse** | `clubhouse` | Table POS, kitchen tickets, member tabs, settlement, shift reports |
| **CRM** | `crm` | Enquiries, leads, assignment, follow-ups, quotes, account conversion |
| **Billing** | `billing` | Shared invoices, allocations, credits, refunds, idempotency, receipts |
| **Operations / Admin** | `administration`, `reports`, `staff`, `operations` | Owner reports, cash reconciliation, payroll, employee management |

All systems share one PostgreSQL database through Prisma. Business rules are enforced at the database level with constraints, triggers, exclusion locks and transactions — not only in application code.

---

## 3. Architecture

### 3.1 System Architecture Overview

```mermaid
flowchart TD
    subgraph CLIENT["🌐 Presentation & Client Layer"]
        CP["Customer Pages
(black · white · orange)"]
        SP["Staff Workspace
(white · slate · orange)"]
        MOB["Responsive Mobile View
(390px Viewport Support)"]
    end

    subgraph NEXTJS["⚡ Next.js App Router  —  Node 22"]
        direction TB
        subgraph PAGES["src/app/  — Pages & Route Handlers"]
            PUB["Public Pages
Home · Book · Memberships · Shop · Clubhouse"]
            ACC["account/
Profile · QR card · Activity · Invoices"]
            STF["staff/
Reception · POS · Kitchen · Inventory · Owner"]
            API["api/
Authenticated REST Endpoints
Zod Validation · Idempotency Guard"]
        end

        subgraph MODULES["src/modules/  — Decoupled Business Services"]
            direction LR
            M1["account
membership"]
            M2["bookings
shop"]
            M3["clubhouse
crm"]
            M4["billing
reports"]
            M5["administration
operations · mail"]
        end

        subgraph LIB["src/lib/  — Infrastructure & Shared Utilities"]
            direction LR
            L1["db.ts
Prisma Client · UTC Mode"]
            L2["access.ts
RBAC Guards · Session"]
            L3["errors.ts
AppError Handlers"]
            L4["cart-store.ts
User-Scoped Isolation"]
        end
    end

    subgraph DB["🗄️ PostgreSQL 18  —  127.0.0.1:5433"]
        direction LR
        DB1["Exclusion Constraints
EXCLUDE USING gist"]
        DB2["Database Triggers
Daily Quota · Event Capacity"]
        DB3["Pessimistic Row Locks
SELECT FOR UPDATE"]
        DB4["Transactional Outbox
SKIP LOCKED Queue"]
    end

    subgraph WORKER["⚙️ Durable Background Worker  —  src/worker.ts"]
        direction LR
        W1["Hold Expiry Sweeper
FIFO Waitlist Reoffer"]
        W2["7/1/0-Day Reminder Dispatch
Dual Email Adapters (Local/SMTP)"]
        W3["Gateway Capture Recovery
Stale Lease Auto-Recovery"]
    end

    CP & SP & MOB -->|HTTPS / JSON| API
    API --> PAGES
    PAGES --> MODULES
    MODULES --> LIB
    LIB -->|Prisma Transactions| DB
    DB -->|SKIP LOCKED claims| WORKER
    WORKER -->|retry / complete| DB
```

### 3.2 Enterprise Monolith & Persistence Layer

The architecture enforces strict data integrity rules across all club domains:

```mermaid
flowchart TD
    subgraph INGRESS["Client Mutation Ingress"]
        REQ["Client Mutation Request"] --> IDEM["Idempotency Header Check"]
        IDEM --> AUTH["Better Auth Session Validation"]
        AUTH --> RBAC["Role & Ownership Verification"]
    end

    subgraph TX["Atomic Database Transaction (Prisma)"]
        RBAC --> LOCK["Pessimistic Row Lock (Court / SKU / Invoice)"]
        LOCK --> BIZ["Execute Server-Priced Domain Logic"]
        BIZ --> SNAP["Snapshot Immutable Invoice / Benefits / Lines"]
        SNAP --> ENQ["Enqueue Outbox Job (Email / Audit / Sweeper)"]
        ENQ --> COMMIT["Commit Transaction (Release Locks)"]
    end

    subgraph POST["Response & Propagation"]
        COMMIT --> RES["HTTP 200 Response with Immutable Entity"]
        COMMIT --> ASYNC["Worker Claims Outbox Job (SKIP LOCKED)"]
    end
```

### 3.3 Request Lifecycle

```mermaid
flowchart LR
    REQ(["HTTP Request"])
    AUTH["🔐 Authenticate
Better Auth session"]
    AUTHZ["🛡️ Authorize
Role + Ownership check"]
    ZOD["✅ Validate
Zod schema"]
    MOD["📦 Module
Business logic"]
    TX["🏦 Transaction
DB constraints + locks"]
    RES(["HTTP Response"])

    REQ --> AUTH
    AUTH -->|valid session| AUTHZ
    AUTH -->|no session| E1(["401 Unauthorized"])
    AUTHZ -->|permitted| ZOD
    AUTHZ -->|denied| E2(["403 Forbidden"])
    ZOD -->|clean| MOD
    ZOD -->|invalid| E3(["400 Bad Request"])
    MOD --> TX
    TX -->|committed| RES
    TX -->|constraint violation| E4(["409 / 422 Error"])
```

### 3.4 Module Map

```mermaid
graph TD
    subgraph CUSTOMER["Customer-facing"]
        A1["account
profile · QR · session"]
        A2["membership
plans · terms · benefits"]
        A3["bookings
courts · holds · social"]
        A4["shop
catalogue · cart · orders"]
        A5["clubhouse
POS · kitchen · tabs"]
    end

    subgraph STAFF["Staff-facing"]
        B1["crm
enquiries · leads · CRM"]
        B2["operations
reception · check-in"]
        B3["administration
owner · payroll · HR"]
        B4["reports
financial · utilization"]
    end

    subgraph SHARED["Shared Services"]
        C1["billing
invoices · allocations
credits · refunds"]
        C2["mail
outbox · delivery · SMTP"]
        C3["public
read-only public views"]
        C4["staff
role guards · onboarding"]
        C5["facilities
courts · sports · status"]
    end

    A1 & A2 & A3 & A4 & A5 --> C1
    B1 & B2 & B3 & B4 --> C1
    C1 --> C2
    A3 & A4 & A5 --> C5
```

**Key design principles:**

- **API layer** only authenticates, authorizes (role + ownership), validates with Zod and delegates to modules.
- **Modules** own all business rules. They never return raw database rows to HTTP handlers.
- **Database** is the last line of defence — constraints and locks prevent corrupt state even if application code has a bug.
- **Worker** is a separate Node process that claims durable jobs using `SKIP LOCKED` to avoid double-processing. It recovers stale leases after crashes.
- **Money** is always stored as **integer paise** (Rs 1 = 100 paise). No floating-point arithmetic on financial values.
- **Timestamps** are stored as UTC; the club timezone (`Asia/Kolkata`) is used only for display and booking-day boundaries.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 6 (strict mode) |
| Styling | Tailwind CSS 4, GSAP 3 animations |
| UI primitives | Radix UI / CVA (shadcn-style, custom club themes) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 18 |
| Auth | Better Auth 1 (sessions, verification, revocation) |
| Validation | Zod 4 + React Hook Form 7 |
| Data fetching | TanStack Query 5 |
| QR | `qrcode` (generation) + `@zxing/browser` (camera scan) |
| Email | Nodemailer (SMTP) + local DB inbox |
| Background jobs | Custom durable worker with transactional outbox |
| Testing | Node built-in test runner (`tsx --test`) |
| CI | GitHub Actions |
| Containers | Docker / Compose |

---

## 5. Local Setup

### Prerequisites

- **Node.js 22.13+** (tested on 22.20.0) — run `node --version` to confirm
- **npm** (bundled with Node)
- **PostgreSQL 18** installed at `C:/Program Files/PostgreSQL/18/bin`
  (override with `PG_BIN` env var if installed elsewhere)

> **Internet is needed once** to download packages. After `npm ci`, all fonts, images, QR generation, email and the local database run offline.

### Step-by-step

```powershell
# 1. Install dependencies
npm ci

# 2. Generate .env with a random auth secret (safe to re-run; preserves existing values)
npm run setup:env

# 3. Start the isolated local PostgreSQL cluster on port 5433
npm run db:local

# 4. Generate the Prisma client
npm run db:generate

# 5. Apply all migrations
npm run db:migrate

# 6. Seed demo users, catalogue, menu and courts
npm run db:seed

# 7a. Start everything at once (recommended)
npm run dev:all

# 7b. Or start separately in two terminals
npm run dev       # Next.js on http://localhost:3000
npm run worker    # Background job processor
```

Open **http://localhost:3000** in your browser.

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev:all` | Start app + worker together (Ctrl+C stops both) |
| `npm run start:all` | Production mode (after `npm run build`) |
| `npm run db:local -- --stop` | Stop the local PostgreSQL cluster |
| `npm run mail:verify -- you@example.com` | Test SMTP configuration |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript compile check |
| `npm test` | Automated unit test suite (14 tests) |
| `npm run test:integration` | Integration tests (requires running app + migrated DB) |
| `npm run build` | Production build |

> **Note:** `db:local` creates an isolated persistent cluster in `.local/postgres` bound to `127.0.0.1:5433`. It never touches the system cluster on port 5432. Seeding is idempotent — it preserves existing rows, prices, stock, roles and memberships.

---

## 6. Environment Variables

Copy `.env.example` to `.env` (or run `npm run setup:env`). All variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://champions:champions_local_only@127.0.0.1:5433/champions` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | *(generated)* | At least 32-char random secret for session signing |
| `BETTER_AUTH_URL` | `http://localhost:3000` | App origin — change to LAN IP for LAN use |
| `TRUSTED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `PAYMENT_MODE` | `local` | `local` (simulated) or `razorpay` |
| `RAZORPAY_KEY_ID` | *(empty)* | Razorpay key (required if `PAYMENT_MODE=razorpay`) |
| `RAZORPAY_KEY_SECRET` | *(empty)* | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | *(empty)* | Razorpay webhook HMAC secret |
| `EMAIL_MODE` | `local` | `local` (owner inbox) or `smtp` (real delivery) |
| `SMTP_HOST` | *(empty)* | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (use 465 for implicit TLS) |
| `SMTP_SECURE` | *(auto)* | Force TLS: `true` or `false` |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASSWORD` | *(empty)* | SMTP password |
| `EMAIL_FROM` | `Champions Club <club@champions.local>` | Sender address |
| `POSTGRES_PASSWORD` | `champions_local_only` | Docker Compose DB password |

See **[docs/SMTP.md](docs/SMTP.md)** for provider-by-provider email configuration (Gmail, Brevo, SendGrid, SES, etc.).

---

## 7. Demo Accounts

All demo passwords: **`Champions2026!`** — emails end in `@champions.local`.

| Email | Role | Scenario |
|---|---|---|
| `member@champions.local` | Customer | Aarav — active Gold membership, receipts, QR card |
| `new@champions.local` | Customer | Ananya — account with no membership (purchase flow) |
| `junior@champions.local` | Customer | Riya — under-18, eligible for Junior plan |
| `expired@champions.local` | Customer | Karan — expired Silver, renewal prompt shown |
| `owner@champions.local` | Owner | Priya — full admin: reports, settings, staff, inbox |
| `reception@champions.local` | Reception | Neha — calendar, walk-ins, check-in, CRM |
| `cashier@champions.local` | Cashier / Waiter | Dev — counter sales, POS, billing |
| `kitchen@champions.local` | Kitchen | Kabir — preparation queue and item amendments |

> Demonstration actions **persist**. Re-seeding does not erase purchase or booking history.

---

## 8. System Workflows

### 8.1 Accounts & Authentication

```mermaid
flowchart TD
    SU["Sign Up
email + password"] --> VE["Email Verification
link in inbox"]
    VE --> LI["Login
Better Auth session"]
    LI --> CD{"Role?"}
    CD -->|member| CX["Customer workspace
Profile · Bookings · Shop
Statement · QR card"]
    CD -->|reception| RX["Reception workspace
Calendar · Walk-ins · CRM"]
    CD -->|cashier| CAS["Cashier workspace
POS · Inventory · Billing"]
    CD -->|kitchen| KIT["Kitchen screen
Tickets · Preparation"]
    CD -->|owner| OWN["Owner workspace
Reports · Settings · HR"]

    PR["Password Reset
link in inbox"] -->|forgot password| LI
    OWN -->|assign role| RA["Role Assignment
revokes existing sessions"]
    RA --> LI
```

- Every account gets a unique **Champions ID** (e.g. `CC-DEMO-MEMBER`) enforced by the database.
- Sign-up, login, logout, session expiry, email verification and password-reset all use **Better Auth**.
- Public sign-up cannot assign privileged roles. Owner assigns roles; role assignment revokes existing sessions immediately.
- Customer pages show: profile, booking history, purchase history, receipts, outstanding charges and a membership card or QR.
- **Authorization:** every protected API endpoint checks session + role + ownership. A member cannot access another member's receipts, bookings or statement by changing an ID in the URL.

---

### 8.2 Memberships & QR Cards

**Plans:** Gold (Rs 3,999/mo), Silver (Rs 2,199/mo), Junior (Rs 1,199/mo)

| Benefit | Gold | Silver | Junior |
|---|---|---|---|
| Court discount | 25% | 15% | 20% |
| Shop discount | 15% | 5% | 10% |
| Food/bar discount | 15% | 5% | 10% |
| Free sessions/week | 2 | 0 | 1 |

**Purchase flow:**

```mermaid
flowchart LR
    A(["Member"]) --> B["Select Plan
Gold · Silver · Junior"]
    B --> C["Select Term
1 month · 3 months · Annual"]
    C --> D["Server prices
+ term discount applied"]
    D --> E["5-min Hold
created atomically"]
    E --> F{"Confirm?"}
    F -->|yes| G["Atomic commit
term + invoice
+ allocation
+ benefit snapshot
+ audit + idempotency key"]
    F -->|timeout / cancel| H["Hold released
slot freed"]
    G --> I(["Active Membership
QR Card issued"])

    subgraph CONCURRENCY["Concurrency guard"]
        E -->|duplicate request| DUP["Idempotency key
returns original result"]
    end
```

**Membership card and QR:**
- Active membership shows a virtual card with name, Champions ID, plan badge and an opaque QR code.
- QR contains a **revocable opaque identifier** — not personal data. Revoking issues a new identifier; the old one fails staff lookup immediately.
- Staff can scan the QR to see permitted member details (name, plan, benefits) but never payment secrets.
- No membership shows an invitation card. Expired shows a renewal prompt. History is never deleted.

---

### 8.3 Court Booking & Social Play

**Courts:** 3 Tennis · 2 Padel · 4 Badminton · 2 Cricket nets  
**Hours:** 06:00–23:00 daily · Hourly start times · 14-day booking window

**Standard booking flow:**

```mermaid
flowchart TD
    S(["Customer"]) --> SEL["Select Sport · Date · Hour"]
    SEL --> VAL{"Server validates"}
    VAL -->|court busy| BUSY(["Show alternatives
+ Waiting list option"])
    VAL -->|quota exceeded| QUOTA(["2-session daily
limit reached"])
    VAL -->|clear| HOLD["Exclusive Hold
PostgreSQL exclusion constraint
5-minute expiry"]
    HOLD --> CONF{"Confirm?"}
    CONF -->|yes| PAY["Payment
local / manual / gateway"]
    PAY --> BOOK["Confirmed Booking
Invoice + allocation saved"]
    BOOK --> CHK["Check-in opens
30 min before session"]
    CONF -->|timeout / close| REL["Hold released immediately
court freed for all users"]

    subgraph SOCIAL["Friday Social Play"]
        direction LR
        SS["Single court
reserved"] --> PS["Participant places
up to 12  capacity trigger"]
        PS --> WS["Waiting list
if full"]
    end

    subgraph WAIT["Waiting List"]
        WL["Worker finds
earliest eligible"] --> OFF["Offer sent
30-min accept window"]
        OFF -->|accepted| BOOK
        OFF -->|expired| NXT["Next in queue"]
    end
```

**Instant Release on Modal Close:**
- When a user opens checkout, a server-side `HOLD` locks the slot.
- If the user clicks **Close**, clicks the backdrop, or hits Escape, an immediate cancellation mutation releases the slot in PostgreSQL, and availability refetches instantly so other players can book it right away without waiting 5 minutes.

---

### 8.4 The Champions Shop

**Catalogue:** 36 products across Tennis, Padel, Badminton, Cricket, Apparel and Accessories — with variants (size, colour, weight), realistic stock levels and sport-specific imagery.

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT : cart checkout
    PENDING_PAYMENT --> PAID : payment confirmed
    PAID --> PROCESSING : staff picks order
    PROCESSING --> READY_FOR_PICKUP : pickup selected
    PROCESSING --> DISPATCHED : delivery selected
    READY_FOR_PICKUP --> FULFILLED : member collects
    DISPATCHED --> FULFILLED : delivery confirmed
    PENDING_PAYMENT --> CANCELLED : abandoned / staff cancel
    PAID --> CANCELLED : staff cancel
    PROCESSING --> CANCELLED : staff cancel
    CANCELLED --> [*] : stock reservation released
    FULFILLED --> [*]
```

- **Cart Isolation**: Carts are scoped per user account. Guest visitors never see a prior user's items, and guest items merge cleanly into the user's account upon signing in.
- **Inventory Pool**: Online orders and counter checkout draw from the exact same inventory pool under atomic locking.

---

### 8.5 Clubhouse Kitchen & Bar

**Tables:** 8 dining tables, configurable capacity.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> PENDING : waiter submits order
    PENDING --> ACCEPTED : kitchen accepts
    ACCEPTED --> COOKING : chef starts
    COOKING --> READY : preparation done
    READY --> SERVED : cashier marks served
    SERVED --> [*]

    PENDING --> CANCELLED : before cooking
staff reason required
    ACCEPTED --> CANCELLED : before cooking
staff reason required
    CANCELLED --> [*]

    note right of PENDING
        Guarded version prevents
        concurrent stale overwrites
    end note
```

- Amendments (items added after submission) create a new ticket revision and are clearly highlighted.
- Concurrent state updates are protected with a guarded preparation version to prevent stale overwrites.
- Tables close only when all tickets are served or cancelled and invoices are settled.

---

### 8.6 Reception & CRM

```mermaid
flowchart TD
    PUB(["Public visitor"]) --> ENQ["Submit enquiry
website contact form"]
    ENQ --> LEAD["Lead saved
DB transaction"]
    LEAD --> NOTIF["Reception notified
in-app immediately"]
    NOTIF --> ASSIGN["Assign staff
add notes"]
    ASSIGN --> FOLLOW["Log follow-ups
add quote"]
    FOLLOW --> CONV{"Convert?"}
    CONV -->|yes| INVITE["Invite email sent
password reset link"]
    INVITE --> VER["Account verifies email
logs in"]
    VER --> MEM["Reception processes
membership checkout"]
    CONV -->|no| CLOSE["Lead closed / archived
history preserved"]

    subgraph HISTORY["Lead history preserved"]
        LEAD -.->|linked permanently| VER
    end
```

---

### 8.7 Shared Billing & Payments

```mermaid
flowchart LR
    subgraph SOURCES["Invoice Sources"]
        direction TB
        SRC1["Membership
checkout"]
        SRC2["Court
booking"]
        SRC3["Shop
order"]
        SRC4["Clubhouse
table bill"]
    end

    subgraph INVOICE["Invoice  immutable after issue"]
        direction TB
        INV["Invoice
itemized lines
price snapshot"]
        ALLOC["Payment Allocation
partial or full
bounded under lock"]
        CREDIT["Credits / Refunds
separate entries"]
    end

    subgraph MODES["Payment Modes"]
        direction TB
        PM1["LOCAL_SIMULATED
no funds move"]
        PM2["MANUAL_RECORDED
cash · card · UPI"]
        PM3["GATEWAY_VERIFIED
Razorpay captured"]
    end

    SOURCES --> INV
    INV --> ALLOC
    ALLOC --> CREDIT
    MODES --> ALLOC

    ALLOC --> BAL["Outstanding Balance
invoice − allocations + credits"]
```

---

### 8.8 Owner Reports & Administration

**Financial reports** support Today / This Week / This Month / Custom date range:

| Metric | How it is calculated |
|---|---|
| Invoiced Sales | Invoices issued within the date range |
| Collections | Payments received within the date range, by method |
| Credits | Credited amounts dated within range |
| Refunds | Actual recorded refunds within range |
| Outstanding | Older unpaid balances through the end date |

- **Drill-down:** click any total to see the supporting records.
- **Department breakdown:** membership, courts/social, shop, kitchen/bar.
- **CSV export:** integer paise, escapes spreadsheet formula injection.
- **Cash shift reconciliation:** Opening float + cash receipts − actual refunds − payouts = expected cash.
- **Payroll:** Finalize immutable employee/pay/withholding snapshots. Staff view only their own records.

---

### 8.9 Background Worker & Emails

```mermaid
flowchart TD
    DB[(PostgreSQL
outbox table)] -->|SELECT FOR UPDATE
SKIP LOCKED| CLAIM["Worker claims job
sets lease timestamp"]
    CLAIM --> EXEC["Execute job
hold expiry · email · offer · reminder"]
    EXEC -->|success| DONE["Mark DONE
release lease"]
    EXEC -->|failure| RETRY["Increment attempts
schedule retry
exponential backoff"]
    RETRY -->|max retries| FAIL["Mark FAILED
owner notification"]
    RETRY -->|next attempt| CLAIM

    subgraph STALE["Stale lease recovery"]
        TIMEOUT["Lease expired
worker crashed"] -->|background scan| CLAIM
    end

    subgraph OUTBOX["Transactional outbox"]
        BIZ["Business event
membership · booking · order"] -->|same DB transaction| DB
    end
```

---

## 9. Integration Modes

### Payment

| `PAYMENT_MODE` | Behaviour |
|---|---|
| `local` (default) | Simulated. No funds move. Receipts clearly labelled. |
| `razorpay` | Real gateway. Requires all three Razorpay keys. |

### Email

See **[docs/SMTP.md](docs/SMTP.md)** for Gmail, Brevo, SendGrid and SES configuration.

Verify any SMTP setup with:
```bash
npm run mail:verify -- you@example.com
```

---

## 10. Database

**PostgreSQL 18** on an isolated cluster at `127.0.0.1:5433` (does not touch the system cluster on 5432).

### Critical database guarantees
- **Court overlap** — PostgreSQL exclusion constraint (`EXCLUDE USING gist`) prevents two active bookings from overlapping on the same court.
- **Daily quota** — Database trigger enforces the two-session-per-member-per-day limit under concurrency.
- **Social capacity** — Trigger prevents more than the configured participant count; duplicate participation rejected.
- **Stock reservation** — Atomic lock prevents overselling the same SKU.
- **Invoice immutability** — DB guard prevents editing issued invoices or their line items.
- **Allocation bounds** — Credits and allocations are bounded under invoice-level locks.
- **Unique constraints** — Champions ID, idempotency keys, invoice origin keys are all unique at the DB level.

---

## 11. Testing & Verification

```bash
# 1. Typecheck and code standards
npm run lint             # ESLint checks
npm run typecheck        # TypeScript strict verification

# 2. Automated Unit Tests (14 passing tests)
npm test

# 3. High-Concurrency PostgreSQL Integration Suite
npm run test:integration # Real-PostgreSQL concurrency tests

# 4. Production Build Check
npm run build            # Optimized production bundle
```

---

## 12. Docker

```sh
docker compose up --build -d
docker compose run --rm app npm run db:seed
```

Compose starts PostgreSQL with a persistent volume, applies migrations before app/worker startup, and health-checks both services.

---

## 13. LAN & Offline Operation

1. Set `BETTER_AUTH_URL` to the host's LAN IP (e.g. `http://192.168.1.10:3000`).
2. Add the same origin to `TRUSTED_ORIGINS`.
3. Restart app and worker.
4. The app listens on `0.0.0.0`; PostgreSQL stays on loopback.

---

## 14. Operational Policies

| Policy | Default | Editable by owner |
|---|---|---|
| Club timezone | Asia/Kolkata | No (UTC stored) |
| Opening hours | 06:00-23:00 | Yes |
| Booking window | 14 days ahead | Yes |
| Checkout hold | 5 minutes | No |
| Cancellation notice | 12 hours | Yes |
| Waiting offer window | 30 minutes | Yes |
| Social play capacity | 12 participants | Yes |
| Social play fee | Rs 300 | Yes |
| Delivery fee | Rs 100 | Yes |
| Trial discount | 50% | Yes |
| Member tab limit | Rs 5,000 | Yes |
| Tab due period | 7 days | Yes |
| Bar age requirement | 21+ | Deployment |
| Membership reminder offsets | 7 days, 1 day, 0 days | Yes |
| Reminder send time | 09:00 IST | Yes |
| Low stock threshold | 5 or fewer units | No |
| Default payroll withholding | 0% | Yes (per label) |

---

## 15. Judging Walkthrough

1. **Landing page** — Explore the four sport panels (keyboard, mouse or touch). Browse facilities, membership prices, shop previews and the clubhouse section. Check mobile navigation at narrow widths.
2. **Book a Court** — Select sport, date and hour, then confirm local checkout. Inspect the saved booking and receipt in My Account. Try a full slot for the waiting-list option. Try a maintenance-closed court to see the reason and alternatives.
3. **Shop** — Browse 36 products, add variants to cart, choose pickup or delivery. Confirm checkout. In Inventory (cashier login), collect a pickup or dispatch a delivery; process a partial return.
4. **Membership** — Sign in as `new`, `junior` or `expired`. Purchase or renew a membership. Accept the displayed policy. Reload and inspect the membership card, QR, history and receipt. No funds are collected.
5. **Reception** — Sign in as `reception`. Search a member by email or QR. Inspect the daily calendar. Register a walk-in booking with manual payment.
6. **CRM** — Submit an enquiry from the public contact form. Sign in as `reception` to see the notification, assign staff, log a follow-up and convert the lead to an account.
7. **POS and Kitchen** — Sign in as `cashier`. Open a table, add items with notes, submit. In another tab sign in as `kitchen`: Accept → Cook → Ready. Back as cashier: mark served, settle and close the table.
8. **Owner** — Business settings, membership plans, staff roles, local inbox. Financial report with drill-downs and CSV export. Cash shift reconciliation. Payroll — view Neha's demo payslip.
9. **Security** — Try accessing a staff URL as a member. Try another member's receipt URL. APIs return 403 or 404 with no data disclosure.
10. **Email** — Sign up with a new email. In owner's Local test inbox, open the verification link. Run `npm run worker` to mark mail delivered. Password reset works the same way.

See **[JUDGING.md](JUDGING.md)** for the full connected walkthrough and all concurrency, reminder and reconciliation proofs.

---

## 16. Contributing

When Git use is authorized, use a **feature branch** workflow:

```bash
git checkout -b feature/your-feature-name
git commit -m "feat: descriptive message"
git push origin feature/your-feature-name
```

**Never commit:**
- `.env` or any file containing secrets
- `.local/` (local database cluster)
- `.next/` (build output)
- `node_modules/`
- `src/generated/` (generated Prisma client)

**Reference documents:**

| File | Purpose |
|---|---|
| [SPEC.md](SPEC.md) | Full product specification and acceptance criteria |
| [API.md](API.md) | All endpoint contracts and idempotency headers |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Every specification area mapped to code, with explicit limits |
| [JUDGING.md](JUDGING.md) | Demo walkthrough and concurrency proofs |
| [docs/CHAMPIONS_CLUB_TECHNICAL_GUIDE.md](docs/CHAMPIONS_CLUB_TECHNICAL_GUIDE.md) | Comprehensive technical architecture and subsystem guide |
| [docs/SMTP.md](docs/SMTP.md) | SMTP setup guide for email delivery |

---

*Champions Club — Built for the Odoo Hackathon.*
