import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import { AppError } from "../../src/lib/errors";
import { holdBooking, actBooking } from "../../src/modules/bookings/service";
import { purchaseMembership } from "../../src/modules/membership/service";
import { addMonths, termPrice } from "../../src/modules/membership/terms";
import { manageFacility } from "../../src/modules/facilities/service";
import { availability } from "../../src/modules/public/availability";
import { publicData } from "../../src/modules/public/queries";
import { type Actor, clubDay } from "../../src/modules/operations/core";

const prefix = "fac-" + randomUUID().slice(0, 8);
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const member: Actor = { id: `${prefix}-member`, name: "Facility Player", email: `${prefix}-member@example.test`, role: "MEMBER" };
const buyer: Actor = { id: `${prefix}-buyer`, name: "Term Buyer", email: `${prefix}-buyer@example.test`, role: "MEMBER" };
const ownerId = "demo-owner";
const day = new Date(+new Date(clubDay(new Date())) + 3 * 86400000).toISOString().slice(0, 10);
// The owner API derives a sport id from its name, so the fixture id is predictable and cleanable.
const sportId = `test-${prefix}`;
let courtId = "";
let ownerCookie = "";
let memberCookie = "";
const headers = (cookie = "") => ({ "Content-Type": "application/json", Origin: base, Cookie: cookie });
async function login(email: string, password: string) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
const hold = async (hour: number, who = member) => (await holdBooking(who, randomUUID(), { courtId, day, hour, trial: false })).data;
async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  assert.fail("Expected the operation to be rejected");
}

before(async () => {
  assert.equal(process.env.PAYMENT_MODE, "local", "Integration tests require explicit local payment mode.");
  // The suite signs in many times a minute; start each file with a fresh login rate-limit window.
  await db.rateLimit.deleteMany({});
  const password = await hashPassword("Facilities2026!");
  for (const actor of [member, buyer]) {
    await db.user.create({ data: { ...actor, championsId: "CC-" + actor.id, emailVerified: true, dateOfBirth: new Date("1990-01-01") } });
    await db.account.create({ data: { id: "account-" + actor.id, userId: actor.id, accountId: actor.id, providerId: "credential", password } });
  }
  ownerCookie = await login("owner@champions.local", "Champions2026!");
  memberCookie = await login(member.email, "Facilities2026!");
});
after(async () => {
  const ids = [member.id, buyer.id];
  const courts = await db.court.findMany({ where: { sportId }, select: { id: true } });
  await db.$transaction(async (tx) => {
    const reservations = await tx.reservation.findMany({ where: { courtId: { in: courts.map((c) => c.id) } }, select: { id: true } });
    const invoices = await tx.invoice.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    const memberships = await tx.membership.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const mails = await tx.mailMessage.findMany({ where: { membershipId: { in: memberships.map((m) => m.id) } }, select: { jobId: true } });
    await tx.paymentAllocation.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.credit.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.reservation.deleteMany({ where: { id: { in: reservations.map((r) => r.id) } } });
    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await tx.payment.deleteMany({ where: { userId: { in: ids } } });
    await tx.checkout.deleteMany({ where: { userId: { in: ids } } });
    await tx.memberCard.deleteMany({ where: { userId: { in: ids } } });
    await tx.membership.deleteMany({ where: { userId: { in: ids } } });
    await tx.mailMessage.deleteMany({ where: { jobId: { in: mails.map((m) => m.jobId) } } });
    await tx.job.deleteMany({ where: { OR: [{ id: { in: mails.map((m) => m.jobId) } }, { dedupeKey: { in: reservations.map((r) => `booking-expiry:${r.id}`) } }] } });
    await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: [sportId, ...courts.map((c) => c.id)] } }] } });
    await tx.court.deleteMany({ where: { sportId } });
    await tx.sport.deleteMany({ where: { id: sportId } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
  await db.$disconnect();
});

