# HTTP contracts

Application routes return `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "...", "fields": {} } }` on failure. `fields` is present for validation errors. Better Auth endpoints use Better Auth's supported response/error contract. All amounts are integer paise in INR; all API instants are ISO UTC timestamps.

Protected routes authenticate the cookie with Better Auth and read current roles from PostgreSQL. Customer routes derive identity from the session and never accept a customer ID override. Mutations require an exact permitted `Origin`; browser fetches set it automatically. There are no permissive cross-origin headers.

| Method / route | Contract | Access |
|---|---|---|
| GET /api/health | DB readiness `{status:"ok"}`; 503 if unavailable | Public |
| GET /api/public | Stored sports/courts, plans, active catalogue/variants, menu and limited contact/hour settings | Public |
| GET /api/public/availability?sport=tennis&date=2026-10-03 | Any offered sport id. Court names, guest prices, `maintenance`/`maintenanceReason` and hourly available/elapsed booleans plus closure reason; courts under maintenance report every slot unavailable; 404 `SPORT_UNAVAILABLE` for retired sports; no reservation/user details | Public |
| POST /api/enquiries | `{name,email,sport,message,website:""}`; 201 `{id}`; rate-limited to 3/email/hour | Public, same origin |
| GET /api/me | Own safe profile, membership snapshots, invoices/payment allocations/credits, bookings and orders | Session |
| PATCH /api/me | `{name,phone,dateOfBirth}`; birthday `YYYY-MM-DD` or empty; 200 `{updated:true}` | Own account |
| POST /api/me/membership | UUID `Idempotency-Key` header, `{planId:"gold"|"silver"|"junior",months:1|3|12 (default 1),action:"purchase"|"renew"|"change",acceptPolicy:true,planVersion:"ISO timestamp from /api/public"}`. Price = monthly rate × months less the plan's 3-month/annual discount, rounded to a whole rupee, always calculated by the server; the term ends the same number of calendar months later | Verified own account |
| GET /api/me/card | Active card PNG data URL/issued date, revoked flag, or null if no active membership | Own account |
| DELETE /api/me/card | Revoke own card, 200 `{revoked:true}` | Own account |
| POST /api/me/card | Issue if missing/revoked; active existing token reused, 200 `{issued:true}` | Own active membership |
| GET /api/me/invoices/:id | Itemized owned invoice and allocations; 404 if missing/not owned | Own account |
| GET /api/staff/lookup?q=... | Exact ID/email or `champions:card:<opaque>`; limited name/ID/current plan/expiry | Owner, reception, cashier |
| GET /api/staff/settings | Full editable business settings | Owner |
| PATCH /api/staff/settings | Full operating-policy/contact fields; timezone fixed to Asia/Kolkata | Owner |
| PATCH /api/staff/plans | `{id,pricePaise (monthly rate),quarterDiscountBps,annualDiscountBps,courtDiscountBps,shopDiscountBps,foodDiscountBps,freeSessionsWeek,active}` | Owner |
| POST /api/operations/member | `{name,email,phone?,dateOfBirth?}` front-desk registration; creates the account, Champions ID and an invitation email, or returns the existing member for a known email (`created:false`) | Owner/reception |
| GET /api/staff/member?id=... | A member's history: plan and days left, visits, bookings, memberships, orders, bills, total paid and unpaid balance | Owner/reception |
| GET /staff/summary?preset=month\|week\|today or ?from=&to= | Printable business summary page (money in/out, departments, bar vs kitchen, what the club owes, courts) | Owner |
| GET /api/staff/facilities | Every sport and court (including maintenance/retired) with upcoming booking counts | Owner/reception |
| POST /api/staff/facilities | `{action:"createSport",name,description,image}`; `{action:"updateSport",id,name?,description?,image?,status?,statusNote?}`; `{action:"createCourt",sportId,name?,hourlyPaise,indoor}`; `{action:"updateCourt",id,name?,hourlyPaise?,indoor?,status?,statusNote?}`. `status` is `ACTIVE`, `MAINTENANCE` (note required, shown to players) or `INACTIVE` (retired, hidden). `image` must be a local `/images/…` asset. Facilities are never deleted; changes are audited. Existing bookings are not cancelled automatically | Owner |
| GET /api/staff/mail | Email mode, masked SMTP settings, missing variables, warnings and delivery queue counts; never the password | Owner |
| POST /api/staff/mail | `{action:"verify"}` tests the SMTP connection and login; `{action:"test"}` queues a test email to the owner through the worker | Owner |
| PATCH /api/staff/users | `{email,role}`; existing account only, cannot change own role; target sessions revoked | Owner |
| GET /api/staff/inbox | Latest 30 local test messages; unavailable in SMTP mode | Owner |

