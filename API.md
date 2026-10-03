# HTTP contracts

Application routes return `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "...", "fields": {} } }` on failure. `fields` is present for validation errors. Better Auth endpoints use Better Auth's supported response/error contract. All amounts are integer paise in INR; all API instants are ISO UTC timestamps.

Protected routes authenticate the cookie with Better Auth and read current roles from PostgreSQL. Customer routes derive identity from the session and never accept a customer ID override. Mutations require an exact permitted `Origin`; browser fetches set it automatically. There are no permissive cross-origin headers.

| Method / route | Contract | Access |
|---|---|---|
| GET /api/health | DB readiness `{status:"ok"}`; 503 if unavailable | Public |
| GET /api/public | Stored sports/courts, plans, active catalogue/variants, menu and limited contact/hour settings | Public |
| GET /api/public/availability?sport=tennis&date=2026-10-03 | Court names, guest prices and hourly availability booleans; no reservation/user details | Public |
| POST /api/enquiries | `{name,email,sport,message,website:""}`; 201 `{id}`; rate-limited to 3/email/hour | Public, same origin |
| GET /api/me | Own safe profile, membership snapshots, invoices/payment allocations/credits, bookings and orders | Session |
| PATCH /api/me | `{name,phone,dateOfBirth}`; birthday `YYYY-MM-DD` or empty; 200 `{updated:true}` | Own account |
| POST /api/me/membership | UUID `Idempotency-Key` header, `{planId:"gold"|"silver"|"junior",action:"purchase"|"renew"|"change",acceptPolicy:true,planVersion:"ISO timestamp from /api/public"}` | Verified own account |
| GET /api/me/card | Active card PNG data URL/issued date, revoked flag, or null if no active membership | Own account |
| DELETE /api/me/card | Revoke own card, 200 `{revoked:true}` | Own account |
| POST /api/me/card | Issue if missing/revoked; active existing token reused, 200 `{issued:true}` | Own active membership |
| GET /api/me/invoices/:id | Itemized owned invoice and allocations; 404 if missing/not owned | Own account |
| GET /api/staff/lookup?q=... | Exact ID/email or `champions:card:<opaque>`; limited name/ID/current plan/expiry | Owner, reception, cashier |
| GET /api/staff/settings | Full editable business settings | Owner |
| PATCH /api/staff/settings | Full operating-policy/contact fields; timezone fixed to Asia/Kolkata | Owner |
| PATCH /api/staff/plans | `{id,pricePaise,durationDays,courtDiscountBps,shopDiscountBps,foodDiscountBps,freeSessionsWeek,active}` | Owner |
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
| POST /api/operations/booking | `{courtId,day,hour,trial?}` creates priced temporary hold/invoice; staff may add `userId` or `guestName,guestEmail?` | Member/owner/reception |
| PATCH /api/operations/booking/:id | `{action:"confirm"|"cancel"|"checkin",method?,reason?,override?}` | Own customer; owner/reception for check-in/override |
| POST /api/operations/social-create | `{courtId,day,hour,title,capacity}` creates Friday event and one court reservation | Owner/reception |
| PATCH /api/operations/social/:eventId | `{action:"join"}`; `{action:"confirm"|"cancel"|"checkin",participantId?,method?,reason?,override?}`; `{action:"cancelEvent",reason}` | Own participant inferred; owner/reception can select participantId |
| POST /api/operations/waiting | `{courtId,day,hour,eventId?}`; one entry per own court/start | Session |
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
