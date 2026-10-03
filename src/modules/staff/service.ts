import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { currentMembership } from "@/modules/membership/service";
import type { planSchema, settingsSchema, roleSchema } from "./validation";
export async function updatePlan(actorId: string, input: z.infer<typeof planSchema>) {
  const { id, ...data } = input;
  const plan = await db.$transaction(async tx => {
    const result = await tx.membershipPlan.update({ where: { id }, data });
    await tx.auditLog.create({ data: { actorId, action: "plan.update", entityId: id, details: data } });
    return result;
  });
  return plan;
}
export async function updateSettings(actorId: string, input: z.infer<typeof settingsSchema>) {
  const settings = await db.$transaction(async tx => {
    const result = await tx.clubSettings.update({ where: { id: "club" }, data: input });
    await tx.auditLog.create({ data: { actorId, action: "settings.update", entityId: "club" } });
    return result;
  });
  return settings;
}
export async function assignRole(actorId: string, input: z.infer<typeof roleSchema>) {
  const result = await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) throw new AppError(404, "NOT_FOUND", "Ask this person to create an account first.");
    if (user.id === actorId) throw new AppError(409, "SELF_ROLE_CHANGE", "You cannot change your own role.");
    await tx.user.update({ where: { id: user.id }, data: { role: input.role } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({ data: { actorId, action: "staff.role", entityId: user.id, details: { from: user.role, to: input.role }, reason: "Owner assigned role" } });
    return { name: user.name, role: input.role };
  });
  return result;
}
export async function lookupMember(query: string) {
  const token = query.startsWith("champions:card:") ? query.slice(15) : null;
  let user;
  if (token) {
    const card = await db.memberCard.findUnique({ where: { token }, include: { user: true } });
    if (!card || card.revokedAt) throw new AppError(404, "CARD_INVALID", "This card is invalid or revoked.");
    user = card.user;
  } else user = await db.user.findFirst({ where: { OR: [{ championsId: query.toUpperCase() }, { email: query.toLowerCase() }] } });
  if (!user) throw new AppError(404, "NOT_FOUND", "Member not found. Use an exact Champions ID or email.");
  const membership = await currentMembership(user.id);
  return { id: user.id, name: user.name, championsId: user.championsId, membership: membership ? { plan: membership.planSnapshot, endsAt: membership.endsAt } : null };
}
