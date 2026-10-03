import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { enquirySchema, saveEnquiry } from "@/modules/enquiries/service";
export const POST = route(async request => {
  sameOrigin(request);
  return Response.json({ data: await saveEnquiry(enquirySchema.parse(await jsonBody(request))) }, { status: 201 });
});
