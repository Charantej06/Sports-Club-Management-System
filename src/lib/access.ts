import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { AppError } from "./errors";
import type { Role } from "@/generated/prisma/client";

export async function requireUser(request?: Request, roles?: Role[]) {
  const session = await auth.api.getSession({ headers: request?.headers ?? await headers() });
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  // Roles always come from the database so demotion takes effect immediately.
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
  if (roles && !roles.includes(user.role)) throw new AppError(403, "FORBIDDEN", "You do not have permission for this action.");
  return user;
}
export async function pageUser(roles?: Role[]) {
  try { return await requireUser(undefined, roles); }
  catch (error) {
    if (error instanceof AppError) redirect(error.status === 401 ? "/login" : "/account");
    throw error;
  }
}
