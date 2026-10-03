import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { clubDay, slot, memberLock, type Tx } from "@/modules/operations/core";
export async function scheduleReminders(
  tx: Tx,
  userId: string,
  now = new Date(),
) {
  await memberLock(tx, userId);
  const settings = await tx.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  const terms = await tx.membership.findMany({
    where: { userId, status: "ACTIVE", endsAt: { gte: slot(clubDay(now), 0) } },
    orderBy: { endsAt: "desc" },
  });
  const latest = terms[0];
  const messages = await tx.mailMessage.findMany({
    where: {
      membershipId: { not: null },
      to: (await tx.user.findUniqueOrThrow({ where: { id: userId } })).email,
    },
    select: { id: true, jobId: true, membershipId: true, status: true },
  });
  const desired: string[] = [];
  if (latest) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    for (const days of [...new Set(settings.reminderDays)]) {
      const date = new Date(clubDay(latest.endsAt));
      date.setUTCDate(date.getUTCDate() - days);
      const day = date.toISOString().slice(0, 10);
      if (day < clubDay(now)) continue;
      const dedupeKey = `membership:${latest.id}:${days}`,
        runAt = slot(day, settings.reminderHour);
      const task = await tx.job.upsert({
        where: { dedupeKey },
        create: {
          kind: "MEMBERSHIP_REMINDER",
          dedupeKey,
          payload: { userId, membershipId: latest.id, days },
          runAt,
        },
        update: {},
      });
      desired.push(task.id);
      if (task.status === "PENDING" || task.status === "CANCELLED") {
        await tx.job.update({
          where: { id: task.id },
          data: { runAt, status: "PENDING" },
        });
        const plan = latest.planSnapshot as { name: string };
        const body = `Hello ${user.name},\n\nYour ${plan.name} membership expires on ${clubDay(latest.endsAt)} (Asia/Kolkata), ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}.\nRenew your membership: ${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/memberships\n\nChampions Club`;
        await tx.mailMessage.upsert({
          where: { jobId: task.id },
          create: {
            id: randomUUID(),
            jobId: task.id,
            membershipId: latest.id,
            to: user.email,
            subject: `${plan.name} membership expiry · ${days} days`,
            body,
            mode: process.env.EMAIL_MODE === "smtp" ? "smtp" : "local",
          },
          update: { status: "QUEUED", body },
        });
      }
    }
  }
  const obsolete = messages.filter(
    (m) =>
      !desired.includes(m.jobId) &&
      !["DELIVERED", "SUPPRESSED"].includes(m.status),
  );
  if (obsolete.length) {
    await tx.job.updateMany({
      where: {
        id: { in: obsolete.map((m) => m.jobId) },
        status: { not: "DONE" },
      },
      data: { status: "CANCELLED", lockedAt: null },
    });
    await tx.mailMessage.updateMany({
      where: { id: { in: obsolete.map((m) => m.id) } },
      data: { status: "SUPPRESSED" },
    });
  }
}
export async function synchronizeReminders() {
  const users = await db.membership.findMany({
    where: { status: "ACTIVE", endsAt: { gte: slot(clubDay(new Date()), 0) } },
    distinct: ["userId"],
    select: { userId: true },
  });
  for (const { userId } of users)
    await db.$transaction((tx) => scheduleReminders(tx, userId), {
      timeout: 20000,
    });
}
