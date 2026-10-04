import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { slot, clubDay } from "@/modules/operations/core";
import type { courtCreateSchema, courtUpdateSchema } from "./validation";

export type SlotStatus = "AVAILABLE" | "BOOKED" | "HOLD" | "CLOSED";

export type CourtSlotView = {
  hour: number;
  displayTime: string;
  timeRange: string;
  startsAt: string;
  endsAt: string;
  isElapsed: boolean;
  status: SlotStatus;
  booking: {
    id: string;
    customerName: string;
    customerEmail: string | null;
    championsId: string | null;
    kind: string;
    status: string;
    checkedIn: boolean;
    pricePaise: number;
    invoiceId: string | null;
    holdUntil: string | null;
  } | null;
  closure: {
    id: string;
    reason: string;
  } | null;
};

export type CourtScheduleView = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  hourlyPaise: number;
  indoor: boolean;
  active: boolean;
  slots: CourtSlotView[];
  stats: {
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    closedSlots: number;
    occupancyPercent: number;
  };
};

export type ScheduleResult = {
  day: string;
  settings: {
    openHour: number;
    closeHour: number;
    timezone: string;
    bookingWindowDays: number;
  };
  sports: {
    id: string;
    name: string;
    description: string;
    image: string;
    sortOrder: number;
  }[];
  courts: CourtScheduleView[];
  stats: {
    totalCourts: number;
    activeCourts: number;
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    closedSlots: number;
    occupancyRate: number;
  };
};

