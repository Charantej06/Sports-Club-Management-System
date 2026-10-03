import { requireUser } from "@/lib/access";
import { route, sameOrigin } from "@/lib/errors";
import { readCard, revokeCard, issueCard } from "@/modules/account/cards";
export const GET = route(async request => {
  const user = await requireUser(request);
  return Response.json({ data: await readCard(user.id) });
});
export const DELETE = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request);
  await revokeCard(user.id);
  return Response.json({ data: { revoked: true } });
});
export const POST = route(async request => {
  sameOrigin(request);
  const user = await requireUser(request);
  await issueCard(user.id);
  return Response.json({ data: { issued: true } });
});
