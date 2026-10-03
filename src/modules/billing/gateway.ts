import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  assert,
  audit,
  operation,
  roles,
  type Actor,
} from "@/modules/operations/core";
import { payInvoice } from "./service";
import { verifiedPayment } from "./gateway-context";
import {
  purchaseMembership,
  purchaseSchema,
} from "@/modules/membership/service";
import { ageAt } from "@/modules/membership/rules";
import { actBooking, actSocial } from "@/modules/bookings/service";
import { actOrder } from "@/modules/shop/service";
import { refreshBill } from "@/modules/clubhouse/service";
export const intentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("membership"), input: purchaseSchema }).strict(),
  z
    .object({
      kind: z.enum(["booking", "order", "social", "invoice"]),
      targetId: z.string().min(1).max(150),
    })
    .strict(),
]);
export function gatewayConfigured() {
  return (
    process.env.PAYMENT_MODE === "razorpay" &&
    Boolean(
      process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET &&
        process.env.RAZORPAY_WEBHOOK_SECRET,
    )
  );
}
export function validSignature(
  body: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature, "hex"),
  );
}
async function provider(path: string, body?: unknown) {
  assert(
    gatewayConfigured(),
    "GATEWAY_UNCONFIGURED",
    "Razorpay is not configured. Contact reception.",
    503,
  );
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  assert(
    response.ok,
    "GATEWAY_ERROR",
    "The payment provider could not complete this request. Try again.",
    502,
  );
  return response.json() as Promise<{
    id: string;
    order_id?: string;
    payment_id?: string;
    amount: number;
    currency: string;
    status: string;
  }>;
}
export async function recordGatewayRepayment(
  actor: Actor,
  key: string,
  input: { id: string; refundId: string; reason: string },
) {
  roles(actor, ["OWNER"]);
  const refund = await provider(
    `refunds/${encodeURIComponent(input.refundId)}`,
  );
  return operation(actor, key, "gateway.repayment", input, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GatewayIntent" WHERE id=${input.id} FOR UPDATE`;
    const intent = await tx.gatewayIntent.findUniqueOrThrow({
      where: { id: input.id },
    });
    const prior = await tx.gatewayRepayment.findUnique({
      where: { intentId: intent.id },
    });
    if (prior) {
      assert(
        prior.reference === input.refundId,
        "REFUND_CONFLICT",
        "A different repayment was already recorded.",
      );
      return prior;
    }
    assert(
      intent.state === "NEEDS_REVIEW" &&
        refund.status === "processed" &&
        refund.payment_id === intent.paymentId &&
        refund.amount === intent.amountPaise &&
        refund.currency === "INR",
      "REFUND_UNVERIFIED",
      "A processed full provider refund matching this captured payment is required.",
    );
    const department =
      intent.kind === "membership"
        ? "MEMBERSHIP"
        : intent.kind === "order"
          ? "SHOP"
          : intent.kind === "invoice"
            ? (
                await tx.invoice.findUniqueOrThrow({
                  where: { id: intent.targetId! },
                })
              ).department
            : "COURT";
    const repayment = await tx.gatewayRepayment.create({
      data: {
        intentId: intent.id,
        reference: input.refundId,
        amountPaise: refund.amount,
        department,
        actorId: actor.id,
        reason: input.reason,
      },
    });
    await tx.gatewayIntent.update({
      where: { id: intent.id },
      data: { state: "REPAID" },
    });
    await audit(tx, actor, "gateway.repayment", intent.id, input.reason, {
      reference: input.refundId,
    });
    return repayment;
  });
}
export async function createIntent(
  actor: Actor,
  key: string,
  input: z.infer<typeof intentSchema>,
) {
  roles(actor, ["MEMBER"]);
  assert(
    gatewayConfigured(),
    "GATEWAY_UNCONFIGURED",
    "Online payments are not configured.",
    503,
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"gateway:" + actor.id + key}, 15))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"gateway-target:" + actor.id + input.kind + (input.kind === "membership" ? "" : input.targetId)}, 15))`;
      const prior = await tx.gatewayIntent.findUnique({
        where: { userId_key: { userId: actor.id, key } },
      });
      if (prior) {
        assert(
          prior.fingerprint === fingerprint,
          "IDEMPOTENCY_CONFLICT",
          "This payment key was used with different details.",
        );
        assert(
          prior.orderId,
          "PAYMENT_CREATING",
          "Payment order creation is pending. Retry this request.",
        );
        return {
          id: prior.id,
          orderId: prior.orderId,
          amountPaise: prior.amountPaise,
          keyId: process.env.RAZORPAY_KEY_ID,
        };
      }
      const pending = await tx.gatewayIntent.findFirst({
        where: {
          userId: actor.id,
          kind: input.kind,
          targetId: input.kind === "membership" ? null : input.targetId,
          state: "PENDING",
        },
      });
      if (pending?.orderId) {
        assert(
          pending.fingerprint === fingerprint,
          "PAYMENT_PENDING",
          "A different online checkout is pending. Finish that checkout before starting another.",
        );
        return {
          id: pending.id,
          orderId: pending.orderId,
          amountPaise: pending.amountPaise,
          keyId: process.env.RAZORPAY_KEY_ID,
        };
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id } });
      assert(
        user.emailVerified,
        "EMAIL_UNVERIFIED",
        "Verify your email before online payment.",
        403,
      );
      let amountPaise: number;
      if (input.kind === "membership") {
        const plan = await tx.membershipPlan.findUniqueOrThrow({
          where: { id: input.input.planId },
        });
        assert(
          plan.active &&
            plan.updatedAt.toISOString() === input.input.planVersion,
          "PLAN_CHANGED",
          "Refresh and review the current plan.",
        );
        const terms = await tx.membership.findMany({
          where: {
            userId: actor.id,
            status: "ACTIVE",
            endsAt: { gt: new Date() },
          },
          orderBy: { endsAt: "desc" },
        });
        assert(
          input.input.action !== "purchase" || !terms.length,
          "MEMBERSHIP_EXISTS",
          "Choose renewal or plan change.",
        );
        assert(
          input.input.action !== "renew" ||
            !terms[0] ||
            terms[0].planId === plan.id,
          "PLAN_CHANGE_REQUIRED",
          "Choose change plan.",
        );
        assert(
          input.input.action !== "change" ||
            terms.some((t) => t.startsAt <= new Date() && t.planId !== plan.id),
          "CHANGE_REQUIRED",
          "An active different plan is required.",
        );
        const startsAt =
          input.input.action === "renew" && terms[0]
            ? terms[0].endsAt
            : new Date();
        assert(
          !plan.juniorOnly ||
            (user.dateOfBirth && ageAt(user.dateOfBirth, startsAt) < 18),
          "JUNIOR_ELIGIBILITY",
          "Junior players must be under 18 at term start.",
          422,
        );
        amountPaise = plan.pricePaise;
      } else {
        let invoiceId: string | null = input.targetId;
        if (input.kind === "booking") {
          const r = await tx.reservation.findUnique({
            where: { id: input.targetId },
          });
          assert(
            r?.userId === actor.id &&
              r.status === "HOLD" &&
              r.holdUntil &&
              r.holdUntil > new Date(),
            "HOLD_EXPIRED",
            "Your session hold is unavailable.",
          );
          invoiceId = r.invoiceId;
        } else if (input.kind === "order") {
          const r = await tx.shopOrder.findUnique({
            where: { id: input.targetId },
          });
          assert(
            r?.userId === actor.id &&
              r.status === "HOLD" &&
              r.holdUntil &&
              r.holdUntil > new Date(),
            "HOLD_EXPIRED",
            "Your order hold is unavailable.",
          );
          invoiceId = r.invoiceId;
        } else if (input.kind === "social") {
          const r = await tx.socialParticipant.findUnique({
            where: { id: input.targetId },
          });
          assert(
            r?.userId === actor.id &&
              r.status === "HOLD" &&
              r.holdUntil &&
              r.holdUntil > new Date(),
            "HOLD_EXPIRED",
            "Your social hold is unavailable.",
          );
          invoiceId = r.invoiceId;
        }
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId || "" },
          include: { allocations: true, credits: true },
        });
        assert(
          invoice?.userId === actor.id,
          "NOT_FOUND",
          "Invoice not found.",
          404,
        );
        if (input.kind === "invoice")
          assert(
            invoice.department === "CLUBHOUSE" ||
              invoice.originId.startsWith("business:"),
            "CHECKOUT_REQUIRED",
            "Use the original checkout to confirm this charge.",
          );
        amountPaise = Math.max(
          0,
          invoice.totalPaise -
            invoice.allocations.reduce((s, a) => s + a.amountPaise, 0) -
            invoice.credits.reduce((s, c) => s + c.amountPaise, 0),
        );
      }
      assert(amountPaise > 0, "NO_PAYMENT", "This charge requires no payment.");
      const id = randomUUID();
      const order = await provider("orders", {
        amount: amountPaise,
        currency: "INR",
        receipt: id,
        notes: { intent: id },
      });
      assert(
        order.amount === amountPaise && order.currency === "INR",
        "PROVIDER_AMOUNT",
        "Provider returned an unexpected amount.",
        502,
      );
      await tx.gatewayIntent.create({
        data: {
          id,
          userId: actor.id,
          key,
          fingerprint,
          kind: input.kind,
          targetId: input.kind === "membership" ? null : input.targetId,
          input,
          amountPaise,
          orderId: order.id,
          state: "PENDING",
        },
      });
      return {
        id,
        orderId: order.id,
        amountPaise,
        keyId: process.env.RAZORPAY_KEY_ID,
      };
    },
    { timeout: 30000 },
  );
}
export async function completeIntent(id: string, paymentId: string) {
  const intent = await db.gatewayIntent.findUniqueOrThrow({ where: { id } });
  if (["COMPLETE", "REPAID"].includes(intent.state)) {
    assert(
      intent.paymentId === paymentId,
      "PAYMENT_CONFLICT",
      "Different payment for this completed order.",
    );
    return intent;
  }
  const payment = await provider(`payments/${encodeURIComponent(paymentId)}`);
  assert(
    payment.status === "captured" &&
      payment.order_id === intent.orderId &&
      payment.currency === "INR" &&
      payment.amount === intent.amountPaise,
    "PAYMENT_NOT_CAPTURED",
    "Payment capture is not verified yet. Check the account later.",
  );
  const actor = await db.user.findUniqueOrThrow({
    where: { id: intent.userId },
  });
  if (intent.state === "NEEDS_REVIEW") return intent;
  const input = intentSchema.parse(intent.input);
  try {
    assert(
      actor.role === "MEMBER",
      "ROLE_CHANGED",
      "This account needs staff review.",
    );
    const result = await verifiedPayment.run(
      {
        userId: actor.id,
        amountPaise: intent.amountPaise,
        reference: "razorpay:" + paymentId,
        ...(input.kind === "invoice" ? { invoiceId: input.targetId } : {}),
      },
      async () => {
        if (input.kind === "membership")
          return purchaseMembership(
            actor.id,
            intent.id,
            input.input,
            new Date(),
            { actor, method: "GATEWAY" },
          );
        if (input.kind === "booking")
          return actBooking(actor, intent.id, input.targetId, {
            action: "confirm",
            method: "GATEWAY",
            override: false,
          });
        if (input.kind === "order")
          return actOrder(actor, intent.id, input.targetId, {
            action: "confirm",
            method: "GATEWAY",
          });
        if (input.kind === "social") {
          const p = await db.socialParticipant.findUniqueOrThrow({
            where: { id: input.targetId },
          });
          return actSocial(actor, intent.id, p.eventId, {
            action: "confirm",
            participantId: p.id,
            method: "GATEWAY",
            override: false,
          });
        }
        return operation(
          actor,
          intent.id,
          "gateway.settlement",
          input,
          async (tx) => {
            const ticket = await tx.kitchenTicket.findFirst({
              where: { invoiceId: input.targetId },
            });
            if (ticket)
              await tx.$queryRaw`SELECT id FROM "KitchenOrder" WHERE id=${ticket.orderId} FOR UPDATE`;
            await payInvoice(
              tx,
              actor,
              input.targetId,
              "GATEWAY",
              intent.amountPaise,
            );
            if (ticket) await refreshBill(tx, ticket.orderId);
            await audit(tx, actor, "gateway.settlement", input.targetId);
            return { invoiceId: input.targetId };
          },
        );
      },
    );
    return db.gatewayIntent.update({
      where: { id },
      data: {
        paymentId,
        state: "COMPLETE",
        result: JSON.parse(JSON.stringify(result)),
      },
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return db.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { reference: "razorpay:" + paymentId },
        create: {
          userId: actor.id,
          actorId: actor.id,
          method: "GATEWAY",
          source: "GATEWAY_VERIFIED",
          amountPaise: payment.amount,
          reference: "razorpay:" + paymentId,
        },
        update: {},
      });
      const result = await tx.gatewayIntent.update({
        where: { id },
        data: {
          paymentId,
          state: "NEEDS_REVIEW",
          result: { code: error.code },
        },
      });
      await tx.staffNotification.upsert({
        where: { dedupeKey: "gateway-review:" + id },
        create: {
          dedupeKey: "gateway-review:" + id,
          kind: "PAYMENT_REVIEW",
          entityId: id,
          message:
            "Captured payment needs review: expired/changed checkout. Verify repayment with the provider.",
        },
        update: {},
      });
      await audit(
        tx,
        actor,
        "gateway.review",
        id,
        "Captured payment could not confirm checkout",
        { code: error.code, paymentId },
      );
      return result;
    });
  }
}
