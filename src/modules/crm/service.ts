import { isTermMonths, termDays, termPrice, type TermMonths } from "@/modules/membership/terms";
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
      status: z.enum(["NEW", "CONTACTED", "LOST"]),
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
    })
    .strict(),
  z.object({ action: z.literal("convert") }).strict(),
]);
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
          },
        });
        note = "Quote saved: " + q.id;
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
export async function followupJob(id: string, at: string) {
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id } });
    if (
      !lead ||
      lead.followUpAt?.toISOString() !== at ||
      ["LOST", "CONVERTED"].includes(lead.status)
    )
      return;
    await tx.staffNotification.upsert({
      where: { dedupeKey: `followup:${id}:${at}` },
      create: {
        dedupeKey: `followup:${id}:${at}`,
        kind: "FOLLOW_UP",
        entityId: id,
        message: `Follow up with ${lead.name}${lead.assignedTo ? " (assigned)" : ""}.`,
      },
      update: {},
    });
  });
}
