import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import type { Job } from "@/generated/prisma/client";
export async function processNextJob() {
  const jobs = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET status='RUNNING', "lockedAt"=NOW(), attempts=attempts+1
    WHERE id = (SELECT id FROM "Job" WHERE
      (status='PENDING' AND "runAt"<=NOW()) OR
      (status='RUNNING' AND "lockedAt"<NOW()-INTERVAL '5 minutes')
      ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`;
  const job = jobs[0];
  if (!job) return false;
  try {
    if (job.kind !== "SEND_MAIL") throw new Error("Unsupported job kind");
    const message = await db.mailMessage.findUniqueOrThrow({ where: { jobId: job.id } });
    if (message.status !== "DELIVERED") {
      if (message.mode === "smtp") {
        if (!process.env.SMTP_HOST) throw new Error("SMTP is not configured");
        const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === "465", connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
        await transport.sendMail({ from: process.env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.body, messageId: `<${message.id}@champions.local>` });
      }
      await db.mailMessage.update({ where: { id: message.id }, data: { status: "DELIVERED", sentAt: new Date() } });
    }
    await db.job.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } });
  } catch {
    // No email bodies, tokens or SMTP credentials in errors or logs.
    await db.job.update({ where: { id: job.id }, data: { status: job.attempts >= 5 ? "FAILED" : "PENDING", lockedAt: null, runAt: new Date(Date.now() + Math.min(3600, 2 ** job.attempts * 10) * 1000), lastError: "Delivery failed; check integration configuration." } });
  }
  return true;
}
