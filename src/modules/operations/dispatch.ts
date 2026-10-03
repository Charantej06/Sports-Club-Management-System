import { z } from "zod";
import { requireUser } from "@/lib/access";
import { jsonBody, sameOrigin } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  assert,
  keyFrom,
  operation,
  audit,
  roles,
  methodSchema,
  reasonSchema,
  cashLock,
} from "./core";
import {
  bookingSchema,
  bookingActionSchema,
  holdBooking,
  actBooking,
  socialCreateSchema,
  createSocial,
  joinSocial,
  socialActionSchema,
  actSocial,
  waitSchema,
  joinWaiting,
  closureSchema,
  addClosure,
  removeClosure,
} from "@/modules/bookings/service";
import {
  orderSchema,
  holdOrder,
  orderActionSchema,
  actOrder,
  correctionSchema,
  correctStock,
} from "@/modules/shop/service";
import {
  openBillSchema,
  openBill,
  billActionSchema,
  actBill,
  preparationSchema,
  prepareTicket,
  refreshBill,
} from "@/modules/clubhouse/service";
import { crmSchema, actLead } from "@/modules/crm/service";
import {
  purchaseSchema,
  purchaseMembership,
} from "@/modules/membership/service";
import { payInvoice } from "@/modules/billing/service";
import { receiptData } from "./queries";
export async function mutate(request: Request, area: string, id?: string) {
  sameOrigin(request);
  const actor = await requireUser(request),
    key = keyFrom(request),
    input = await jsonBody(request);
  if (area === "booking")
    return id
      ? actBooking(actor, key, id, bookingActionSchema.parse(input))
      : holdBooking(actor, key, bookingSchema.parse(input));
  if (area === "order")
    return id
      ? actOrder(actor, key, id, orderActionSchema.parse(input))
      : holdOrder(actor, key, orderSchema.parse(input));
  if (area === "bill")
    return id
      ? actBill(actor, key, id, billActionSchema.parse(input))
      : openBill(actor, key, openBillSchema.parse(input));
  if (area === "social") {
    assert(id, "ID_REQUIRED", "Choose a social session.", 422);
    const action = z
      .object({ action: z.literal("join") })
      .strict()
      .safeParse(input);
    return action.success
      ? joinSocial(actor, key, id)
      : actSocial(actor, key, id, socialActionSchema.parse(input));
  }
  if (area === "social-create")
    return createSocial(actor, key, socialCreateSchema.parse(input));
  if (area === "waiting") {
    if (!id) return joinWaiting(actor, key, waitSchema.parse(input));
    z.object({ action: z.literal("cancel") })
      .strict()
      .parse(input);
    return operation(actor, key, "waiting.cancel", { id }, async (tx) => {
      const entry = await tx.waitlistEntry.findFirst({
        where: { id, userId: actor.id },
      });
      assert(entry, "NOT_FOUND", "Waiting entry not found.", 404);
      assert(
        entry.status !== "OFFERED",
        "ACTIVE_OFFER",
        "Cancel the offered booking or social place to release it.",
      );
      await tx.waitlistEntry.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await audit(tx, actor, "waiting.cancel", id);
      return { cancelled: true };
    });
  }
  if (area === "closure") {
    if (!id) return addClosure(actor, key, closureSchema.parse(input));
    const i = z.object({ reason: reasonSchema }).strict().parse(input);
    return removeClosure(actor, key, id, i.reason);
  }
  if (area === "stock")
    return correctStock(actor, key, correctionSchema.parse(input));
  if (area === "kitchen")
    return prepareTicket(actor, key, preparationSchema.parse(input));
  if (area === "crm") {
    assert(id, "ID_REQUIRED", "Choose an enquiry.", 422);
    return actLead(actor, key, id, crmSchema.parse(input));
  }
  if (area === "notification") {
    roles(actor, ["OWNER", "RECEPTION"]);
    z.object({ read: z.literal(true) })
      .strict()
      .parse(input);
    return operation(actor, key, "notification.read", { id }, async (tx) => {
      assert(id, "ID_REQUIRED", "Choose a notification.", 422);
      return tx.staffNotification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    });
  }
  if (area === "membership") {
    roles(actor, ["OWNER", "RECEPTION"]);
    const i = purchaseSchema
      .extend({ userId: z.string(), method: methodSchema })
      .parse(input);
    const { userId, method, ...purchase } = i;
    return {
      data: await purchaseMembership(userId, key, purchase, new Date(), {
        actor,
        method,
      }),
    };
  }
  if (area === "payment") {
    assert(id, "ID_REQUIRED", "Choose an invoice.", 422);
    const i = z
      .object({
        method: methodSchema,
        amountPaise: z.number().int().positive().optional(),
      })
      .strict()
      .parse(input);
    const invoice = await receiptData(actor, id);
    return operation(actor, key, "billing.pay", { id, ...i }, async (tx) => {
      if (invoice.department === "CLUBHOUSE") {
        const ticket = await tx.kitchenTicket.findFirst({
          where: { invoiceId: id },
        });
        if (ticket)
          await tx.$queryRaw`SELECT id FROM "KitchenOrder" WHERE id=${ticket.orderId} FOR UPDATE`;
      } else
        assert(
          invoice.department === "MEMBERSHIP" || invoice.originId.startsWith("business:"),
          "CHECKOUT_REQUIRED",
          "Confirm the booking or order through its checkout.",
        );
      await payInvoice(tx, actor, id, i.method, i.amountPaise);
      const ticket = await tx.kitchenTicket.findFirst({
        where: { invoiceId: id },
      });
      if (ticket) await refreshBill(tx, ticket.orderId);
      return { paid: true };
    });
  }
  if (area === "refund") {
    roles(actor, ["OWNER", "RECEPTION", "CASHIER"]);
    assert(id, "ID_REQUIRED", "Choose a refund.", 422);
    const i = z.object({ reason: reasonSchema }).strict().parse(input);
    const refund = await db.refund.findUnique({
      where: { id },
      include: { credit: true },
    });
    assert(refund, "NOT_FOUND", "Refund not found.", 404);
    await receiptData(actor, refund.credit.invoiceId);
    return operation(actor, key, "refund.record", { id, ...i }, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Refund" WHERE id=${id} FOR UPDATE`;
      const current = await tx.refund.findUniqueOrThrow({ where: { id } });
      if (current.status === "RECORDED") return current;
      await audit(tx, actor, "refund.record", id, i.reason);
      return tx.refund.update({
        where: { id },
        data: { status: "RECORDED", actorId: actor.id, recordedAt: new Date(), cashShiftId: current.method === "CASH" ? (await cashLock(tx, actor.id))?.id : null },
      });
    });
  }
  assert(false, "NOT_FOUND", "Action not found.", 404);
}
