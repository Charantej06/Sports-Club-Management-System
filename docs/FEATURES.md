# How Champions Club answers the brief

Each section below takes one scene from "A week at the club", says what the system does, where the code lives and what stops it going wrong. File paths are relative to the project root. Everything runs on one Next.js app, one PostgreSQL database and one background worker.

## How the pieces fit together

| Piece | What it does |
|---|---|
| `src/app` | Pages and API routes. Every handler authenticates, checks the role, validates input with Zod and hands over to a service. |
| `src/modules/*` | Business rules: `membership`, `bookings`, `shop`, `clubhouse`, `billing`, `crm`, `reports`, `administration`, `members`, `facilities`, `mail`. |
| `prisma/` | PostgreSQL schema, SQL migrations (constraints and triggers live here) and demo data. |
| Worker (`npm run worker`) | Sends email, expires holds, offers waiting-list places, schedules membership reminders and CRM follow-ups. |
| Shared rules | Money is integer paise, times are stored in UTC and club days follow Asia/Kolkata. The client never sets prices, roles or customer IDs. Critical writes use transactions, row locks and database constraints. Invoices and membership terms are snapshots that never change afterwards. |

Roles: `MEMBER`, `RECEPTION`, `CASHIER` (the waiter), `KITCHEN`, `OWNER`. The role is read from the database on every request, so removing access takes effect immediately.

---

## 1. A new member walks in

**What happens.** Reception registers the person, sells a plan and the member is recognised on every later visit.

| Need | How it works | Where |
|---|---|---|
| Know who they are | *Register a new member* (reception desk) creates the account and a unique Champions ID (`CC-…`) and emails an invitation to set a password. A duplicate email returns the existing member instead of a second account. Members can also sign up online. | `src/modules/members/service.ts`, `src/components/member-registration.tsx` |
| Which plan they are on | Gold, Silver or Junior. Junior needs a date of birth and age under 18 at the start of the term. Members choose **1 month, 3 months or annual**; longer terms are discounted. The server prices the term; the owner edits the monthly rate and discounts. | `src/modules/membership/service.ts`, `terms.ts` |
| What the plan entitles them to | Each plan stores a court discount, shop discount, clubhouse discount and free sessions per week. A copy of those benefits is saved on the membership when it is bought, so later plan edits do not change it. Every department reads the same benefits, so the discount applies without being asked for. | `membership/pricing.ts` (`benefits()`), used by bookings, shop and clubhouse |
| Nobody should have to remember the expiry | Reminder emails at 7, 1 and 0 days (09:00 club time) are scheduled when a term is bought; a renewal cancels the old ones. The member sees a renewal banner two weeks before the end. The owner's report lists memberships ending within seven days. | `mail/reminders.ts`, `src/components/account.tsx`, `reports/service.ts` |
| Recognise them quickly | Every member has a digital card with a QR code. Staff find a member by Champions ID, email, a pasted QR value or the **camera scanner**; reception can also search by name. | `account/cards.ts`, `staff/service.ts` (`lookupMember`), `staff-operations.tsx` (`MemberFinder`) |
| See their history | Reception and owner see plan and days left, visits, last visit, bookings, memberships, shop orders, clubhouse bills, total paid and anything unpaid. Cashiers see only name, ID and plan. | `members/service.ts` (`memberProfile`), `src/components/member-history.tsx`, `GET /api/staff/member` |

**Protection.** Buying a membership is idempotent (same key, same result), serialised per member, rejects a stale price and cannot overlap an existing term (a PostgreSQL exclusion constraint). Plan changes keep the old term as history.

---

## 2. Booking a court on a busy evening

