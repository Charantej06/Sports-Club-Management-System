import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

/** One originating transaction, one immutable invoice. Amounts are integer paise. */
export async function issueMembershipInvoice(tx: Prisma.TransactionClient, input: {
  userId: string; name: string; email: string; membershipId: string; description: string; pricePaise: number;
}) {
  const invoice = await tx.invoice.create({ data: {
    number: `CC-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    userId: input.userId, department: "MEMBERSHIP", originId: input.membershipId,
    subtotalPaise: input.pricePaise, totalPaise: input.pricePaise,
    customerName: input.name, customerEmail: input.email,
    lines: { create: { description: input.description, quantity: 1, unitPaise: input.pricePaise, totalPaise: input.pricePaise } },
  } });
  const payment = await tx.payment.create({ data: {
    userId: input.userId, method: "LOCAL", source: "LOCAL_SIMULATED", amountPaise: input.pricePaise,
    reference: `local:${input.membershipId}`,
  } });
  await tx.paymentAllocation.create({ data: { invoiceId: invoice.id, paymentId: payment.id, amountPaise: input.pricePaise } });
  return invoice;
}
export function discountedAmount(paise: number, basisPoints: number) {
  // Round the discount once, half-up to the nearest paise.
  return paise - Math.floor((paise * basisPoints + 5000) / 10000);
}
