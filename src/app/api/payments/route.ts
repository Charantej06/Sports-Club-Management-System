import { z } from "zod";
import { requireUser } from "@/lib/access";
import { route, jsonBody, sameOrigin } from "@/lib/errors";
import { db } from "@/lib/db";
import { assert, keyFrom } from "@/modules/operations/core";
import {
  createIntent,
  intentSchema,
  gatewayConfigured,
  validSignature,
  completeIntent,
} from "@/modules/billing/gateway";
export const GET = route(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("history") === "true") {
    const actor = await requireUser(request);
    return Response.json({
      data: await db.gatewayIntent.findMany({
        where: { userId: actor.id },
        select: {
          id: true,
          kind: true,
          amountPaise: true,
          state: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    });
  }
  if (!url.searchParams.has("id"))
    return Response.json({
      data: {
        local: process.env.PAYMENT_MODE === "local",
        gateway: gatewayConfigured(),
        // Razorpay test keys move no real money; the UI tells testers which card to use.
        testMode: gatewayConfigured() && (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_"),
      },
    });
  const actor = await requireUser(request),
    id = z.uuid().parse(url.searchParams.get("id"));
  const intent = await db.gatewayIntent.findUnique({ where: { id } });
  assert(intent?.userId === actor.id, "NOT_FOUND", "Payment not found.", 404);
  return Response.json({ data: { id: intent.id, state: intent.state } });
});
export const POST = route(async (request) => {
  sameOrigin(request);
  const actor = await requireUser(request);
  return Response.json({
    data: await createIntent(
      actor,
      keyFrom(request),
      intentSchema.parse(await jsonBody(request)),
    ),
  });
});
export const PATCH = route(async (request) => {
  sameOrigin(request);
  const actor = await requireUser(request);
  const input = z
    .object({
      id: z.uuid(),
      paymentId: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
      signature: z.string().length(64),
    })
    .strict()
    .parse(await jsonBody(request));
  const intent = await db.gatewayIntent.findUnique({ where: { id: input.id } });
  assert(
    intent?.userId === actor.id && intent.orderId,
    "NOT_FOUND",
    "Payment not found.",
    404,
  );
  assert(
    gatewayConfigured() &&
      validSignature(
        `${intent.orderId}|${input.paymentId}`,
        input.signature,
        process.env.RAZORPAY_KEY_SECRET!,
      ),
    "SIGNATURE",
    "Invalid payment signature.",
    403,
  );
  await db.job.upsert({
    where: { dedupeKey: "gateway:" + input.paymentId },
    create: {
      kind: "GATEWAY_CAPTURE",
      dedupeKey: "gateway:" + input.paymentId,
      payload: { id: intent.id, paymentId: input.paymentId },
    },
    update: {},
  });
  const result = await completeIntent(intent.id, input.paymentId);
  return Response.json({ data: { id: result.id, state: result.state } });
});
