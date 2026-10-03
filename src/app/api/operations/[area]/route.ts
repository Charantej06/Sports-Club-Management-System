import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { operationsData, socialList } from "@/modules/operations/queries";
import { mutate } from "@/modules/operations/dispatch";
import { z } from "zod";
function area(request: Request) {
  return new URL(request.url).pathname.split("/").at(-1)!;
}
export const GET = route(async (request) => {
  const a = area(request);
  if (a === "social") return Response.json({ data: await socialList() });
  const user = await requireUser(request);
  const url = new URL(request.url);
  const day = z.iso
      .date()
      .optional()
      .parse(url.searchParams.get("day") || undefined),
    q = z
      .string()
      .max(120)
      .parse(url.searchParams.get("q") || "");
  return Response.json({ data: await operationsData(user, a, day, q) });
});
export const POST = route(async (request) =>
  Response.json(await mutate(request, area(request))),
);
