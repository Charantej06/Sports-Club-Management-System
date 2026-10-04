import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { courtLock, type Tx } from "@/modules/operations/core";

const status = z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]);
const note = z.string().trim().max(200).optional();
const name = z.string().trim().min(2).max(60);
const image = z.string().regex(/^\/images\/[A-Za-z0-9._-]+$/, "Choose one of the club's local images.");
const ratePaise = z.number().int().min(0).max(100000000);

export const facilitySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createSport"), name, description: z.string().trim().min(10).max(400), image }).strict(),
  z.object({ action: z.literal("updateSport"), id: z.string().min(1).max(60), name: name.optional(), description: z.string().trim().min(10).max(400).optional(), image: image.optional(), status: status.optional(), statusNote: note }).strict(),
  z.object({ action: z.literal("createCourt"), sportId: z.string().min(1).max(60), name: name.optional(), hourlyPaise: ratePaise, indoor: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal("updateCourt"), id: z.string().min(1).max(80), name: name.optional(), hourlyPaise: ratePaise.optional(), indoor: z.boolean().optional(), status: status.optional(), statusNote: note }).strict(),
]);
export type FacilityInput = z.infer<typeof facilitySchema>;

const slug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function requireNote(next: "ACTIVE" | "MAINTENANCE" | "INACTIVE" | undefined, text: string | undefined) {
  if (next === "MAINTENANCE" && !text?.trim())
    throw new AppError(422, "NOTE_REQUIRED", "Add a short maintenance note, for example the expected reopening date. Customers will see it.");
}
/** A cleared note is stored as null; the note only makes sense while the facility is not active. */
function noteFor(next: string | undefined, text: string | undefined) {
  if (next === "ACTIVE") return null;
  return text === undefined ? undefined : text.trim() || null;
}
async function audit(tx: Tx, actorId: string, action: string, entityId: string, details: Record<string, unknown>) {
  await tx.auditLog.create({ data: { actorId, action, entityId, details: details as never } });
}

export async function listFacilities() {
  const now = new Date();
  const [sports, upcoming] = await Promise.all([
    db.sport.findMany({ orderBy: { sortOrder: "asc" }, include: { courts: { orderBy: { name: "asc" } } } }),
    db.reservation.groupBy({ by: ["courtId"], where: { status: { in: ["HOLD", "CONFIRMED"] }, startsAt: { gt: now } }, _count: { _all: true } }),
  ]);
  const counts = new Map(upcoming.map((row) => [row.courtId, row._count._all]));
  return sports.map((sport) => ({
    ...sport,
    courts: sport.courts.map((court) => ({ ...court, upcomingBookings: counts.get(court.id) ?? 0 })),
  }));
}

export async function manageFacility(actorId: string, input: FacilityInput) {
  return db.$transaction(async (tx) => {
    if (input.action === "createSport") {
      const base = slug(input.name);
      if (!base) throw new AppError(422, "NAME", "Enter a sport name using letters or numbers.");
      if (await tx.sport.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } }))
        throw new AppError(409, "SPORT_EXISTS", "A sport with this name already exists.");
      let id = base;
      for (let n = 2; await tx.sport.findUnique({ where: { id } }); n++) id = `${base}-${n}`;
      const sortOrder = ((await tx.sport.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
      const sport = await tx.sport.create({ data: { id, name: input.name, description: input.description, image: input.image, sortOrder } });
      await audit(tx, actorId, "sport.create", id, { name: input.name });
      return sport;
    }
    if (input.action === "updateSport") {
      const current = await tx.sport.findUnique({ where: { id: input.id } });
      if (!current) throw new AppError(404, "NOT_FOUND", "Sport not found.");
      const next = input.status ?? current.status;
      requireNote(input.status, input.statusNote ?? current.statusNote ?? undefined);
      if (input.name && input.name.toLowerCase() !== current.name.toLowerCase() && (await tx.sport.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } })))
        throw new AppError(409, "SPORT_EXISTS", "A sport with this name already exists.");
      const sport = await tx.sport.update({
        where: { id: input.id },
        data: { name: input.name, description: input.description, image: input.image, status: input.status, statusNote: noteFor(next, input.statusNote) },
      });
      await audit(tx, actorId, "sport.update", input.id, { from: current.status, to: sport.status, note: sport.statusNote });
      return sport;
    }
    if (input.action === "createCourt") {
      const sport = await tx.sport.findUnique({ where: { id: input.sportId }, include: { courts: { select: { id: true, name: true } } } });
      if (!sport) throw new AppError(404, "NOT_FOUND", "Sport not found.");
      const label = sport.id === "cricket" ? "Net" : "Court";
      const suffix = (courtId: string) => Number(courtId.slice(sport.id.length + 1)) || 0;
      let n = Math.max(0, ...sport.courts.map((c) => suffix(c.id))) + 1;
      while (await tx.court.findUnique({ where: { id: `${sport.id}-${n}` } })) n++;
      const courtName = input.name ?? `${sport.name} ${label} ${n}`;
      if (sport.courts.some((c) => c.name.toLowerCase() === courtName.toLowerCase()))
        throw new AppError(409, "COURT_EXISTS", "This sport already has a court with that name.");
      const court = await tx.court.create({ data: { id: `${sport.id}-${n}`, sportId: sport.id, name: courtName, hourlyPaise: input.hourlyPaise, indoor: input.indoor } });
      await audit(tx, actorId, "court.create", court.id, { name: court.name, hourlyPaise: court.hourlyPaise });
      return court;
    }
    // updateCourt: serialize with in-flight bookings on this court.
    await courtLock(tx, input.id);
    const current = await tx.court.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError(404, "NOT_FOUND", "Court not found.");
    const next = input.status ?? current.status;
    requireNote(input.status, input.statusNote ?? current.statusNote ?? undefined);
    if (input.name && input.name.toLowerCase() !== current.name.toLowerCase() && (await tx.court.findFirst({ where: { sportId: current.sportId, name: { equals: input.name, mode: "insensitive" } } })))
      throw new AppError(409, "COURT_EXISTS", "This sport already has a court with that name.");
    const court = await tx.court.update({
      where: { id: input.id },
      data: { name: input.name, hourlyPaise: input.hourlyPaise, indoor: input.indoor, status: input.status, statusNote: noteFor(next, input.statusNote) },
    });
    await audit(tx, actorId, "court.update", input.id, { from: { status: current.status, hourlyPaise: current.hourlyPaise }, to: { status: court.status, hourlyPaise: court.hourlyPaise }, note: court.statusNote });
    return court;
  });
}
