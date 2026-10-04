import { isTermMonths, termDays, termLabel, termPrice, type TermMonths } from "@/modules/membership/terms";
import { enqueueMail } from "@/modules/mail/outbox";
import { quoteEmail } from "@/modules/mail/notifications";
import { randomUUID, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  operation,
  assert,
  audit,
  job,
  roles,
  type Actor,
  type Tx,
} from "@/modules/operations/core";
export const crmSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("assign"), staffId: z.string().nullable() })
    .strict(),
  z
    .object({
      action: z.literal("note"),
      note: z.string().trim().min(3).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("followup"),
      at: z.iso.datetime(),
      note: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("status"),
      status: z.enum(["NEW", "CONTACTED", "QUOTED", "LOST"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("quote"),
      planId: z.enum(["gold", "silver", "junior"]),
      months: z
        .number()
        .int()
        .refine(isTermMonths, "Choose 1, 3 or 12 months.")
        .default(1),
      // Email the quote to the visitor straight away (with a link to view it and join).
      send: z.boolean().default(true),
    })
    .strict(),
  z.object({ action: z.literal("emailQuote"), quoteId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("convert") }).strict(),
]);
type QuoteRow = { id: string; planId: string; totalPaise: number; validUntil: Date; token: string; snapshot: unknown };
/** Emails a quote with an unguessable public link; the visitor needs no account to read it. */
async function emailQuote(tx: Tx, lead: { name: string; email: string }, q: QuoteRow) {
  const snap = q.snapshot as { name: string; months?: number; durationDays: number; courtDiscountBps: number; shopDiscountBps: number; foodDiscountBps: number; freeSessionsWeek: number };
  await enqueueMail(tx, {
    ...quoteEmail({
      name: lead.name,
      plan: snap.name,
      term: termLabel(snap.months, snap.durationDays),
      totalPaise: q.totalPaise,
      validUntil: q.validUntil,
      url: `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/quote/${q.token}`,
      benefits: [`${snap.courtDiscountBps / 100}% off courts`, `${snap.shopDiscountBps / 100}% off the shop`, `${snap.foodDiscountBps / 100}% off the clubhouse`, ...(snap.freeSessionsWeek ? [`${snap.freeSessionsWeek} free sessions a week`] : [])],
    }),
    to: lead.email,
  });
  await tx.leadQuote.update({ where: { id: q.id }, data: { sentAt: new Date() } });
  return true;
}
export function actLead(
  actor: Actor,
  key: string,
  id: string,
  input: z.input<typeof crmSchema>,
) {
  roles(actor, ["OWNER", "RECEPTION"]);
  return operation(
    actor,
    key,
    "crm." + input.action,
    { id, ...input },
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
      const lead = await tx.lead.findUnique({ where: { id } });
      assert(lead, "NOT_FOUND", "Enquiry not found.", 404);
      let note: string;
      if (input.action === "assign") {
        if (input.staffId)
          assert(
            await tx.user.findFirst({
              where: {
                id: input.staffId,
                role: { in: ["OWNER", "RECEPTION"] },
              },
            }),
            "ASSIGNEE",
            "Choose an owner or reception employee.",
            422,
          );
        await tx.lead.update({
          where: { id },
          data: { assignedTo: input.staffId },
        });
        note = "Assigned to " + (input.staffId || "unassigned");
      } else if (input.action === "note") note = input.note;
      else if (input.action === "followup") {
        assert(
          new Date(input.at) > new Date(),
          "FOLLOWUP_DATE",
          "Choose a future follow-up time.",
          422,
        );
        await tx.lead.update({
          where: { id },
          data: { followUpAt: new Date(input.at) },
        });
        await job(
          tx,
          "LEAD_FOLLOWUP",
          `followup:${id}:${input.at}`,
          { id, at: input.at },
          new Date(input.at),
        );
        note = input.note;
      } else if (input.action === "status") {
        assert(
          !lead.memberId,
          "CONVERTED_LEAD",
          "A converted enquiry retains its conversion status.",
        );
        await tx.lead.update({ where: { id }, data: { status: input.status } });
        note = "Status: " + input.status;
      } else if (input.action === "quote") {
        const p = await tx.membershipPlan.findUnique({
          where: { id: input.planId },
        });
        assert(p?.active, "PLAN_UNAVAILABLE", "Plan unavailable.");
        const months = (input.months ?? 1) as TermMonths;
        const price = termPrice(p, months);
        const q = await tx.leadQuote.create({
          data: {
            leadId: id,
            planId: p.id,
            snapshot: {
              name: p.name,
              months,
              durationDays: termDays(new Date(), months),
              monthlyPaise: p.pricePaise,
              courtDiscountBps: p.courtDiscountBps,
              shopDiscountBps: p.shopDiscountBps,
              foodDiscountBps: p.foodDiscountBps,
              freeSessionsWeek: p.freeSessionsWeek,
              planVersion: p.updatedAt.toISOString(),
            },
            totalPaise: price.totalPaise,
            validUntil: new Date(Date.now() + 7 * 86400000),
            token: randomBytes(18).toString("hex"),
          },
        });
        if (["NEW", "CONTACTED"].includes(lead.status))
          await tx.lead.update({ where: { id }, data: { status: "QUOTED" } });
        const emailed = (input.send ?? true) ? await emailQuote(tx, lead, q) : false;
        note = `Quote saved: ${q.id}${emailed ? " and emailed to the visitor" : ""}`;
      } else if (input.action === "emailQuote") {
        const q = await tx.leadQuote.findFirst({ where: { id: input.quoteId, leadId: id } });
        assert(q, "NOT_FOUND", "Quote not found.", 404);
        assert(q.validUntil > new Date(), "QUOTE_EXPIRED", "This quote has expired. Save a new one.", 409);
        await emailQuote(tx, lead, q);
        note = "Quote emailed again: " + q.id;
      } else {
        if (lead.memberId) return lead;
        const email = lead.email.toLowerCase();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 1))`;
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          const userId = randomUUID();
          user = await tx.user.create({
            data: {
              id: userId,
              name: lead.name,
              email,
              championsId: "CC-" + randomBytes(5).toString("hex").toUpperCase(),
            },
          });
          await tx.account.create({
            data: {
              id: randomUUID(),
              userId,
              accountId: userId,
              providerId: "credential",
              password: await hashPassword(randomBytes(32).toString("hex")),
            },
          });
          const mailId = randomUUID();
          await tx.job.create({
            data: {
              id: mailId,
              kind: "SEND_MAIL",
              dedupeKey: "conversion:" + id,
              payload: { messageId: mailId },
            },
          });
          await tx.mailMessage.create({
            data: {
              id: mailId,
              jobId: mailId,
              to: email,
              subject: "Your Champions Club account",
              body: `Hello ${lead.name},\nReception has created your Champions Club account. Set a password at ${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/forgot-password and verify your email when signing in. Membership is activated only after a separate reviewed purchase.`,
              mode: process.env.EMAIL_MODE === "smtp" ? "smtp" : "local",
            },
          });
        }
        assert(
          user.role === "MEMBER",
          "ACCOUNT_ROLE",
          "This email belongs to a staff account.",
          422,
        );
        await tx.lead.update({
          where: { id },
          data: { memberId: user.id, status: "CONVERTED", followUpAt: null },
        });
        note = "Linked member " + user.championsId;
      }
      await tx.leadActivity.create({
        data: { leadId: id, actorId: actor.id, note },
      });
      await audit(tx, actor, "crm." + input.action, id);
      return tx.lead.findUniqueOrThrow({
        where: { id },
        include: { activities: true, quotes: true },
      });
    },
  );
}
export async function followupJob(id: string, at: string, auto = false) {
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id } });
    if (
      !lead ||
      lead.followUpAt?.toISOString() !== at ||
      ["LOST", "CONVERTED"].includes(lead.status) ||
      // The automatic one-day reminder only matters while nobody has touched the lead.
      (auto && lead.status !== "NEW")
    )
      return;
    await tx.staffNotification.upsert({
      where: { dedupeKey: `followup:${id}:${at}` },
      create: {
        dedupeKey: `followup:${id}:${at}`,
        kind: "FOLLOW_UP",
        entityId: id,
        message: auto ? `${lead.name} enquired a day ago and has not been contacted yet.` : `Follow up with ${lead.name}${lead.assignedTo ? " (assigned)" : ""}.`,
      },
      update: {},
    });
  });
}