Checkout rejects a stale planVersion with 409 PLAN_CHANGED and no records created. Clients must refresh and review the updated plan. Replays retain the original result even after plan edits. Prices always come from the locked database plan.

Purchase returns 201 `{membershipId,invoiceId,startsAt,endsAt,replayed:false}` on first success. Same key + canonical payload returns 200 with the original result and `replayed:true`; different payload returns 409. The service locks the user, validates current plan and Junior eligibility, calculates price on the server, snapshots benefits, creates the membership/invoice/payment/allocation/card/audit and saves checkout result in one transaction. Client-submitted totals, roles and customer IDs are rejected.

Common statuses: 400 invalid JSON/auth input; 401 no session; 403 role/origin/email-verification failure; 404 missing/unowned record; 409 policy/idempotency conflict; 413 oversized body; 422 Zod/business validation; 429 enquiry/auth rate limit; 503 payment adapter disabled or health unavailable. Unrecognized HTTP methods receive Next.js 405.

Better Auth mounted at `/api/auth/*` supports signup/signin/signout, verification, reset, sessions and revocation. Passwords are 10–128 characters. Signup `role` and `championsId` are forbidden inputs. IDs are server-generated and unique in PostgreSQL. Sessions expire in seven days, refresh daily and are checked against the DB (no cached role/session authorization). Reset tokens expire in one hour and reset revokes all sessions. Tokens/passwords are not included in application audit logs.

Business settings PATCH fields: `openHour`, `closeHour`, `bookingWindowDays`, `dailySessionLimit`, `holdMinutes`, `cancellationHours`, `waitOfferMinutes`, `socialCapacity`, `tabLimitPaise`, `address`, `contactEmail`, `contactPhone`, `reminderDays`. Closing hour must exceed opening hour. Plan discounts use 100 basis points per percent. Plan name/Junior identity is fixed; values update only future purchases.

Next.js streamed UI not-found pages can return HTTP 200; receipt API authorization still returns 404 and pages reveal no unowned invoice.

## Stage two operations

Every operation mutation requires the session cookie, permitted `Origin` and UUID `Idempotency-Key`. Same actor/key/canonical payload returns the stored result; changed payload returns 409. Prices, roles, payment source and ownership are server-derived. Unknown fields are rejected by strict Zod schemas. Successful operations return `{data: result, replayed?: boolean}`. Roles below describe permitted workflows; services also enforce per-record ownership/state restrictions.

