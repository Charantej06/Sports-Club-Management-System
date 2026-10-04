import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assert, audit, clubDay, operation, roles, type Actor } from "@/modules/operations/core";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    phone: z.string().trim().min(7).max(25).optional(),
    dateOfBirth: z.iso.date().optional(),
  })
  .strict();

/**
 * Front-desk sign-up for someone standing at the counter. The account is created immediately with a
 * Champions ID so a plan can be sold on the spot; the member sets their own password from an emailed
 * invitation. If the email already has a member account, that account is returned instead of a duplicate.
 */
export function registerMember(actor: Actor, key: string, input: z.infer<typeof registerSchema>) {
  roles(actor, ["OWNER", "RECEPTION"]);
  return operation(actor, key, "member.register", input, async (tx) => {
    const email = input.email.toLowerCase();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 1))`;
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      assert(existing.role === "MEMBER", "ACCOUNT_ROLE", "This email belongs to a staff account.", 422);
      return { id: existing.id, name: existing.name, championsId: existing.championsId, created: false };
    }
    if (input.dateOfBirth) assert(new Date(input.dateOfBirth) < new Date(), "DOB", "Date of birth must be in the past.", 422);
    const id = randomUUID();
    const user = await tx.user.create({
      data: {
        id,
        name: input.name,
        email,
        phone: input.phone ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        championsId: "CC-" + randomBytes(5).toString("hex").toUpperCase(),
      },
    });
    await tx.account.create({
      data: { id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(randomBytes(32).toString("hex")) },
    });
    const mailId = randomUUID();
    await tx.job.create({ data: { id: mailId, kind: "SEND_MAIL", dedupeKey: "register:" + id, payload: { messageId: mailId } } });
    await tx.mailMessage.create({
      data: {
        id: mailId,
        jobId: mailId,
        to: email,
        subject: "Welcome to Champions Club: set your password",
        body: `Hello ${input.name},\n\nReception has created your Champions Club account. Your Champions ID is ${user.championsId}.\n\nSet your password at ${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/forgot-password and verify your email when you sign in. You can then book courts, shop and see your membership online.`,
        mode: process.env.EMAIL_MODE === "smtp" ? "smtp" : "local",
      },
    });
    await audit(tx, actor, "member.register", id);
    return { id, name: user.name, championsId: user.championsId, created: true };
  });
}

const outstanding = (invoice: { totalPaise: number; allocations: { amountPaise: number }[]; credits: { amountPaise: number }[] }) =>
  Math.max(0, invoice.totalPaise - invoice.allocations.reduce((n, a) => n + a.amountPaise, 0) - invoice.credits.reduce((n, c) => n + c.amountPaise, 0));

/** A member's history with the club, for the front desk: plan and expiry, visits, purchases and anything unpaid. */
export async function memberProfile(actor: Actor, userId: string) {
  roles(actor, ["OWNER", "RECEPTION"]);
  const now = new Date();
  const user = await db.user.findFirst({ where: { id: userId, role: "MEMBER" }, select: { id: true, name: true, email: true, phone: true, dateOfBirth: true, championsId: true, emailVerified: true, createdAt: true } });
  if (!user) throw new AppError(404, "NOT_FOUND", "Member not found.");
  const [memberships, bookings, social, orders, bills, invoices] = await Promise.all([
    db.membership.findMany({ where: { userId }, orderBy: { startsAt: "desc" }, take: 12 }),
    db.reservation.findMany({ where: { userId, kind: "STANDARD" }, orderBy: { startsAt: "desc" }, take: 12, include: { court: { select: { name: true } } } }),
    db.socialParticipant.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, include: { event: { select: { title: true, reservation: { select: { startsAt: true } } } } } }),
    db.shopOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, totalPaise: true, createdAt: true, channel: true } }),
    db.kitchenOrder.findMany({ where: { memberId: userId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, paymentStatus: true, createdAt: true, table: { select: { name: true } } } }),
    db.invoice.findMany({ where: { userId }, select: { totalPaise: true, allocations: { select: { amountPaise: true } }, credits: { select: { amountPaise: true } } } }),
  ]);
  const current = memberships.find((m) => m.status === "ACTIVE" && m.startsAt <= now && m.endsAt > now) ?? null;
  const upcoming = memberships.filter((m) => m.status === "ACTIVE" && m.startsAt > now).at(-1) ?? null;
  const lastEnd = (upcoming ?? current)?.endsAt ?? null;
  const today = clubDay(now);
  const visits = bookings.filter((b) => b.checkedInAt);
  return {
    member: user,
    current: current ? { plan: current.planSnapshot as { name: string }, startsAt: current.startsAt, endsAt: current.endsAt, pricePaise: current.pricePaise } : null,
    daysLeft: lastEnd ? Math.ceil((+lastEnd - +now) / 86400000) : null,
    expiredOn: !current && memberships[0] ? memberships[0].endsAt : null,
    memberships: memberships.map((m) => ({ id: m.id, plan: (m.planSnapshot as { name: string }).name, startsAt: m.startsAt, endsAt: m.endsAt, status: m.status, pricePaise: m.pricePaise })),
    today: bookings.filter((b) => clubDay(b.startsAt) === today && ["HOLD", "CONFIRMED"].includes(b.status)).map((b) => ({ id: b.id, court: b.court.name, startsAt: b.startsAt, status: b.status, checkedInAt: b.checkedInAt })),
    bookings: bookings.map((b) => ({ id: b.id, court: b.court.name, startsAt: b.startsAt, status: b.status, checkedInAt: b.checkedInAt, pricePaise: b.pricePaise })),
    social: social.map((p) => ({ id: p.id, title: p.event.title, startsAt: p.event.reservation.startsAt, status: p.status })),
    orders,
    bills: bills.map((b) => ({ id: b.id, table: b.table.name, status: b.status, paymentStatus: b.paymentStatus, createdAt: b.createdAt })),
    visitCount: visits.length,
    lastVisit: visits[0]?.checkedInAt ?? null,
    outstandingPaise: invoices.reduce((n, i) => n + outstanding(i), 0),
    lifetimePaidPaise: invoices.reduce((n, i) => n + i.allocations.reduce((s, a) => s + a.amountPaise, 0) - i.credits.reduce((s, c) => s + c.amountPaise, 0), 0),
  };
}
