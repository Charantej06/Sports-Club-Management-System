import { requireUser } from "@/lib/access";
import { accountData } from "@/modules/account/queries";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { profileSchema, updateProfile } from "@/modules/account/service";
export const GET = route(async request => {
  const user = await requireUser(request);
  return Response.json({ data: await accountData(user) });
});
export const PATCH = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request);
  await updateProfile(user.id, profileSchema.parse(await jsonBody(request)));
  return Response.json({ data: { updated: true } });
});