| Method / route | Contract | Access |
|---|---|---|
| GET /api/operations/social | Future active events, capacity/available places; no other customers' details | Public |
| GET /api/operations/history | Own bookings, social places, waiting offers, orders, bills and totals | Session |
| GET /api/operations/reception?day=YYYY-MM-DD&q=search | Day calendar, closures, limited member search and social check-in records | Owner/reception |
| GET /api/operations/crm | Leads, activities, quotes, assignable staff and notifications | Owner/reception |
| GET /api/operations/inventory | Catalogue/variants, stock/reservations, orders and movements | Owner/cashier |
| GET /api/operations/pos | Menu/tables, open/recent bills, ticket lines and server ledger totals | Owner/cashier |
| GET /api/operations/kitchen | Open preparation tickets and amendments | Owner/kitchen/cashier |
| GET /api/operations/billing | Latest 150 permitted invoices, allocations, credits and refunds | Owner/reception/cashier, department scoped |
| GET /api/operations/booking/:id, order/:id, bill/:id | Scoped persisted record | Own customer or permitted staff |
| POST /api/operations/booking | `{courtId,day,hour,minute?:0|30,trial?}` creates priced temporary hold/invoice; a new session may start every `slotMinutes` (30 by default, owner-editable to 60), lasts one hour and must end by closing time (422 `SLOT_START` / `OPENING_HOURS`); 409 `SLOT_TAKEN` when it overlaps another booking; staff may add `userId` or `guestName,guestEmail?` | Member/owner/reception |
| PATCH /api/operations/booking/:id | `{action:"confirm"|"cancel"|"checkin",method?,reason?,override?}` | Own customer; owner/reception for check-in/override |
| POST /api/operations/social-create | `{courtId,day,hour,title,capacity}` creates Friday event and one court reservation | Owner/reception |
| PATCH /api/operations/social/:eventId | `{action:"join"}`; `{action:"confirm"|"cancel"|"checkin",participantId?,method?,reason?,override?}`; `{action:"cancelEvent",reason}` | Own participant inferred; owner/reception can select participantId |
| POST /api/operations/waiting | `{courtId,day,hour,minute?:0|30,eventId?}`; one entry per own court/start | Session |
| PATCH /api/operations/waiting/:id | `{action:"cancel"}`; offered holds are released via booking/participant cancellation | Own customer |
| POST /api/operations/closure | `{courtId,startsAt,endsAt,reason}` | Owner/reception |
| PATCH /api/operations/closure/:id | `{reason}` reopens closure | Owner/reception |
| POST /api/operations/order | `{items:[{variantId,quantity}],delivery,address?,channel?}` reserves stock and invoices; counter may add member/guest identity | Customer online; owner/cashier counter |
| PATCH /api/operations/order/:id | `{action:"confirm"|"cancel"|"collect"|"dispatch"|"deliver"|"return",method?,reason?,tracking?,returns?}` | Own confirm/cancel; owner/cashier fulfillment/return |
| POST /api/operations/stock | `{variantId,delta,reason}`; integer correction cannot consume reserved stock | Owner/cashier |
| POST /api/operations/bill | `{tableId,items:[{menuId,quantity,note?}],userId?,guestName?,ageConfirmed?}` | Owner/cashier |
| PATCH /api/operations/bill/:id | `add` with items; `pay` with method/optional amountPaise; `tab`; `close`; `cancelItem` with lineId/reason; `adjust` with invoiceId/amountPaise/reason | Owner/cashier |
| POST /api/operations/kitchen | `{ticketId,version,state:"ACCEPTED"|"COOKING"|"READY"|"SERVED"}`; stale version 409 | Owner/kitchen prepares; owner/cashier serves |
| PATCH /api/operations/crm/:id | `assign` staffId nullable; `note` note; `followup` at/note; `status` NEW/CONTACTED/LOST; `quote` planId; `convert` | Owner/reception |
| PATCH /api/operations/notification/:id | `{read:true}` | Owner/reception |
| POST /api/operations/membership | Existing reviewed membership payload plus `userId,method` | Owner/reception |
| PATCH /api/operations/payment/:invoiceId | `{method,amountPaise?}`; membership/clubhouse only; court/shop must confirm checkout | Own customer LOCAL; permitted department staff |
| PATCH /api/operations/refund/:id | `{reason}` marks a pending manual refund recorded after staff repayment | Permitted department staff |

Payment methods are `LOCAL`, `CASH`, `CARD`, `UPI`; manual methods require authorized staff. No client may assert gateway verification. Delivery address is `{line,city,postcode,phone}` with a six-digit postcode. Returns are `[{variantId,quantity,restock}]` and require a reason. Quantities, timestamps, membership eligibility, stock/capacity, opening/future windows and all safe state transitions are checked server-side.

Settings add `trialDiscountBps`, `socialPricePaise`, `deliveryFeePaise`, `tabDueDays` to the existing operating policies. Responses deliberately separate preparation, payment, fulfillment and refund states. Receipt pages `/account/receipts/:invoiceId` allow the owning customer and staff authorized for that department; invoice APIs remain customer-owned.

Durable worker kinds: `SEND_MAIL`, `EXPIRE_BOOKING`, `EXPIRE_SOCIAL`, `EXPIRE_SHOP`, `OFFER_WAITLIST`, `LEAD_FOLLOWUP`. Expiry/refund/stock release is repeat-safe; obsolete social invoice/follow-up jobs are suppressed. Waiting offers retry contested member locks while retaining FIFO order. Claims use SKIP LOCKED with stale-lease recovery and retry backoff.

## Stage three administration and reporting

All mutations below validate strict bodies, require a session, permitted Origin and UUID Idempotency-Key, and record sensitive actions without secrets. Paise fields are bounded integer values. Unknown actions/fields are rejected.

