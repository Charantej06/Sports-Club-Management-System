import { z } from "zod";
import { db } from "@/lib/db";
import {
  operation,
  assert,
  audit,
  job,
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
} from "@/modules/billing/service";
export const orderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            variantId: z.string(),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    delivery: z.boolean().default(false),
    address: z
      .object({
        line: z.string().trim().min(8).max(200),
        city: z.string().trim().min(2).max(80),
        postcode: z.string().regex(/^\d{6}$/),
        phone: z.string().regex(/^\+?[\d -]{10,16}$/),
      })
      .strict()
      .optional(),
    channel: z.enum(["ONLINE", "COUNTER"]).default("ONLINE"),
    userId: z.string().optional(),
    guestName: z.string().trim().min(2).max(80).optional(),
    guestEmail: z.email().optional(),
  })
  .strict();
export const orderActionSchema = z
  .object({
    action: z.enum([
      "confirm",
      "cancel",
      "collect",
      "dispatch",
      "deliver",
      "return",
    ]),
    method: methodSchema.default("LOCAL"),
    reason: reasonSchema.optional(),
    tracking: z.string().trim().min(3).max(100).optional(),
    returns: z
      .array(
        z
          .object({
            variantId: z.string(),
            quantity: z.number().int().min(1).max(20),
            restock: z.boolean().default(true),
          })
          .strict(),
      )
      .min(1)
      .max(30)
      .optional(),
  })
  .strict();
