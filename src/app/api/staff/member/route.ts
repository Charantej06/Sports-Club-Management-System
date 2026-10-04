import { z } from "zod";
import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { memberProfile } from "@/modules/members/service";

// Member history for the front desk (owner and reception). Cashiers only see the limited lookup.
export const GET = route(async (request) => {
  const user = await requireUser(request, ["OWNER", "RECEPTION"]);
  const id = z.string().min(1).max(100).parse(new URL(request.url).searchParams.get("id"));
  return Response.json({ data: await memberProfile(user, id) });
});