| Route | Contract | Access |
|---|---|---|
| GET /api/staff/reports | `preset=today|week|month` or `from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive club dates, at most 366 days. Returns totals plus every supporting ledger record. `format=csv` downloads records. `area=operations` returns utilization and current alerts. | Owner |
| GET /api/staff/home | Role-filtered live action counts/navigation targets | Staff |
| GET /api/staff/admin?area=hr | Employee/current salary, shifts, leave decisions and finalized payslips; own employee only unless owner | Staff |
| GET /api/staff/admin?area=cash | Shift totals, receipts/refunds/payouts and expected cash; owner additionally sees unassigned cash | Owner/reception/cashier |
| GET /api/staff/admin?area=quotes | Persisted business quotes with invoice links | Owner |
| GET /api/staff/admin?area=mail | Delivery mode/configuration, message status and related attempts/run time/safe failure text; no authentication-link bodies | Owner |
| GET /api/staff/admin?area=gateway | Gateway attempts, capture references and review states | Owner |
| GET /api/staff/admin?area=audit | `q` matches action/actor/entity, optional `cursor`; owner pages all history; other staff get their latest 50 own records | Staff |
| GET /api/staff/payroll-export | Finalized payslip rows and period/configuration withholding summaries; CSV formula protection | Owner |
| GET /staff/payslips/:id | Printable immutable pay/tax snapshot | Owner or owning employee |
| GET /staff/quotes/:id | Printable quote snapshot | Owner |

`POST /api/staff/admin` uses an action discriminator:

- `employee`: `{email,title,salaryPaise,active}` for an existing staff account; owner only. Upsert preserves finalized payroll history.
- `shift`: `{employeeId,startsAt,endsAt}` UTC ISO instants, positive interval at most 24 hours. `shiftCancel`: `{id,reason}`. Owner only; overlap/approved-leave conflicts fail.
- `leave`: `{employeeId,startsAt,endsAt,reason}`, at most 90 days; owner or own employee. `leaveDecision`: `{id,status:"APPROVED"|"REJECTED",reason}` owner only; only pending requests, no scheduled-shift or approved-leave overlap.
- `payslip`: `{employeeId,period:"YYYY-MM",adjustmentPaise,reason}` owner only. Finalizes one snapshot per employee/period using the current configured base/withholding. Finalized rows cannot be updated.
- `cashOpen`: `{openingPaise}`; one open shift per actor. `cashPayout`: `{id,amountPaise,reason}`. `cashClose`: `{id,countedPaise,reason}`; discrepancies require a reason. Staff reconcile own shifts, owner may reconcile any. Closed shifts cannot change. Cash settlements/refund confirmations attach to the actor's open shift under the same lock.
- `quote`: `{customerName,customerEmail,department,validUntil,lines:[{description,quantity,unitPaise}]}` owner only. `quoteInvoice`: `{id}` creates one unpaid immutable business invoice. This does not activate a membership or reserve court/retail resources. Normal department operations remain responsible for fulfillment.
- `retryMail`: `{id}` owner only; retries a failed delivery and resets attempts. Suppressed/delivered messages cannot be retried.
- `gatewayRepayment`: `{id,refundId,reason}` owner only; verifies a processed full provider refund for a NEEDS_REVIEW unallocated capture before recording one repayment. This is verification, not initiation of another money transfer.

Settings additionally accept `reminderHour` (0–23, club timezone), `payrollTaxBps` (0–10000) and `payrollTaxLabel`. Reminder offset changes take effect in the worker's next synchronization (within one minute). New durable kinds are `MEMBERSHIP_REMINDER` and `GATEWAY_CAPTURE`.

Financial sales use invoice issue dates; collections use payment receive dates; credits use credit issue dates; recorded refunds use actual recording dates (legacy records fall back to creation date). Pending refunds are separate. Outstanding includes all invoices issued through the end date, less allocations/credits through that date. Department collections use allocations; unallocated provider captures appear explicitly in the global collection figure and gateway review. Core invoices/benefit snapshots are immutable.

## Optional verified payment provider

`GET /api/payments` exposes only enabled modes. `GET /api/payments?history=true` returns the signed-in account's intent status/amount; `?id=UUID` reads one owned intent. No other customer's intent can be read.

`POST /api/payments` creates a server-priced provider order with an idempotency key. Body is `{kind:"membership",input:<reviewed membership payload>}` or `{kind:"booking"|"order"|"social"|"invoice",targetId}`. Social targetId is the owned participant ID; invoice settlement supports eligible owned clubhouse/business charges. Membership eligibility and owned/live holds are checked before order creation and again before confirmation.

`PATCH /api/payments` accepts `{id,paymentId,signature}`. The server uses its stored order ID for callback HMAC, persists a capture job, fetches the provider payment and checks captured status, amount, currency and order before shared checkout. `/api/payments/webhook` verifies HMAC over the raw body with the separate webhook secret and durably deduplicates `payment.captured` events. No public operation can assert GATEWAY_VERIFIED: `GATEWAY` allocations require internal server capture context. LOCAL/CASH/CARD/UPI semantics remain unchanged.

Intent states: PENDING is not a club confirmation; COMPLETE has a shared charge/allocation; NEEDS_REVIEW is captured money with a changed/expired checkout and visible unallocated collection; REPAID has provider-verified full repayment. Provider settings/keys are documented in README. Mock integration tests do not prove actual sandbox/live acceptance.
