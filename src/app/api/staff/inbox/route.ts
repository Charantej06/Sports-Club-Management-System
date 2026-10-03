import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { AppError, route } from "@/lib/errors";
export const GET = route(async request => {
  await requireUser(request, ["OWNER"]);
  if (process.env.EMAIL_MODE !== "local") throw new AppError(404, "DISABLED", "Local test inbox is disabled.");
  return Response.json({ data: await db.mailMessage.findMany({ where: { mode: "local" }, orderBy: { createdAt: "desc" }, take: 30 }) });
});
