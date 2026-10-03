import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import { purchaseMembership as purchase, type PurchaseInput } from "../../src/modules/membership/service";
import { updateProfile } from "../../src/modules/account/service";
import { queueMail } from "../../src/modules/mail/service";
import { processNextJob } from "../../src/modules/mail/worker";

const prefix = `test-${randomUUID()}`;
const ids = [prefix, `${prefix}-second`, `${prefix}-junior`];
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const planVersions: Record<string, string> = {};
async function purchaseMembership(userId: string, key: string, input: Omit<PurchaseInput, "planVersion"> & { planVersion?: string }) {
  return purchase(userId, key, { ...input, planVersion: input.planVersion ?? planVersions[input.planId] });
}
let firstPurchaseKey = "";
let cookie = "";
let otherCookie = "";
const signupEmails: string[] = [];
const headers = (value = cookie) => ({ "Content-Type": "application/json", Origin: base, Cookie: value });
async function login(email: string, password = "Integration2026!") {
  const res = await fetch(`${base}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `Login failed: ${await res.clone().text()}`);
  return res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
}
before(async () => {
  assert.equal(process.env.PAYMENT_MODE, "local", "Integration tests require explicit local payment mode.");
  for (const plan of await db.membershipPlan.findMany()) planVersions[plan.id] = plan.updatedAt.toISOString();
  const password = await hashPassword("Integration2026!");
  for (const [n,id] of ids.entries()) {
    await db.user.create({ data: { id, name: "Integration Player", email: `${id}@example.test`, emailVerified: true, championsId: `CC-${id}`, dateOfBirth: new Date(n === 2 ? "2012-01-01" : "1990-01-01") } });
    await db.account.create({ data: { id: `account-${id}`, providerId: "credential", accountId: id, userId: id, password } });
  }
  cookie = await login(`${ids[0]}@example.test`);
  otherCookie = await login(`${ids[1]}@example.test`);
});
after(async () => {
  const signupUsers = await db.user.findMany({ where: { email: { in: signupEmails } }, select: { id: true } });
  const all = [...ids, ...signupUsers.map(u => u.id)];
  await db.$transaction(async tx => {
    const invoices = await tx.invoice.findMany({ where: { userId: { in: all } }, select: { id: true } });
    const invIds = invoices.map(i => i.id);
    await tx.paymentAllocation.deleteMany({ where: { invoiceId: { in: invIds } } });
    await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
    await tx.credit.deleteMany({ where: { invoiceId: { in: invIds } } });
    await tx.invoice.deleteMany({ where: { userId: { in: all } } });
    await tx.payment.deleteMany({ where: { userId: { in: all } } });
    await tx.checkout.deleteMany({ where: { userId: { in: all } } });
    await tx.memberCard.deleteMany({ where: { userId: { in: all } } });
    await tx.membership.deleteMany({ where: { userId: { in: all } } });
    await tx.reservation.deleteMany({ where: { userId: { in: all } } });
    await tx.auditLog.deleteMany({ where: { actorId: { in: all } } });
    await tx.user.deleteMany({ where: { id: { in: all } } });
    const mails = await tx.mailMessage.findMany({ where: { OR: [{ to: { in: [...signupEmails, ...ids.map(id => `${id}@example.test`)] } }, { subject: { startsWith: prefix } }] }, select: { jobId: true } });
    await tx.mailMessage.deleteMany({ where: { jobId: { in: mails.map(m => m.jobId) } } });
    await tx.job.deleteMany({ where: { id: { in: mails.map(m => m.jobId) } } });
  });
  await db.$disconnect();
});
test("Anonymous and member requests cannot reach staff APIs; cross-origin mutations are rejected", async () => {
  assert.equal((await fetch(`${base}/api/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/staff/settings`, { headers: headers() })).status, 403);
  assert.equal((await fetch(`${base}/api/staff/inbox`, { headers: headers() })).status, 403);
  assert.equal((await fetch(`${base}/api/me`, { method: "PATCH", headers: { ...headers(), Origin: "https://untrusted.example" }, body: "{}" })).status, 403);
});
test("Concurrent duplicate checkout creates one term, invoice, payment and stable card", async () => {
  const key = randomUUID(); firstPurchaseKey = key;
  const requests = Array.from({ length: 5 }, () => fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(), "Idempotency-Key": key }, body: JSON.stringify({ planId: "silver", action: "purchase", acceptPolicy: true, planVersion: planVersions.silver }) }));
  const responses = await Promise.all(requests);
  assert.equal(responses.filter(r => r.status === 201).length, 1);
  assert.equal(responses.filter(r => r.status === 200).length, 4);
  const results = await Promise.all(responses.map(r => r.json()));
  assert.equal(new Set(results.map(r => r.data.invoiceId)).size, 1);
  assert.equal(await db.membership.count({ where: { userId: prefix } }), 1);
  assert.equal(await db.invoice.count({ where: { userId: prefix } }), 1);
  assert.equal(await db.payment.count({ where: { userId: prefix } }), 1);
  const mismatch = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(), "Idempotency-Key": key }, body: JSON.stringify({ planId: "gold", action: "change", acceptPolicy: true, planVersion: planVersions.gold }) });
  assert.equal(mismatch.status, 409);
  const qr1 = await fetch(`${base}/api/me/card`, { headers: headers() }).then(r => r.json());
  const qr2 = await fetch(`${base}/api/me/card`, { headers: headers() }).then(r => r.json());
  assert.equal(qr1.data.qr, qr2.data.qr);
});
test("New keys cannot race a duplicate initial purchase; renewal terms never overlap", async () => {
  const input = { planId: "gold", action: "purchase", acceptPolicy: true } as const;
  const results = await Promise.allSettled([purchaseMembership(ids[1], randomUUID(), input), purchaseMembership(ids[1], randomUUID(), input)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const initial = await db.membership.findFirstOrThrow({ where: { userId: prefix } });
  const renew = await Promise.all([purchaseMembership(prefix, randomUUID(), { planId: "silver", action: "renew", acceptPolicy: true }), purchaseMembership(prefix, randomUUID(), { planId: "silver", action: "renew", acceptPolicy: true })]);
  const ordered = renew.sort((a,b) => +new Date(a.startsAt)-+new Date(b.startsAt));
  assert.equal(ordered[0].startsAt, initial.endsAt.toISOString());
  assert.equal(ordered[1].startsAt, ordered[0].endsAt);
});
test("Invoice ownership is enforced in API and receipt page; client prices are rejected", async () => {
  const invoice = await db.invoice.findFirstOrThrow({ where: { userId: prefix } });
  assert.equal((await fetch(`${base}/api/me/invoices/${invoice.id}`, { headers: headers(otherCookie) })).status, 404);
  const page = await fetch(`${base}/account/receipts/${invoice.id}`, { headers: headers(otherCookie) });
  const html = await page.text();
  assert.ok(html.includes("Out of bounds."));
  assert.ok(!html.includes(invoice.number), "Another customer's invoice must never be rendered.");
  assert.equal((await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(), "Idempotency-Key": randomUUID() }, body: JSON.stringify({ planId: "gold", action: "change", acceptPolicy: true, planVersion: planVersions.gold, pricePaise: 1 }) })).status, 422);
  const response = await fetch(`${base}/api/me?userId=${ids[1]}`, { headers: headers() }).then(r => r.json());
  assert.equal(response.data.user.id, prefix);
});
test("Plan change preserves history and invoice snapshots", async () => {
  const originals = await db.invoice.findMany({ where: { userId: prefix } });
  const before = await db.memberCard.findUniqueOrThrow({ where: { userId: prefix } });
  await purchaseMembership(prefix, randomUUID(), { planId: "gold", action: "change", acceptPolicy: true });
  assert.equal(await db.membership.count({ where: { userId: prefix, status: "SUPERSEDED" } }), 3);
  assert.equal((await db.memberCard.findUniqueOrThrow({ where: { userId: prefix } })).token, before.token);
  for (const invoice of originals) assert.equal((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).totalPaise, invoice.totalPaise);
});
test("Junior age and profile changes are validated transactionally", async () => {
  await assert.rejects(purchaseMembership(ids[1], randomUUID(), { planId: "junior", action: "change", acceptPolicy: true }), /under 18/);
  await purchaseMembership(ids[2], randomUUID(), { planId: "junior", action: "purchase", acceptPolicy: true });
  await assert.rejects(updateProfile(ids[2], { name: "Junior Player", phone: "", dateOfBirth: "1990-01-01" }), /conflicts/);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ids[2] } })).dateOfBirth?.toISOString().slice(0,10), "2012-01-01");
});
test("PostgreSQL excludes concurrent court overlap and protects stock from negative values", async () => {
  const startsAt = new Date("2030-01-01T06:30:00Z");
  const input = { userId: prefix, courtId: "tennis-1", startsAt, endsAt: new Date(+startsAt+3600000), clubDay: new Date("2030-01-01"), status: "CONFIRMED" as const, pricePaise: 80000 };
  const results = await Promise.allSettled([db.reservation.create({ data: input }), db.reservation.create({ data: { ...input, userId: ids[1] } })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(db.productVariant.update({ where: { id: "pro-tour-98-0" }, data: { stock: -1 } }));
});
test("QR revocation invalidates the old token; reissue generates a new stable token", async () => {
  const old = await db.memberCard.findUniqueOrThrow({ where: { userId: prefix } });
  assert.equal((await fetch(`${base}/api/me/card`, { method: "DELETE", headers: headers() })).status, 200);
  assert.ok((await db.memberCard.findUniqueOrThrow({ where: { userId: prefix } })).revokedAt);
  assert.equal((await fetch(`${base}/api/me/card`, { method: "POST", headers: headers() })).status, 200);
  const next = await db.memberCard.findUniqueOrThrow({ where: { userId: prefix } });
  assert.notEqual(next.token, old.token);
});
test("Signup cannot assign an owner role; verification and reset links are persisted", async () => {
  const email = `${prefix}-signup@example.test`;
  signupEmails.push(email);
  const res = await fetch(`${base}/api/auth/sign-up/email`, { method: "POST", headers: headers(""), body: JSON.stringify({ name: "New Player", email, password: "Integration2026!", role: "OWNER", championsId: "CC-OVERRIDE" }) });
  assert.equal(res.status, 400);
  assert.equal(await db.user.count({ where: { email } }), 0);
  const signup = await fetch(`${base}/api/auth/sign-up/email`, { method: "POST", headers: headers(""), body: JSON.stringify({ name: "New Player", email, password: "Integration2026!" }) });
  assert.equal(signup.status, 200, await signup.clone().text());
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.role, "MEMBER");
  assert.notEqual(user.championsId, "CC-OVERRIDE");
  assert.equal(user.emailVerified, false);
  const mail = await db.mailMessage.findFirstOrThrow({ where: { to: email }, orderBy: { createdAt: "desc" } });
  const link = mail.body.match(/https?:\/\/\S+/)?.[0]; assert.ok(link);
  const verified = await fetch(link, { redirect: "manual" }); assert.ok([200,302,303].includes(verified.status));
  assert.equal((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified, true);
  await login(email);
  await fetch(`${base}/api/auth/request-password-reset`, { method: "POST", headers: headers(""), body: JSON.stringify({ email, redirectTo: `${base}/reset-password` }) });
  const reset = await db.mailMessage.findFirstOrThrow({ where: { to: email, subject: { contains: "Reset" } } });
  const resetUrl = reset.body.match(/https?:\/\/\S+/)?.[0]; assert.ok(resetUrl);
  const redirect = await fetch(resetUrl, { redirect: "manual" });
  const token = new URL(redirect.headers.get("location")!, base).searchParams.get("token"); assert.ok(token);
  const changed = await fetch(`${base}/api/auth/reset-password`, { method: "POST", headers: headers(""), body: JSON.stringify({ token, newPassword: "ChangedPass2026!" }) });
  assert.equal(changed.status, 200);
  assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
  await login(email, "ChangedPass2026!");
});
test("Stale reviewed plans roll back checkout while completed replays keep their original price", async () => {
  const original = await db.membershipPlan.findUniqueOrThrow({ where: { id: "silver" } });
  try {
    await db.membershipPlan.update({ where: { id: "silver" }, data: { pricePaise: original.pricePaise + 5000 } });
    const count = await db.invoice.count({ where: { userId: prefix } });
    const stale = await fetch(`${base}/api/me/membership`, { method: "POST", headers: { ...headers(), "Idempotency-Key": randomUUID() }, body: JSON.stringify({ planId: "silver", action: "change", acceptPolicy: true, planVersion: planVersions.silver }) });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "PLAN_CHANGED");
    assert.equal(await db.invoice.count({ where: { userId: prefix } }), count);
    const replay = await purchaseMembership(prefix, firstPurchaseKey, { planId: "silver", action: "purchase", acceptPolicy: true });
    assert.equal(replay.replayed, true);
    assert.equal((await db.invoice.findUniqueOrThrow({ where: { id: replay.invoiceId } })).totalPaise, original.pricePaise);
  } finally {
    await db.membershipPlan.update({ where: { id: "silver" }, data: { pricePaise: original.pricePaise, updatedAt: original.updatedAt } });
  }
});

test("Worker local delivery is persistent and safely resumes a completed delivery", async () => {
  await queueMail(`${prefix}@example.test`, `${prefix}-worker`, "Local worker test, no secrets.");
  let mail = await db.mailMessage.findFirstOrThrow({ where: { subject: `${prefix}-worker` } });
  for (let n=0; n<20 && mail.status !== "DELIVERED"; n++) { await processNextJob(); mail = await db.mailMessage.findUniqueOrThrow({ where: { id: mail.id } }); }
  assert.equal(mail.status, "DELIVERED");
  const sentAt = mail.sentAt?.toISOString();
  await db.job.update({ where: { id: mail.jobId }, data: { status: "PENDING" } });
  await processNextJob();
  assert.equal((await db.mailMessage.findUniqueOrThrow({ where: { id: mail.id } })).sentAt?.toISOString(), sentAt);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: mail.jobId } })).status, "DONE");
});
test("Worker failure retries are durable; a stale lease is recovered without a duplicate message", async () => {
  assert.ok(!process.env.SMTP_HOST, "This local test requires SMTP to be unconfigured.");
  await queueMail(`${prefix}@example.test`, `${prefix}-retry`, "Retry test.");
  const mail = await db.mailMessage.findFirstOrThrow({ where: { subject: `${prefix}-retry` } });
  await db.mailMessage.update({ where: { id: mail.id }, data: { mode: "smtp" } });
  await processNextJob();
  const failed = await db.job.findUniqueOrThrow({ where: { id: mail.jobId } });
  assert.equal(failed.status, "PENDING");
  assert.equal(failed.attempts, 1);
  assert.ok(failed.runAt > new Date());
  await db.mailMessage.update({ where: { id: mail.id }, data: { mode: "local" } });
  await db.job.update({ where: { id: mail.jobId }, data: { status: "RUNNING", lockedAt: new Date(Date.now()-3600000) } });
  await processNextJob();
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: mail.jobId } })).status, "DONE");
  assert.equal(await db.mailMessage.count({ where: { jobId: mail.jobId } }), 1);
});
