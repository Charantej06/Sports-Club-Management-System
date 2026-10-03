import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { issueMembershipInvoice } from "@/modules/billing/service";
import { ageAt } from "./rules";

export const purchaseSchema = z.object({
  planId: z.enum(["gold", "silver", "junior"]),
  action: z.enum(["purchase", "renew", "change"]),
  acceptPolicy: z.literal(true),
  planVersion: z.iso.datetime(),
}).strict();
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export async function purchaseMembership(userId: string, key: string, input: PurchaseInput, now = new Date()) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ planId: input.planId, action: input.action, acceptPolicy: input.acceptPolicy, planVersion: input.planVersion })).digest("hex");
  return db.$transaction(async tx => {
    // The same lock serializes purchase, renewal, plan change and birthday updates.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    const prior = await tx.checkout.findUnique({ where: { userId_key: { userId, key } } });
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This checkout key was used with different details.");
      return { ...prior.result as { membershipId: string; invoiceId: string; startsAt: string; endsAt: string }, replayed: true };
    }
    if (process.env.PAYMENT_MODE !== "local") throw new AppError(503, "PAYMENT_UNCONFIGURED", "Online payments are not configured. Please contact reception.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    // An owner update must wait until this reviewed price has committed.
    await tx.$queryRaw`SELECT id FROM "MembershipPlan" WHERE id=${input.planId} FOR SHARE`;
    const plan = await tx.membershipPlan.findUnique({ where: { id: input.planId } });
    const terms = await tx.membership.findMany({ where: { userId, status: "ACTIVE", endsAt: { gt: now } }, orderBy: { endsAt: "desc" } });
    if (!user.emailVerified) throw new AppError(403, "EMAIL_UNVERIFIED", "Verify your email before purchasing a membership.");
    if (!plan?.active) throw new AppError(404, "PLAN_UNAVAILABLE", "This membership plan is unavailable.");
    if (plan.updatedAt.toISOString() !== input.planVersion) throw new AppError(409, "PLAN_CHANGED", "This plan has changed. Close checkout and refresh the page to review the latest price and benefits.");
    const current = terms.find(t => t.startsAt <= now);
    let startsAt = now;
    if (input.action === "purchase" && terms.length) throw new AppError(409, "MEMBERSHIP_EXISTS", "You already have a membership. Choose renewal or plan change.");
    if (input.action === "renew") {
      const latest = terms[0];
      if (latest && latest.planId !== plan.id) throw new AppError(409, "PLAN_CHANGE_REQUIRED", "Choose change plan to switch your membership.");
      if (latest) startsAt = latest.endsAt;
    }
    if (input.action === "change") {
      if (!current) throw new AppError(409, "NO_ACTIVE_MEMBERSHIP", "Purchase a membership first.");
      if (current.planId === plan.id) throw new AppError(409, "SAME_PLAN", "Choose renewal to extend your current plan.");
    }
    if (plan.juniorOnly && (!user.dateOfBirth || ageAt(user.dateOfBirth, startsAt) >= 18)) throw new AppError(422, "JUNIOR_ELIGIBILITY", "Junior membership requires a date of birth and age under 18 at the start of the term.");
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * 86400000);
    if (input.action === "change") {
      // Immediate plan change: preserve the original term and invoice as history.
      await tx.membership.updateMany({ where: { userId, status: "ACTIVE", endsAt: { gt: now } }, data: { status: "SUPERSEDED" } });
    }
    const membership = await tx.membership.create({ data: {
      userId, planId: plan.id, startsAt, endsAt, pricePaise: plan.pricePaise,
      planSnapshot: { name: plan.name, durationDays: plan.durationDays, courtDiscountBps: plan.courtDiscountBps, shopDiscountBps: plan.shopDiscountBps, foodDiscountBps: plan.foodDiscountBps, freeSessionsWeek: plan.freeSessionsWeek },
    } });
    const invoice = await issueMembershipInvoice(tx, { userId, name: user.name, email: user.email, membershipId: membership.id, description: `${plan.name} membership · ${plan.durationDays} days · ${input.action}`, pricePaise: plan.pricePaise });
    const card = await tx.memberCard.findUnique({ where: { userId } });
    if (!card) await tx.memberCard.create({ data: { userId, token: randomBytes(24).toString("hex") } });
    else if (card.revokedAt) await tx.memberCard.update({ where: { userId }, data: { token: randomBytes(24).toString("hex"), revokedAt: null, issuedAt: now } });
    await tx.auditLog.create({ data: { actorId: userId, action: `membership.${input.action}`, entityId: membership.id, details: { invoiceId: invoice.id, paymentSource: "LOCAL_SIMULATED" } } });
    // Notification/reminder integrations will attach jobs here in stage 3.
    const result = { membershipId: membership.id, invoiceId: invoice.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
    await tx.checkout.create({ data: { userId, key, fingerprint, result } });
    return { ...result, replayed: false };
  });
}

export async function currentMembership(userId: string, at = new Date()) {
  return db.membership.findFirst({ where: { userId, status: "ACTIVE", startsAt: { lte: at }, endsAt: { gt: at } }, orderBy: { startsAt: "desc" } });
}
