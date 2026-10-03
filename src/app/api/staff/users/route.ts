import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { roleSchema } from "@/modules/staff/validation";
import { assignRole } from "@/modules/staff/service";
export const PATCH = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER"]);
  return Response.json({ data: await assignRole(user.id, roleSchema.parse(await jsonBody(request))) });
});
