import { db } from "@/lib/db";
import { assert, roles, clubDay, slot, type Actor } from "./core";
async function withBillTotals<
  T extends { tickets: { invoiceId: string | null }[] },
>(bills: T[]) {
  const invoices = await db.invoice.findMany({
    where: {
      id: {
        in: bills.flatMap((b) =>
          b.tickets.map((t) => t.invoiceId!).filter(Boolean),
        ),
      },
    },
    include: { allocations: true, credits: true },
  });
  return bills.map((b) => {
    let totalPaise = 0,
      paidPaise = 0,
      creditPaise = 0,
      outstandingPaise = 0;
    for (const t of b.tickets) {
      const i = invoices.find((i) => i.id === t.invoiceId);
      if (!i) continue;
      const paid = i.allocations.reduce((s, a) => s + a.amountPaise, 0),
        credit = i.credits.reduce((s, c) => s + c.amountPaise, 0);
      totalPaise += i.totalPaise;
      paidPaise += paid;
      creditPaise += credit;
      outstandingPaise += Math.max(0, i.totalPaise - paid - credit);
    }
    return {
      ...b,
      totals: { totalPaise, paidPaise, creditPaise, outstandingPaise },
    };
  });
}
export async function socialList() {
  const now = new Date();
  const events = await db.socialEvent.findMany({
    where: { active: true, reservation: { startsAt: { gt: now } } },
    include: {
      reservation: {
        include: { court: { select: { id: true, name: true, sportId: true } } },
      },
      participants: {
        where: {
          OR: [
            { status: "CONFIRMED" },
            { status: "HOLD", holdUntil: { gt: now } },
          ],
        },
        select: { id: true },
      },
    },
    orderBy: { reservation: { startsAt: "asc" } },
  });
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    capacity: e.capacity,
    remaining: Math.max(0, e.capacity - e.participants.length),
    pricePaise: e.pricePaise,
    startsAt: e.reservation.startsAt,
    court: e.reservation.court,
  }));
}
export async function operationsData(
  actor: Actor,
  area: string,
  day = clubDay(new Date()),
  q = "",
) {
  if (area === "history") {
    const [bookings, social, waiting, orders, bills] = await Promise.all([
      db.reservation.findMany({
        where: { userId: actor.id },
        include: { court: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      }),
      db.socialParticipant.findMany({
        where: { userId: actor.id },
        include: {
          event: { include: { reservation: { include: { court: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.waitlistEntry.findMany({
        where: { userId: actor.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.shopOrder.findMany({
        where: { userId: actor.id },
        include: { orderLines: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.kitchenOrder.findMany({
        where: { memberId: actor.id },
        include: { table: true, tickets: { include: { lines: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      bookings,
      social,
      waiting,
      orders,
      bills: await withBillTotals(bills),
    };
  }
  if (area === "reception") {
    roles(actor, ["OWNER", "RECEPTION"]);
    const start = slot(day, 0),
      end = new Date(+start + 86400000);
    const [courts, bookings, social, closures, members] = await Promise.all([
      db.court.findMany({
        where: { active: true },
        include: { sport: true },
        orderBy: { name: "asc" },
      }),
      db.reservation.findMany({
        where: { startsAt: { gte: start, lt: end } },
        include: {
          court: true,
          user: { select: { id: true, name: true, championsId: true } },
        },
        orderBy: { startsAt: "asc" },
      }),
      db.socialEvent.findMany({
        where: { reservation: { startsAt: { gte: start, lt: end } } },
        include: {
          reservation: true,
          participants: {
            include: { user: { select: { name: true, championsId: true } } },
          },
        },
      }),
      db.courtClosure.findMany({
        where: { active: true, startsAt: { lt: end }, endsAt: { gt: start } },
      }),
      db.user.findMany({
        where: {
          role: "MEMBER",
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { championsId: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, email: true, championsId: true },
        take: 30,
        orderBy: { name: "asc" },
      }),
    ]);
    return { courts, bookings, social, closures, members };
  }
  if (area === "crm") {
    roles(actor, ["OWNER", "RECEPTION"]);
    return {
      leads: await db.lead.findMany({
        include: {
          activities: { orderBy: { createdAt: "desc" } },
          quotes: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      staff: await db.user.findMany({
        where: { role: { in: ["OWNER", "RECEPTION"] } },
        select: { id: true, name: true },
      }),
      notifications: await db.staffNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  if (area === "inventory") {
    roles(actor, ["OWNER", "CASHIER"]);
    return {
      products: await db.product.findMany({
        include: { variants: true },
        orderBy: { name: "asc" },
      }),
      orders: await db.shopOrder.findMany({
        include: { orderLines: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      movements: await db.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    };
  }
  if (area === "pos") {
    roles(actor, ["OWNER", "CASHIER"]);
    return {
      tables: await db.diningTable.findMany({ orderBy: { name: "asc" } }),
      menu: await db.menuItem.findMany({ orderBy: { name: "asc" } }),
      bills: await withBillTotals(
        await db.kitchenOrder.findMany({
          where: {
            OR: [{ status: "OPEN" }, { closedAt: { gte: slot(day, 0) } }],
          },
          include: {
            table: true,
            member: { select: { name: true, championsId: true } },
            tickets: { include: { lines: true }, orderBy: { revision: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ),
    };
  }
  if (area === "kitchen") {
    roles(actor, ["OWNER", "KITCHEN", "CASHIER"]);
    return db.kitchenTicket.findMany({
      where: { order: { status: "OPEN" } },
      include: {
        lines: true,
        order: {
          select: {
            id: true,
            table: { select: { name: true } },
            paymentStatus: true,
            guestName: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  if (area === "billing") {
    roles(actor, ["OWNER", "RECEPTION", "CASHIER"]);
    return db.invoice.findMany({
      where:
        actor.role === "OWNER"
          ? {}
          : {
              department: {
                in:
                  actor.role === "RECEPTION"
                    ? ["MEMBERSHIP", "COURT"]
                    : ["SHOP", "CLUBHOUSE"],
              },
            },
      include: {
        lines: true,
        allocations: { include: { payment: true } },
        credits: { include: { refund: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 150,
    });
  }
  assert(false, "NOT_FOUND", "Workspace not found.", 404);
}
export async function recordData(actor: Actor, area: string, id: string) {
  if (area === "booking") {
    const r = await db.reservation.findUnique({
      where: { id },
      include: { court: true },
    });
    assert(
      r &&
        (r.userId === actor.id || ["OWNER", "RECEPTION"].includes(actor.role)),
      "NOT_FOUND",
      "Booking not found.",
      404,
    );
    return r;
  }
  if (area === "order") {
    const r = await db.shopOrder.findUnique({
      where: { id },
      include: { orderLines: true },
    });
    assert(
      r && (r.userId === actor.id || ["OWNER", "CASHIER"].includes(actor.role)),
      "NOT_FOUND",
      "Order not found.",
      404,
    );
    return r;
  }
  if (area === "bill") {
    const r = await db.kitchenOrder.findUnique({
      where: { id },
      include: { table: true, tickets: { include: { lines: true } } },
    });
    assert(
      r &&
        (r.memberId === actor.id || ["OWNER", "CASHIER"].includes(actor.role)),
      "NOT_FOUND",
      "Bill not found.",
      404,
    );
    return r;
  }
  assert(false, "NOT_FOUND", "Record not found.", 404);
}
export async function receiptData(actor: Actor, id: string) {
  const i = await db.invoice.findUnique({
    where: { id },
    include: {
      lines: true,
      allocations: { include: { payment: true } },
      credits: { include: { refund: true } },
    },
  });
  const allowed =
    i &&
    (i.userId === actor.id ||
      actor.role === "OWNER" ||
      (actor.role === "RECEPTION" &&
        ["COURT", "MEMBERSHIP"].includes(i.department)) ||
      (actor.role === "CASHIER" &&
        ["SHOP", "CLUBHOUSE"].includes(i.department)));
  assert(allowed, "NOT_FOUND", "Invoice not found.", 404);
  return i;
}
