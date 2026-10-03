import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
export async function availability(sport: string, day: string) {
  const settings = await db.clubSettings.findUniqueOrThrow({ where: { id: "club" } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).format(new Date());
  if (day < today || +new Date(day) > +new Date(today) + settings.bookingWindowDays * 86400000) throw new AppError(422, "BOOKING_WINDOW", `Choose a date within the next ${settings.bookingWindowDays} days.`);
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  const courts = await db.court.findMany({ where: { sportId: sport, active: true }, include: {
    reservations: { where: { OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: new Date() } }], startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } },
    closures: { where: { startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } },
  } });
  return courts.map(court => ({ id: court.id, name: court.name, indoor: court.indoor, hourlyPaise: court.hourlyPaise,
    slots: Array.from({ length: settings.closeHour - settings.openHour }, (_,n) => {
      const hour = settings.openHour + n;
      const startsAt = new Date(start.getTime() + hour * 3600000);
      const endsAt = new Date(startsAt.getTime() + 3600000);
      return { hour, available: startsAt > new Date() && ![...court.reservations, ...court.closures].some(r => r.startsAt < endsAt && r.endsAt > startsAt) };
    }),
  }));
}
