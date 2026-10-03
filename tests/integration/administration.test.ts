import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import {
  adminMutation,
  cashTotals,
  hrData,
} from "../../src/modules/administration/service";
import {
  financialReport,
  reportRange,
  csv,
} from "../../src/modules/reports/service";
import {
  issueInvoice,
  payInvoice,
  creditInvoice,
} from "../../src/modules/billing/service";
import {
  gatewayConfigured,
  validSignature,
  createIntent,
  completeIntent,
  recordGatewayRepayment,
} from "../../src/modules/billing/gateway";
import { scheduleReminders } from "../../src/modules/mail/reminders";
import { purchaseMembership } from "../../src/modules/membership/service";
import { processNextJob } from "../../src/modules/mail/worker";
import { clubDay, type Actor } from "../../src/modules/operations/core";
import { saveEnquiry } from "../../src/modules/enquiries/service";
import { actLead } from "../../src/modules/crm/service";
import { readCard } from "../../src/modules/account/cards";
import { lookupMember } from "../../src/modules/staff/service";
import { holdBooking, actBooking } from "../../src/modules/bookings/service";
import { holdOrder, actOrder } from "../../src/modules/shop/service";
import {
  openBill,
  actBill,
  prepareTicket,
} from "../../src/modules/clubhouse/service";
const prefix = "admin-test-" + randomUUID();
const owner: Actor = {
  id: prefix + "-owner",
  name: "Report Owner",
  email: prefix + "-owner@example.test",
  role: "OWNER",
};
const cashier: Actor = {
  id: prefix + "-cash",
  name: "Test Cashier",
  email: prefix + "-cash@example.test",
  role: "CASHIER",
};
const member: Actor = {
  id: prefix + "-member",
  name: "Test Member",
  email: prefix + "-member@example.test",
  role: "MEMBER",
};
const other: Actor = {
  id: prefix + "-other",
  name: "Other Employee",
  email: prefix + "-other@example.test",
  role: "KITCHEN",
};
const journey: Actor = {
  id: prefix + "-journey",
  name: "Journey Customer",
  email: prefix + "-journey@example.test",
  role: "MEMBER",
};
const actors = [owner, cashier, member, other, journey];
const invoices: string[] = [],
  quotes: string[] = [];
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
let ownerCookie = "",
  memberCookie = "";
