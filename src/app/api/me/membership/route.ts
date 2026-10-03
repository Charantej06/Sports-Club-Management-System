import { z } from "zod";
import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { purchaseMembership, purchaseSchema } from "@/modules/membership/service";
export const POST = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request);
  const key = z.uuid().parse(request.headers.get("idempotency-key"));
  const result = await purchaseMembership(user.id, key, purchaseSchema.parse(await jsonBody(request)));
  return Response.json({ data: result }, { status: result.replayed ? 200 : 201 });
});
