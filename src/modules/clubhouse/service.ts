import { z } from "zod";
import {
  operation,
  assert,
  audit,
  subject,
  roles,
  memberLock,
  methodSchema,
  reasonSchema,
  type Actor,
  type Tx,
} from "@/modules/operations/core";
import { benefits, priced } from "@/modules/membership/pricing";
import {
  issueInvoice,
  payInvoice,
  creditInvoice,
  balance,
} from "@/modules/billing/service";
import { ageAt } from "@/modules/membership/rules";
const items = z
  .array(
    z
      .object({
        menuId: z.string(),
        quantity: z.number().int().min(1).max(30),
        note: z.string().trim().max(200).default(""),
      })
      .strict(),
  )
  .min(1)
  .max(40);
export const openBillSchema = z
  .object({
    tableId: z.string(),
    userId: z.string().optional(),
    guestName: z.string().trim().min(2).max(80).optional(),
    ageConfirmed: z.boolean().default(false),
    items,
  })
  .strict();
export const billActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), items }).strict(),
  z
    .object({
      action: z.literal("pay"),
      method: methodSchema,
      amountPaise: z.number().int().positive().optional(),
    })
    .strict(),
  z.object({ action: z.literal("tab") }).strict(),
  z.object({ action: z.literal("close") }).strict(),
  z
    .object({
      action: z.literal("cancelItem"),
      lineId: z.string(),
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("adjust"),
      invoiceId: z.string(),
      amountPaise: z.number().int().positive(),
      reason: reasonSchema,
    })
    .strict(),
]);
export const preparationSchema = z
  .object({
    ticketId: z.string(),
    version: z.number().int().positive(),
    state: z.enum(["ACCEPTED", "COOKING", "READY", "SERVED"]),
  })
  .strict();
