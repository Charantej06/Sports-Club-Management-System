import { z } from "zod";
import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import {
  getCourtSchedule,
  createCourt,
  updateCourt,
} from "@/modules/staff/courts";
import {
  courtCreateSchema,
  courtUpdateSchema,
} from "@/modules/staff/validation";

export const GET = route(async (request) => {
  await requireUser(request, ["OWNER", "RECEPTION", "CASHIER"]);
  const url = new URL(request.url);
  const day = z.iso
    .date()
    .optional()
    .parse(url.searchParams.get("day") || undefined);
  const sport = z
    .string()
    .max(50)
    .optional()
    .parse(url.searchParams.get("sport") || undefined);

  return Response.json({
    data: await getCourtSchedule(day, sport),
  });
});

export const POST = route(async (request) => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER", "RECEPTION"]);
  const input = courtCreateSchema.parse(await jsonBody(request));
  return Response.json(
    { data: await createCourt(user.id, input) },
    { status: 201 },
  );
});

export const PATCH = route(async (request) => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER", "RECEPTION"]);
  const input = courtUpdateSchema.parse(await jsonBody(request));
  return Response.json({ data: await updateCourt(user.id, input) });
});
