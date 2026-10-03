import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { planSchema } from "@/modules/staff/validation";
import { updatePlan } from "@/modules/staff/service";
export const PATCH = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER"]);
  return Response.json({ data: await updatePlan(user.id, planSchema.parse(await jsonBody(request))) });
});