test("Membership terms: 1 month, 3 months and annual are priced from the monthly rate and chain without overlap", async () => {
  const plan = await db.membershipPlan.findUniqueOrThrow({ where: { id: "silver" } });
  const version = plan.updatedAt.toISOString();
  const first = await purchaseMembership(buyer.id, randomUUID(), { planId: "silver", months: 1, action: "purchase", acceptPolicy: true, planVersion: version });
  const quarter = await purchaseMembership(buyer.id, randomUUID(), { planId: "silver", months: 3, action: "renew", acceptPolicy: true, planVersion: version });
  const annual = await purchaseMembership(buyer.id, randomUUID(), { planId: "silver", months: 12, action: "renew", acceptPolicy: true, planVersion: version });
  const terms = await db.membership.findMany({ where: { userId: buyer.id }, orderBy: { startsAt: "asc" } });
  assert.equal(terms.length, 3);
  assert.deepEqual(terms.map((t) => t.pricePaise), [termPrice(plan, 1).totalPaise, termPrice(plan, 3).totalPaise, termPrice(plan, 12).totalPaise]);
  assert.ok(terms[2].pricePaise < plan.pricePaise * 12, "annual must be cheaper than twelve single months");
  assert.equal(terms[0].endsAt.toISOString(), addMonths(terms[0].startsAt, 1).toISOString());
  assert.equal(terms[1].startsAt.toISOString(), terms[0].endsAt.toISOString(), "renewal starts when the previous term ends");
  assert.equal(terms[1].endsAt.toISOString(), addMonths(terms[1].startsAt, 3).toISOString());
  assert.equal(terms[2].endsAt.toISOString(), addMonths(terms[2].startsAt, 12).toISOString());
  assert.equal((terms[2].planSnapshot as { months: number }).months, 12);
  for (const [result, term] of [[first, terms[0]], [quarter, terms[1]], [annual, terms[2]]] as const) {
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: result.invoiceId }, include: { allocations: true } });
    assert.equal(invoice.totalPaise, term.pricePaise, "invoice reflects the server-calculated term price");
    assert.equal(invoice.allocations.reduce((n, a) => n + a.amountPaise, 0), term.pricePaise);
  }
});
test("Membership terms reject unsupported lengths and the same key cannot be reused for a different term", async () => {
  const plan = await db.membershipPlan.findUniqueOrThrow({ where: { id: "gold" } });
  const version = plan.updatedAt.toISOString();
  const invalid = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(memberCookie), "Idempotency-Key": randomUUID() }, body: JSON.stringify({ planId: "gold", months: 7, action: "purchase", acceptPolicy: true, planVersion: version }) });
  assert.equal(invalid.status, 422);
  const key = randomUUID();
  const ok = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(memberCookie), "Idempotency-Key": key }, body: JSON.stringify({ planId: "gold", months: 3, action: "purchase", acceptPolicy: true, planVersion: version }) });
  assert.equal(ok.status, 201);
  const reused = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(memberCookie), "Idempotency-Key": key }, body: JSON.stringify({ planId: "gold", months: 12, action: "purchase", acceptPolicy: true, planVersion: version }) });
  assert.equal(reused.status, 409);
  const term = await db.membership.findFirstOrThrow({ where: { userId: member.id } });
  assert.equal(term.pricePaise, termPrice(plan, 3).totalPaise);
  // A client-supplied price can never be injected.
  const injected = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(memberCookie), "Idempotency-Key": randomUUID() }, body: JSON.stringify({ planId: "gold", months: 1, action: "renew", acceptPolicy: true, planVersion: version, pricePaise: 1 }) });
  assert.equal(injected.status, 422);
});
test("Facility management is owner-only, validated and audited", async () => {
  const body = JSON.stringify({ action: "createSport", name: `Test ${prefix}`, description: "Created by the integration test suite.", image: "/images/tennis.jpg" });
  assert.equal((await fetch(`${base}/api/staff/facilities`, { method: "POST", headers: headers(), body })).status, 401);
  assert.equal((await fetch(`${base}/api/staff/facilities`, { method: "POST", headers: headers(memberCookie), body })).status, 403);
  assert.equal((await fetch(`${base}/api/staff/facilities`, { headers: headers(memberCookie) })).status, 403);
  assert.equal((await fetch(`${base}/api/staff/facilities`, { method: "POST", headers: { ...headers(ownerCookie), Origin: "https://untrusted.example" }, body })).status, 403);
  const external = await fetch(`${base}/api/staff/facilities`, { method: "POST", headers: headers(ownerCookie), body: JSON.stringify({ action: "createSport", name: "Remote image", description: "Image must be a local asset.", image: "https://evil.example/x.jpg" }) });
  assert.equal(external.status, 422);
  const sport = await manageFacility(ownerId, { action: "createSport", name: `Test ${prefix}`, description: "Created by the integration test suite.", image: "/images/tennis.jpg" });
  assert.equal(sport.id, sportId);
  const dup = await rejection(manageFacility(ownerId, { action: "createSport", name: `test ${prefix}`.toUpperCase(), description: "Duplicate names differ only by case.", image: "/images/tennis.jpg" }));
  assert.equal(dup.code, "SPORT_EXISTS");
  const court = await manageFacility(ownerId, { action: "createCourt", sportId, hourlyPaise: 55000, indoor: true });
  courtId = court.id;
  assert.equal(court.id, `${sportId}-1`);
  assert.equal((await manageFacility(ownerId, { action: "createCourt", sportId, hourlyPaise: 55000, indoor: false })).id, `${sportId}-2`);
  const listed = await fetch(`${base}/api/staff/facilities`, { headers: headers(ownerCookie) }).then((r) => r.json());
  assert.equal(listed.data.find((s: { id: string }) => s.id === sportId).courts.length, 2);
  assert.ok(await db.auditLog.count({ where: { entityId: courtId, action: "court.create" } }));
});
test("Maintenance blocks new bookings on the court or the whole sport, and reopening restores them", async () => {
  const note = await rejection(manageFacility(ownerId, { action: "updateCourt", id: courtId, status: "MAINTENANCE" }));
  assert.equal(note.code, "NOTE_REQUIRED", "customers must be told why a court is closed");
  await manageFacility(ownerId, { action: "updateCourt", id: courtId, status: "MAINTENANCE", statusNote: "Resurfacing until Friday" });
  const blocked = await rejection(hold(10));
  assert.equal(blocked.code, "COURT_MAINTENANCE");
  const shown = (await availability(sportId, day)).find((c) => c.id === courtId)!;
  assert.equal(shown.maintenance, true);
  assert.equal(shown.maintenanceReason, "Resurfacing until Friday");
  assert.ok(shown.slots.every((s) => !s.available), "no slot of a court under maintenance is bookable");
  await manageFacility(ownerId, { action: "updateCourt", id: courtId, status: "ACTIVE" });
  assert.equal((await db.court.findUniqueOrThrow({ where: { id: courtId } })).statusNote, null, "the note is cleared when the court reopens");
  await manageFacility(ownerId, { action: "updateSport", id: sportId, status: "MAINTENANCE", statusNote: "Hall closed for repainting" });
  assert.equal((await rejection(hold(11))).code, "COURT_MAINTENANCE");
  assert.ok((await availability(sportId, day)).every((c) => c.maintenance));
  await manageFacility(ownerId, { action: "updateSport", id: sportId, status: "ACTIVE" });
  const reopened = await hold(10);
  assert.equal(reopened.status, "HOLD");
  await actBooking(member, randomUUID(), reopened.id, { action: "cancel", method: "LOCAL", reason: "Test cleanup release", override: false });
});
test("Direct checkout: a held slot confirms in one follow-up call and a duplicate booking is refused", async () => {
  // The booking page performs hold then confirm back-to-back without a review step.
  const held = await hold(12);
  const confirmed = (await actBooking(member, randomUUID(), held.id, { action: "confirm", method: "LOCAL", override: false })).data;
  assert.equal(confirmed.status, "CONFIRMED");
  assert.ok(confirmed.invoiceId);
  // Gold members get complimentary weekly sessions, so a zero-priced booking correctly has no payment.
  assert.equal(await db.paymentAllocation.count({ where: { invoiceId: confirmed.invoiceId! } }), confirmed.pricePaise > 0 ? 1 : 0);
  assert.equal((await rejection(hold(12, buyer))).code, "SLOT_TAKEN");
  const slot = (await availability(sportId, day)).find((c) => c.id === courtId)!.slots.find((s) => s.hour === 12)!;
  assert.equal(slot.available, false);
});
test("Retired courts and sports disappear from public pages but their history is kept", async () => {
  await manageFacility(ownerId, { action: "updateCourt", id: courtId, status: "INACTIVE" });
  const shown = await publicData();
  assert.ok(!shown.sports.find((s) => s.id === sportId)?.courts.some((c) => c.id === courtId));
  assert.equal((await rejection(hold(13))).code, "COURT_UNAVAILABLE");
  assert.equal(await db.reservation.count({ where: { courtId } }) > 0, true, "past bookings are retained");
  await manageFacility(ownerId, { action: "updateSport", id: sportId, status: "INACTIVE" });
  assert.ok(!(await publicData()).sports.some((s) => s.id === sportId));
  assert.equal((await rejection(availability(sportId, day))).code, "SPORT_UNAVAILABLE");
  const page = await fetch(`${base}/api/public/availability?sport=${sportId}&date=${day}`);
  assert.equal(page.status, 404);
});
