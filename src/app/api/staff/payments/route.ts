import { z } from "zod";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { jsonBody, route, sameOrigin } from "@/lib/errors";
import { paymentSettings, verifyProvider } from "@/modules/billing/health";

// Owner-only payment health: how online payments are configured (never the secrets) and a live key check.
export const GET = route(async (request) => {
  await requireUser(request, ["OWNER"]);
  const intents = await db.gatewayIntent.groupBy({ by: ["state"], _count: { _all: true } });
  return Response.json({ data: { ...paymentSettings(), intents: Object.fromEntries(intents.map((i) => [i.state, i._count._all])) } });
});
export const POST = route(async (request) => {
  sameOrigin(request);
  await requireUser(request, ["OWNER"]);
  z.object({ action: z.literal("verify") }).strict().parse(await jsonBody(request));
  return Response.json({ data: await verifyProvider() });
});
