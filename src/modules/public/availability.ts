import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
export async function availability(sport: string, day: string) {
  const now = new Date();
  const settings = await db.clubSettings.findUniqueOrThrow({ where: { id: "club" } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).format(new Date());
  if (day < today || +new Date(day) > +new Date(today) + settings.bookingWindowDays * 86400000) throw new AppError(422, "BOOKING_WINDOW", `Choose a date within the next ${settings.bookingWindowDays} days.`);
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  const facility = await db.sport.findUnique({ where: { id: sport }, select: { status: true, statusNote: true } });
  if (!facility || facility.status === "INACTIVE") throw new AppError(404, "SPORT_UNAVAILABLE", "This sport is not currently offered.");
  const courts = await db.court.findMany({ where: { sportId: sport, status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, include: {
    reservations: { where: { OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: new Date() } }], startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } },
    closures: { where: { active: true, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true, reason: true } },
  } });
  return courts.map(court => {
    const maintenance = court.status === "MAINTENANCE" || facility.status === "MAINTENANCE";
    const maintenanceReason = (court.status === "MAINTENANCE" ? court.statusNote : facility.statusNote) || "Under maintenance";
    return { id: court.id, name: court.name, indoor: court.indoor, hourlyPaise: court.hourlyPaise, maintenance, maintenanceReason: maintenance ? maintenanceReason : null,
    slots: Array.from({ length: settings.closeHour - settings.openHour }, (_,n) => {
      const hour = settings.openHour + n;
      const startsAt = new Date(start.getTime() + hour * 3600000);
      const endsAt = new Date(startsAt.getTime() + 3600000);
      const closure = court.closures.find(r => r.startsAt < endsAt && r.endsAt > startsAt);
      return { hour, elapsed: startsAt <= now, reason: maintenance ? maintenanceReason : closure?.reason || null, available: !maintenance && startsAt > now && ![...court.reservations, ...court.closures].some(r => r.startsAt < endsAt && r.endsAt > startsAt) };
    }),
  }; });
}
