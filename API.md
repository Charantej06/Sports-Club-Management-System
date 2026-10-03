# Stage 1 HTTP contracts

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

No booking, stock checkout, refund, POS or report mutation endpoint is exposed in stage one. Schema foundations alone do not claim those business workflows are complete. Next.js streamed UI not-found pages can return HTTP 200; receipt API authorization still returns 404 and pages reveal no unowned invoice.
