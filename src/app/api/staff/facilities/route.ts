import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { facilitySchema, listFacilities, manageFacility } from "@/modules/facilities/service";

export const GET = route(async (request) => {
  await requireUser(request, ["OWNER", "RECEPTION"]);
  return Response.json({ data: await listFacilities() });
});
// Create or update a sport/court. Owner only; facilities are retired, never deleted, to preserve history.
export const POST = route(async (request) => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER"]);
  return Response.json({ data: await manageFacility(user.id, facilitySchema.parse(await jsonBody(request))) });
});
