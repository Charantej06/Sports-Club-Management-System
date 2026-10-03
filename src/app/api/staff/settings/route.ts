import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { settingsSchema } from "@/modules/staff/validation";
import { updateSettings } from "@/modules/staff/service";
export const PATCH = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER"]);
  return Response.json({ data: await updateSettings(user.id, settingsSchema.parse(await jsonBody(request))) });
});
export const GET = route(async request => {
  await requireUser(request, ["OWNER"]);
  return Response.json({ data: await db.clubSettings.findUniqueOrThrow({ where: { id: "club" } }) });
});
import { db } from "@/lib/db";
