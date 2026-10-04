import { z } from "zod";
import { route } from "@/lib/errors";
import { assert } from "@/modules/operations/core";
import { gatewayConfigured, validSignature } from "@/modules/billing/gateway";
import { db } from "@/lib/db";
export const POST = route(async (request) => {
  assert(
    gatewayConfigured() && Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    "GATEWAY_UNCONFIGURED",
    "Payment provider is unconfigured.",
    503,
  );
  const raw = await request.text();
  assert(raw.length <= 1000000, "TOO_LARGE", "Webhook too large.", 413);
  assert(
    validSignature(
      raw,
      request.headers.get("x-razorpay-signature") || "",
      process.env.RAZORPAY_WEBHOOK_SECRET!,
    ),
    "SIGNATURE",
    "Invalid webhook signature.",
    403,
  );
  const event = z
    .object({ event: z.string(), payload: z.unknown() })
    .parse(JSON.parse(raw));
  if (event.event !== "payment.captured")
    return Response.json({ data: { ignored: true } });
  const payload = z
    .object({
      payment: z.object({
        entity: z.object({
          id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
          order_id: z.string(),
          amount: z.number().int().positive(),
          currency: z.literal("INR"),
          status: z.literal("captured"),
        }),
      }),
    })
    .parse(event.payload);
  const payment = payload.payment.entity;
  const intent = await db.gatewayIntent.findUnique({
    where: { orderId: payment.order_id },
  });
  if (!intent) return Response.json({ data: { ignored: true } });
  assert(
    payment.amount === intent.amountPaise,
    "PAYMENT_AMOUNT",
    "Captured amount does not match the order.",
    422,
  );
  await db.job.upsert({
    where: { dedupeKey: "gateway:" + payment.id },
    create: {
      kind: "GATEWAY_CAPTURE",
      dedupeKey: "gateway:" + payment.id,
      payload: { id: intent.id, paymentId: payment.id },
    },
    update: {},
  });
  return Response.json({ data: { queued: true } });
});
