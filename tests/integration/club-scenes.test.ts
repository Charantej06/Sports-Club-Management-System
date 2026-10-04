import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import { AppError } from "../../src/lib/errors";
import { holdBooking, actBooking } from "../../src/modules/bookings/service";
import { purchaseMembership } from "../../src/modules/membership/service";
import { manageFacility } from "../../src/modules/facilities/service";
import { registerMember, memberProfile } from "../../src/modules/members/service";
import { availability } from "../../src/modules/public/availability";
import { financialReport, operationalReport } from "../../src/modules/reports/service";
import { type Actor, clubDay } from "../../src/modules/operations/core";

const prefix = "scn-" + randomUUID().slice(0, 8);
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const owner: Actor = { id: "demo-owner", name: "Priya Sharma", email: "owner@champions.local", role: "OWNER" };
const reception: Actor = { id: "demo-reception", name: "Neha Singh", email: "reception@champions.local", role: "RECEPTION" };
const players: Actor[] = [1, 2, 3].map((n) => ({ id: `${prefix}-p${n}`, name: `Scene Player ${n}`, email: `${prefix}-p${n}@example.test`, role: "MEMBER" }));
const sportId = `test-${prefix}`;
const courtId = `${sportId}-1`;
const registeredEmails: string[] = [];
const day = new Date(+new Date(clubDay(new Date())) + 4 * 86400000).toISOString().slice(0, 10);
const kitchenIds = { order: `${prefix}-order`, ticket: `${prefix}-ticket`, table: `${prefix}-table` };
let receptionCookie = "";
let cashierCookie = "";
let ownerCookie = "";
let playerCookie = "";
const headers = (cookie = "") => ({ "Content-Type": "application/json", Origin: base, Cookie: cookie });
async function login(email: string, password: string) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
const book = async (who: Actor, hour: number, minute = 0) => (await holdBooking(who, randomUUID(), { courtId, day, hour, minute: minute as 0 | 30, trial: false })).data;
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
  await db.rateLimit.deleteMany({});
  const password = await hashPassword("Scenes2026!");
  for (const actor of players) {
    await db.user.create({ data: { ...actor, championsId: "CC-" + actor.id, emailVerified: true, dateOfBirth: new Date("1990-01-01") } });
    await db.account.create({ data: { id: "account-" + actor.id, userId: actor.id, accountId: actor.id, providerId: "credential", password } });
  }
  await manageFacility(owner.id, { action: "createSport", name: `Test ${prefix}`, description: "Fixture sport for scene tests.", image: "/images/tennis.jpg" });
  await manageFacility(owner.id, { action: "createCourt", sportId, hourlyPaise: 60000, indoor: false });
  receptionCookie = await login("reception@champions.local", "Champions2026!");
  cashierCookie = await login("cashier@champions.local", "Champions2026!");
  ownerCookie = await login("owner@champions.local", "Champions2026!");
  playerCookie = await login(players[0].email, "Scenes2026!");
});
after(async () => {
  const registered = await db.user.findMany({ where: { email: { in: registeredEmails } }, select: { id: true } });
  const ids = [...players.map((p) => p.id), ...registered.map((u) => u.id)];
  await db.$transaction(async (tx) => {
    const reservations = await tx.reservation.findMany({ where: { courtId }, select: { id: true } });
    const invoices = await tx.invoice.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    const memberships = await tx.membership.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const mails = await tx.mailMessage.findMany({ where: { OR: [{ to: { in: registeredEmails } }, { membershipId: { in: memberships.map((m) => m.id) } }] }, select: { jobId: true } });
    await tx.kitchenLine.deleteMany({ where: { ticketId: kitchenIds.ticket } });
    await tx.kitchenTicket.deleteMany({ where: { id: kitchenIds.ticket } });
    await tx.kitchenOrder.deleteMany({ where: { id: kitchenIds.order } });
    await tx.diningTable.deleteMany({ where: { id: kitchenIds.table } });
    await tx.paymentAllocation.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.credit.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.reservation.deleteMany({ where: { id: { in: reservations.map((r) => r.id) } } });
    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await tx.payment.deleteMany({ where: { userId: { in: ids } } });
    await tx.checkout.deleteMany({ where: { OR: [{ userId: { in: ids } }, { userId: { in: [owner.id, reception.id] }, key: { in: createdKeys } }] } });
    await tx.memberCard.deleteMany({ where: { userId: { in: ids } } });
    await tx.membership.deleteMany({ where: { userId: { in: ids } } });
    await tx.mailMessage.deleteMany({ where: { jobId: { in: mails.map((m) => m.jobId) } } });
    await tx.job.deleteMany({ where: { OR: [{ id: { in: mails.map((m) => m.jobId) } }, { dedupeKey: { in: reservations.map((r) => `booking-expiry:${r.id}`) } }, { dedupeKey: { in: registered.map((u) => `register:${u.id}`) } }] } });
    await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: [sportId, courtId, ...registered.map((u) => u.id)] } }] } });
    await tx.account.deleteMany({ where: { userId: { in: ids } } });
    await tx.court.deleteMany({ where: { sportId } });
    await tx.sport.deleteMany({ where: { id: sportId } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
    await tx.clubSettings.update({ where: { id: "club" }, data: { slotMinutes: 30 } });
  });
  await db.$disconnect();
});
const createdKeys: string[] = [];
const key = () => {
  const k = randomUUID();
  createdKeys.push(k);
  return k;
};

