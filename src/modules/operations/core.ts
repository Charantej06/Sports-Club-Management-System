import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Prisma, User, Role } from "@/generated/prisma/client";
export type Tx = Prisma.TransactionClient;
export type Actor = Pick<User, "id" | "name" | "email" | "role">;
export function roles(actor: Actor, allowed: Role[]) {
  if (!allowed.includes(actor.role))
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
}
export function assert(
  condition: unknown,
  code: string,
  message: string,
  status = 409,
): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function keyFrom(request: Request) {
  return z.uuid().parse(request.headers.get("Idempotency-Key"));
}
export async function operation<T>(
  actor: Actor,
  key: string,
  kind: string,
  input: unknown,
  work: (tx: Tx) => Promise<T>,
) {
  const fingerprint = createHash("sha256")
    .update(canonical({ kind, input }))
    .digest("hex");
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + key}, 8))`;
        const prior = await tx.checkout.findUnique({
          where: { userId_key: { userId: actor.id, key } },
        });
        if (prior) {
          assert(
            prior.fingerprint === fingerprint,
            "IDEMPOTENCY_CONFLICT",
            "This key was already used with different details.",
          );
          return { data: prior.result as T, replayed: true };
        }
        const result = JSON.parse(JSON.stringify(await work(tx))) as T;
        await tx.checkout.create({
          data: {
            userId: actor.id,
            key,
            fingerprint,
            result: result as Prisma.InputJsonValue,
          },
        });
        return { data: result, replayed: false };
      },
      { timeout: 20000, maxWait: 10000 },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    const text = String(error);
    if (
      /P2002|P2004|23P01|23514|exclusion constraint|constraint failed/i.test(
        text,
      )
    )
      throw new AppError(
        409,
        "CONFLICT",
        "This resource changed or is no longer available. Refresh and try again.",
      );
    throw error;
  }
}
export async function memberLock(tx: Tx, userId: string | null) {
  if (userId)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
}
export async function courtLock(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Court" WHERE id=${id} FOR UPDATE`;
}
export function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityId: string,
  reason?: string,
  details?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { actorId: actor.id, action, entityId, reason, details },
  });
}
export function job(
  tx: Tx,
  kind: string,
  dedupeKey: string,
  payload: Prisma.InputJsonValue,
  runAt = new Date(),
) {
  return tx.job.upsert({
    where: { dedupeKey },
    create: { kind, dedupeKey, payload, runAt },
    update: {},
  });
}
export async function subject(
  tx: Tx,
  actor: Actor,
  userId?: string | null,
  guestName?: string,
  guestEmail?: string,
) {
  if (!userId && !guestName) userId = actor.id;
  if (actor.role === "MEMBER") {
    assert(
      !userId || userId === actor.id,
      "FORBIDDEN",
      "You can only use your own account.",
      403,
    );
    userId = actor.id;
  }
  if (userId) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    assert(user, "NOT_FOUND", "Account not found.", 404);
    return { userId: user.id, name: user.name, email: user.email };
  }
  assert(
    guestName && guestName.trim().length >= 2,
    "GUEST_REQUIRED",
    "Enter the guest's name.",
    422,
  );
  return { userId: null, name: guestName.trim(), email: guestEmail || "" };
}
export function clubDay(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    at,
  );
}
export function slot(day: string, hour: number) {
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+05:30`);
}
export function weekRange(at: Date) {
  const day = clubDay(at);
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const start = slot(d.toISOString().slice(0, 10), 0);
  return { start, end: new Date(+start + 7 * 86400000) };
}
export const methodSchema = z.enum(["LOCAL", "CASH", "CARD", "UPI"]);
export const reasonSchema = z.string().trim().min(5).max(300);
