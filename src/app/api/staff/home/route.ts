import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { db } from "@/lib/db";
import { clubDay, slot } from "@/modules/operations/core";
export const GET = route(async (request) => {
  const user = await requireUser(request, [
    "OWNER",
    "RECEPTION",
    "CASHIER",
    "KITCHEN",
  ]);
  const now = new Date(),
    start = slot(clubDay(now), 0),
    end = new Date(+start + 86400000);
  const cards: { label: string; count: number; tab: string }[] = [];
  if (["OWNER", "RECEPTION"].includes(user.role)) {
    const [arrivals, checkedIn, followups, courts] = await Promise.all([
      db.reservation.count({
        where: {
          startsAt: { gte: start, lt: end },
          status: "CONFIRMED",
          kind: "STANDARD",
          checkedInAt: null,
        },
      }),
      db.reservation.count({
        where: {
          startsAt: { gte: start, lt: end },
          checkedInAt: { not: null },
        },
      }),
      db.lead.count({
        where: {
          OR: [
            { status: "NEW" },
            { status: { not: "CONVERTED" }, followUpAt: { lte: now } },
          ],
        },
      }),
      db.court.count({ where: { active: true } }),
    ]);
    cards.push(
      {
        label: "Today's arrivals to check in",
        count: arrivals,
        tab: "reception",
      },
      {
        label: "Today's checked-in bookings",
        count: checkedIn,
        tab: "reception",
      },
      { label: "New / due enquiries", count: followups, tab: "crm" },
      { label: "Active courts & slots", count: courts, tab: "courts" },
    );
  }
  if (["OWNER", "CASHIER"].includes(user.role)) {
    const [ready, collections, variants, invoices] = await Promise.all([
      db.kitchenTicket.count({
        where: { preparation: "READY", order: { status: "OPEN" } },
      }),
      db.shopOrder.count({ where: { status: "PAID", delivery: false } }),
      db.productVariant.findMany({
        where: { product: { active: true } },
        select: { stock: true, reserved: true },
      }),
      db.invoice.findMany({
        where: { department: "CLUBHOUSE" },
        include: { allocations: true, credits: true },
      }),
    ]);
    cards.push(
      { label: "Ready kitchen tickets", count: ready, tab: "pos" },
      {
        label: "Pending shop collections",
        count: collections,
        tab: "inventory",
      },
      {
        label: "Low-stock variants",
        count: variants.filter((v) => v.stock - v.reserved <= 5).length,
        tab: "inventory",
      },
      {
        label: "Unpaid clubhouse charges",
        count: invoices.filter(
          (i) =>
            i.totalPaise >
            i.allocations.reduce((s, a) => s + a.amountPaise, 0) +
              i.credits.reduce((s, c) => s + c.amountPaise, 0),
        ).length,
        tab: "billing",
      },
    );
  }
  if (["OWNER", "KITCHEN", "CASHIER"].includes(user.role)) {
    const waiting = await db.kitchenTicket.count({
      where: {
        preparation: { in: ["INCOMING", "ACCEPTED", "COOKING"] },
        createdAt: { lte: new Date(+now - 15 * 60000) },
        order: { status: "OPEN" },
      },
    });
    cards.push({
      label: "Kitchen tickets older than 15 minutes",
      count: waiting,
      tab: "kitchen",
    });
  }
  return Response.json({ data: cards });
});