test("Booking a court: a new slot opens every half hour and two people can never share the court", async () => {
  const slots = (await availability(sportId, day)).find((c) => c.id === courtId)!.slots;
  assert.equal(slots.length, 33, "6:00 to 22:00 every 30 minutes (a one-hour session must finish by 23:00)");
  assert.deepEqual([slots[0], slots[1], slots.at(-1)].map((s) => `${s!.hour}:${String(s!.minute).padStart(2, "0")}`), ["6:00", "6:30", "22:00"]);
  const six = await book(players[0], 18, 0);
  assert.equal(new Date(six.startsAt).toISOString(), new Date(`${day}T18:00:00+05:30`).toISOString());
  assert.equal((await rejection(book(players[1], 18, 30))).code, "SLOT_TAKEN", "18:30 overlaps the 18:00 hour-long session");
  assert.equal((await rejection(book(players[1], 17, 30))).code, "SLOT_TAKEN", "17:30 overlaps the 18:00 session too");
  const seven = await book(players[1], 19, 0);
  assert.equal(seven.status, "HOLD", "the next free slot after an hour is bookable");
  const view = (await availability(sportId, day)).find((c) => c.id === courtId)!.slots;
  const state = (h: number, m: number) => view.find((s) => s.hour === h && s.minute === m)!.available;
  assert.deepEqual([state(17, 0), state(17, 30), state(18, 0), state(18, 30), state(19, 0), state(19, 30), state(20, 0)], [true, false, false, false, false, false, true]);
  await actBooking(players[0], key(), six.id, { action: "cancel", method: "LOCAL", reason: "Test cleanup release", override: false });
  await actBooking(players[1], key(), seven.id, { action: "cancel", method: "LOCAL", reason: "Test cleanup release", override: false });
});
test("Half-hour starts respect opening hours, the club's slot spacing and the database itself", async () => {
  assert.equal((await rejection(book(players[0], 22, 30))).code, "OPENING_HOURS", "a session starting 22:30 would end after closing");
  assert.equal((await rejection(holdBooking(players[0], randomUUID(), { courtId, day, hour: 18, minute: 15 as 0, trial: false }))).code, "SLOT_START");
  const bad = await fetch(`${base}/api/operations/booking`, { method: "POST", headers: { ...headers(playerCookie), "Idempotency-Key": randomUUID() }, body: JSON.stringify({ courtId, day, hour: 18, minute: 15, trial: false }) });
  assert.equal(bad.status, 422, "the API refuses quarter-hour starts");
  await db.clubSettings.update({ where: { id: "club" }, data: { slotMinutes: 60 } });
  try {
    assert.equal((await availability(sportId, day)).find((c) => c.id === courtId)!.slots.length, 17);
    assert.equal((await rejection(book(players[0], 18, 30))).code, "SLOT_START", "owner can switch back to hourly starts");
  } finally {
    await db.clubSettings.update({ where: { id: "club" }, data: { slotMinutes: 30 } });
  }
  await assert.rejects(
    db.$executeRaw`INSERT INTO "Reservation" (id,"courtId","startsAt","endsAt","clubDay",status,"pricePaise","createdAt") VALUES (${randomUUID()},${courtId},${new Date(`${day}T10:15:00+05:30`)},${new Date(`${day}T11:15:00+05:30`)},${new Date(day)},'CONFIRMED',0,NOW())`,
    /reservation_slot_start|check constraint/i,
    "PostgreSQL itself refuses a start time that is not on a half hour",
  );
});
test("Overlapping half-hour requests race: exactly one customer gets the court", async () => {
  const results = await Promise.allSettled([book(players[0], 20, 0), book(players[1], 20, 30), book(players[2], 19, 30)]);
  const won = results.filter((r) => r.status === "fulfilled");
  assert.equal(won.length, 1, "three overlapping hour-long requests produce exactly one reservation");
  const active = await db.reservation.findMany({ where: { courtId, status: { in: ["HOLD", "CONFIRMED"] } } });
  assert.equal(active.length, 1);
  await actBooking(players.find((p) => p.id === active[0].userId)!, key(), active[0].id, { action: "cancel", method: "LOCAL", reason: "Test cleanup release", override: false });
});
test("A new member walks in: reception registers them, sells a plan, and staff can see their history", async () => {
  const email = `${prefix}-walkin@example.test`;
  registeredEmails.push(email);
  const input = { name: "Walk In Member", email, phone: "+91 90000 11111", dateOfBirth: "2001-05-05" };
  const k = key();
  const first = await registerMember(reception, k, input);
  assert.equal(first.data.created, true);
  assert.match(first.data.championsId, /^CC-[0-9A-F]{10}$/);
  assert.equal((await registerMember(reception, k, input)).replayed, true, "a double click does not create a second account");
  const again = await registerMember(reception, key(), { ...input, name: "Typo Name" });
  assert.equal(again.data.created, false);
  assert.equal(again.data.id, first.data.id, "the same email never creates a duplicate member");
  assert.equal((await rejection(registerMember(reception, key(), { name: "Staff", email: "owner@champions.local" }))).code, "ACCOUNT_ROLE");
  assert.equal((await rejection(Promise.resolve().then(() => registerMember({ ...players[0] }, key(), { name: "Sneaky", email: `${prefix}-x@example.test` })))).status, 403, "members cannot register other people");
  const invite = await db.mailMessage.findFirstOrThrow({ where: { to: email } });
  assert.match(invite.body, new RegExp(first.data.championsId), "the invitation tells them their Champions ID");
  const plan = await db.membershipPlan.findUniqueOrThrow({ where: { id: "silver" } });
  await purchaseMembership(first.data.id, key(), { planId: "silver", months: 3, action: "purchase", acceptPolicy: true, planVersion: plan.updatedAt.toISOString() }, new Date(), { actor: reception, method: "CASH" });
  const profile = await memberProfile(reception, first.data.id);
  assert.equal(profile.current?.plan.name, "Silver");
  assert.ok(profile.daysLeft! >= 88 && profile.daysLeft! <= 93);
  assert.equal(profile.memberships.length, 1);
  assert.equal(profile.outstandingPaise, 0);
  assert.ok(profile.lifetimePaidPaise > 0);
  const lookup = await fetch(`${base}/api/staff/lookup?q=${encodeURIComponent(email)}`, { headers: headers(cashierCookie) });
  assert.equal(lookup.status, 200, "cashiers can still recognise a member for discounts");
  assert.equal((await fetch(`${base}/api/staff/member?id=${first.data.id}`, { headers: headers(cashierCookie) })).status, 403, "but the full history is reception/owner only");
  assert.equal((await fetch(`${base}/api/staff/member?id=${first.data.id}`, { headers: headers(playerCookie) })).status, 403);
  const viaApi = await fetch(`${base}/api/staff/member?id=${first.data.id}`, { headers: headers(receptionCookie) }).then((r) => r.json());
  assert.equal(viaApi.data.member.championsId, first.data.championsId);
  assert.equal(viaApi.data.member.email, email);
});
test("The owner sees what the club owes and what the bar earned", async () => {
  const range = { from: day, to: day };
  const finance = await financialReport(owner, range);
  assert.equal(finance.obligations.payrollPeriod, day.slice(0, 7));
  assert.ok(finance.obligations.employeeCount >= 3);
  assert.equal(finance.obligations.payrollNetPaise + finance.obligations.withholdingPaise, finance.obligations.payrollGrossPaise, "net pay plus withholding equals gross pay");
  const salaries = (await db.employee.findMany({ where: { active: true } })).reduce((n, e) => n + e.salaryPaise, 0);
  assert.ok(finance.obligations.payrollGrossPaise >= salaries, "every active salary is counted");
  const before = await operationalReport(owner, range);
  await db.diningTable.create({ data: { id: kitchenIds.table, name: kitchenIds.table, capacity: 4 } });
  await db.kitchenOrder.create({ data: { id: kitchenIds.order, tableId: kitchenIds.table, items: [], status: "CLOSED" } });
  const when = new Date(`${day}T20:00:00+05:30`);
  await db.kitchenTicket.create({ data: { id: kitchenIds.ticket, orderId: kitchenIds.order, revision: 1, createdAt: when } });
  await db.kitchenLine.createMany({
    data: [
      { ticketId: kitchenIds.ticket, menuId: "beer", name: "Craft lager", quantity: 4, unitPaise: 35000, discountPaise: 0, totalPaise: 140000, note: "" },
      { ticketId: kitchenIds.ticket, menuId: "pasta", name: "Penne", quantity: 2, unitPaise: 36000, discountPaise: 0, totalPaise: 72000, note: "" },
      { ticketId: kitchenIds.ticket, menuId: "beer", name: "Craft lager", quantity: 1, unitPaise: 35000, discountPaise: 0, totalPaise: 35000, note: "", status: "CANCELLED" },
    ],
  });
  const after = await operationalReport(owner, range);
  assert.equal(after.clubhouse.barPaise - before.clubhouse.barPaise, 140000, "bar sales are counted and cancelled items are not");
  assert.equal(after.clubhouse.kitchenPaise - before.clubhouse.kitchenPaise, 72000);
  assert.ok(after.clubhouse.categories.some((c) => c.category === "Bar"));
  const denied = await fetch(`${base}/api/staff/reports?from=${day}&to=${day}`, { headers: headers(receptionCookie) });
  assert.equal(denied.status, 403, "financial reports stay owner-only");
});
test("A stranger can find the club: robots, sitemap, structured data and public plans", async () => {
  const robots = await fetch(`${base}/robots.txt`).then((r) => r.text());
  assert.match(robots, /Disallow: \/staff/);
  assert.match(robots, /Sitemap: .*\/sitemap\.xml/);
  const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
  for (const path of ["/book", "/memberships", "/shop", "/clubhouse", "/book?sport=tennis"]) assert.ok(sitemap.includes(path.replaceAll("&", "&amp;")), `${path} is listed`);
  assert.ok(!sitemap.includes("/staff") && !sitemap.includes("/account"), "private areas are not advertised");
  const home = await fetch(`${base}/`).then((r) => r.text());
  const json = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(home);
  assert.ok(json, "the home page carries structured data");
  const data = JSON.parse(json[1]);
  assert.equal(data["@type"], "SportsActivityLocation");
  assert.ok(data.makesOffer.length >= 3, "plans and prices are published");
  assert.ok(data.address && data.telephone);
});
test("The owner can print a business summary; nobody else can open it", async () => {
  const page = await fetch(`${base}/staff/summary?preset=month`, { headers: headers(ownerCookie) });
  assert.equal(page.status, 200);
  const html = await page.text();
  for (const heading of ["Business summary", "Money in and out", "Where it came from", "Bar and kitchen", "What the club owes", "Courts"]) assert.ok(html.includes(heading), heading);
  for (const cookie of ["", receptionCookie, cashierCookie, playerCookie]) {
    const denied = await fetch(`${base}/staff/summary?preset=month`, { headers: headers(cookie), redirect: "manual" });
    assert.ok(![200].includes(denied.status) || !(await denied.text()).includes("Money in and out"), "no summary for non-owners");
  }
});
