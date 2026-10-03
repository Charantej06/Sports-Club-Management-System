import { randomUUID } from "node:crypto";
import type { Prisma, Department } from "@/generated/prisma/client";
import {
  assert,
  audit,
  cashLock,
  type Actor,
  type Tx,
} from "@/modules/operations/core";
import { verifiedPayment } from "./gateway-context";
export type ChargeLine = {
  description: string;
  quantity: number;
  unitPaise: number;
  discountPaise: number;
  totalPaise: number;
};
export type PaymentMethod = "LOCAL" | "CASH" | "CARD" | "UPI" | "GATEWAY";
export async function issueInvoice(
  tx: Tx,
  input: {
    userId: string | null;
    name: string;
    email: string;
    department: Department;
    originId: string;
    lines: ChargeLine[];
    dueAt?: Date;
  },
) {
  const subtotalPaise = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPaise,
    0,
  );
  const discountPaise = input.lines.reduce(
    (sum, l) => sum + l.discountPaise,
    0,
  );
  assert(
    input.lines.length && subtotalPaise <= 1000000000,
    "BILL_LIMIT",
    "The invoice exceeds the permitted amount.",
    422,
  );
  return tx.invoice.create({
    data: {
      number:
        "CC-" +
        new Date().getUTCFullYear() +
        "-" +
        randomUUID().slice(0, 8).toUpperCase(),
      userId: input.userId,
      customerName: input.name,
      customerEmail: input.email,
      department: input.department,
      originId: input.originId,
      subtotalPaise,
      discountPaise,
      totalPaise: subtotalPaise - discountPaise,
      dueAt: input.dueAt,
      lines: { create: input.lines },
    },
  });
}
export async function balance(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { allocations: true, credits: true },
  });
  const paid = invoice.allocations.reduce((s, a) => s + a.amountPaise, 0),
    credited = invoice.credits.reduce((s, c) => s + c.amountPaise, 0);
  return {
    invoice,
    paid,
    credited,
    outstanding: Math.max(0, invoice.totalPaise - paid - credited),
  };
}
export async function payInvoice(
  tx: Tx,
  actor: Actor,
  invoiceId: string,
  method: PaymentMethod,
  amount?: number,
) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${invoiceId} FOR UPDATE`;
  const b = await balance(tx, invoiceId);
  const amountPaise = amount ?? b.outstanding;
  if (b.outstanding === 0 && amount === undefined) return null;
  assert(
    amountPaise > 0 &&
      Number.isInteger(amountPaise) &&
      amountPaise <= b.outstanding,
    "PAYMENT_AMOUNT",
    "Payment must be positive and cannot exceed the outstanding balance.",
    422,
  );
  const verified = verifiedPayment.getStore();
  if (method === "GATEWAY") {
    assert(
      verified &&
        verified.userId === actor.id &&
        verified.amountPaise === amountPaise &&
        (!verified.invoiceId || verified.invoiceId === invoiceId),
      "GATEWAY_UNVERIFIED",
      "A server-verified captured payment is required.",
      403,
    );
  } else if (method === "LOCAL")
    assert(
      process.env.PAYMENT_MODE === "local",
      "PAYMENT_UNCONFIGURED",
      "Online payments are not configured.",
      503,
    );
  else
    assert(
      ["OWNER", "RECEPTION", "CASHIER"].includes(actor.role),
      "FORBIDDEN",
      "Only authorized staff can record payments.",
      403,
    );
  const source =
    method === "GATEWAY"
      ? "GATEWAY_VERIFIED"
      : method === "LOCAL"
        ? "LOCAL_SIMULATED"
        : "MANUAL_RECORDED";
  const cashShift = method === "CASH" ? await cashLock(tx, actor.id) : null;
  const payment = await tx.payment.create({
    data: {
      userId: b.invoice.userId,
      amountPaise,
      method,
      source,
      actorId: actor.id,
      cashShiftId: cashShift?.id,
      reference:
        method === "GATEWAY"
          ? verified!.reference
          : (method === "LOCAL" ? "local:" : "manual:") + randomUUID(),
    },
  });
  await tx.paymentAllocation.create({
    data: { invoiceId, paymentId: payment.id, amountPaise },
  });
  await audit(tx, actor, "billing.payment", invoiceId, undefined, {
    paymentId: payment.id,
    amountPaise,
    method,
    source,
  });
  return payment;
}
export async function creditInvoice(
  tx: Tx,
  actor: Actor,
  invoiceId: string,
  amountPaise: number,
  reason: string,
  originId: string,
) {
  const existing = await tx.credit.findUnique({ where: { originId } });
  if (existing) return existing;
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${invoiceId} FOR UPDATE`;
  const b = await balance(tx, invoiceId);
  assert(
    Number.isInteger(amountPaise) &&
      amountPaise > 0 &&
      amountPaise <= b.invoice.totalPaise - b.credited,
    "CREDIT_AMOUNT",
    "Credit exceeds the remaining invoice charge.",
    422,
  );
  const credit = await tx.credit.create({
    data: { invoiceId, amountPaise, reason, actorId: actor.id, originId },
  });
  const refundAmount = Math.min(
    amountPaise,
    Math.max(0, b.paid + b.credited + amountPaise - b.invoice.totalPaise),
  );
  if (refundAmount) {
    const payments = await tx.paymentAllocation.findMany({
      where: { invoiceId },
      include: { payment: true },
    });
    const local = payments.every((a) => a.payment.source === "LOCAL_SIMULATED");
    await tx.refund.create({
      data: {
        creditId: credit.id,
        amountPaise: refundAmount,
        method: local ? "LOCAL" : payments[0]?.payment.method || "CASH",
        source: local ? "LOCAL_SIMULATED" : "MANUAL_RECORDED",
        status: local ? "RECORDED" : "PENDING",
        recordedAt: local ? new Date() : null,
        actorId: actor.id,
        reference: "refund:" + credit.id,
      },
    });
  }
  await audit(tx, actor, "billing.credit", invoiceId, reason, {
    creditId: credit.id,
    amountPaise,
    refundAmount,
  });
  return credit;
}
/** Membership reuses the same itemized charge and settlement service. */
export async function issueMembershipInvoice(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    name: string;
    email: string;
    membershipId: string;
    description: string;
    pricePaise: number;
    actor?: Actor;
    method?: PaymentMethod;
  },
) {
  const invoice = await issueInvoice(tx, {
    ...input,
    department: "MEMBERSHIP",
    originId: input.membershipId,
    lines: [
      {
        description: input.description,
        quantity: 1,
        unitPaise: input.pricePaise,
        discountPaise: 0,
        totalPaise: input.pricePaise,
      },
    ],
  });
  await payInvoice(
    tx,
    input.actor || {
      id: input.userId,
      name: input.name,
      email: input.email,
      role: "MEMBER",
    },
    invoice.id,
    input.method || "LOCAL",
  );
  return invoice;
}
export function discountedAmount(paise: number, basisPoints: number) {
  return paise - Math.floor((paise * basisPoints + 5000) / 10000);
}
