import { route } from "@/lib/errors";
import { publicData } from "@/modules/public/queries";
export const dynamic = "force-dynamic";
export const GET = route(async () => Response.json({ data: await publicData() }));
