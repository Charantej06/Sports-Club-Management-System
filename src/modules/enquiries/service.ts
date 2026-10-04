import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
export const enquirySchema = z.object({ name: z.string().trim().min(2).max(80), email: z.email().max(254), message: z.string().trim().min(10).max(1000), sport: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}$/), website: z.string().max(0) }).strict();
export async function saveEnquiry({ website: _honeypot, ...input }: z.infer<typeof enquirySchema>) {
  return db.$transaction(async tx => {
    const email = input.email.toLowerCase();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 1))`;
    const recent = await tx.lead.count({ where: { email, createdAt: { gt: new Date(Date.now() - 3600000) } } });
    if (recent >= 3) throw new AppError(429, "RATE_LIMITED", "Please wait before sending another enquiry.");
    const result = await tx.lead.create({ data: { ...input, email } });
    await tx.staffNotification.create({ data: { kind: "ENQUIRY", entityId: result.id, message: `New ${input.sport} enquiry from ${input.name}` } });
    return { id: result.id };
  });
}
