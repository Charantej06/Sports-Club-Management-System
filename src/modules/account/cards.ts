import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { currentMembership } from "@/modules/membership/service";

export async function readCard(userId: string) {
  if (!await currentMembership(userId)) return null;
  const card = await db.memberCard.findUnique({ where: { userId } });
  if (!card || card.revokedAt) return { revoked: true };
  return { qr: await QRCode.toDataURL(`champions:card:${card.token}`, { width: 240, margin: 2, errorCorrectionLevel: "M" }), issuedAt: card.issuedAt };
}

export async function revokeCard(userId: string) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    await tx.memberCard.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: userId, action: "card.revoke", entityId: userId, reason: "Member revoked card" } });
  });
}

export async function issueCard(userId: string) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    const now = new Date();
    const membership = await tx.membership.findFirst({ where: { userId, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } } });
    if (!membership) throw new AppError(409, "MEMBERSHIP_REQUIRED", "An active membership is required to issue a card.");
    const existing = await tx.memberCard.findUnique({ where: { userId } });
    if (existing && !existing.revokedAt) return;
    const token = randomBytes(24).toString("hex");
    await tx.memberCard.upsert({ where: { userId }, create: { userId, token }, update: { token, revokedAt: null, issuedAt: now } });
    await tx.auditLog.create({ data: { actorId: userId, action: "card.issue", entityId: userId } });
  });
}