| Need | How it works | Where |
|---|---|---|
| Sessions last an hour, a new slot every half hour | Sessions are one hour. Start times are every 30 minutes (6:00, 6:30, 7:00…) and a session must end by closing time. The owner can switch to hourly starts in *Business settings*. | `bookings/service.ts` (`validateSlot`), `public/availability.ts`, `ClubSettings.slotMinutes` |
| Two people never on one court at once | Layers of protection: a court row lock while booking, a check for overlapping holds, and a **PostgreSQL exclusion constraint** on the time range that rejects overlaps even if the application code has a bug. Overlapping half-hour requests race and exactly one wins. | `prisma/migrations/*operations*`, `courtLock()` in `operations/core.ts` |
| Each member plays at most twice a day | Counted per club day inside the booking transaction, and enforced again by a database trigger. Social places count toward the same allowance. | `bookings/service.ts` (`quota`), migration `*transaction_guards*` |
| Members pay less, or nothing | Price comes from the court rate, the member's plan discount on the session date, complimentary weekly sessions (Gold, Junior), the 50% introductory trial and the guest rate for walk-ins. The price is stored with the booking. | `bookings/service.ts` (`courtPrice`) |
| Walk-in at the counter, caller on the phone | Reception books for a member or a guest in one form. A live **"What's free?"** panel shows every free start time per court and fills the form on a tap. | `staff-operations.tsx` (`Reception`), `src/components/free-slots.tsx` |
| Customers book online | Picking a free time goes straight to checkout. The slot is held for five minutes so nobody else can take it; payment or confirmation follows at once. | `src/components/courts-view.tsx` |
| Plans change, people cancel | A confirmed booking can be cancelled up to 12 hours ahead; credits and refunds follow the invoice. Reception can override with a reason. A freed slot is offered to the **waiting list in order**; each person has 30 minutes to accept. | `actBooking`, `offerNext`, worker |
| Friday social play | One court reservation, many participants. Capacity is enforced by a database trigger so the last place cannot be sold twice. | `createSocial`, `joinSocial`, migration `*operations*` |
| Courts change | Owners add sports and courts, change rates and mark a court or sport **under maintenance** (players see why) or retire it. | `src/modules/facilities`, *Courts & sports* tab |

---

## 3. Gearing up before a match

| Need | How it works | Where |
|---|---|---|
| Rackets, balls, shoes, accessories, apparel | A catalogue of products with variants (size, grip) and prices. | `Product`, `ProductVariant`, `shop/service.ts` |
| Always know what is in stock | Each variant has `stock` and `reserved`. Available = stock − reserved. Every change is recorded in a stock-movement history. | `StockMovement`, `correctStock` |
| Know when something runs low | Items with five or fewer available appear in the shop workspace and in the owner's report. | `staff-operations.tsx` (`Inventory`), `reports/service.ts` |
| Order from home and collect, or have it delivered | The cart places an order, reserves stock and confirms it in one step. The member chooses club pickup or delivery (with address and fee); staff mark it collected or dispatched with a tracking reference. Returns restock items and credit the exact amount. | `src/components/cart.tsx`, `shop/service.ts` |
| Counter and online come from one shelf | Both channels reserve stock with the same locked update, so the last item cannot be sold twice. | integration test 4 |

---

## 4. After the match, at the bar

| Need | How it works | Where |
|---|---|---|
| Twenty orders at once | The waiter's POS opens a bill per table, adds items with notes and sends them to the **kitchen queue**. Later additions arrive as amended tickets, so the kitchen sees who ordered what. | `clubhouse/service.ts`, `staff-operations.tsx` (`POS`, `Kitchen`) |
| Tables tracked | Tables and their open bills are listed live. | `DiningTable`, `KitchenOrder` |
| Discount without asking | The member's plan discount is applied to every line when the bill is linked to a member. | `benefits()` |
| Run a tab | A member can keep a tab up to a limit (₹5,000 by default) due in seven days. Unpaid tabs show on the owner's report. | settings `tabLimitPaise`, `tabDueDays` |
| Guests pay cash, card or UPI | Payment is recorded per bill, in part or in full, and tied to the cashier's cash shift. | `billing/service.ts`, `CashShift` |
| Staff in shifts | The owner schedules non-overlapping shifts and approves leave. Cashiers reconcile a cash shift (opening cash + receipts − refunds − payouts against the counted cash). | `administration/service.ts` |
| What the bar earned today | The owner's report splits clubhouse sales into **Bar** and **Kitchen & cafeteria** by menu category, excluding cancelled items. | `reports/service.ts` (`operationalReport`) |

