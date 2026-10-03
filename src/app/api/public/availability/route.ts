import { z } from "zod";
import { route } from "@/lib/errors";
import { availability } from "@/modules/public/availability";
export const GET = route(async request => {
  const params = new URL(request.url).searchParams;
  const day = z.iso.date().parse(params.get("date"));
  const sport = z.enum(["tennis", "padel", "badminton", "cricket"]).parse(params.get("sport"));
  return Response.json({ data: await availability(sport, day) });
});
