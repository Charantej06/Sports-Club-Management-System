import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
import {
  holdBooking,
  actBooking,
  createSocial,
  joinSocial,
  actSocial,
  joinWaiting,
  offerNext,
  expireBookingJob,
  expireSocialJob,
  addClosure,
  removeClosure,
} from "../../src/modules/bookings/service";
import {
  holdOrder,
  actOrder,
  expireOrderJob,
  correctStock,
} from "../../src/modules/shop/service";
import {
  openBill,
  actBill,
  prepareTicket,
} from "../../src/modules/clubhouse/service";
import { actLead, followupJob } from "../../src/modules/crm/service";
import { purchaseMembership } from "../../src/modules/membership/service";
import {
  operationsData,
  recordData,
  receiptData,
} from "../../src/modules/operations/queries";
import { type Actor, slot, clubDay } from "../../src/modules/operations/core";
const prefix = "ops-" + randomUUID(),
  base = process.env.TEST_BASE_URL || "http://localhost:3000";
const members: Actor[] = Array.from({ length: 10 }, (_, i) => ({
  id: `${prefix}-${i}`,
  name: `Operations Player ${i} (${prefix})`,
  email: `${prefix}-${i}@example.test`,
  role: "MEMBER",
}));
const owner: Actor = {
  id: prefix + "-owner",
  name: "Operations Owner",
  email: prefix + "-owner@example.test",
  role: "OWNER",
};
const kitchen: Actor = {
  id: prefix + "-kitchen",
  name: "Operations Kitchen",
  email: prefix + "-kitchen@example.test",
  role: "KITCHEN",
};
const courtIds = Array.from({ length: 6 }, (_, i) => `${prefix}-court-${i}`),
  variantId = prefix + "-variant",
  tableId = prefix + "-table";
const day = new Date(+new Date(clubDay(new Date())) + 3 * 86400000)
  .toISOString()
  .slice(0, 10);
let friday = new Date(day);
while (friday.getUTCDay() !== 5) friday = new Date(+friday + 86400000);
const fridayDay = friday.toISOString().slice(0, 10);
const booking = (courtId: string, hour: number, d = day) => ({
  courtId,
  day: d,
  hour,
  trial: false,
});
const bookAction = (action: "confirm" | "cancel" | "checkin", extra = {}) => ({
  action,
  method: "LOCAL" as const,
  override: false,
  ...extra,
});
const orderInput = (channel: "ONLINE" | "COUNTER" = "ONLINE", extra = {}) => ({
  items: [{ variantId, quantity: 1 }],
  delivery: false,
  channel,
  ...extra,
});
const orderAction = (
  action: "confirm" | "cancel" | "collect" | "return" | "dispatch" | "deliver",
  extra = {},
) => ({ action, method: "LOCAL" as const, ...extra });
let cookie = "",
  otherCookie = "";
let leadId = "",
  convertedId = "";