async function stockLock(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort())
    await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id=${id} FOR UPDATE`;
}
async function release(tx: Tx, orderId: string) {
  const lines = await tx.shopOrderLine.findMany({ where: { orderId } });
  await stockLock(
    tx,
    lines.map((l) => l.variantId),
  );
  for (const l of lines)
    await tx.productVariant.update({
      where: { id: l.variantId },
      data: { reserved: { decrement: l.quantity } },
    });
}
async function expire(tx: Tx, id: string, now: Date) {
  await tx.$queryRaw`SELECT id FROM "ShopOrder" WHERE id=${id} FOR UPDATE`;
  const o = await tx.shopOrder.findUnique({ where: { id } });
  if (!o || o.status !== "HOLD" || !o.holdUntil || o.holdUntil > now) return;
  await release(tx, id);
  await tx.shopOrder.update({ where: { id }, data: { status: "EXPIRED" } });
  await audit(
    tx,
    { id: "system", name: "Worker", email: "", role: "OWNER" },
    "shop.expire",
    id,
    "Stock hold expired",
  );
  if (o.totalPaise)
    await creditInvoice(
      tx,
      { id: o.userId || "system", name: "System", email: "", role: "OWNER" },
      o.invoiceId!,
      o.totalPaise,
      "Stock hold expired",
      "shop-expiry:" + id,
    );
}
export async function expireOrderJob(id: string, now = new Date()) {
  await db.$transaction((tx) => expire(tx, id, now));
}
export function holdOrder(
  actor: Actor,
  key: string,
  input: z.infer<typeof orderSchema>,
) {
  roles(actor, ["MEMBER", "OWNER", "CASHIER"]);
  if (input.channel === "COUNTER") roles(actor, ["OWNER", "CASHIER"]);
  return operation(actor, key, "shop.hold", input, async (tx) => {
    assert(
      !input.delivery || input.address,
      "ADDRESS_REQUIRED",
      "Enter the delivery address.",
      422,
    );
    assert(
      new Set(input.items.map((i) => i.variantId)).size === input.items.length,
      "DUPLICATE_SKU",
      "Combine duplicate variants in your cart.",
      422,
    );
    const who = await subject(
      tx,
      actor,
      input.userId,
      input.guestName,
      input.guestEmail,
    );
    await memberLock(tx, who.userId);
    // Expired reservations are released by the durable worker before they become sellable again.
    await stockLock(
      tx,
      input.items.map((i) => i.variantId),
    );
    const plan = await benefits(tx, who.userId);
    const lines = [];
    for (const item of input.items) {
      const v = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });
      assert(
        v?.product.active,
        "SKU_UNAVAILABLE",
        "A cart item is unavailable.",
        404,
      );
      assert(
        v.stock - v.reserved >= item.quantity,
        "OUT_OF_STOCK",
        `${v.product.name} (${v.label}) has insufficient stock.`,
      );
      lines.push({
        variantId: v.id,
        name: v.product.name,
        label: v.label,
        ...priced(v.pricePaise, item.quantity, plan?.shopDiscountBps || 0),
      });
      await tx.productVariant.update({
        where: { id: v.id },
        data: { reserved: { increment: item.quantity } },
      });
    }
    const settings = await tx.clubSettings.findUniqueOrThrow({
      where: { id: "club" },
    });
    const holdUntil = new Date(Date.now() + settings.holdMinutes * 60000);
    const order = await tx.shopOrder.create({
      data: {
        userId: who.userId,
        guestName: who.userId ? null : who.name,
        guestEmail: who.userId ? null : who.email,
        status: "HOLD",
        channel: input.channel,
        delivery: input.delivery,
        address: input.address,
        holdUntil,
        lines,
        priceSnapshot: {
          membershipId: plan?.membershipId || null,
          plan: plan?.name || "Guest",
          discountBps: plan?.shopDiscountBps || 0,
          deliveryFeePaise: input.delivery ? settings.deliveryFeePaise : 0,
        },
        orderLines: { create: lines },
      },
    });
    const charges = lines.map((l) => ({
      description: l.name + " · " + l.label,
      quantity: l.quantity,
      unitPaise: l.unitPaise,
      discountPaise: l.discountPaise,
      totalPaise: l.totalPaise,
    }));
    if (input.delivery)
      charges.push({
        description: "Delivery",
        ...priced(settings.deliveryFeePaise, 1, 0),
      });
    const invoice = await issueInvoice(tx, {
      ...who,
      department: "SHOP",
      originId: order.id,
      lines: charges,
    });
    await tx.shopOrder.update({
      where: { id: order.id },
      data: { invoiceId: invoice.id, totalPaise: invoice.totalPaise },
    });
    await job(
      tx,
      "EXPIRE_SHOP",
      "shop-expiry:" + order.id,
      { id: order.id },
      holdUntil,
    );
    await audit(tx, actor, "shop.hold", order.id);
    return { ...order, invoiceId: invoice.id, totalPaise: invoice.totalPaise };
  });
}
export function actOrder(
  actor: Actor,
  key: string,
  id: string,
  input: z.infer<typeof orderActionSchema>,
) {
  return operation(
    actor,
    key,
    "shop." + input.action,
    { id, ...input },
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ShopOrder" WHERE id=${id} FOR UPDATE`;
      let o = await tx.shopOrder.findUnique({
        where: { id },
        include: { orderLines: true },
      });
      assert(o, "NOT_FOUND", "Order not found.", 404);
      if (actor.role === "MEMBER")
        assert(o.userId === actor.id, "NOT_FOUND", "Order not found.", 404);
      else roles(actor, ["OWNER", "CASHIER"]);
      await expire(tx, id, new Date());
      o = await tx.shopOrder.findUniqueOrThrow({
        where: { id },
        include: { orderLines: true },
      });
      if (input.action === "confirm") {
        assert(
          o.status === "HOLD",
          "HOLD_EXPIRED",
          "This cart hold has expired or was already paid.",
        );
        const plan = await benefits(tx, o.userId);
        assert(
          (o.priceSnapshot as { membershipId?: string }).membershipId ===
            (plan?.membershipId || null),
          "BENEFITS_CHANGED",
          "Membership changed. Cancel this cart and review the new price.",
        );
        await payInvoice(tx, actor, o.invoiceId!, input.method);
        await tx.shopOrder.update({
          where: { id },
          data: { status: "PAID", holdUntil: null },
        });
      } else if (input.action === "cancel") {
        if (["CANCELLED", "EXPIRED"].includes(o.status)) return o;
        assert(
          ["HOLD", "PAID"].includes(o.status),
          "ORDER_STATE",
          "Fulfilled orders must use the returns process.",
        );
        assert(
          input.reason,
          "REASON_REQUIRED",
          "Enter a cancellation reason.",
          422,
        );
        await release(tx, id);
        if (o.totalPaise)
          await creditInvoice(
            tx,
            actor,
            o.invoiceId!,
            o.totalPaise,
            input.reason,
            "shop-cancel:" + id,
          );
        await tx.shopOrder.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
      } else {
        roles(actor, ["OWNER", "CASHIER"]);
        if (input.action === "collect" || input.action === "dispatch") {
          assert(
            o.status === "PAID" && (input.action === "dispatch") === o.delivery,
            "ORDER_STATE",
            "Choose collection for pickup orders or dispatch for delivery orders after payment.",
          );
          assert(
            input.action !== "dispatch" || input.tracking,
            "TRACKING_REQUIRED",
            "Enter a delivery tracking reference.",
            422,
          );
          await stockLock(
            tx,
            o.orderLines.map((l) => l.variantId),
          );
          for (const l of o.orderLines) {
            await tx.productVariant.update({
              where: { id: l.variantId },
              data: {
                stock: { decrement: l.quantity },
                reserved: { decrement: l.quantity },
              },
            });
            await tx.stockMovement.create({
              data: {
                variantId: l.variantId,
                delta: -l.quantity,
                reason: input.action,
                actorId: actor.id,
                originId: `fulfill:${id}:${l.variantId}`,
              },
            });
          }
          await tx.shopOrder.update({
            where: { id },
            data: {
              status: input.action === "dispatch" ? "DISPATCHED" : "COLLECTED",
              fulfilledAt: new Date(),
              tracking: input.tracking,
            },
          });
        } else if (input.action === "deliver") {
          assert(
            o.status === "DISPATCHED",
            "ORDER_STATE",
            "Only dispatched orders can be delivered.",
          );
          await tx.shopOrder.update({
            where: { id },
            data: { status: "DELIVERED" },
          });
        } else {
          assert(
            ["COLLECTED", "DELIVERED", "PART_RETURNED"].includes(o.status),
            "ORDER_STATE",
            "Returns require a collected or delivered order.",
          );
          assert(
            input.reason && input.returns,
            "RETURN_DETAILS",
            "Enter a reason and returned quantities.",
            422,
          );
          assert(
            new Set(input.returns.map((r) => r.variantId)).size ===
              input.returns.length,
            "DUPLICATE_SKU",
            "Combine returned quantities.",
            422,
          );
          await stockLock(
            tx,
            input.returns.map((r) => r.variantId),
          );
          let credit = 0;
          for (const r of input.returns) {
            const l = o.orderLines.find((l) => l.variantId === r.variantId);
            assert(
              l && l.returned + r.quantity <= l.quantity,
              "RETURN_QUANTITY",
              "Return exceeds the purchased quantity.",
              422,
            );
            credit +=
              Math.floor(
                (l.totalPaise * (l.returned + r.quantity)) / l.quantity,
              ) - Math.floor((l.totalPaise * l.returned) / l.quantity);
            await tx.shopOrderLine.update({
              where: { id: l.id },
              data: { returned: { increment: r.quantity } },
            });
            if (r.restock) {
              await tx.productVariant.update({
                where: { id: r.variantId },
                data: { stock: { increment: r.quantity } },
              });
              await tx.stockMovement.create({
                data: {
                  variantId: r.variantId,
                  delta: r.quantity,
                  reason: input.reason,
                  actorId: actor.id,
                  originId: `return:${key}:${r.variantId}`,
                },
              });
            }
          }
          if (credit)
            await creditInvoice(
              tx,
              actor,
              o.invoiceId!,
              credit,
              input.reason,
              "shop-return:" + key,
            );
          const remaining = await tx.shopOrderLine.findMany({
            where: { orderId: id },
          });
          await tx.shopOrder.update({
            where: { id },
            data: {
              status: remaining.every((l) => l.returned === l.quantity)
                ? "RETURNED"
                : "PART_RETURNED",
            },
          });
        }
      }
      await audit(tx, actor, "shop." + input.action, id, input.reason);
      return tx.shopOrder.findUniqueOrThrow({
        where: { id },
        include: { orderLines: true },
      });
    },
  );
}
export const correctionSchema = z
  .object({
    variantId: z.string(),
    delta: z
      .number()
      .int()
      .min(-10000)
      .max(10000)
      .refine((n) => n !== 0),
    reason: reasonSchema,
  })
  .strict();
export function correctStock(
  actor: Actor,
  key: string,
  input: z.infer<typeof correctionSchema>,
) {
  roles(actor, ["OWNER", "CASHIER"]);
  return operation(actor, key, "stock.correct", input, async (tx) => {
    await stockLock(tx, [input.variantId]);
    const v = await tx.productVariant.findUnique({
      where: { id: input.variantId },
    });
    assert(v, "NOT_FOUND", "Variant not found.", 404);
    assert(
      v.stock + input.delta >= v.reserved,
      "RESERVED_STOCK",
      "Correction cannot remove stock reserved for orders.",
    );
    await tx.productVariant.update({
      where: { id: v.id },
      data: { stock: { increment: input.delta } },
    });
    await tx.stockMovement.create({
      data: { ...input, actorId: actor.id, originId: "correction:" + key },
    });
    await audit(tx, actor, "stock.correct", v.id, input.reason, {
      delta: input.delta,
    });
    return { corrected: true };
  });
}
