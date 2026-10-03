import { z } from "zod";
import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { lookupMember } from "@/modules/staff/service";
export const GET = route(async request => {
  await requireUser(request, ["OWNER", "RECEPTION", "CASHIER"]);
  const query = z.string().trim().min(3).max(120).parse(new URL(request.url).searchParams.get("q"));
  return Response.json({ data: await lookupMember(query) });
});
