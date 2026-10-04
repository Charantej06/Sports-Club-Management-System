import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { job } from "@/modules/operations/core";
import { enqueueMail } from "@/modules/mail/outbox";
import { enquiryAckEmail, enquiryAlertEmail } from "@/modules/mail/notifications";

export const INTERESTS = ["GENERAL", "TRIAL", "BOOKING", "MEMBERSHIP", "SHOP"] as const;
export const enquirySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    phone: z.string().trim().regex(/^[0-9+()\-\s]{7,25}$/, "Enter a valid phone number.").optional().or(z.literal("").transform(() => undefined)),
    message: z.string().trim().min(10).max(1000),
    sport: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}$/).default("general"),
    interest: z.enum(INTERESTS).default("GENERAL"),
    planId: z.enum(["gold", "silver", "junior"]).optional(),
    website: z.string().max(0),
  })
  .strict();
export type EnquiryInput = z.input<typeof enquirySchema>;

const OPEN = ["NEW", "CONTACTED", "QUOTED"];
const specific = (interest: string) => interest !== "GENERAL";

/**
 * A visitor without an account reaches out. The enquiry is never lost: it becomes a lead (or is added to the
 * visitor's open lead if they have written before), reception is notified in the app and by email, the visitor
 * gets an acknowledgement, and a follow-up reminder fires if nobody has contacted them within a day.
 */
export async function saveEnquiry({ website: _honeypot, ...raw }: EnquiryInput) {
  const input = enquirySchema.parse({ ...raw, website: "" });
  return db.$transaction(async (tx) => {
    const email = input.email.toLowerCase();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 1))`;
    const since = new Date(Date.now() - 3600000);
    const recent =
      (await tx.lead.count({ where: { email, createdAt: { gt: since } } })) +
      (await tx.leadActivity.count({ where: { actorId: "visitor", note: { startsWith: "Visitor wrote again" }, createdAt: { gt: since }, lead: { email } } }));
    if (recent >= 5) throw new AppError(429, "RATE_LIMITED", "Please wait before sending another enquiry.");
    const settings = await tx.clubSettings.findUniqueOrThrow({ where: { id: "club" } });
    const existingMember = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const open = await tx.lead.findFirst({ where: { email, status: { in: OPEN } }, orderBy: { createdAt: "desc" } });
    let id: string;
    let merged = false;
    if (open) {
      merged = true;
      id = open.id;
      await tx.lead.update({
        where: { id },
        data: {
          enquiryCount: { increment: 1 },
          phone: open.phone ?? input.phone ?? null,
          interest: specific(input.interest) ? input.interest : open.interest,
          planId: input.planId ?? open.planId,
          memberId: open.memberId ?? existingMember?.id ?? null,
        },
      });
      await tx.leadActivity.create({ data: { leadId: id, actorId: "visitor", note: `Visitor wrote again (${input.interest.toLowerCase()}): ${input.message}`.slice(0, 600) } });
      await tx.staffNotification.create({ data: { kind: "ENQUIRY", entityId: id, message: `${input.name} wrote again (${input.interest.toLowerCase()})` } });
    } else {
      const lead = await tx.lead.create({
        data: {
          name: input.name,
          email,
          phone: input.phone ?? null,
          message: input.message,
          sport: input.sport,
          interest: input.interest,
          planId: input.planId ?? null,
          memberId: existingMember?.id ?? null,
          followUpAt: new Date(Date.now() + 24 * 3600000),
        },
      });
      id = lead.id;
      await tx.leadActivity.create({ data: { leadId: id, actorId: "visitor", note: `Enquiry received via the website (${input.interest.toLowerCase()})${existingMember ? ", already has an account" : ""}.` } });
      await tx.staffNotification.create({ data: { kind: "ENQUIRY", entityId: id, message: `New ${input.interest === "GENERAL" ? input.sport : input.interest.toLowerCase()} enquiry from ${input.name}` } });
      // If nobody has contacted them within a day, remind the front desk.
      await job(tx, "LEAD_FOLLOWUP", `lead-auto:${id}`, { id, at: lead.followUpAt!.toISOString(), auto: true }, lead.followUpAt!);
      await enqueueMail(tx, { ...enquiryAckEmail({ name: input.name, interest: input.interest }), to: email, dedupeKey: `enquiry-ack:${id}` });
    }
    await enqueueMail(tx, { ...enquiryAlertEmail({ name: input.name, email, phone: input.phone ?? open?.phone ?? null, interest: input.interest, message: input.message, repeat: merged }), to: settings.contactEmail });
    return { id, merged };
  });
}