const invoiceIds = new Set<string>();
const resourceIds = new Set<string>();
before(async () => {
  const password = await hashPassword("Operations2026!");
  for (const actor of [...members, owner, kitchen]) {
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
        userId: actor.id,
        accountId: actor.id,
        providerId: "credential",
        password,
      },
    });
  }
  for (const id of courtIds)
    await db.court.create({
      data: { id, name: id, sportId: "tennis", hourlyPaise: 80000 },
    });
  await db.product.create({
    data: {
      id: prefix,
      name: "Competition test ball",
      category: "Balls",
      sport: "tennis",
      description: "Isolated integration fixture",
      image: "/images/product-tennis.svg",
      variants: {
        create: {
          id: variantId,
          sku: variantId,
          label: "Pack",
          stock: 1,
          pricePaise: 999,
        },
      },
    },
  });
  await db.diningTable.create({
    data: { id: tableId, name: tableId, capacity: 4 },
  });
  for (const [index, actor] of members.slice(0, 2).entries()) {
    const r = await fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: actor.email, password: "Operations2026!" }),
    });
    assert.equal(r.status, 200, await r.clone().text());
    const c = r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    if (index === 0) cookie = c;
    else otherCookie = c;
  }
});
after(async () => {
  const actorIds = [...members, owner, kitchen].map((a) => a.id);
  if (convertedId) actorIds.push(convertedId);
  await db.$transaction(
    async (tx) => {
      const orders = await tx.shopOrder.findMany({
        where: { orderLines: { some: { variantId } } },
        select: { id: true, invoiceId: true },
      });
      const bills = await tx.kitchenOrder.findMany({
        where: { tableId },
        include: { tickets: true },
      });
      const reservations = await tx.reservation.findMany({
        where: { courtId: { in: courtIds } },
        select: { id: true, invoiceId: true },
      });
      const events = await tx.socialEvent.findMany({
        where: { reservationId: { in: reservations.map((r) => r.id) } },
        include: { participants: true },
      });
      for (const o of orders) if (o.invoiceId) invoiceIds.add(o.invoiceId);
      for (const b of bills)
        for (const t of b.tickets) if (t.invoiceId) invoiceIds.add(t.invoiceId);
      for (const r of reservations)
        if (r.invoiceId) invoiceIds.add(r.invoiceId);
      for (const e of events)
        for (const p of e.participants)
          if (p.invoiceId) invoiceIds.add(p.invoiceId);
      const invoices = await tx.invoice.findMany({
        where: {
          OR: [{ userId: { in: actorIds } }, { id: { in: [...invoiceIds] } }],
        },
        select: { id: true },
      });
      const ids = invoices.map((i) => i.id);
      const allocations = await tx.paymentAllocation.findMany({
        where: { invoiceId: { in: ids } },
      });
      const paymentIds = allocations.map((a) => a.paymentId);
      for (const x of [
        ...orders,
        ...bills,
        ...reservations,
        ...events,
        ...events.flatMap((e) => e.participants),
      ])
        resourceIds.add(x.id);
      await tx.refund.deleteMany({
        where: { credit: { invoiceId: { in: ids } } },
      });
      await tx.credit.deleteMany({ where: { invoiceId: { in: ids } } });
      await tx.paymentAllocation.deleteMany({
        where: { invoiceId: { in: ids } },
      });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
      await tx.invoice.deleteMany({ where: { id: { in: ids } } });
      await tx.payment.deleteMany({
        where: {
          OR: [{ userId: { in: actorIds } }, { id: { in: paymentIds } }],
        },
      });
      await tx.kitchenLine.deleteMany({
        where: { ticket: { order: { tableId } } },
      });
      await tx.kitchenTicket.deleteMany({ where: { order: { tableId } } });
      await tx.kitchenOrder.deleteMany({ where: { tableId } });
      await tx.diningTable.delete({ where: { id: tableId } });
      await tx.shopOrderLine.deleteMany({
        where: { orderId: { in: orders.map((o) => o.id) } },
      });
      await tx.shopOrder.deleteMany({
        where: { id: { in: orders.map((o) => o.id) } },
      });
      await tx.stockMovement.deleteMany({ where: { variantId } });
      await tx.productVariant.delete({ where: { id: variantId } });
      await tx.product.delete({ where: { id: prefix } });
      await tx.waitlistEntry.deleteMany({
        where: { userId: { in: actorIds } },
      });
      await tx.socialParticipant.deleteMany({
        where: { eventId: { in: events.map((e) => e.id) } },
      });
      await tx.socialEvent.deleteMany({
        where: { id: { in: events.map((e) => e.id) } },
      });
      await tx.reservation.deleteMany({ where: { courtId: { in: courtIds } } });
      await tx.courtClosure.deleteMany({
        where: { courtId: { in: courtIds } },
      });
      await tx.court.deleteMany({ where: { id: { in: courtIds } } });
      await tx.leadQuote.deleteMany({ where: { leadId } });
      await tx.leadActivity.deleteMany({ where: { leadId } });
      if (leadId) await tx.lead.delete({ where: { id: leadId } });
      await tx.memberCard.deleteMany({ where: { userId: { in: actorIds } } });
      await tx.membership.deleteMany({ where: { userId: { in: actorIds } } });
      await tx.checkout.deleteMany({ where: { userId: { in: actorIds } } });
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: actorIds } },
            { entityId: { in: [...resourceIds] } },
          ],
        },
      });
      await tx.user.deleteMany({ where: { id: { in: actorIds } } });
    },
    { timeout: 30000 },
  );
  await db.staffNotification.deleteMany({
    where: {
      OR: [
        { entityId: leadId },
        { message: { contains: prefix } },
        { dedupeKey: { contains: prefix } },
      ],
    },
  });
  if (convertedId) {
    const messages = await db.mailMessage.findMany({
      where: { to: prefix + "-lead@example.test" },
    });
    await db.mailMessage.deleteMany({
      where: { id: { in: messages.map((m) => m.id) } },
    });
    await db.job.deleteMany({
      where: { id: { in: messages.map((m) => m.jobId) } },
    });
  }
  const jobs = await db.job.findMany({
    where: {
      kind: {
        in: [
          "EXPIRE_BOOKING",
          "EXPIRE_SOCIAL",
          "EXPIRE_SHOP",
          "OFFER_WAITLIST",
          "LEAD_FOLLOWUP",
        ],
      },
    },
  });
  await db.job.deleteMany({
    where: {
      id: {
        in: jobs
          .filter(
            (j) =>
              JSON.stringify(j.payload).includes(prefix) ||
              (!!leadId && JSON.stringify(j.payload).includes(leadId)) ||
              [...invoiceIds, ...resourceIds].some((id) =>
                JSON.stringify(j.payload).includes(id),
              ),
          )
          .map((j) => j.id),
      },
    },
  });
  await db.$disconnect();
});
test("1. Concurrent customers race the same court; exactly one succeeds and direct overlap is rejected", async () => {
  const results = await Promise.allSettled([
    holdBooking(members[0], randomUUID(), booking(courtIds[0], 10)),
    holdBooking(members[1], randomUUID(), booking(courtIds[0], 10)),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(
    db.reservation.create({
      data: {
        userId: members[2].id,
        courtId: courtIds[0],
        startsAt: slot(day, 10),
        endsAt: slot(day, 11),
        clubDay: new Date(day),
        status: "CONFIRMED",
        pricePaise: 80000,
      },
    }),
  );
});
test("2. Concurrent sessions enforce the daily quota in service and direct PostgreSQL writes", async () => {
  const results = await Promise.allSettled(
    [0, 1, 2, 3].map((i) =>
      holdBooking(members[3], randomUUID(), booking(courtIds[i], 12 + i)),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  const direct = await Promise.allSettled(
    [0, 1, 2].map((i) =>
      db.reservation.create({
        data: {
          userId: members[4].id,
          courtId: courtIds[i],
          startsAt: slot(day, 18 + i),
          endsAt: slot(day, 19 + i),
          clubDay: new Date(day),
          status: "CONFIRMED",
          pricePaise: 80000,
        },
      }),
    ),
  );
  assert.equal(direct.filter((r) => r.status === "fulfilled").length, 2);
});
test("3. Final social place is atomic; duplicate entry and combined daily quota fail", async () => {
  const event = (
    await createSocial(owner, randomUUID(), {
      ...booking(courtIds[4], 14, fridayDay),
      capacity: 2,
      title: "Integration Friday",
    })
  ).data;
  const place = (await joinSocial(members[5], randomUUID(), event.id)).data;
  const result = await Promise.allSettled([
    joinSocial(members[6], randomUUID(), event.id),
    joinSocial(members[7], randomUUID(), event.id),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await db.socialParticipant.count({
      where: { eventId: event.id, status: "HOLD" },
    }),
    2,
  );
  await assert.rejects(joinSocial(members[5], randomUUID(), event.id));
  await holdBooking(
    members[5],
    randomUUID(),
    booking(courtIds[5], 16, fridayDay),
  );
  await assert.rejects(
    holdBooking(members[5], randomUUID(), booking(courtIds[5], 17, fridayDay)),
    /two|2 sessions|at most 2/i,
  );
  await actSocial(members[5], randomUUID(), event.id, {
    action: "confirm",
    method: "LOCAL",
    override: false,
  });
  await actSocial(
    owner,
    randomUUID(),
    event.id,
    {
      action: "checkin",
      participantId: place.id,
      method: "LOCAL",
      override: false,
    },
    new Date(+slot(fridayDay, 14) - 600000),
  );
  await assert.rejects(
    actSocial(
      owner,
      randomUUID(),
      event.id,
      {
        action: "checkin",
        participantId: place.id,
        method: "LOCAL",
        override: false,
      },
      slot(fridayDay, 14),
    ),
  );
  await actSocial(owner, randomUUID(), event.id, {
    action: "cancel",
    participantId: place.id,
    method: "LOCAL",
    override: true,
    reason: "Reception social cancellation",
  });
  assert.equal(
    await db.refund.count({
      where: { credit: { invoiceId: place.invoiceId! } },
    }),
    1,
  );
});
test("4. Online and counter buyers compete for final SKU; insufficient stock rolls back checkout", async () => {
  const results = await Promise.allSettled([
    holdOrder(members[0], randomUUID(), orderInput()),
    holdOrder(
      owner,
      randomUUID(),
      orderInput("COUNTER", { guestName: "Counter Guest" }),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
      .reserved,
    1,
  );
  await assert.rejects(holdOrder(members[1], randomUUID(), orderInput()));
  const o = await db.shopOrder.findFirstOrThrow({
    where: { orderLines: { some: { variantId } }, status: "HOLD" },
  });
  await actOrder(
    o.userId ? members[0] : owner,
    randomUUID(),
    o.id,
    orderAction("cancel", { reason: "Release race fixture" }),
  );
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
      .reserved,
    0,
  );
});
test("5. Identical simultaneous checkout retries create one operation; changed payload is rejected", async () => {
  const key = randomUUID(),
    input = orderInput();
  const result = await Promise.all([
    holdOrder(members[1], key, input),
    holdOrder(members[1], key, input),
    holdOrder(members[1], key, input),
  ]);
  assert.equal(new Set(result.map((r) => r.data.id)).size, 1);
  assert.equal(result.filter((r) => r.replayed).length, 2);
  await assert.rejects(
    holdOrder(members[1], key, {
      ...input,
      delivery: true,
      address: {
        line: "123 Sample Road",
        city: "Bengaluru",
        postcode: "560001",
        phone: "9876543210",
      },
    }),
    /key/i,
  );
});
test("6. Cross-account reads, mutations and invoice access are denied through HTTP and services", async () => {
  const o = await db.shopOrder.findFirstOrThrow({
    where: { userId: members[1].id, status: "HOLD" },
  });
  await assert.rejects(recordData(members[0], "order", o.id));
  await assert.rejects(receiptData(members[0], o.invoiceId!));
  await assert.rejects(
    actOrder(
      members[0],
      randomUUID(),
      o.id,
      orderAction("cancel", { reason: "Ownership denial" }),
    ),
  );
  assert.equal(
    (
      await fetch(`${base}/api/operations/order/${o.id}`, {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${base}/api/operations/order/${o.id}`, {
        headers: { Cookie: otherCookie },
      })
    ).status,
    200,
  );
  for (const a of [
    "reception",
    "crm",
    "inventory",
    "pos",
    "kitchen",
    "billing",
  ])
    assert.equal(
      (
        await fetch(`${base}/api/operations/${a}`, {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
  assert.equal((await fetch(`${base}/api/operations/history`)).status, 401);
});
test("7. Expiry, cancellations, returns and refunds adjust stock and charges once", async () => {
  const held = await db.shopOrder.findFirstOrThrow({
    where: { userId: members[1].id, status: "HOLD" },
  });
  const afterExpiry = new Date(+held.holdUntil! + 1000);
  await expireOrderJob(held.id, afterExpiry);
  await expireOrderJob(held.id, afterExpiry);
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
      .reserved,
    0,
  );
  assert.equal(
    await db.credit.count({ where: { invoiceId: held.invoiceId! } }),
    1,
  );
  const o = (await holdOrder(members[0], randomUUID(), orderInput())).data;
  await actOrder(members[0], randomUUID(), o.id, orderAction("confirm"));
  await actOrder(owner, randomUUID(), o.id, orderAction("collect"));
  const key = randomUUID(),
    r = orderAction("return", {
      reason: "Unopened returned item",
      returns: [{ variantId, quantity: 1, restock: true }],
    });
  await actOrder(owner, key, o.id, r);
  await actOrder(owner, key, o.id, r);
  await assert.rejects(actOrder(owner, randomUUID(), o.id, r));
  const v = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
  });
  assert.equal(v.stock, 1);
  assert.equal(v.reserved, 0);
  assert.equal(
    await db.refund.count({ where: { credit: { invoiceId: o.invoiceId! } } }),
    1,
  );
  const booked = (
    await holdBooking(members[8], randomUUID(), booking(courtIds[5], 9))
  ).data;
  await expireBookingJob(
    booked.id,
    new Date(+new Date(booked.holdUntil!) + 1000),
  );
  await expireBookingJob(
    booked.id,
    new Date(+new Date(booked.holdUntil!) + 1000),
  );
  assert.equal(
    await db.credit.count({ where: { invoiceId: booked.invoiceId! } }),
    1,
  );
  const next = (
    await holdBooking(members[8], randomUUID(), booking(courtIds[5], 9))
  ).data;
  await actBooking(members[8], randomUUID(), next.id, bookAction("confirm"));
  await actBooking(
    members[8],
    randomUUID(),
    next.id,
    bookAction("cancel", { reason: "Changed game schedule" }),
  );
  await actBooking(
    members[8],
    randomUUID(),
    next.id,
    bookAction("cancel", { reason: "Changed game schedule" }),
  );
  assert.equal(
    await db.refund.count({
      where: { credit: { invoiceId: next.invoiceId! } },
    }),
    1,
  );
});
test("8. POS, kitchen, customer history and billing persist consistent independent states", async () => {
  const menu = await db.menuItem.findFirstOrThrow({
    where: { available: true, category: { not: "Bar" } },
  });
  const bill = (
    await openBill(owner, randomUUID(), {
      tableId,
      userId: members[9].id,
      ageConfirmed: false,
      items: [
        { menuId: menu.id, quantity: 2, note: "No chilli, allergy note" },
      ],
    })
  ).data;
  const first = bill.tickets[0];
  await actBill(owner, randomUUID(), bill.id, {
    action: "pay",
    method: "CASH",
    amountPaise: 100,
  });
  assert.equal(
    (await db.kitchenOrder.findUniqueOrThrow({ where: { id: bill.id } }))
      .paymentStatus,
    "PARTIAL",
  );
  assert.equal(
    (await db.kitchenTicket.findUniqueOrThrow({ where: { id: first.id } }))
      .preparation,
    "INCOMING",
  );
  await prepareTicket(kitchen, randomUUID(), {
    ticketId: first.id,
    version: 1,
    state: "ACCEPTED",
  });
  const line = await db.kitchenLine.findFirstOrThrow({
    where: { ticketId: first.id },
  });
  await actBill(owner, randomUUID(), bill.id, {
    action: "cancelItem",
    lineId: line.id,
    reason: "Customer amended order",
  });
  await assert.rejects(
    prepareTicket(kitchen, randomUUID(), {
      ticketId: first.id,
      version: 2,
      state: "COOKING",
    }),
    /amended|refresh/i,
  );
  await actBill(owner, randomUUID(), bill.id, {
    action: "add",
    items: [{ menuId: menu.id, quantity: 1, note: "Second order" }],
  });
  const amended = await db.kitchenOrder.findUniqueOrThrow({
    where: { id: bill.id },
    include: {
      tickets: { include: { lines: true }, orderBy: { revision: "asc" } },
    },
  });
  assert.equal(amended.tickets.length, 2);
  const second = amended.tickets[1];
  for (const [n, state] of ["ACCEPTED", "COOKING", "READY"].entries())
    await prepareTicket(kitchen, randomUUID(), {
      ticketId: second.id,
      version: n + 1,
      state: state as "ACCEPTED" | "COOKING" | "READY",
    });
  await prepareTicket(owner, randomUUID(), {
    ticketId: second.id,
    version: 4,
    state: "SERVED",
  });
  await actBill(owner, randomUUID(), bill.id, { action: "pay", method: "UPI" });
  await actBill(owner, randomUUID(), bill.id, { action: "close" });
  const history = (await operationsData(members[9], "history")) as {
    bills: {
      id: string;
      paymentStatus: string;
      tickets: { lines: { note: string }[] }[];
    }[];
  };
  assert.equal(
    history.bills.find((b) => b.id === bill.id)?.paymentStatus,
    "PAID",
  );
  assert.ok(
    history.bills.some((b) =>
      b.tickets.some((t) => t.lines.some((l) => l.note === "Second order")),
    ),
  );
  const receipt = await receiptData(members[9], second.invoiceId!);
  assert.equal(receipt.allocations[0].payment.source, "MANUAL_RECORDED");
  assert.equal(receipt.allocations[0].payment.method, "UPI");
  await assert.rejects(recordData(members[0], "bill", bill.id));
  const refund = await db.refund.findFirstOrThrow({
    where: { credit: { invoiceId: first.invoiceId! } },
  });
  assert.equal(refund.status, "PENDING");
});
test("Waiting-list offers recover FIFO after expiry; offers count quota and are accepted via checkout", async () => {
  const held = (
    await holdBooking(members[0], randomUUID(), booking(courtIds[4], 8))
  ).data;
  const first = (
    await joinWaiting(members[1], randomUUID(), { ...booking(courtIds[4], 8) })
  ).data;
  const second = (
    await joinWaiting(members[2], randomUUID(), { ...booking(courtIds[4], 8) })
  ).data;
  await actBooking(
    members[0],
    randomUUID(),
    held.id,
    bookAction("cancel", { reason: "Waiting-list fixture" }),
  );
  await offerNext(courtIds[4], slot(day, 8));
  const offered = await db.waitlistEntry.findUniqueOrThrow({
    where: { id: first.id },
  });
  assert.equal(offered.status, "OFFERED");
  await expireBookingJob(
    offered.reservationId!,
    new Date(+offered.offerUntil! + 1),
  );
  await offerNext(
    courtIds[4],
    slot(day, 8),
    undefined,
    new Date(+offered.offerUntil! + 1),
  );
  const recovered = await db.waitlistEntry.findUniqueOrThrow({
    where: { id: second.id },
  });
  assert.equal(recovered.status, "OFFERED");
  await actBooking(
    members[2],
    randomUUID(),
    recovered.reservationId!,
    bookAction("confirm"),
  );
  assert.equal(
    (await db.waitlistEntry.findUniqueOrThrow({ where: { id: second.id } }))
      .status,
    "ACCEPTED",
  );
});
test("Closures block direct writes and service bookings; reopening restores alternatives", async () => {
  const c = (
    await addClosure(owner, randomUUID(), {
      courtId: courtIds[4],
      startsAt: slot(day, 21).toISOString(),
      endsAt: slot(day, 22).toISOString(),
      reason: "Surface maintenance",
    })
  ).data;
  await assert.rejects(
    holdBooking(members[2], randomUUID(), booking(courtIds[4], 21)),
    /closed/i,
  );
  await assert.rejects(
    db.reservation.create({
      data: {
        userId: members[2].id,
        courtId: courtIds[4],
        startsAt: slot(day, 21),
        endsAt: slot(day, 22),
        clubDay: new Date(day),
        status: "CONFIRMED",
        pricePaise: 80000,
      },
    }),
  );
  await removeClosure(owner, randomUUID(), c.id, "Maintenance completed");
  await holdBooking(members[2], randomUUID(), booking(courtIds[4], 21));
});
test("Social waiting-list capacity recovers once after expiry", async () => {
  const event = (
    await createSocial(owner, randomUUID(), {
      ...booking(courtIds[3], 7, fridayDay),
      capacity: 2,
      title: "Waiting Social",
    })
  ).data;
  const a = (await joinSocial(members[0], randomUUID(), event.id)).data;
  await joinSocial(members[1], randomUUID(), event.id);
  await assert.rejects(joinWaiting(members[1], randomUUID(), {
    ...booking(courtIds[3], 7, fridayDay), eventId: event.id,
  }), /already have a place/i);
  const w = (
    await joinWaiting(members[2], randomUUID(), {
      ...booking(courtIds[3], 7, fridayDay),
      eventId: event.id,
    })
  ).data;
  await expireSocialJob(
    a.id,
    a.invoiceId!,
    new Date(+new Date(a.holdUntil!) + 1),
  );
  await offerNext(courtIds[3], slot(fridayDay, 7), event.id);
  assert.equal(
    (await db.waitlistEntry.findUniqueOrThrow({ where: { id: w.id } })).status,
    "OFFERED",
  );
  assert.ok(
    (await db.socialParticipant.count({
      where: { eventId: event.id, status: { in: ["HOLD", "CONFIRMED"] } },
    })) <= 2,
  );
});
test("CRM assignment, follow-up, price snapshots, conversion and reception membership persist", async () => {
  const lead = await db.lead.create({
    data: {
      name: "Lead Operations",
      email: prefix + "-lead@example.test",
      message: "Interested in membership and tennis",
    },
  });
  leadId = lead.id;
  await actLead(owner, randomUUID(), lead.id, {
    action: "assign",
    staffId: owner.id,
  });
  await actLead(owner, randomUUID(), lead.id, {
    action: "note",
    note: "Customer requested a club tour",
  });
  await actLead(owner, randomUUID(), lead.id, {
    action: "quote",
    planId: "silver",
  });
  const at = new Date(Date.now() + 60000).toISOString();
  await actLead(owner, randomUUID(), lead.id, {
    action: "followup",
    at,
    note: "Call tomorrow",
  });
  await followupJob(lead.id, at);
  await followupJob(lead.id, at);
  assert.equal(
    await db.staffNotification.count({
      where: { dedupeKey: `followup:${lead.id}:${at}` },
    }),
    1,
  );
  const converted = (
    await actLead(owner, randomUUID(), lead.id, { action: "convert" })
  ).data;
  convertedId = converted.memberId!;
  assert.ok(convertedId);
  await actLead(owner, randomUUID(), lead.id, { action: "convert" });
  const plan = await db.membershipPlan.findUniqueOrThrow({
    where: { id: "silver" },
  });
  const m = await purchaseMembership(
    convertedId,
    randomUUID(),
    {
      planId: "silver",
      planVersion: plan.updatedAt.toISOString(),
      action: "purchase",
      acceptPolicy: true,
    },
    new Date(),
    { actor: owner, method: "CARD" },
  );
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: m.invoiceId },
    include: { allocations: { include: { payment: true } } },
  });
  assert.equal(invoice.allocations[0].payment.source, "MANUAL_RECORDED");
  assert.equal(
    (
      await db.lead.findUniqueOrThrow({
        where: { id: lead.id },
        include: { quotes: true },
      })
    ).quotes[0].totalPaise,
    plan.pricePaise,
  );
});
test("Member benefits apply to historical shop and POS snapshots, with guarded tabs and stock corrections", async () => {
  const plan = await db.membershipPlan.findUniqueOrThrow({
    where: { id: "silver" },
  });
  await purchaseMembership(members[8].id, randomUUID(), {
    planId: "silver",
    planVersion: plan.updatedAt.toISOString(),
    action: "purchase",
    acceptPolicy: true,
  });
  const order = (await holdOrder(members[8], randomUUID(), orderInput())).data;
  assert.equal(order.totalPaise, 949);
  await actOrder(members[8], randomUUID(), order.id, orderAction("confirm"));
  await actOrder(
    members[8],
    randomUUID(),
    order.id,
    orderAction("cancel", { reason: "Benefits cancellation" }),
  );
  const menu = await db.menuItem.findFirstOrThrow({
    where: { available: true, category: { not: "Bar" } },
  });
  const bill = (
    await openBill(owner, randomUUID(), {
      tableId,
      userId: members[8].id,
      ageConfirmed: false,
      items: [{ menuId: menu.id, quantity: 1, note: "Membership benefits" }],
    })
  ).data;
  assert.equal(
    (
      await db.kitchenLine.findFirstOrThrow({
        where: { ticketId: bill.tickets[0].id },
      })
    ).discountPaise,
    Math.floor((menu.pricePaise * plan.foodDiscountBps + 5000) / 10000),
  );
  await actBill(owner, randomUUID(), bill.id, { action: "tab" });
  await assert.rejects(
    actBill(owner, randomUUID(), bill.id, {
      action: "add",
      items: [{ menuId: menu.id, quantity: 30, note: "Limit test" }],
    }),
    /limit/i,
  );
  assert.throws(() =>
    correctStock(members[0], randomUUID(), {
      variantId,
      delta: 1,
      reason: "Unauthorized correction",
    }),
  );
  await correctStock(owner, randomUUID(), {
    variantId,
    delta: 2,
    reason: "Stock arrival reference",
  });
});
test("Delivery fulfillment and partial returns preserve historical line prices and exact final credit", async () => {
  const o = (
    await holdOrder(members[0], randomUUID(), {
      ...orderInput(),
      items: [{ variantId, quantity: 2 }],
      delivery: true,
      address: {
        line: "123 Sample Road",
        city: "Bengaluru",
        postcode: "560001",
        phone: "9876543210",
      },
    })
  ).data;
  await actOrder(members[0], randomUUID(), o.id, orderAction("confirm"));
  await actOrder(
    owner,
    randomUUID(),
    o.id,
    orderAction("dispatch", { tracking: "TEST-COURIER-123" }),
  );
  await assert.rejects(
    actOrder(
      owner,
      randomUUID(),
      o.id,
      orderAction("dispatch", { tracking: "TEST-COURIER-123" }),
    ),
  );
  await actOrder(owner, randomUUID(), o.id, orderAction("deliver"));
  await actOrder(
    owner,
    randomUUID(),
    o.id,
    orderAction("return", {
      reason: "One unopened pack",
      returns: [{ variantId, quantity: 1, restock: true }],
    }),
  );
  assert.equal(
    (await db.shopOrder.findUniqueOrThrow({ where: { id: o.id } })).status,
    "PART_RETURNED",
  );
  await actOrder(
    owner,
    randomUUID(),
    o.id,
    orderAction("return", {
      reason: "Second unopened pack",
      returns: [{ variantId, quantity: 1, restock: false }],
    }),
  );
  const receipt = await receiptData(members[0], o.invoiceId!);
  assert.equal(
    receipt.credits.reduce((s, c) => s + c.amountPaise, 0),
    1998,
  );
  assert.equal(
    receipt.lines.find((l) => l.description === "Delivery")?.totalPaise,
    10000,
  );
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
      .stock,
    2,
  );
});
test("Direct social-place writes enforce final capacity; check-in is single-use", async () => {
  const e = (
    await createSocial(owner, randomUUID(), {
      ...booking(courtIds[2], 9, fridayDay),
      capacity: 2,
      title: "Direct capacity",
    })
  ).data;
  await db.socialParticipant.create({
    data: {
      eventId: e.id,
      userId: members[8].id,
      status: "CONFIRMED",
      pricePaise: 30000,
    },
  });
  const result = await Promise.allSettled(
    [members[3], members[4]].map((m) =>
      db.socialParticipant.create({
        data: {
          eventId: e.id,
          userId: m.id,
          status: "CONFIRMED",
          pricePaise: 30000,
        },
      }),
    ),
  );
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const b = (
    await holdBooking(
      members[9],
      randomUUID(),
      booking(courtIds[0], 8, fridayDay),
    )
  ).data;
  await actBooking(members[9], randomUUID(), b.id, bookAction("confirm"));
  await actBooking(
    owner,
    randomUUID(),
    b.id,
    bookAction("checkin"),
    new Date(+slot(fridayDay, 8) - 600000),
  );
  await assert.rejects(
    actBooking(
      owner,
      randomUUID(),
      b.id,
      bookAction("checkin"),
      slot(fridayDay, 8),
    ),
    /already|confirmed/i,
  );
});
test("Invoice snapshots and ledger amounts are protected against direct mutation", async () => {
  const invoice = await db.invoice.findFirstOrThrow({
    where: { userId: members[8].id, department: "MEMBERSHIP" },
    include: { lines: true },
  });
  await assert.rejects(
    db.invoice.update({ where: { id: invoice.id }, data: { totalPaise: 1 } }),
  );
  await assert.rejects(
    db.invoiceLine.update({
      where: { id: invoice.lines[0].id },
      data: { description: "Tampered historical price" },
    }),
  );
  await assert.rejects(
    db.credit.create({
      data: {
        invoiceId: invoice.id,
        amountPaise: invoice.totalPaise + 1,
        actorId: owner.id,
        reason: "Excess credit",
      },
    }),
  );
});
test("Concurrent final checkout retries allocate one payment and cancellation refunds it once", async () => {
  await correctStock(owner, randomUUID(), {
    variantId, delta: 1, reason: "Checkout replay fixture stock",
  });
  const order = (await holdOrder(members[9], randomUUID(), orderInput())).data;
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 3 }, () =>
    actOrder(members[9], key, order.id, orderAction("confirm"))));
  assert.equal(results.filter(r => r.replayed).length, 2);
  assert.equal(await db.paymentAllocation.count({ where: { invoiceId: order.invoiceId! } }), 1);
  await actOrder(members[9], randomUUID(), order.id, orderAction("cancel", { reason: "Replay checkout cancellation" }));
  await actOrder(members[9], randomUUID(), order.id, orderAction("cancel", { reason: "Replay checkout cancellation" }));
  assert.equal(await db.refund.count({ where: { credit: { invoiceId: order.invoiceId! } } }), 1);
});
