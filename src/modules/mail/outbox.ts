import { randomUUID } from "node:crypto";
import type { Tx } from "@/modules/operations/core";

/**
 * Queues an email inside the caller's transaction. The message exists only if the surrounding change
 * (a purchase, a booking, an enquiry…) commits, so nobody is emailed about something that was rolled back.
 * A dedupe key makes retries of the same business event send one email, not two.
 */
export async function enqueueMail(tx: Tx, mail: { to: string; subject: string; text: string; html?: string; dedupeKey?: string }) {
  const id = randomUUID();
  const dedupeKey = mail.dedupeKey ?? `mail:${id}`;
  if (mail.dedupeKey && (await tx.job.findUnique({ where: { dedupeKey }, select: { id: true } }))) return null;
  await tx.job.create({ data: { id, kind: "SEND_MAIL", dedupeKey, payload: { messageId: id } } });
  await tx.mailMessage.create({
    data: { id, jobId: id, to: mail.to, subject: mail.subject, body: mail.text, html: mail.html ?? null, mode: process.env.EMAIL_MODE === "smtp" ? "smtp" : "local" },
  });
  return id;
}