export async function getCourtSchedule(
  day?: string,
  sportId?: string,
): Promise<ScheduleResult> {
  const settings = await db.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  const selectedDay = day || clubDay(new Date());

  const startOfDay = slot(selectedDay, 0);
  const endOfDay = slot(selectedDay, 24);
  const now = new Date();

  const [sports, courts, reservations, closures] = await Promise.all([
    db.sport.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        sortOrder: true,
      },
    }),
    db.court.findMany({
      where: sportId && sportId !== "all" ? { sportId } : undefined,
      include: {
        sport: { select: { id: true, name: true } },
      },
      orderBy: [{ sport: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    db.reservation.findMany({
      where: {
        startsAt: { gte: startOfDay, lt: endOfDay },
        status: { in: ["CONFIRMED", "HOLD"] },
      },
      include: {
        user: {
          select: { id: true, name: true, championsId: true, email: true },
        },
        socialEvent: { select: { title: true, capacity: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.courtClosure.findMany({
      where: {
        active: true,
        startsAt: { lt: endOfDay },
        endsAt: { gt: startOfDay },
      },
    }),
  ]);

  const courtSchedules: CourtScheduleView[] = courts.map((court) => {
    const slots: CourtSlotView[] = [];
    let courtBookedCount = 0;
    let courtClosedCount = 0;

    for (let h = settings.openHour; h < settings.closeHour; h++) {
      const slotStartsAt = slot(selectedDay, h);
      const slotEndsAt = slot(selectedDay, h + 1);
      const isElapsed = slotStartsAt <= now;

      const closure = closures.find(
        (c) =>
          c.courtId === court.id &&
          c.startsAt < slotEndsAt &&
          c.endsAt > slotStartsAt,
      );

      const res = reservations.find(
        (r) =>
          r.courtId === court.id &&
          r.startsAt < slotEndsAt &&
          r.endsAt > slotStartsAt &&
          (r.status === "CONFIRMED" ||
            (r.status === "HOLD" && (!r.holdUntil || r.holdUntil > now))),
      );

      let status: SlotStatus = "AVAILABLE";
      if (closure) {
        status = "CLOSED";
        courtClosedCount++;
      } else if (res) {
        status = res.status === "HOLD" ? "HOLD" : "BOOKED";
        courtBookedCount++;
      }

      slots.push({
        hour: h,
        displayTime: `${h === 12 ? 12 : h % 12}:00 ${h >= 12 ? "PM" : "AM"}`,
        timeRange: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
        startsAt: slotStartsAt.toISOString(),
        endsAt: slotEndsAt.toISOString(),
        isElapsed,
        status,
        booking: res
          ? {
              id: res.id,
              customerName:
                res.user?.name ||
                res.guestName ||
                (res.kind === "SOCIAL"
                  ? res.socialEvent?.title || "Social Session"
                  : "Member"),
              customerEmail: res.user?.email || res.guestEmail || null,
              championsId: res.user?.championsId || null,
              kind: res.kind,
              status: res.status,
              checkedIn: Boolean(res.checkedInAt),
              pricePaise: res.pricePaise,
              invoiceId: res.invoiceId,
              holdUntil: res.holdUntil?.toISOString() || null,
            }
          : null,
        closure: closure
          ? {
              id: closure.id,
              reason: closure.reason,
            }
          : null,
      });
    }

    const totalCourtSlots = slots.length;
    const availableCourtSlots =
      totalCourtSlots - courtBookedCount - courtClosedCount;

    return {
      id: court.id,
      name: court.name,
      sportId: court.sportId,
      sportName: court.sport.name,
      hourlyPaise: court.hourlyPaise,
      indoor: court.indoor,
      active: court.active,
      slots,
      stats: {
        totalSlots: totalCourtSlots,
        bookedSlots: courtBookedCount,
        availableSlots: availableCourtSlots,
        closedSlots: courtClosedCount,
        occupancyPercent:
          totalCourtSlots - courtClosedCount > 0
            ? Math.round(
                (courtBookedCount / (totalCourtSlots - courtClosedCount)) * 100,
              )
            : 0,
      },
    };
  });

  const totalCourts = courts.length;
  const activeCourts = courts.filter((c) => c.active).length;
  const totalSlots = courtSchedules.reduce(
    (acc, c) => acc + c.stats.totalSlots,
    0,
  );
  const totalBooked = courtSchedules.reduce(
    (acc, c) => acc + c.stats.bookedSlots,
    0,
  );
  const totalAvailable = courtSchedules.reduce(
    (acc, c) => acc + c.stats.availableSlots,
    0,
  );
  const totalClosed = courtSchedules.reduce(
    (acc, c) => acc + c.stats.closedSlots,
    0,
  );

  return {
    day: selectedDay,
    settings: {
      openHour: settings.openHour,
      closeHour: settings.closeHour,
      timezone: settings.timezone,
      bookingWindowDays: settings.bookingWindowDays,
    },
    sports,
    courts: courtSchedules,
    stats: {
      totalCourts,
      activeCourts,
      totalSlots,
      bookedSlots: totalBooked,
      availableSlots: totalAvailable,
      closedSlots: totalClosed,
      occupancyRate:
        totalSlots - totalClosed > 0
          ? Math.round((totalBooked / (totalSlots - totalClosed)) * 100)
          : 0,
    },
  };
}

export async function createCourt(
  actorId: string,
  input: z.infer<typeof courtCreateSchema>,
) {
  const result = await db.$transaction(async (tx) => {
    const sport = await tx.sport.findUnique({
      where: { id: input.sportId },
    });
    if (!sport) {
      throw new AppError(
        404,
        "SPORT_NOT_FOUND",
        "The selected sport does not exist.",
      );
    }

    let courtId = input.id?.trim().toLowerCase();
    if (courtId) {
      const existing = await tx.court.findUnique({ where: { id: courtId } });
      if (existing) {
        throw new AppError(
          409,
          "COURT_EXISTS",
          `A court with ID "${courtId}" already exists.`,
        );
      }
    } else {
      const slugName = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const baseId = slugName
        ? `${input.sportId}-${slugName}`
        : `${input.sportId}-court`;
      courtId = baseId;
      let suffix = 1;
      while (await tx.court.findUnique({ where: { id: courtId } })) {
        suffix++;
        courtId = `${baseId}-${suffix}`;
      }
    }

    const newCourt = await tx.court.create({
      data: {
        id: courtId,
        name: input.name.trim(),
        sportId: input.sportId,
        hourlyPaise: input.hourlyPaise,
        indoor: input.indoor,
        active: input.active,
      },
      include: {
        sport: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "court.create",
        entityId: newCourt.id,
        details: {
          id: newCourt.id,
          name: newCourt.name,
          sportId: newCourt.sportId,
          hourlyPaise: newCourt.hourlyPaise,
          indoor: newCourt.indoor,
          active: newCourt.active,
        },
      },
    });

    return newCourt;
  });

  return result;
}

export async function updateCourt(
  actorId: string,
  input: z.infer<typeof courtUpdateSchema>,
) {
  const { id, ...data } = input;
  const court = await db.$transaction(async (tx) => {
    const existing = await tx.court.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Court not found.");
    }

    const updated = await tx.court.update({
      where: { id },
      data,
      include: { sport: true },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "court.update",
        entityId: id,
        details: data,
      },
    });

    return updated;
  });

  return court;
}
