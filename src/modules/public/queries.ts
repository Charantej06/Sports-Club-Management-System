import { db } from "@/lib/db";
export async function publicData() {
  const [sports, plans, products, menu, settings] = await Promise.all([
    db.sport.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { sortOrder: "asc" }, include: { courts: { where: { status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, hourlyPaise: true, indoor: true, status: true, statusNote: true } } } }),
    db.membershipPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { active: true }, include: { variants: { select: { id: true, label: true, pricePaise: true, stock: true, reserved: true } } }, orderBy: { name: "asc" } }),
    db.menuItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.clubSettings.findUniqueOrThrow({ where: { id: "club" } }),
  ]);
  return {
    sports, plans: plans.map(({ updatedAt, ...plan }) => ({ ...plan, planVersion: updatedAt.toISOString() })),
    products: products.map(p => ({ ...p, variants: p.variants.map(v => ({ id: v.id, label: v.label, pricePaise: v.pricePaise, available: Math.max(0, v.stock - v.reserved) })) })),
    menu, settings: { timezone: settings.timezone, openHour: settings.openHour, closeHour: settings.closeHour, bookingWindowDays: settings.bookingWindowDays, dailySessionLimit:settings.dailySessionLimit,slotMinutes:settings.slotMinutes,cancellationHours:settings.cancellationHours,deliveryFeePaise:settings.deliveryFeePaise, address: settings.address, contactEmail: settings.contactEmail, contactPhone: settings.contactPhone },
  };
}