const mutate = (
  actor: Actor,
  input: Parameters<typeof adminMutation>[2],
  key = randomUUID(),
) => adminMutation(actor, key, input);
async function invoice(
  amountPaise = 10000,
  department: "CLUBHOUSE" | "COURT" = "CLUBHOUSE",
) {
  const i = await db.$transaction((tx) =>
    issueInvoice(tx, {
      userId: member.id,
      name: member.name,
      email: member.email,
      department,
      originId: prefix + randomUUID(),
      lines: [
        {
          description: "Test charge",
          quantity: 1,
          unitPaise: amountPaise,
          discountPaise: 0,
          totalPaise: amountPaise,
        },
      ],
    }),
  );
  invoices.push(i.id);
  return i;
}
before(async () => {
  const password = await hashPassword("Integration2026!");
  for (const actor of actors) {
    await db.user.create({
      data: {
        ...actor,
        championsId: "CC-" + actor.id,
        emailVerified: true,
        dateOfBirth: new Date("1990-01-01"),
      },
    });
    await db.account.create({
      data: {
        id: "account-" + actor.id,
        accountId: actor.id,
        providerId: "credential",
        userId: actor.id,
        password,
      },
    });
  }
  for (const actor of [owner, member]) {
    const res = await fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        email: actor.email,
        password: "Integration2026!",
      }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (actor.id === owner.id) ownerCookie = cookie;
    else memberCookie = cookie;
  }
});
after(async () => {
  await db.$transaction(async (tx) => {
    const orders = await tx.shopOrder.findMany({
      where: { userId: journey.id },
    });
    const bookings = await tx.reservation.findMany({
      where: { userId: journey.id },
    });
    await tx.job.deleteMany({
      where: {
        OR: [
          ...orders.map((o) => ({ dedupeKey: "shop-expiry:" + o.id })),
          ...bookings.map((b) => ({ dedupeKey: "booking-expiry:" + b.id })),
        ],
      },
    });
    await tx.stockMovement.deleteMany({
      where: { variantId: prefix + "-variant" },
    });
    await tx.shopOrderLine.deleteMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });
    await tx.shopOrder.deleteMany({ where: { userId: journey.id } });
    await tx.reservation.deleteMany({ where: { userId: journey.id } });
    const bills = await tx.kitchenOrder.findMany({
      where: { memberId: journey.id },
    });
    const tickets = await tx.kitchenTicket.findMany({
      where: { orderId: { in: bills.map((b) => b.id) } },
    });
    await tx.kitchenLine.deleteMany({
      where: { ticketId: { in: tickets.map((t) => t.id) } },
    });
    await tx.kitchenTicket.deleteMany({
      where: { id: { in: tickets.map((t) => t.id) } },
    });
    await tx.kitchenOrder.deleteMany({ where: { memberId: journey.id } });
    await tx.court.deleteMany({ where: { id: prefix + "-court" } });
    await tx.productVariant.deleteMany({ where: { id: prefix + "-variant" } });
    await tx.product.deleteMany({ where: { id: prefix + "-product" } });
    await tx.menuItem.deleteMany({ where: { id: prefix + "-menu" } });
    await tx.diningTable.deleteMany({ where: { id: prefix + "-table" } });
    const leads = await tx.lead.findMany({ where: { email: journey.email } });
    await tx.leadQuote.deleteMany({
      where: { leadId: { in: leads.map((l) => l.id) } },
    });
    await tx.leadActivity.deleteMany({
      where: { leadId: { in: leads.map((l) => l.id) } },
    });
    await tx.staffNotification.deleteMany({
      where: { entityId: { in: leads.map((l) => l.id) } },
    });
    await tx.lead.deleteMany({ where: { id: { in: leads.map((l) => l.id) } } });
    const inv = await tx.invoice.findMany({
      where: {
        OR: [
          { userId: { in: actors.map((a) => a.id) } },
          { id: { in: invoices } },
          { originId: { startsWith: "business:" }, customerEmail: owner.email },
        ],
      },
      select: { id: true },
    });
    const ids = inv.map((i) => i.id),
      credits = await tx.credit.findMany({ where: { invoiceId: { in: ids } } });
    await tx.refund.deleteMany({
      where: { creditId: { in: credits.map((c) => c.id) } },
    });
    await tx.credit.deleteMany({ where: { invoiceId: { in: ids } } });
    await tx.paymentAllocation.deleteMany({
      where: { invoiceId: { in: ids } },
    });
    await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
    await tx.invoice.deleteMany({ where: { id: { in: ids } } });
    await tx.payment.deleteMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    await tx.businessQuote.deleteMany({ where: { id: { in: quotes } } });
    const employees = await tx.employee.findMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    await tx.payslip.deleteMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
    });
    await tx.leaveRequest.deleteMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
    });
    await tx.staffShift.deleteMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
    });
    await tx.employee.deleteMany({
      where: { id: { in: employees.map((e) => e.id) } },
    });
    const shifts = await tx.cashShift.findMany({
      where: { actorId: { in: actors.map((a) => a.id) } },
    });
    await tx.cashPayout.deleteMany({
      where: { shiftId: { in: shifts.map((s) => s.id) } },
    });
    await tx.cashShift.deleteMany({
      where: { id: { in: shifts.map((s) => s.id) } },
    });
    await tx.gatewayRepayment.deleteMany({ where: { actorId: owner.id } });
    const intents = await tx.gatewayIntent.findMany({
      where: { userId: { in: actors.map((a) => a.id) } },
      select: { id: true },
    });
    await tx.staffNotification.deleteMany({
      where: { entityId: { in: intents.map((i) => i.id) } },
    });
    await tx.gatewayIntent.deleteMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    const messages = await tx.mailMessage.findMany({
      where: { to: { in: actors.map((a) => a.email) } },
    });
    await tx.mailMessage.deleteMany({
      where: { id: { in: messages.map((m) => m.id) } },
    });
    await tx.job.deleteMany({
      where: { id: { in: messages.map((m) => m.jobId) } },
    });
    await tx.memberCard.deleteMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    await tx.membership.deleteMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    await tx.auditLog.deleteMany({
      where: { actorId: { in: actors.map((a) => a.id) } },
    });
    await tx.checkout.deleteMany({
      where: { userId: { in: actors.map((a) => a.id) } },
    });
    await tx.user.deleteMany({
      where: { id: { in: actors.map((a) => a.id) } },
    });
  });
  await db.$disconnect();
});
test("Reports deny staff/customers, and admin rejects cross-origin and customer writes", async () => {
  const headers = {
    Cookie: memberCookie,
    Origin: base,
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(),
  };
  assert.equal(
    (await fetch(base + "/api/staff/reports", { headers })).status,
    403,
  );
  assert.equal(
    (await fetch(base + "/api/staff/admin?area=hr", { headers })).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/staff/admin", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/staff/admin", {
        method: "POST",
        headers: {
          ...headers,
          Cookie: ownerCookie,
          Origin: "https://invalid.example",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  await assert.rejects(
    () =>
      financialReport(cashier, {
        from: clubDay(new Date()),
        to: clubDay(new Date()),
      }),
    /permission/,
  );
});
test("Report club-day boundaries and exports reject spreadsheet formulas", () => {
  const range = reportRange({ from: "2090-01-02", to: "2090-01-02" });
  assert.equal(range.start.toISOString(), "2090-01-01T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2090-01-02T18:30:00.000Z");
  assert.throws(
    () => reportRange({ from: "2090-02-01", to: "2090-01-01" }),
    /ordered/,
  );
  assert.match(csv([["=SUM(A1)", 'a"b']]), /'=SUM/);
  assert.match(csv([["=SUM(A1)", 'a"b']]), /a""b/);
});
test("All financial drill-downs exactly reproduce period totals and department allocations", async () => {
  const i = await invoice(12000),
    j = await invoice(9000, "COURT");
  await db.$transaction(async (tx) => {
    await payInvoice(tx, cashier, i.id, "CASH", 7000);
    await payInvoice(tx, owner, j.id, "UPI", 9000);
    await creditInvoice(
      tx,
      owner,
      i.id,
      8000,
      "Test cancellation credit",
      prefix + "-credit",
    );
  });
  const r = await financialReport(owner, {
    from: clubDay(new Date()),
    to: clubDay(new Date()),
  });
  assert.equal(
    r.totals.salesPaise,
    r.sales.reduce((s, i) => s + i.totalPaise, 0),
  );
  assert.equal(
    r.totals.collectionsPaise,
    r.payments.reduce((s, p) => s + p.amountPaise, 0),
  );
  assert.equal(
    r.totals.creditsPaise,
    r.credits.reduce((s, c) => s + c.amountPaise, 0),
  );
  assert.equal(
    r.totals.refundsPaise,
    r.refunds
      .filter((v) => v.status === "RECORDED")
      .reduce((s, v) => s + v.amountPaise, 0),
  );
  assert.equal(
    r.totals.pendingRefundsPaise,
    r.refunds
      .filter((v) => v.status === "PENDING")
      .reduce((s, v) => s + v.amountPaise, 0),
  );
  assert.equal(
    r.totals.outstandingPaise,
    r.outstanding.reduce((s, i) => s + i.outstandingPaise, 0),
  );
  assert.equal(
    r.methods.reduce((s, m) => s + m.amountPaise, 0),
    r.totals.collectionsPaise,
  );
  assert.equal(
    r.departments.reduce((s, d) => s + d.salesPaise, 0),
    r.totals.salesPaise,
  );
  assert.equal(
    r.departments.reduce((s, d) => s + d.collectionsPaise, 0),
    r.totals.collectionsPaise,
  );
  assert.equal(
    r.refunds.find((v) => v.credit.invoiceId === i.id)?.amountPaise,
    3000,
  );
  const response = await fetch(`${base}/api/staff/reports?format=csv`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /LOCAL_SIMULATED|MANUAL_RECORDED/);
});
test("Historical outstanding includes older charges and excludes later payments", async () => {
  const i = await db.invoice.create({
    data: {
      number: prefix + "-historical",
      originId: prefix + "-historical",
      userId: member.id,
      customerName: member.name,
      customerEmail: member.email,
      department: "COURT",
      subtotalPaise: 33300,
      totalPaise: 33300,
      issuedAt: new Date("2090-01-01T18:30:00Z"),
    },
  });
  invoices.push(i.id);
  const payment = await db.payment.create({
    data: {
      userId: member.id,
      method: "LOCAL",
      source: "LOCAL_SIMULATED",
      reference: prefix + "-historic-payment",
      amountPaise: 12000,
      receivedAt: new Date("2090-01-03T18:30:00Z"),
    },
  });
  await db.paymentAllocation.create({
    data: { invoiceId: i.id, paymentId: payment.id, amountPaise: 12000 },
  });
  const before = await financialReport(owner, {
    from: "2090-01-03",
    to: "2090-01-03",
  });
  assert.equal(
    before.outstanding.find((v) => v.id === i.id)?.outstandingPaise,
    33300,
  );
  assert(!before.sales.some((v) => v.id === i.id));
  const after = await financialReport(owner, {
    from: "2090-01-04",
    to: "2090-01-04",
  });
  assert.equal(
    after.outstanding.find((v) => v.id === i.id)?.outstandingPaise,
    21300,
  );
});
test("Cash opening races, linked receipts, payouts and explained closure are repeat-safe", async () => {
  const opened = await Promise.allSettled([
    mutate(cashier, { action: "cashOpen", openingPaise: 5000 }),
    mutate(cashier, { action: "cashOpen", openingPaise: 5000 }),
  ]);
  assert.equal(opened.filter((v) => v.status === "fulfilled").length, 1);
  const shift = await db.cashShift.findFirstOrThrow({
    where: { actorId: cashier.id, closedAt: null },
  });
  const i = await invoice(20000);
  await db.$transaction((tx) => payInvoice(tx, cashier, i.id, "CASH", 20000));
  assert.equal(
    (
      await db.payment.findFirstOrThrow({
        where: { allocations: { some: { invoiceId: i.id } } },
      })
    ).cashShiftId,
    shift.id,
  );
  await mutate(cashier, {
    action: "cashPayout",
    id: shift.id,
    amountPaise: 1000,
    reason: "Test supplies payout",
  });
  await assert.rejects(
    () =>
      mutate(other, {
        action: "cashClose",
        id: shift.id,
        countedPaise: 24000,
        reason: "Balanced",
      }),
    /permission|own shift/,
  );
  await assert.rejects(
    () =>
      mutate(cashier, {
        action: "cashClose",
        id: shift.id,
        countedPaise: 23900,
        reason: "",
      }),
    /Explain/,
  );
  const key = randomUUID(),
    input = {
      action: "cashClose",
      id: shift.id,
      countedPaise: 23900,
      reason: "Test rounding difference explained",
    } as const;
  const a = await mutate(cashier, input, key),
    b = await mutate(cashier, input, key);
  assert.deepEqual(a.data, b.data);
  assert.equal(b.replayed, true);
  const totals = await db.$transaction((tx) => cashTotals(tx, shift.id));
  assert.equal(totals.receiptsPaise, 20000);
  assert.equal(totals.payoutsPaise, 1000);
  await assert.rejects(
    () =>
      db.cashShift.update({
        where: { id: shift.id },
        data: { countedPaise: 24000 },
      }),
    /immutable/,
  );
});
test("Employee ownership, overlapping shifts, leave decisions and finalized payroll persist", async () => {
  await mutate(owner, {
    action: "employee",
    email: cashier.email,
    title: "Cashier",
    salaryPaise: 2500000,
    active: true,
  });
  const e = await db.employee.findUniqueOrThrow({
    where: { userId: cashier.id },
  });
  await mutate(owner, {
    action: "shift",
    employeeId: e.id,
    startsAt: "2090-02-01T00:30:00Z",
    endsAt: "2090-02-01T08:30:00Z",
  });
  await assert.rejects(() =>
    mutate(owner, {
      action: "shift",
      employeeId: e.id,
      startsAt: "2090-02-01T01:30:00Z",
      endsAt: "2090-02-01T09:30:00Z",
    }),
  );
  await assert.rejects(
    () =>
      mutate(other, {
        action: "leave",
        employeeId: e.id,
        startsAt: "2090-02-02T00:30:00Z",
        endsAt: "2090-02-03T00:30:00Z",
        reason: "Wrong employee test",
      }),
    /own leave/,
  );
  await mutate(cashier, {
    action: "leave",
    employeeId: e.id,
    startsAt: "2090-02-02T00:30:00Z",
    endsAt: "2090-02-03T00:30:00Z",
    reason: "Personal leave test",
  });
  const leave = await db.leaveRequest.findFirstOrThrow({
    where: { employeeId: e.id },
  });
  await mutate(owner, {
    action: "leaveDecision",
    id: leave.id,
    status: "APPROVED",
    reason: "Leave approved for test",
  });
  await assert.rejects(
    () =>
      mutate(owner, {
        action: "shift",
        employeeId: e.id,
        startsAt: "2090-02-02T01:30:00Z",
        endsAt: "2090-02-02T04:30:00Z",
      }),
    /approved leave/,
  );
  await mutate(owner, {
    action: "payslip",
    employeeId: e.id,
    period: "2090-02",
    adjustmentPaise: -10000,
    reason: "Final test salary adjustment",
  });
  const slip = await db.payslip.findFirstOrThrow({
    where: { employeeId: e.id },
  });
  const snapshot = slip.snapshot;
  await mutate(owner, {
    action: "employee",
    email: cashier.email,
    title: "Senior Cashier",
    salaryPaise: 3000000,
    active: true,
  });
  assert.deepEqual(
    (await db.payslip.findUniqueOrThrow({ where: { id: slip.id } })).snapshot,
    snapshot,
  );
  await assert.rejects(
    () => db.payslip.update({ where: { id: slip.id }, data: { snapshot: {} } }),
    /immutable/,
  );
  assert.equal((await hrData(other)).length, 0);
  assert.equal((await hrData(cashier)).length, 1);
});
test("Business quotes issue one immutable invoice under competing conversion requests", async () => {
  const result = await mutate(owner, {
    action: "quote",
    customerName: "Test business",
    customerEmail: owner.email,
    department: "COURT",
    validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
    lines: [
      { description: "Corporate court package", quantity: 3, unitPaise: 10000 },
    ],
  });
  const quote = result.data as { id: string };
  quotes.push(quote.id);
  const converted = await Promise.all([
    mutate(owner, { action: "quoteInvoice", id: quote.id }),
    mutate(owner, { action: "quoteInvoice", id: quote.id }),
  ]);
  assert.equal(
    (converted[0].data as { invoiceId: string }).invoiceId,
    (converted[1].data as { invoiceId: string }).invoiceId,
  );
  const inv = await db.invoice.findFirstOrThrow({
    where: { originId: "business:" + quote.id },
  });
  invoices.push(inv.id);
  assert.equal(inv.totalPaise, 30000);
  await assert.rejects(() =>
    db.invoice.update({ where: { id: inv.id }, data: { totalPaise: 20000 } }),
  );
});
test("Reminder scheduling is duplicate-safe, delivers to local inbox and renewal suppresses obsolete notices", async () => {
  const plan = await db.membershipPlan.findUniqueOrThrow({
    where: { id: "silver" },
  });
  const term = await db.membership.create({
    data: {
      userId: member.id,
      planId: plan.id,
      startsAt: new Date(Date.now() - 10 * 86400000),
      endsAt: new Date(Date.now() + 7 * 86400000),
      pricePaise: plan.pricePaise,
      planSnapshot: { name: "Silver" },
    },
  });
  await db.$transaction((tx) => scheduleReminders(tx, member.id));
  await db.$transaction((tx) => scheduleReminders(tx, member.id));
  const messages = await db.mailMessage.findMany({
    where: { membershipId: term.id },
  });
  assert.equal(messages.length, 3);
  const seven = await db.job.findUniqueOrThrow({
    where: { dedupeKey: `membership:${term.id}:7` },
  });
  await db.job.update({
    where: { id: seven.id },
    data: { runAt: new Date("1900-01-01") },
  });
  await processNextJob();
  assert.equal(
    (await db.mailMessage.findUniqueOrThrow({ where: { jobId: seven.id } }))
      .status,
    "DELIVERED",
  );
  await purchaseMembership(member.id, randomUUID(), {
    planId: "silver",
    action: "renew",
    acceptPolicy: true,
    planVersion: plan.updatedAt.toISOString(),
  });
  assert.equal(
    await db.mailMessage.count({
      where: { membershipId: term.id, status: "SUPPRESSED" },
    }),
    2,
  );
  assert.equal(
    await db.job.count({
      where: {
        dedupeKey: { startsWith: `membership:${term.id}:` },
        status: "CANCELLED",
      },
    }),
    2,
  );
  const delivered = await db.mailMessage.findUniqueOrThrow({
    where: { jobId: seven.id },
  });
  assert.match(delivered.body, /memberships/);
  assert.match(delivered.body, /Test Member/);
});
test("Unconfigured SMTP never claims delivery and owner retries failed mail visibly", async () => {
  const id = randomUUID();
  await db.job.create({
    data: {
      id,
      kind: "SEND_MAIL",
      dedupeKey: prefix + "-smtp",
      payload: {},
      runAt: new Date("1890-01-01"),
      attempts: 4,
    },
  });
  await db.mailMessage.create({
    data: {
      id,
      jobId: id,
      to: member.email,
      subject: "SMTP failure test",
      body: "No secrets",
      mode: "smtp",
    },
  });
  const previous = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    await processNextJob();
  } finally {
    if (previous !== undefined) process.env.SMTP_HOST = previous;
  }
  assert.equal(
    (await db.mailMessage.findUniqueOrThrow({ where: { id } })).status,
    "FAILED",
  );
  assert.equal(
    (await db.job.findUniqueOrThrow({ where: { id } })).status,
    "FAILED",
  );
  await mutate(owner, { action: "retryMail", id });
  assert.equal((await db.job.findUniqueOrThrow({ where: { id } })).attempts, 0);
});
test("Gateway signatures reject tampering and direct unverified allocations are forbidden", async () => {
  const secret = randomUUID(),
    body = "order_test|pay_test",
    signature = createHmac("sha256", secret).update(body).digest("hex");
  assert(validSignature(body, signature, secret));
  assert(!validSignature(body + "tamper", signature, secret));
  assert(!validSignature(body, "short", secret));
  const i = await invoice();
  await assert.rejects(
    () => db.$transaction((tx) => payInvoice(tx, member, i.id, "GATEWAY")),
    /server-verified/,
  );
});
test("Mock provider capture is amount-verified and competing retries allocate exactly once", async () => {
  const env = {
      PAYMENT_MODE: process.env.PAYMENT_MODE,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
    originalFetch = globalThis.fetch;
  const i = await invoice(14000);
  process.env.PAYMENT_MODE = "razorpay";
  process.env.RAZORPAY_KEY_ID = "test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook";
  const orderId = "order_" + randomUUID().replaceAll("-", "");
  const paymentId = "pay_" + randomUUID().replaceAll("-", "");
  let wrongAmount = true;
  globalThis.fetch = async (url) => {
    assert(String(url).startsWith("https://api.razorpay.com/v1/"));
    return Response.json(
      String(url).endsWith("orders")
        ? { id: orderId, amount: 14000, currency: "INR", status: "created" }
        : {
            id: paymentId,
            order_id: orderId,
            amount: wrongAmount ? 1 : 14000,
            currency: "INR",
            status: "captured",
          },
    );
  };
  try {
    assert(gatewayConfigured());
    const key = randomUUID(),
      input = { kind: "invoice", targetId: i.id } as const;
    const a = await createIntent(member, key, input),
      b = await createIntent(member, key, input);
    assert.equal(a.id, b.id);
    await assert.rejects(
      () => completeIntent(a.id, paymentId),
      /capture is not verified/,
    );
    wrongAmount = false;
    await Promise.all([
      completeIntent(a.id, paymentId),
      completeIntent(a.id, paymentId),
    ]);
    assert.equal(
      await db.paymentAllocation.count({ where: { invoiceId: i.id } }),
      1,
    );
    assert.equal(
      (await db.gatewayIntent.findUniqueOrThrow({ where: { id: a.id } })).state,
      "COMPLETE",
    );
    assert.equal(
      (
        await db.payment.findFirstOrThrow({
          where: { allocations: { some: { invoiceId: i.id } } },
        })
      ).source,
      "GATEWAY_VERIFIED",
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Connected enquiry → account → card → check-in → shop → kitchen → tab → report journey", async () => {
  const lead = await saveEnquiry({
    name: journey.name,
    email: journey.email,
    sport: "tennis",
    message: "Connected local journey enquiry",
    website: "",
  });
  await actLead(owner, randomUUID(), lead.id, { action: "convert" });
  assert.equal(
    (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).memberId,
    journey.id,
  );
  const plan = await db.membershipPlan.findUniqueOrThrow({
    where: { id: "silver" },
  });
  await purchaseMembership(journey.id, randomUUID(), {
    planId: "silver",
    action: "purchase",
    acceptPolicy: true,
    planVersion: plan.updatedAt.toISOString(),
  });
  assert(
    (await readCard(journey.id)) && !(await readCard(journey.id))?.revoked,
  );
  const lookup = await lookupMember(
    (await db.memberCard.findUniqueOrThrow({ where: { userId: journey.id } }))
      .token
      ? "champions:card:" +
          (
            await db.memberCard.findUniqueOrThrow({
              where: { userId: journey.id },
            })
          ).token
      : "",
  );
  assert.equal(lookup.id, journey.id);
  await db.court.create({
    data: {
      id: prefix + "-court",
      name: "Integration journey court",
      sportId: "tennis",
      hourlyPaise: 10000,
    },
  });
  const day = clubDay(new Date(Date.now() + 86400000));
  const b = await holdBooking(journey, randomUUID(), {
    courtId: prefix + "-court",
    day,
    hour: 10,
    trial: false,
  });
  const booking = b.data as unknown as {
    id: string;
    invoiceId: string;
    startsAt: string;
  };
  await actBooking(journey, randomUUID(), booking.id, {
    action: "confirm",
    method: "LOCAL",
    override: false,
  });
  await actBooking(
    owner,
    randomUUID(),
    booking.id,
    { action: "checkin", method: "LOCAL", override: false },
    new Date(booking.startsAt),
  );
  assert(
    (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } }))
      .checkedInAt,
  );
  await db.product.create({
    data: {
      id: prefix + "-product",
      name: "Journey bottle",
      category: "Accessories",
      sport: "all",
      description: "Test",
      image: "/images/products/bottle.svg",
    },
  });
  await db.productVariant.create({
    data: {
      id: prefix + "-variant",
      productId: prefix + "-product",
      sku: prefix,
      label: "Standard",
      pricePaise: 10000,
      stock: 2,
    },
  });
  const order = await holdOrder(journey, randomUUID(), {
    items: [{ variantId: prefix + "-variant", quantity: 1 }],
    delivery: false,
    channel: "ONLINE",
  });
  const o = order.data as { id: string; invoiceId: string };
  await actOrder(journey, randomUUID(), o.id, {
    action: "confirm",
    method: "LOCAL",
  });
  await actOrder(cashier, randomUUID(), o.id, {
    action: "collect",
    method: "LOCAL",
  });
  assert.equal(
    (
      await db.productVariant.findUniqueOrThrow({
        where: { id: prefix + "-variant" },
      })
    ).stock,
    1,
  );
  await db.diningTable.create({
    data: { id: prefix + "-table", name: prefix, capacity: 4 },
  });
  await db.menuItem.create({
    data: {
      id: prefix + "-menu",
      name: "Journey coffee",
      description: "Test",
      category: "Drinks",
      pricePaise: 10000,
    },
  });
  const opened = await openBill(cashier, randomUUID(), {
    tableId: prefix + "-table",
    userId: journey.id,
    ageConfirmed: false,
    items: [
      { menuId: prefix + "-menu", quantity: 1, note: "Journey item note" },
    ],
  });
  const bill = opened.data as { id: string };
  await actBill(cashier, randomUUID(), bill.id, { action: "tab" });
  for (const state of ["ACCEPTED", "COOKING", "READY", "SERVED"] as const) {
    const ticket = await db.kitchenTicket.findFirstOrThrow({
      where: { orderId: bill.id },
    });
    await prepareTicket(state === "SERVED" ? cashier : other, randomUUID(), {
      ticketId: ticket.id,
      version: ticket.version,
      state,
    });
  }
  await actBill(cashier, randomUUID(), bill.id, {
    action: "pay",
    method: "LOCAL",
  });
  await actBill(cashier, randomUUID(), bill.id, { action: "close" });
  const persisted = await db.kitchenOrder.findUniqueOrThrow({
    where: { id: bill.id },
  });
  assert.equal(persisted.status, "CLOSED");
  assert.equal(persisted.paymentStatus, "PAID");
  const ticket = await db.kitchenTicket.findFirstOrThrow({
    where: { orderId: bill.id },
  });
  const ids = [booking.invoiceId, o.invoiceId, ticket.invoiceId!];
  const report = await financialReport(owner, {
    from: clubDay(new Date()),
    to: clubDay(new Date()),
  });
  const charges = report.sales.filter((i) => ids.includes(i.id));
  const payments = report.payments
    .flatMap((p) => p.allocations)
    .filter((a) => ids.includes(a.invoiceId));
  assert.equal(charges.length, 3);
  assert.equal(
    charges.reduce((s, i) => s + i.totalPaise, 0),
    payments.reduce((s, a) => s + a.amountPaise, 0),
  );
  assert(!report.outstanding.some((i) => ids.includes(i.id)));
});

test("Captured stale checkout stays in collections and processed repayment is verified once", async () => {
  const env = {
      PAYMENT_MODE: process.env.PAYMENT_MODE,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
    originalFetch = globalThis.fetch;
  const i = await invoice(15000);
  process.env.PAYMENT_MODE = "razorpay";
  process.env.RAZORPAY_KEY_ID = "test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook";
  const orderId = "order_" + randomUUID().replaceAll("-", ""),
    paymentId = "pay_" + randomUUID().replaceAll("-", ""),
    refundId = "rfnd_" + randomUUID().replaceAll("-", "");
  let processed = false;
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).endsWith("orders")
        ? { id: orderId, amount: 15000, currency: "INR", status: "created" }
        : String(url).includes("refunds/")
          ? {
              id: refundId,
              payment_id: paymentId,
              amount: 15000,
              currency: "INR",
              status: processed ? "processed" : "pending",
            }
          : {
              id: paymentId,
              order_id: orderId,
              amount: 15000,
              currency: "INR",
              status: "captured",
            },
    );
  try {
    const intent = await createIntent(member, randomUUID(), {
      kind: "invoice",
      targetId: i.id,
    });
    await db.$transaction((tx) =>
      creditInvoice(
        tx,
        owner,
        i.id,
        15000,
        "Charge changed before capture",
        prefix + "-stale-capture",
      ),
    );
    assert.equal(
      (await completeIntent(intent.id, paymentId)).state,
      "NEEDS_REVIEW",
    );
    assert.equal(
      await db.payment.count({ where: { reference: "razorpay:" + paymentId } }),
      1,
    );
    const report = await financialReport(owner, {
      from: clubDay(new Date()),
      to: clubDay(new Date()),
    });
    assert(
      report.payments.some(
        (p) => p.reference === "razorpay:" + paymentId && !p.allocations.length,
      ),
    );
    await assert.rejects(
      () =>
        recordGatewayRepayment(owner, randomUUID(), {
          id: intent.id,
          refundId,
          reason: "Review full provider repayment",
        }),
      /processed full provider refund/,
    );
    processed = true;
    const key = randomUUID(),
      input = {
        id: intent.id,
        refundId,
        reason: "Verified processed provider repayment",
      };
    await recordGatewayRepayment(owner, key, input);
    await recordGatewayRepayment(owner, key, input);
    assert.equal(
      await db.gatewayRepayment.count({ where: { intentId: intent.id } }),
      1,
    );
    assert.equal((await completeIntent(intent.id, paymentId)).state, "REPAID");
    const after = await financialReport(owner, {
      from: clubDay(new Date()),
      to: clubDay(new Date()),
    });
    assert.equal(
      after.refunds.find((r) => r.reference === refundId)?.amountPaise,
      15000,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
