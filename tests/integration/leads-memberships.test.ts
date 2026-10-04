import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import { AppError } from "../../src/lib/errors";
import { purchaseMembership } from "../../src/modules/membership/service";
import { benefits } from "../../src/modules/membership/pricing";
import { saveEnquiry } from "../../src/modules/enquiries/service";
import { actLead, followupJob } from "../../src/modules/crm/service";
import { holdBooking } from "../../src/modules/bookings/service";
import { type Actor, clubDay } from "../../src/modules/operations/core";

const prefix = "lm-" + randomUUID().slice(0, 8);
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const reception: Actor = { id: "demo-reception", name: "Neha Singh", email: "reception@champions.local", role: "RECEPTION" };
const member = { id: `${prefix}-member`, name: "Queue Member", email: `${prefix}-member@example.test` };
const joiner = { id: `${prefix}-joiner`, name: "Lead Joiner", email: `${prefix}-joiner@example.test` };
const newbie: Actor = { id: `${prefix}-newbie`, name: "Trial Newbie", email: `${prefix}-newbie@example.test`, role: "MEMBER" };
const visitorEmail = `${prefix}-visitor@example.test`;
const fayEmail = `${prefix}-fay@example.test`;
const leadEmails = [visitorEmail, joiner.email, `${prefix}-bad@example.test`, fayEmail, member.email];
const keys: string[] = [];
const key = () => {
  const k = randomUUID();
  keys.push(k);
  return k;
};
const versions: Record<string, string> = {};
const buy = (userId: string, planId: "gold" | "silver" | "junior", action: "purchase" | "renew" | "change", months: 1 | 3 | 12 = 1) =>
  purchaseMembership(userId, key(), { planId, months, action, acceptPolicy: true, planVersion: versions[planId] });
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
  for (const plan of await db.membershipPlan.findMany()) versions[plan.id] = plan.updatedAt.toISOString();
  const password = await hashPassword("Leads2026!");
  for (const user of [member, newbie]) {
    await db.user.create({ data: { ...user, championsId: "CC-" + user.id, emailVerified: true, dateOfBirth: new Date("1990-01-01") } });
    await db.account.create({ data: { id: "account-" + user.id, userId: user.id, accountId: user.id, providerId: "credential", password } });
  }
});
after(async () => {
  const ids = [member.id, joiner.id, newbie.id];
  await db.$transaction(async (tx) => {
    const leads = await tx.lead.findMany({ where: { email: { in: leadEmails } }, select: { id: true } });
    const leadIds = leads.map((l) => l.id);
    const invoices = await tx.invoice.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const invoiceIds = invoices.map((i) => i.id);
    const memberships = await tx.membership.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const mails = await tx.mailMessage.findMany({ where: { OR: [{ to: { in: leadEmails } }, { subject: { contains: prefix } }, { membershipId: { in: memberships.map((m) => m.id) } }, { body: { contains: prefix } }] }, select: { jobId: true } });
    await tx.leadQuote.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.staffNotification.deleteMany({ where: { entityId: { in: leadIds } } });
    await tx.job.deleteMany({ where: { OR: [{ id: { in: mails.map((m) => m.jobId) } }, { dedupeKey: { in: leadIds.flatMap((id) => [`lead-auto:${id}`, `enquiry-ack:${id}`]) } }] } });
    await tx.mailMessage.deleteMany({ where: { jobId: { in: mails.map((m) => m.jobId) } } });
    await tx.lead.deleteMany({ where: { id: { in: leadIds } } });
    await tx.paymentAllocation.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.credit.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    const heldIds = (await tx.reservation.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((r) => `booking-expiry:${r.id}`);
    await tx.reservation.deleteMany({ where: { userId: { in: ids } } });
    await tx.job.deleteMany({ where: { dedupeKey: { in: heldIds } } });
    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await tx.payment.deleteMany({ where: { userId: { in: ids } } });
    await tx.checkout.deleteMany({ where: { OR: [{ userId: { in: ids } }, { userId: reception.id, key: { in: keys } }] } });
    await tx.memberCard.deleteMany({ where: { userId: { in: ids } } });
    await tx.membership.deleteMany({ where: { userId: { in: ids } } });
    await tx.auditLog.deleteMany({ where: { actorId: { in: [...ids, "visitor"] }, entityId: { in: [...ids, ...leadIds] } } });
    await tx.account.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
  await db.$disconnect();
});

test("A second membership continues after the current one ends, whatever the plan", async () => {
  const silver = await buy(member.id, "silver", "purchase", 1);
  const gold = await buy(member.id, "gold", "renew", 3);
  assert.equal((await rejection(buy(member.id, "gold", "purchase", 1))).code, "MEMBERSHIP_EXISTS", "a stale page cannot buy a duplicate first membership");
  const terms = await db.membership.findMany({ where: { userId: member.id }, orderBy: { startsAt: "asc" } });
  assert.equal(terms.length, 2);
  assert.equal(terms[1].startsAt.toISOString(), terms[0].endsAt.toISOString(), "Gold starts the moment Silver ends");
  assert.deepEqual(terms.map((t) => t.status), ["ACTIVE", "ACTIVE"], "the paid-for Silver time is not thrown away");
  assert.ok(+terms[1].endsAt > +terms[1].startsAt);
  assert.notEqual(silver.invoiceId, gold.invoiceId);
  assert.equal((await benefits(db as never, member.id, new Date()))?.name, "Silver", "Silver applies now");
  assert.equal((await benefits(db as never, member.id, new Date(+terms[0].endsAt + 60000)))?.name, "Gold", "Gold applies from its start");
  const third = await buy(member.id, "silver", "renew", 1);
  const all = await db.membership.findMany({ where: { userId: member.id }, orderBy: { startsAt: "asc" } });
  assert.equal(all[2].startsAt.toISOString(), all[1].endsAt.toISOString(), "a third membership queues after the second");
  assert.ok(third.invoiceId);
  const mail = await db.mailMessage.findMany({ where: { to: member.email, subject: { contains: "membership is confirmed" } }, orderBy: { createdAt: "asc" } });
  assert.equal(mail.length, 3, "every purchase is emailed a receipt");
  assert.match(mail[1].body, /after your current membership/, "the second receipt says when it starts");
  assert.ok(mail[1].html?.includes("Membership confirmed"));
  const reminders = await db.job.findMany({ where: { kind: "MEMBERSHIP_REMINDER", payload: { path: ["userId"], equals: member.id }, status: "PENDING" } });
  assert.ok(reminders.length > 0 && reminders.every((r) => (r.payload as { membershipId: string }).membershipId === all[2].id), "reminders follow the last term, not the first");
});
test("Switching plan now is an explicit choice that replaces the time left", async () => {
  const before = await db.membership.findMany({ where: { userId: member.id, status: "ACTIVE" } });
  assert.equal(before.length, 3);
  const adult = await rejection(buy(member.id, "junior", "change", 1));
  assert.equal(adult.code, "JUNIOR_ELIGIBILITY");
  const same = await rejection(buy(member.id, "silver", "change", 1));
  assert.equal(same.code, "SAME_PLAN", "switching to the plan you are on is a renewal, not a switch");
  await buy(member.id, "gold", "change", 1);
  const after = await db.membership.findMany({ where: { userId: member.id }, orderBy: { startsAt: "asc" } });
  assert.equal(after.filter((t) => t.status === "ACTIVE").length, 1, "only the new term remains active");
  assert.equal(after.filter((t) => t.status === "SUPERSEDED").length, 3, "history is kept");
});
test("The introductory trial is for new players, not members", async () => {
  const day = new Date(+new Date(clubDay(new Date())) + 5 * 86400000).toISOString().slice(0, 10);
  const asMember = await rejection(holdBooking({ id: member.id, name: member.name, email: member.email, role: "MEMBER" }, key(), { courtId: "tennis-1", day, hour: 11, trial: true }));
  assert.equal(asMember.code, "TRIAL_MEMBER");
  const first = await holdBooking(newbie, key(), { courtId: "tennis-1", day, hour: 12, trial: true });
  assert.equal(first.data.pricePaise, 40000, "50% off the ₹800 court");
});
test("A visitor without an account becomes a lead: stored, acknowledged, announced and followed up", async () => {
  const result = await saveEnquiry({ name: "Vera Visitor", email: visitorEmail.toUpperCase(), phone: "+91 98765 43210", message: `Looking for padel lessons ${prefix}`, sport: "padel", interest: "TRIAL", website: "" });
  assert.equal(result.merged, false);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: result.id } });
  assert.equal(lead.email, visitorEmail, "emails are stored lower-case");
  assert.equal(lead.phone, "+91 98765 43210");
  assert.equal(lead.interest, "TRIAL");
  assert.equal(lead.status, "NEW");
  assert.ok(lead.followUpAt, "a follow-up is scheduled for the next day");
  const ack = await db.mailMessage.findFirstOrThrow({ where: { to: visitorEmail } });
  assert.match(ack.subject, /got your message/i, "the visitor gets an acknowledgement");
  const settings = await db.clubSettings.findUniqueOrThrow({ where: { id: "club" } });
  const alert = await db.mailMessage.findFirst({ where: { to: settings.contactEmail, subject: { contains: "Vera Visitor" } } });
  assert.ok(alert, "the club's contact address is emailed about the new enquiry");
  assert.ok(await db.staffNotification.count({ where: { entityId: lead.id, kind: "ENQUIRY" } }), "reception is notified in the app");
  assert.ok(await db.job.count({ where: { dedupeKey: `lead-auto:${lead.id}` } }), "an automatic one-day reminder is queued");
  assert.ok(await db.leadActivity.count({ where: { leadId: lead.id, actorId: "visitor" } }));
});
test("Writing again merges into the open lead instead of creating duplicates, and spam is limited", async () => {
  const first = await db.lead.findFirstOrThrow({ where: { email: visitorEmail } });
  const again = await saveEnquiry({ name: "Vera V.", email: visitorEmail, message: `Also what are the prices? ${prefix}`, interest: "MEMBERSHIP", planId: "gold", website: "" });
  assert.equal(again.merged, true);
  assert.equal(again.id, first.id);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(lead.enquiryCount, 2);
  assert.equal(lead.interest, "MEMBERSHIP", "the more specific interest wins");
  assert.equal(lead.planId, "gold");
  assert.equal(await db.lead.count({ where: { email: visitorEmail } }), 1, "one lead per person");
  assert.equal(await db.mailMessage.count({ where: { to: visitorEmail } }), 1, "no second acknowledgement");
  for (let n = 0; n < 3; n++) await saveEnquiry({ name: "Vera V.", email: visitorEmail, message: `Another question number ${n} ${prefix}`, website: "" });
  const limited = await rejection(saveEnquiry({ name: "Vera V.", email: visitorEmail, message: `One too many ${prefix}`, website: "" }));
  assert.equal(limited.code, "RATE_LIMITED");
});
test("Bad enquiries are refused: honeypot, phone format, short message, unknown plan", async () => {
  const post = (body: object) => fetch(`${base}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });
  const ok = { name: "Bad Input", email: `${prefix}-bad@example.test`, message: "A perfectly fine message here.", sport: "tennis", website: "" };
  assert.equal((await post({ ...ok, website: "http://spam.example" })).status, 422);
  assert.equal((await post({ ...ok, phone: "call me maybe" })).status, 422);
  assert.equal((await post({ ...ok, message: "short" })).status, 422);
  assert.equal((await post({ ...ok, planId: "platinum" })).status, 422);
  assert.equal((await post({ ...ok, interest: "HACK" })).status, 422);
  assert.equal((await post({ ...ok, extra: "x" })).status, 422, "unknown fields are refused");
  assert.equal((await post(ok)).status, 201);
});
test("Reception quotes by email, the visitor opens the public link, joins, and the lead closes itself", async () => {
  const { id } = await saveEnquiry({ name: "Jo Joiner", email: joiner.email, message: `I want the gold plan please ${prefix}`, interest: "MEMBERSHIP", planId: "gold", website: "" });
  await actLead(reception, key(), id, { action: "status", status: "CONTACTED" });
  await actLead(reception, key(), id, { action: "quote", planId: "gold", months: 3, send: true });
  let lead = await db.lead.findUniqueOrThrow({ where: { id }, include: { quotes: true } });
  assert.equal(lead.status, "QUOTED", "sending a quote moves the lead along");
  const quote = lead.quotes[0];
  assert.ok(quote.sentAt && quote.token.length >= 20);
  const email = await db.mailMessage.findFirstOrThrow({ where: { to: joiner.email, subject: { contains: "Gold membership quote" } } });
  assert.ok(email.body.includes(`/quote/${quote.token}`) && email.html?.includes(`/quote/${quote.token}`), "the email carries the public link");
  const page = await fetch(`${base}/quote/${quote.token}`);
  assert.equal(page.status, 200, "no login is needed to read a quote");
  const html = (await page.text()).replace(/<!--.*?-->/g, "");
  assert.ok(html.includes("Gold membership") && html.includes("Create my account to join"));
  assert.ok(html.includes(encodeURIComponent(joiner.email)), "the sign-up link is prefilled with their email");
  // Streamed not-found pages can report 200, so check that nothing about a quote is revealed.
  for (const bad of ["not-a-real-token-1234567890", "!!!", "a".repeat(30)]) {
    const body = (await fetch(`${base}/quote/${encodeURIComponent(bad)}`).then((r) => r.text())).replace(/<!--.*?-->/g, "");
    assert.ok(!body.includes("Create my account to join") && !body.includes("Your quote"), `${bad} reveals nothing`);
  }
  await db.leadQuote.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() - 86400000) } });
  assert.match(await fetch(`${base}/quote/${quote.token}`).then((r) => r.text()), /expired/i);
  assert.equal((await rejection(actLead(reception, key(), id, { action: "emailQuote", quoteId: quote.id }))).code, "QUOTE_EXPIRED");
  await db.user.create({ data: { ...joiner, championsId: "CC-" + joiner.id, emailVerified: true, dateOfBirth: new Date("1990-01-01") } });
  await buy(joiner.id, "gold", "purchase", 3);
  lead = await db.lead.findUniqueOrThrow({ where: { id }, include: { quotes: true } });
  assert.equal(lead.status, "CONVERTED", "joining closes the lead");
  assert.equal(lead.memberId, joiner.id);
  assert.equal(lead.followUpAt, null);
});
test("The automatic follow-up reminds only about leads nobody has touched", async () => {
  const fresh = await saveEnquiry({ name: "Fay Fresh", email: fayEmail, message: `Does anyone read these? ${prefix}`, website: "" });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: fresh.id } });
  const at = lead.followUpAt!.toISOString();
  await actLead(reception, key(), fresh.id, { action: "status", status: "CONTACTED" });
  await followupJob(fresh.id, at, true);
  assert.equal(await db.staffNotification.count({ where: { dedupeKey: `followup:${fresh.id}:${at}` } }), 0, "contacted leads are not nagged about");
  await db.lead.update({ where: { id: fresh.id }, data: { status: "NEW" } });
  await followupJob(fresh.id, at, true);
  assert.equal(await db.staffNotification.count({ where: { dedupeKey: `followup:${fresh.id}:${at}` } }), 1, "untouched leads trigger a reminder");
});
