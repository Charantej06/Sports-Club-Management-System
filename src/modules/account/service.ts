import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ageAt } from "@/modules/membership/rules";

import { profileSchema } from "./validation";
export { profileSchema } from "./validation";
export async function updateProfile(userId: string, input: z.infer<typeof profileSchema>) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const birth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    const junior = await tx.membership.findFirst({ where: { userId, planId: "junior", status: "ACTIVE", endsAt: { gt: new Date() } } });
    if (junior && (!birth || ageAt(birth, junior.startsAt) >= 18)) throw new AppError(422, "JUNIOR_ELIGIBILITY", "This birth date conflicts with your Junior membership. Contact reception to correct it.");
    await tx.user.update({ where: { id: userId }, data: { name: input.name, phone: input.phone || null, dateOfBirth: birth } });
    await tx.auditLog.create({ data: { actorId: userId, action: "profile.update", entityId: userId, details: { birthdayChanged: user.dateOfBirth?.toISOString() !== birth?.toISOString() } } });
  });
}