async function billLock(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "KitchenOrder" WHERE id=${id} FOR UPDATE`;
  return tx.kitchenOrder.findUnique({
    where: { id },
    include: {
      table: true,
      member: true,
      tickets: { include: { lines: true }, orderBy: { revision: "asc" } },
    },
  });
}
export async function refreshBill(tx: Tx, id: string) {
  const o = await tx.kitchenOrder.findUniqueOrThrow({
    where: { id },
    include: { tickets: {include:{lines:true}} },
  });
  let net = 0,
    paid = 0,
    outstanding = 0;
  for (const t of o.tickets) {
    const b = await balance(tx, t.invoiceId!);
    net += b.invoice.totalPaise - b.credited;
    paid += b.paid;
    outstanding += b.outstanding;
  }
  const paymentStatus =
    outstanding === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "OPEN";
  const active=o.tickets.filter(t=>t.lines.some(l=>l.status==="ACTIVE"));
  const stages=["INCOMING","ACCEPTED","COOKING","READY","SERVED"];
  const preparation=active.length?stages[Math.min(...active.map(t=>stages.indexOf(t.preparation)))]:"CANCELLED";
  await tx.kitchenOrder.update({ where: { id }, data: { paymentStatus,preparation,items:o.tickets.flatMap(t=>t.lines.map(l=>({name:l.name,quantity:l.quantity,note:l.note,status:l.status,ticketId:t.id}))) } });
  return { net, paid, outstanding, paymentStatus };
}
async function tabCheck(tx: Tx, userId: string, extra: number) {
  await memberLock(tx, userId);
  assert(
    await benefits(tx, userId),
    "TAB_ELIGIBILITY",
    "Tabs require a current membership.",
  );
  const invoices = await tx.invoice.findMany({
    where: { userId, department: "CLUBHOUSE" },
    include: { allocations: true, credits: true },
  });
  let outstanding = extra;
  for (const i of invoices) {
    const due = Math.max(
      0,
      i.totalPaise -
        i.allocations.reduce((s, a) => s + a.amountPaise, 0) -
        i.credits.reduce((s, c) => s + c.amountPaise, 0),
    );
    assert(
      !due || !i.dueAt || i.dueAt >= new Date(),
      "TAB_OVERDUE",
      "Settle overdue clubhouse charges before using a tab.",
    );
    outstanding += due;
  }
  const settings = await tx.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  assert(
    outstanding <= settings.tabLimitPaise,
    "TAB_LIMIT",
    "The member tab spending limit would be exceeded.",
  );
  return settings;
}
async function append(
  tx: Tx,
  actor: Actor,
  id: string,
  input: z.infer<typeof items>,
) {
  const o = await billLock(tx, id);
  assert(o?.status === "OPEN", "BILL_CLOSED", "This bill is closed.");
  await memberLock(tx, o.memberId);
  const plan = await benefits(tx, o.memberId);
  const lines = [];
  for (const item of input) {
    const m = await tx.menuItem.findUnique({ where: { id: item.menuId } });
    assert(m?.available, "MENU_UNAVAILABLE", "A menu item is unavailable.");
    if (m.category === "Bar") {
      assert(
        o.member
          ? !!o.member.dateOfBirth &&
              ageAt(o.member.dateOfBirth, new Date()) >= 21
          : o.ageConfirmed,
        "AGE_REQUIRED",
        "Bar orders require age 21+. Confirm guest age or the member's date of birth.",
        422,
      );
    }
    lines.push({
      menuId: m.id,
      name: m.name,
      note: item.note,
      ...priced(m.pricePaise, item.quantity, plan?.foodDiscountBps || 0),
    });
  }
  const total = lines.reduce((s, l) => s + l.totalPaise, 0);
  if (o.tabEnabled) {
    assert(o.memberId, "TAB_ELIGIBILITY", "Guest tabs are unavailable.");
    await tabCheck(tx, o.memberId, total);
  }
  const settings = await tx.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  const ticket = await tx.kitchenTicket.create({
    data: {
      orderId: id,
      revision: o.tickets.length + 1,
      lines: { create: lines },
    },
  });
  const invoice = await issueInvoice(tx, {
    userId: o.memberId,
    name: o.member?.name || o.guestName || "Guest",
    email: o.member?.email || "",
    department: "CLUBHOUSE",
    originId: ticket.id,
    dueAt: o.tabEnabled
      ? new Date(Date.now() + settings.tabDueDays * 86400000)
      : undefined,
    lines: lines.map((l) => ({
      description: l.name + (l.note ? " · " + l.note : ""),
      quantity: l.quantity,
      unitPaise: l.unitPaise,
      discountPaise: l.discountPaise,
      totalPaise: l.totalPaise,
    })),
  });
  await tx.kitchenTicket.update({
    where: { id: ticket.id },
    data: { invoiceId: invoice.id },
  });
  await tx.kitchenOrder.update({
    where: { id },
    data: { version: { increment: 1 } },
  });
  await refreshBill(tx, id);
  await audit(tx, actor, "clubhouse.add", id, undefined, {
    ticketId: ticket.id,
    revision: ticket.revision,
    membershipId: plan?.membershipId || null,
    discountBps: plan?.foodDiscountBps || 0,
  });
  return ticket;
}
export function openBill(
  actor: Actor,
  key: string,
  input: z.infer<typeof openBillSchema>,
) {
  roles(actor, ["OWNER", "CASHIER"]);
  return operation(actor, key, "clubhouse.open", input, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id=${input.tableId} FOR UPDATE`;
    assert(
      await tx.diningTable.findUnique({ where: { id: input.tableId } }),
      "NOT_FOUND",
      "Table not found.",
      404,
    );
    assert(
      !(await tx.kitchenOrder.count({
        where: { tableId: input.tableId, status: "OPEN" },
      })),
      "TABLE_OCCUPIED",
      "This table already has an open bill.",
    );
    const who = await subject(tx, actor, input.userId, input.guestName);
    const o = await tx.kitchenOrder.create({
      data: {
        tableId: input.tableId,
        memberId: who.userId,
        guestName: who.userId ? null : who.name,
        ageConfirmed: input.ageConfirmed,
        items: [],
      },
    });
    await append(tx, actor, o.id, input.items);
    await audit(tx, actor, "clubhouse.open", o.id);
    return tx.kitchenOrder.findUniqueOrThrow({
      where: { id: o.id },
      include: { tickets: { include: { lines: true } } },
    });
  });
}
export function actBill(
  actor: Actor,
  key: string,
  id: string,
  input: z.infer<typeof billActionSchema>,
) {
  roles(actor, ["OWNER", "CASHIER"]);
  return operation(
    actor,
    key,
    "clubhouse." + input.action,
    { id, ...input },
    async (tx) => {
      const o = await billLock(tx, id);
      assert(o, "NOT_FOUND", "Bill not found.", 404);
      assert(o.status === "OPEN", "BILL_CLOSED", "This bill is closed.");
      if (input.action === "add") await append(tx, actor, id, input.items);
      else if (input.action === "pay") {
        const totals = await refreshBill(tx, id);
        let remaining = input.amountPaise ?? totals.outstanding;
        assert(
          remaining > 0 && remaining <= totals.outstanding,
          "PAYMENT_AMOUNT",
          "Payment cannot exceed the outstanding balance.",
          422,
        );
        for (const t of o.tickets) {
          const b = await balance(tx, t.invoiceId!);
          const amount = Math.min(b.outstanding, remaining);
          if (amount)
            await payInvoice(tx, actor, t.invoiceId!, input.method, amount);
          remaining -= amount;
          if (!remaining) break;
        }
      } else if (input.action === "tab") {
        if (o.tabEnabled) return o;
        assert(o.memberId, "TAB_ELIGIBILITY", "Guest tabs are unavailable.");
        const settings = await tabCheck(tx, o.memberId, 0);
        await tx.kitchenOrder.update({
          where: { id },
          data: { tabEnabled: true },
        });
        await tx.invoice.updateMany({
          where: { id: { in: o.tickets.map((t) => t.invoiceId!) } },
          data: {
            dueAt: new Date(Date.now() + settings.tabDueDays * 86400000),
          },
        });
      } else if (input.action === "cancelItem") {
        const ticket = o.tickets.find((t) =>
          t.lines.some((l) => l.id === input.lineId),
        );
        const line = ticket?.lines.find((l) => l.id === input.lineId);
        assert(line && ticket, "NOT_FOUND", "Item not found.", 404);
        if (line.status === "CANCELLED") return { cancelled: true };
        assert(
          ["INCOMING", "ACCEPTED"].includes(ticket.preparation),
          "PREPARATION_STATE",
          "Prepared items require a recorded adjustment.",
        );
        if (line.totalPaise)
          await creditInvoice(
            tx,
            actor,
            ticket.invoiceId!,
            line.totalPaise,
            input.reason,
            "item-cancel:" + line.id,
          );
        await tx.kitchenLine.update({
          where: { id: line.id },
          data: { status: "CANCELLED" },
        });
        await tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: { version: { increment: 1 } },
        });
      } else if (input.action === "adjust") {
        assert(
          o.tickets.some((t) => t.invoiceId === input.invoiceId),
          "NOT_FOUND",
          "Invoice is not part of this bill.",
          404,
        );
        await creditInvoice(
          tx,
          actor,
          input.invoiceId,
          input.amountPaise,
          input.reason,
          "bill-adjust:" + key,
        );
      } else {
        const totals = await refreshBill(tx, id);
        assert(
          !totals.outstanding,
          "UNPAID_BILL",
          "Settle this bill before closing the table.",
        );
        assert(
          o.tickets.every(
            (t) =>
              t.preparation === "SERVED" ||
              t.lines.every((l) => l.status === "CANCELLED"),
          ),
          "UNSERVED_ITEMS",
          "Serve or cancel all items before closing the table.",
        );
        await tx.kitchenOrder.update({
          where: { id },
          data: { status: "CLOSED", closedAt: new Date() },
        });
      }
      await refreshBill(tx, id);
      await audit(
        tx,
        actor,
        "clubhouse." + input.action,
        id,
        "reason" in input ? input.reason : undefined,
      );
      return tx.kitchenOrder.findUniqueOrThrow({
        where: { id },
        include: { tickets: { include: { lines: true } } },
      });
    },
  );
}
export function prepareTicket(
  actor: Actor,
  key: string,
  input: z.infer<typeof preparationSchema>,
) {
  roles(
    actor,
    input.state === "SERVED" ? ["OWNER", "CASHIER"] : ["OWNER", "KITCHEN"],
  );
  return operation(actor, key, "kitchen.prepare", input, async (tx) => {
    const found = await tx.kitchenTicket.findUnique({
      where: { id: input.ticketId },
    });
    assert(found, "NOT_FOUND", "Ticket not found.", 404);
    const o = await billLock(tx, found.orderId);
    assert(o?.status === "OPEN", "BILL_CLOSED", "This bill is closed.");
    const t = o.tickets.find((t) => t.id === input.ticketId)!;
    assert(
      t.version === input.version,
      "STALE_TICKET",
      "This ticket was amended. Refresh and review the changes before updating.",
    );
    const next: Record<string, string> = {
      INCOMING: "ACCEPTED",
      ACCEPTED: "COOKING",
      COOKING: "READY",
      READY: "SERVED",
    };
    assert(
      next[t.preparation] === input.state,
      "PREPARATION_STATE",
      "Preparation must follow accepted, cooking, ready and served.",
    );
    await tx.kitchenTicket.update({
      where: { id: t.id },
      data: { preparation: input.state, version: { increment: 1 } },
    });
      await audit(tx, actor, "kitchen." + input.state.toLowerCase(), t.id);
      await refreshBill(tx,o.id);
    return { updated: true };
  });
}