---

## 5. A stranger finds the club online

| Need | How it works | Where |
|---|---|---|
| Be found | A public site with the club's sports, hours, address and phone. Search engines get a sitemap, a robots file (private areas excluded) and structured data describing the club and its plans. | `src/app/page.tsx`, `robots.ts`, `sitemap.ts` |
| See plans and prices | `/memberships` shows the plans with a 1-month / 3-month / annual picker and the real price. | `membership-options.tsx` |
| See what is free this week | `/book` shows live availability per court for the booking window, refreshed every five seconds. | `GET /api/public/availability` |
| See what the shop sells | `/shop` with search and sport filters. | `shop-view.tsx` |
| Book a trial on the spot | The trial session uses the same checkout at a discount, once per account. | `bookings/service.ts` |
| Enquiries never vanish | The enquiry form saves a lead, notifies reception and rate-limits spam. Staff assign it, add notes, schedule a follow-up (a reminder fires through the worker), send a **quote** for a chosen plan and term, and **convert** the lead into a member account. | `crm/service.ts`, `enquiries/service.ts` |

---

## 6. The owner, at the end of the month

| Need | How it works | Where |
|---|---|---|
| How much did we earn, from where | Sales, collections, credits, refunds and amounts still owed, by **department** (membership, courts, shop, clubhouse) and by **payment method** (cash, card, UPI, online). Every figure drills down to the records behind it. | `reports/service.ts` (`financialReport`) |
| Today, this week, this month | One-click presets plus a custom range. | `owner-workspaces.tsx` (`OwnerReports`) |
| What do we owe | Staff net pay for the month, withholding to remit, refunds awaiting repayment, and an estimated net position. | `financialReport().obligations` |
| Memberships and business clients to invoice | Memberships invoice automatically. Business quotes become one immutable invoice each. | `administration/service.ts` |
| Employees, leave, taxes | Employee records and salaries, leave requests the owner approves or declines, payslips with a saved withholding calculation, and a period withholding export. | `People & payroll` workspace |
| Share the numbers | **Printable summary** page (print or save as PDF), a ledger CSV export that escapes spreadsheet formulas, and printable invoices. | `src/app/staff/summary/page.tsx`, `GET /api/staff/reports?format=csv` |
| Money in one place | Every charge goes through one billing service: an invoice with itemised lines, payments allocated to invoices, credits and refunds. | `billing/service.ts` |

---

## Beyond the brief

- **One-tap checkout** for booking and the shop, with the safety of a server-side hold behind it.
- **Flexible membership terms** (1 month, 3 months, annual) with owner-editable discounts.
- **Owner-managed courts and sports** with maintenance and retirement.
- **Real email**: an SMTP setup guide (`docs/SMTP.md`), a `mail:verify` command, an owner email-health check and readable failure reasons.
- **Friendly verification**: resend links, a verified page and clear messages for unverified sign-ins.
- **Staff workspaces** with grouped navigation, member history, registration, a free-slot finder, owner reports and a printable summary.
- **Safety nets**: audit log for sensitive changes, idempotency keys on every write, role checks on every route, immutable invoice and term snapshots, and 54 integration tests that run against a real PostgreSQL database.

## Known limits

- Online card payments need Razorpay keys; without them the app records clearly labelled **test payments** and says so everywhere.
- Real email needs SMTP credentials (see `docs/SMTP.md`).
- Taxes: prices are tax-inclusive. The system reports payroll withholding; it does not file statutory returns.
- Putting a court under maintenance does not cancel existing bookings; the owner is shown how many are affected and reception moves them.
