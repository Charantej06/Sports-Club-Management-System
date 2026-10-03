import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  operation,
  assert,
  audit,
  job,
  memberLock,
  courtLock,
  subject,
  clubDay,
  slot,
  clubTime,
  minuteSchema,
  weekRange,
  methodSchema,
  reasonSchema,
  roles,
  type Actor,
  type Tx,
} from "@/modules/operations/core";
import { benefits, priced } from "@/modules/membership/pricing";
import {
  issueInvoice,
  payInvoice,
  creditInvoice,
  balance,
} from "@/modules/billing/service";

export const bookingSchema = z
  .object({
    courtId: z.string().min(1).max(80),
    day: z.iso.date(),
    hour: z.number().int().min(0).max(23),
    minute: minuteSchema,
    trial: z.boolean().default(false),
    userId: z.string().optional(),
    guestName: z.string().trim().min(2).max(80).optional(),
    guestEmail: z.email().optional(),
  })
  .strict();
export const bookingActionSchema = z
  .object({
    action: z.enum(["confirm", "cancel", "checkin"]),
    method: methodSchema.default("LOCAL"),
    reason: reasonSchema.optional(),
    override: z.boolean().default(false),
  })
  .strict();
export type BookingInput = z.input<typeof bookingSchema>;
async function validateSlot(
  tx: Tx,
  courtId: string,
  day: string,
  hour: number,
  minute: number,
  now: Date,
) {
  const settings = await tx.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  assert(
    minute % settings.slotMinutes === 0,
    "SLOT_START",
    `Sessions start every ${settings.slotMinutes} minutes. Choose one of the listed times.`,
    422,
  );
  const startsAt = slot(day, hour, minute),
    endsAt = new Date(+startsAt + 3600000);
  assert(
    startsAt > now &&
      day <=
        new Date(
          +new Date(clubDay(now)) + settings.bookingWindowDays * 86400000,
        )
          .toISOString()
          .slice(0, 10),
    "BOOKING_WINDOW",
    "Choose a future session within the booking window.",
    422,
  );
  assert(
    hour * 60 + minute >= settings.openHour * 60 &&
      hour * 60 + minute + 60 <= settings.closeHour * 60,
    "OPENING_HOURS",
    "Choose a one-hour session within club opening hours.",
    422,
  );
  const court = await tx.court.findUnique({
    where: { id: courtId },
    include: { sport: { select: { name: true, status: true } } },
  });
  assert(
    court && court.status !== "INACTIVE" && court.sport.status !== "INACTIVE",
    "COURT_UNAVAILABLE",
    "Court is unavailable.",
    404,
  );
  assert(
    court.status === "ACTIVE" && court.sport.status === "ACTIVE",
    "COURT_MAINTENANCE",
    `${court.status === "MAINTENANCE" ? court.name : court.sport.name} is under maintenance and cannot be booked right now. Choose an alternative court or sport.`,
  );
  assert(
    !(await tx.courtClosure.count({
      where: {
        courtId,
        active: true,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    })),
    "COURT_CLOSED",
    "This court is closed. Choose an alternative court or time.",
  );
  return { settings, court, startsAt, endsAt };
}
export async function dailyUsed(
  tx: Tx,
  userId: string,
  day: string,
  now = new Date(),
) {
  const ordinary = await tx.reservation.count({
    where: {
      userId,
      kind: "STANDARD",
      clubDay: new Date(day),
      OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
    },
  });
  const social = await tx.socialParticipant.count({
    where: {
      userId,
      OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
      event: { active: true, reservation: { clubDay: new Date(day) } },
    },
  });
  return ordinary + social;
}
async function quota(
  tx: Tx,
  userId: string | null,
  day: string,
  limit: number,
  now: Date,
  includingExisting = false,
) {
  if (userId)
    assert(
      (await dailyUsed(tx, userId, day, now)) <
        limit + (includingExisting ? 1 : 0),
      "DAILY_LIMIT",
      `You can have at most ${limit} sessions per club day, including social play.`,
    );
}
async function courtPrice(
  tx: Tx,
  userId: string | null,
  at: Date,
  base: number,
  trial: boolean,
  trialBps: number,
) {
  const plan = await benefits(tx, userId, at);
  let complimentary = false;
  if (plan?.freeSessionsWeek && userId && !trial) {
    const range = weekRange(at);
    const booked = await tx.reservation.findMany({
      where: {
        userId,
        kind: "STANDARD",
        startsAt: { gte: range.start, lt: range.end },
        OR: [
          { status: "CONFIRMED" },
          { status: "HOLD", holdUntil: { gt: new Date() } },
        ],
      },
      select: { priceSnapshot: true },
    });
    const social = await tx.socialParticipant.findMany({
      where: {
        userId,
        event: {
          active: true,
          reservation: { startsAt: { gte: range.start, lt: range.end } },
        },
        OR: [
          { status: "CONFIRMED" },
          { status: "HOLD", holdUntil: { gt: new Date() } },
        ],
      },
      select: { priceSnapshot: true },
    });
    complimentary =
      [...booked, ...social].filter(
        (b) => (b.priceSnapshot as { complimentary?: boolean }).complimentary,
      ).length < plan.freeSessionsWeek;
  }
  const discountBps = complimentary
    ? 10000
    : trial
      ? trialBps
      : plan?.courtDiscountBps || 0;
  return {
    ...priced(base, 1, discountBps),
    snapshot: {
      membershipId: plan?.membershipId || null,
      plan: plan?.name || "Guest",
      discountBps,
      complimentary,
      trial,
      basePaise: base,
    },
  };
}
export function scheduleWaiting(
  tx: Tx,
  courtId: string,
  startsAt: Date,
  eventId?: string,
  runAt = new Date(),
) {
  return job(tx, "OFFER_WAITLIST", "waiting:" + randomUUID(), {
    courtId,
    startsAt: startsAt.toISOString(),
    eventId: eventId || null,
  }, runAt);
}
async function expireCourt(tx: Tx, courtId: string, now: Date) {
  const expired = await tx.reservation.findMany({
    where: { courtId, status: "HOLD", holdUntil: { lte: now } },
  });
  for (const hold of expired) {
    await tx.reservation.update({
      where: { id: hold.id },
      data: { status: "EXPIRED" },
    });
    await audit(
      tx,
      { id: "system", name: "Worker", email: "", role: "OWNER" },
      "booking.expire",
      hold.id,
      "Checkout hold expired",
    );
    if (hold.invoiceId && hold.pricePaise) {
      const b = await balance(tx, hold.invoiceId);
      if (b.credited < b.invoice.totalPaise)
        await creditInvoice(
          tx,
          {
            id: hold.userId || "system",
            name: "System",
            email: "",
            role: "OWNER",
          },
          hold.invoiceId,
          b.invoice.totalPaise - b.credited,
          "Checkout hold expired",
          "expiry:" + hold.id,
        );
    }
    await tx.waitlistEntry.updateMany({
      where: { reservationId: hold.id, status: "OFFERED" },
      data: { status: "EXPIRED" },
    });
    await scheduleWaiting(tx, courtId, hold.startsAt);
  }
}
async function createHold(
  tx: Tx,
  actor: Actor,
  input: BookingInput,
  now: Date,
) {
  await courtLock(tx, input.courtId);
  await expireCourt(tx, input.courtId, now);
  const { settings, court, startsAt, endsAt } = await validateSlot(
    tx,
    input.courtId,
    input.day,
    input.hour,
    input.minute ?? 0,
    now,
  );
  assert(
    !(await tx.reservation.count({
      where: {
        courtId: court.id,
        status: { in: ["HOLD", "CONFIRMED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    })),
    "SLOT_TAKEN",
    "Someone has already reserved this session. Choose an alternative.",
  );
  const who = await subject(
    tx,
    actor,
    input.userId,
    input.guestName,
    input.guestEmail,
  );
  await memberLock(tx, who.userId);
  await quota(tx, who.userId, input.day, settings.dailySessionLimit, now);
  if (input.trial && who.userId)
    assert(
      !(await tx.reservation.count({
        where: {
          userId: who.userId,
          trial: true,
          OR: [
            { status: "CONFIRMED" },
            { status: "HOLD", holdUntil: { gt: now } },
          ],
        },
      })),
      "TRIAL_USED",
      "The introductory trial is available once per account.",
    );
  const price = await courtPrice(
    tx,
    who.userId,
    startsAt,
    court.hourlyPaise,
    input.trial ?? false,
    settings.trialDiscountBps,
  );
  const holdUntil = new Date(+now + settings.holdMinutes * 60000);
  const reservation = await tx.reservation.create({
    data: {
      userId: who.userId,
      guestName: who.userId ? null : who.name,
      guestEmail: who.userId ? null : who.email,
      courtId: court.id,
      startsAt,
      endsAt,
      clubDay: new Date(input.day),
      status: "HOLD",
      holdUntil,
      pricePaise: price.totalPaise,
      priceSnapshot: price.snapshot,
      trial: input.trial,
    },
  });
  const invoice = await issueInvoice(tx, {
    ...who,
    department: "COURT",
    originId: reservation.id,
    lines: [
      {
        description: `${court.name} · ${input.day} ${String(input.hour).padStart(2, "0")}:${String(input.minute ?? 0).padStart(2, "0")} · ${input.trial ? "trial" : "one hour"}`,
        ...priced(court.hourlyPaise, 1, price.snapshot.discountBps),
      },
    ],
  });
  await tx.reservation.update({
    where: { id: reservation.id },
    data: { invoiceId: invoice.id },
  });
  await job(
    tx,
    "EXPIRE_BOOKING",
    "booking-expiry:" + reservation.id,
    { id: reservation.id },
    holdUntil,
  );
  await audit(tx, actor, "booking.hold", reservation.id, undefined, {
    invoiceId: invoice.id,
  });
  return { ...reservation, invoiceId: invoice.id, court: { name: court.name } };
}
export function holdBooking(
  actor: Actor,
  key: string,
  input: BookingInput,
  now = new Date(),
) {
  roles(actor, ["MEMBER", "RECEPTION", "OWNER"]);
  return operation(actor, key, "booking.hold", input, (tx) =>
    createHold(tx, actor, input, now),
  );
}
export function actBooking(
  actor: Actor,
  key: string,
  id: string,
  input: z.infer<typeof bookingActionSchema>,
  now = new Date(),
) {
  return operation(
    actor,
    key,
    "booking." + input.action,
    { id, ...input },
    async (tx) => {
      const found = await tx.reservation.findUnique({ where: { id } });
      assert(
        found && found.kind === "STANDARD",
        "NOT_FOUND",
        "Booking not found.",
        404,
      );
      if (actor.role === "MEMBER")
        assert(
          found.userId === actor.id,
          "NOT_FOUND",
          "Booking not found.",
          404,
        );
      else roles(actor, ["OWNER", "RECEPTION"]);
      await courtLock(tx, found.courtId);
      await memberLock(tx, found.userId);
      const booking = await tx.reservation.findUniqueOrThrow({ where: { id } });
      const settings = await tx.clubSettings.findUniqueOrThrow({
        where: { id: "club" },
      });
      if (input.action === "confirm") {
        assert(
          booking.status === "HOLD" &&
            booking.holdUntil &&
            booking.holdUntil > now,
          "HOLD_EXPIRED",
          "This checkout hold has expired. Choose a session again.",
        );
        await quota(
          tx,
          booking.userId,
          clubDay(booking.startsAt),
          settings.dailySessionLimit,
          now,
          true,
        );
        const current = await benefits(tx, booking.userId, booking.startsAt);
        assert(
          (booking.priceSnapshot as { membershipId?: string }).membershipId ===
            (current?.membershipId || null),
          "BENEFITS_CHANGED",
          "Your membership changed. Release this hold and review a new price.",
        );
        await payInvoice(tx, actor, booking.invoiceId!, input.method);
        await tx.reservation.update({
          where: { id },
          data: { status: "CONFIRMED", holdUntil: null },
        });
        await tx.waitlistEntry.updateMany({
          where: { reservationId: id, status: "OFFERED" },
          data: { status: "ACCEPTED" },
        });
      } else if (input.action === "cancel") {
        if (["CANCELLED", "EXPIRED"].includes(booking.status)) return booking;
        assert(
          input.reason,
          "REASON_REQUIRED",
          "Enter a reason for cancellation.",
          422,
        );
        assert(
          !input.override || actor.role !== "MEMBER",
          "FORBIDDEN",
          "Only reception can override cancellation policy.",
          403,
        );
        assert(
          booking.status === "HOLD" ||
            input.override ||
            (!booking.checkedInAt &&
              +booking.startsAt - +now >= settings.cancellationHours * 3600000),
          "CANCELLATION_POLICY",
          `Confirmed bookings require ${settings.cancellationHours} hours' notice and cannot be cancelled after check-in.`,
        );
        await tx.reservation.update({
          where: { id },
          data: { status: "CANCELLED", cancellationReason: input.reason },
        });
        if (booking.pricePaise) {
          const b = await balance(tx, booking.invoiceId!);
          if (b.credited < b.invoice.totalPaise)
            await creditInvoice(
              tx,
              actor,
              booking.invoiceId!,
              b.invoice.totalPaise - b.credited,
              input.reason,
              "booking-cancel:" + id,
            );
        }
        await tx.waitlistEntry.updateMany({
          where: { reservationId: id, status: "OFFERED" },
          data: { status: "CANCELLED" },
        });
        await scheduleWaiting(tx, booking.courtId, booking.startsAt);
      } else {
        roles(actor, ["RECEPTION", "OWNER"]);
        assert(
          booking.status === "CONFIRMED" && !booking.checkedInAt,
          "CHECKIN_STATE",
          "This booking is not confirmed or has already checked in.",
        );
        assert(
          now >= new Date(+booking.startsAt - 30 * 60000) &&
            now < booking.endsAt,
          "CHECKIN_WINDOW",
          "Check-in opens 30 minutes before the session.",
        );
        await tx.reservation.update({
          where: { id },
          data: { checkedInAt: now },
        });
      }
      await audit(tx, actor, "booking." + input.action, id, input.reason);
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { court: { select: { name: true } } },
      });
    },
  );
}

export const socialCreateSchema = z
  .object({
    courtId: z.string(),
    day: z.iso.date(),
    hour: z.number().int().min(0).max(23),
    capacity: z.number().int().min(2).max(50).optional(),
    title: z.string().trim().min(3).max(100).default("Friday social play"),
    pricePaise: z.number().int().min(0).max(1000000).optional(),
  })
  .strict();
export function createSocial(
  actor: Actor,
  key: string,
  input: z.infer<typeof socialCreateSchema>,
  now = new Date(),
) {
  roles(actor, ["OWNER", "RECEPTION"]);
  return operation(actor, key, "social.create", input, async (tx) => {
    await courtLock(tx, input.courtId);
    await expireCourt(tx, input.courtId, now);
    const details = await validateSlot(
      tx,
      input.courtId,
      input.day,
      input.hour,
      0,
      now,
    );
    assert(
      new Date(input.day).getUTCDay() === 5,
      "FRIDAY_ONLY",
      "Social sessions take place on Friday.",
      422,
    );
    const reservation = await tx.reservation.create({
      data: {
        courtId: input.courtId,
        userId: null,
        kind: "SOCIAL",
        startsAt: details.startsAt,
        endsAt: details.endsAt,
        clubDay: new Date(input.day),
        status: "CONFIRMED",
        pricePaise: 0,
      },
    });
    const event = await tx.socialEvent.create({
      data: {
        reservationId: reservation.id,
        capacity: input.capacity || details.settings.socialCapacity,
        title: input.title,
        pricePaise: input.pricePaise ?? details.settings.socialPricePaise,
      },
    });
    await audit(tx, actor, "social.create", event.id);
    return event;
  });
}
async function expireParticipants(tx: Tx, eventId: string, now: Date) {
  const expired = await tx.socialParticipant.findMany({
    where: { eventId, status: "HOLD", holdUntil: { lte: now } },
  });
  for (const p of expired) {
    await tx.socialParticipant.update({
      where: { id: p.id },
      data: { status: "EXPIRED" },
    });
    await audit(
      tx,
      { id: "system", name: "Worker", email: "", role: "OWNER" },
      "social.expire",
      p.id,
      "Checkout hold expired",
    );
    if (p.invoiceId && p.pricePaise) {
      const b = await balance(tx, p.invoiceId);
      if (b.credited < b.invoice.totalPaise)
        await creditInvoice(
          tx,
          { id: p.userId, name: "System", email: "", role: "OWNER" },
          p.invoiceId,
          b.invoice.totalPaise - b.credited,
          "Social checkout hold expired",
          "social-expiry:" + p.invoiceId,
        );
    }
    await tx.waitlistEntry.updateMany({
      where: { participantId: p.id, status: "OFFERED" },
      data: { status: "EXPIRED" },
    });
  }
}
async function socialHold(
  tx: Tx,
  actor: Actor,
  eventId: string,
  now: Date,
  offerMinutes?: number,
) {
  const event = await tx.socialEvent.findUnique({
    where: { id: eventId },
    include: { reservation: { include: { court: true } } },
  });
  assert(
    event?.active && event.reservation.startsAt > now,
    "EVENT_UNAVAILABLE",
    "This social session is unavailable.",
  );
  await courtLock(tx, event.reservation.courtId);
  await expireParticipants(tx, eventId, now);
  await memberLock(tx, actor.id);
  const settings = await tx.clubSettings.findUniqueOrThrow({
    where: { id: "club" },
  });
  assert(
    (await tx.socialParticipant.count({
      where: {
        eventId,
        OR: [
          { status: "CONFIRMED" },
          { status: "HOLD", holdUntil: { gt: now } },
        ],
      },
    })) < event.capacity,
    "SOCIAL_FULL",
    "This social session is full. Join its waiting list.",
  );
  const existing = await tx.socialParticipant.findUnique({
    where: { eventId_userId: { eventId, userId: actor.id } },
  });
  assert(
    !existing || !["HOLD", "CONFIRMED"].includes(existing.status),
    "DUPLICATE_PARTICIPATION",
    "You already have a place or an active hold.",
  );
  await quota(
    tx,
    actor.id,
    clubDay(event.reservation.startsAt),
    settings.dailySessionLimit,
    now,
  );
  const price = await courtPrice(
    tx,
    actor.id,
    event.reservation.startsAt,
    event.pricePaise,
    false,
    0,
  );
  const holdUntil = new Date(
    +now + (offerMinutes || settings.holdMinutes) * 60000,
  );
  const p = await tx.socialParticipant.upsert({
    where: { eventId_userId: { eventId, userId: actor.id } },
    create: {
      eventId,
      userId: actor.id,
      status: "HOLD",
      holdUntil,
      pricePaise: price.totalPaise,
      priceSnapshot: price.snapshot,
    },
    update: {
      status: "HOLD",
      holdUntil,
      pricePaise: price.totalPaise,
      priceSnapshot: price.snapshot,
      checkedInAt: null,
      createdAt: now,
    },
  });
  const invoice = await issueInvoice(tx, {
    userId: actor.id,
    name: actor.name,
    email: actor.email,
    department: "COURT",
    originId: "social:" + p.id + ":" + randomUUID(),
    lines: [
      {
        description: event.title + " · " + event.reservation.court.name,
        ...priced(event.pricePaise, 1, price.snapshot.discountBps),
      },
    ],
  });
  await tx.socialParticipant.update({
    where: { id: p.id },
    data: { invoiceId: invoice.id },
  });
  await job(
    tx,
    "EXPIRE_SOCIAL",
    "social-expiry:" + invoice.id,
    { id: p.id, invoiceId: invoice.id },
    holdUntil,
  );
  await audit(tx, actor, "social.hold", p.id);
  return {
    ...p,
    invoiceId: invoice.id,
    title: event.title,
    startsAt: event.reservation.startsAt,
    court: { name: event.reservation.court.name },
  };
}
export function joinSocial(actor: Actor, key: string, eventId: string) {
  return operation(actor, key, "social.join", { eventId }, (tx) =>
    socialHold(tx, actor, eventId, new Date()),
  );
}
export const socialActionSchema = z
  .object({
    action: z.enum(["confirm", "cancel", "checkin", "cancelEvent"]),
    participantId: z.string().optional(),
    method: methodSchema.default("LOCAL"),
    reason: reasonSchema.optional(),
    override: z.boolean().default(false),
  })
  .strict();
export function actSocial(
  actor: Actor,
  key: string,
  eventId: string,
  input: z.infer<typeof socialActionSchema>,
  now = new Date(),
) {
  return operation(
    actor,
    key,
    "social." + input.action,
    { eventId, ...input },
    async (tx) => {
      const event = await tx.socialEvent.findUnique({
        where: { id: eventId },
        include: { reservation: true },
      });
      assert(event, "NOT_FOUND", "Social event not found.", 404);
      await courtLock(tx, event.reservation.courtId);
      if (input.action === "cancelEvent") {
        roles(actor, ["OWNER", "RECEPTION"]);
        assert(
          input.reason,
          "REASON_REQUIRED",
          "Enter a cancellation reason.",
          422,
        );
        if (!event.active) return event;
        const people = await tx.socialParticipant.findMany({
          where: { eventId, status: { in: ["HOLD", "CONFIRMED"] } },
        });
        for (const p of people) {
          await tx.socialParticipant.update({
            where: { id: p.id },
            data: { status: "CANCELLED" },
          });
          if (p.invoiceId && p.pricePaise) {
            const b = await balance(tx, p.invoiceId);
            if (b.credited < b.invoice.totalPaise)
              await creditInvoice(
                tx,
                actor,
                p.invoiceId,
                b.invoice.totalPaise - b.credited,
                input.reason,
                "social-cancel:" + p.invoiceId,
              );
          }
        }
        await tx.socialEvent.update({
          where: { id: eventId },
          data: { active: false },
        });
        await tx.reservation.update({
          where: { id: event.reservationId },
          data: { status: "CANCELLED", cancellationReason: input.reason },
        });
        await tx.waitlistEntry.updateMany({
          where: { eventId, status: { in: ["WAITING", "OFFERED"] } },
          data: { status: "CANCELLED" },
        });
        await scheduleWaiting(
          tx,
          event.reservation.courtId,
          event.reservation.startsAt,
        );
        await audit(tx, actor, "social.cancel-event", eventId, input.reason);
        return { cancelled: true };
      }
      const participant = await tx.socialParticipant.findFirst({
        where: {
          eventId,
          ...(input.participantId
            ? { id: input.participantId }
            : { userId: actor.id }),
        },
      });
      assert(participant, "NOT_FOUND", "Your social place was not found.", 404);
      if (actor.role === "MEMBER")
        assert(
          participant.userId === actor.id,
          "NOT_FOUND",
          "Your social place was not found.",
          404,
        );
      else if (participant.userId !== actor.id)
        roles(actor, ["OWNER", "RECEPTION"]);
      await memberLock(tx, participant.userId);
      if (input.action === "confirm") {
        assert(
          event.active &&
            participant.status === "HOLD" &&
            participant.holdUntil &&
            participant.holdUntil > now,
          "HOLD_EXPIRED",
          "This social hold has expired.",
        );
        const settings = await tx.clubSettings.findUniqueOrThrow({
          where: { id: "club" },
        });
        await quota(
          tx,
          participant.userId,
          clubDay(event.reservation.startsAt),
          settings.dailySessionLimit,
          now,
          true,
        );
        const plan = await benefits(
          tx,
          participant.userId,
          event.reservation.startsAt,
        );
        assert(
          (participant.priceSnapshot as { membershipId?: string })
            .membershipId === (plan?.membershipId || null),
          "BENEFITS_CHANGED",
          "Your membership changed. Cancel this hold and review the new price.",
        );
        await payInvoice(tx, actor, participant.invoiceId!, input.method);
        await tx.socialParticipant.update({
          where: { id: participant.id },
          data: { status: "CONFIRMED", holdUntil: null },
        });
        await tx.waitlistEntry.updateMany({
          where: { participantId: participant.id, status: "OFFERED" },
          data: { status: "ACCEPTED" },
        });
      } else if (input.action === "checkin") {
        roles(actor, ["OWNER", "RECEPTION"]);
        assert(
          participant.status === "CONFIRMED" && !participant.checkedInAt,
          "CHECKIN_STATE",
          "This place is not confirmed or is already checked in.",
        );
        assert(
          now >= new Date(+event.reservation.startsAt - 30 * 60000) &&
            now < event.reservation.endsAt,
          "CHECKIN_WINDOW",
          "Check-in opens 30 minutes before the session.",
        );
        await tx.socialParticipant.update({
          where: { id: participant.id },
          data: { checkedInAt: now },
        });
      } else {
        if (["CANCELLED", "EXPIRED"].includes(participant.status))
          return participant;
        assert(
          input.reason,
          "REASON_REQUIRED",
          "Enter a cancellation reason.",
          422,
        );
        assert(
          !input.override || actor.role !== "MEMBER",
          "FORBIDDEN",
          "Only staff can override cancellation policy.",
          403,
        );
        const settings = await tx.clubSettings.findUniqueOrThrow({
          where: { id: "club" },
        });
        assert(
          participant.status === "HOLD" ||
            input.override ||
            (!participant.checkedInAt &&
              +event.reservation.startsAt - +now >=
                settings.cancellationHours * 3600000),
          "CANCELLATION_POLICY",
          "The cancellation notice period has passed.",
        );
        await tx.socialParticipant.update({
          where: { id: participant.id },
          data: { status: "CANCELLED" },
        });
        if (participant.pricePaise) {
          const b = await balance(tx, participant.invoiceId!);
          if (b.credited < b.invoice.totalPaise)
            await creditInvoice(
              tx,
              actor,
              participant.invoiceId!,
              b.invoice.totalPaise - b.credited,
              input.reason,
              "social-cancel:" + participant.invoiceId,
            );
        }
        await tx.waitlistEntry.updateMany({
          where: { participantId: participant.id, status: "OFFERED" },
          data: { status: "CANCELLED" },
        });
        await scheduleWaiting(
          tx,
          event.reservation.courtId,
          event.reservation.startsAt,
          eventId,
        );
      }
      await audit(
        tx,
        actor,
        "social." + input.action,
        participant.id,
        input.reason,
      );
      return tx.socialParticipant.findUniqueOrThrow({
        where: { id: participant.id },
      });
    },
  );
}

export const waitSchema = z
  .object({
    courtId: z.string(),
    day: z.iso.date(),
    hour: z.number().int().min(0).max(23),
    minute: minuteSchema,
    eventId: z.string().optional(),
  })
  .strict();
export function joinWaiting(
  actor: Actor,
  key: string,
  input: z.input<typeof waitSchema>,
) {
  return operation(actor, key, "waiting.join", input, async (tx) => {
    const now = new Date();
    await courtLock(tx, input.courtId);
    const details = await validateSlot(
      tx,
      input.courtId,
      input.day,
      input.hour,
      input.minute ?? 0,
      now,
    );
    if (input.eventId) {
      const event = await tx.socialEvent.findUnique({
        where: { id: input.eventId },
        include: { reservation: true },
      });
      assert(
        event?.active &&
          event.reservation.courtId === input.courtId &&
          +event.reservation.startsAt === +details.startsAt,
        "EVENT_UNAVAILABLE",
        "Social waiting-list details do not match.",
        422,
      );
    }
    const existing = await tx.waitlistEntry.findUnique({
      where: {
        userId_courtId_startsAt: {
          userId: actor.id,
          courtId: input.courtId,
          startsAt: details.startsAt,
        },
      },
    });
    if (existing && ["WAITING", "OFFERED"].includes(existing.status))
      return existing;
    const active = input.eventId
      ? await tx.socialParticipant.count({ where: {
          userId: actor.id, eventId: input.eventId,
          OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
        } })
      : await tx.reservation.count({ where: {
          userId: actor.id, courtId: input.courtId, startsAt: details.startsAt,
          OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
        } });
    assert(!active, "ALREADY_RESERVED", "You already have a place in this session.", 409);
    const entry = await tx.waitlistEntry.upsert({
      where: {
        userId_courtId_startsAt: {
          userId: actor.id,
          courtId: input.courtId,
          startsAt: details.startsAt,
        },
      },
      create: {
        userId: actor.id,
        courtId: input.courtId,
        startsAt: details.startsAt,
        eventId: input.eventId,
      },
      update: {
        status: "WAITING",
        eventId: input.eventId || null,
        createdAt: now,
        offeredAt: null,
        offerUntil: null,
        reservationId: null,
        participantId: null,
      },
    });
    await scheduleWaiting(tx, input.courtId, details.startsAt, input.eventId);
    await audit(tx, actor, "waiting.join", entry.id);
    return entry;
  });
}
export async function offerNext(
  courtId: string,
  startsAt: Date,
  eventId?: string,
  now = new Date(),
) {
  await db.$transaction(
    async (tx) => {
      await courtLock(tx, courtId);
      await expireCourt(tx, courtId, now);
      if (startsAt <= now) {
        await tx.waitlistEntry.updateMany({
          where: {
            courtId,
            startsAt,
            status: "WAITING",
            eventId: eventId || null,
          },
          data: { status: "EXPIRED" },
        });
        return;
      }
      if (eventId) {
        const event = await tx.socialEvent.findUnique({
          where: { id: eventId },
        });
        if (!event?.active) return;
        await expireParticipants(tx, eventId, now);
        if (
          (await tx.socialParticipant.count({
            where: {
              eventId,
              OR: [
                { status: "CONFIRMED" },
                { status: "HOLD", holdUntil: { gt: now } },
              ],
            },
          })) >= event.capacity
        )
          return;
      } else if (
        await tx.reservation.count({
          where: {
            courtId,
            status: { in: ["HOLD", "CONFIRMED"] },
            startsAt: { lt: new Date(+startsAt + 3600000) },
            endsAt: { gt: startsAt },
          },
        })
      )
        return;
      const settings = await tx.clubSettings.findUniqueOrThrow({
        where: { id: "club" },
      });
      const entries = await tx.waitlistEntry.findMany({
        where: {
          courtId,
          startsAt,
          eventId: eventId || null,
          status: "WAITING",
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { user: true },
      });
      for (const entry of entries) {
        // A queue can visit several users. Never wait while holding another
        // user's lock: competing queues could visit them in reverse order.
        const locks = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${entry.userId}, 0)) AS locked`;
        if (!locks[0]?.locked) {
          await scheduleWaiting(tx, courtId, startsAt, eventId, new Date(+now + 5000));
          return;
        }
        const duplicate = eventId
          ? await tx.socialParticipant.count({ where: {
              userId: entry.userId, eventId,
              OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
            } })
          : await tx.reservation.count({ where: {
              userId: entry.userId, courtId, startsAt,
              OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdUntil: { gt: now } }],
            } });
        if (
          duplicate ||
          !entry.user.emailVerified ||
          (await dailyUsed(tx, entry.userId, clubDay(startsAt), now)) >=
            settings.dailySessionLimit
        ) {
          await tx.waitlistEntry.update({
            where: { id: entry.id },
            data: { status: "SKIPPED" },
          });
          continue;
        }
        const actor: Actor = entry.user;
        const offerUntil = new Date(+now + settings.waitOfferMinutes * 60000);
        const hold = eventId
          ? await socialHold(tx, actor, eventId, now, settings.waitOfferMinutes)
          : await createHold(
              tx,
              actor,
              {
                courtId,
                day: clubDay(startsAt),
                hour: clubTime(startsAt).hour,
                minute: clubTime(startsAt).minute as 0 | 30,
                trial: false,
              },
              now,
            );
        if (!eventId) {
          await tx.reservation.update({
            where: { id: hold.id },
            data: { holdUntil: offerUntil },
          });
          await job(
            tx,
            "EXPIRE_BOOKING",
            "offer-expiry:" + hold.id,
            { id: hold.id },
            offerUntil,
          );
        }
        await tx.waitlistEntry.update({
          where: { id: entry.id },
          data: {
            status: "OFFERED",
            offeredAt: now,
            offerUntil,
            reservationId: eventId ? null : hold.id,
            participantId: eventId ? hold.id : null,
          },
        });
        await tx.staffNotification.upsert({
          where: {
            dedupeKey: "offer:" + entry.id + ":" + offerUntil.toISOString(),
          },
          create: {
            dedupeKey: "offer:" + entry.id + ":" + offerUntil.toISOString(),
            kind: "WAITING_OFFER",
            entityId: entry.id,
            message: `A waiting-list place was offered to ${actor.name}.`,
          },
          update: {},
        });
        if (eventId) await scheduleWaiting(tx, courtId, startsAt, eventId);
        return;
      }
    },
    { timeout: 20000 },
  );
}
export async function expireBookingJob(id: string, now = new Date()) {
  const b = await db.reservation.findUnique({ where: { id } });
  if (b)
    await db.$transaction(async (tx) => {
      await courtLock(tx, b.courtId);
      await expireCourt(tx, b.courtId, now);
    });
}
export async function expireSocialJob(
  id: string,
  invoiceId: string,
  now = new Date(),
) {
  const p = await db.socialParticipant.findUnique({
    where: { id },
    include: { event: { include: { reservation: true } } },
  });
  if (!p || p.invoiceId !== invoiceId) return;
  await db.$transaction(async (tx) => {
    await courtLock(tx, p.event.reservation.courtId);
    await expireParticipants(tx, p.eventId, now);
    await scheduleWaiting(
      tx,
      p.event.reservation.courtId,
      p.event.reservation.startsAt,
      p.eventId,
    );
  });
}

export const closureSchema = z
  .object({
    courtId: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: reasonSchema,
  })
  .strict();
export function addClosure(
  actor: Actor,
  key: string,
  input: z.infer<typeof closureSchema>,
) {
  roles(actor, ["OWNER", "RECEPTION"]);
  return operation(actor, key, "closure.create", input, async (tx) => {
    await courtLock(tx, input.courtId);
    await expireCourt(tx, input.courtId, new Date());
    assert(
      new Date(input.endsAt) > new Date(input.startsAt),
      "DATES",
      "Closure end must follow its start.",
      422,
    );
    const closure = await tx.courtClosure.create({
      data: {
        ...input,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      },
    });
    await audit(tx, actor, "court.close", closure.id, input.reason);
    return closure;
  });
}
export function removeClosure(
  actor: Actor,
  key: string,
  id: string,
  reason: string,
) {
  roles(actor, ["OWNER", "RECEPTION"]);
  return operation(actor, key, "closure.reopen", { id, reason }, async (tx) => {
    const c = await tx.courtClosure.findUnique({ where: { id } });
    assert(c, "NOT_FOUND", "Closure not found.", 404);
    await courtLock(tx, c.courtId);
    await tx.courtClosure.update({ where: { id }, data: { active: false } });
    await audit(tx, actor, "court.reopen", id, reason);
    return { reopened: true };
  });
}
