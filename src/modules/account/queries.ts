import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export async function accountData(user: User) {
  const [memberships, invoices, bookings, orders] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ where: { userId: user.id }, include: { lines: true, allocations: { include: { payment: true } }, credits: true }, orderBy: { issuedAt: "desc" } }),
    db.reservation.findMany({ where: { userId: user.id }, include: { court: { select: { name: true } } }, orderBy: { startsAt: "desc" } }),
    db.shopOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return { user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, championsId: user.championsId, role: user.role, phone: user.phone, dateOfBirth: user.dateOfBirth }, memberships, invoices, bookings, orders };
}

export function ownedInvoice(userId: string, id: string) {
  return db.invoice.findFirst({ where: { id, userId }, include: { lines: true, allocations: { include: { payment: true } }, credits: true } });
}
