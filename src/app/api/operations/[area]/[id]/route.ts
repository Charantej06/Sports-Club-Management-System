import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { recordData } from "@/modules/operations/queries";
import { mutate } from "@/modules/operations/dispatch";
function path(request: Request) {
  const p = new URL(request.url).pathname.split("/");
  return { area: p.at(-2)!, id: p.at(-1)! };
}
export const GET = route(async (request) => {
  const p = path(request);
  return Response.json({
    data: await recordData(await requireUser(request), p.area, p.id),
  });
});
export const PATCH = route(async (request) => {
  const p = path(request);
  return Response.json(await mutate(request, p.area, p.id));
});
