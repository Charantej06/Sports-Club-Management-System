import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
export async function queueMail(to: string, subject: string, body: string) {
  const id = randomUUID();
  await db.$transaction(async tx => {
    await tx.job.create({ data: { id, kind: "SEND_MAIL", dedupeKey: `mail:${id}`, payload: { messageId: id } } });
    await tx.mailMessage.create({ data: { id, jobId: id, to, subject, body, mode: process.env.EMAIL_MODE === "smtp" ? "smtp" : "local" } });
  });
}
