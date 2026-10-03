import { z } from "zod";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { jsonBody, route, sameOrigin } from "@/lib/errors";
import { queueMail } from "@/modules/mail/service";
import { createMailTransport, describeMailError, mailSettings } from "@/modules/mail/transport";

// Owner-only email health: shows how mail is configured (never the password), tests the SMTP
// connection and queues a test message through the same durable worker used for real emails.
export const GET = route(async (request) => {
  await requireUser(request, ["OWNER"]);
  const counts = await db.mailMessage.groupBy({ by: ["status"], _count: { _all: true } });
  return Response.json({ data: { ...mailSettings(), queue: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) } });
});
export const POST = route(async (request) => {
  sameOrigin(request);
  const user = await requireUser(request, ["OWNER"]);
  const { action } = z.object({ action: z.enum(["verify", "test"]) }).strict().parse(await jsonBody(request));
  const settings = mailSettings();
  if (action === "verify") {
    if (settings.mode !== "smtp") return Response.json({ data: { ok: true, message: "Local mode: emails are stored in the Local test inbox and are not sent. Set EMAIL_MODE=smtp to send real email." } });
    if (!settings.configured) return Response.json({ data: { ok: false, message: `SMTP settings are incomplete. Missing: ${settings.missing.join(", ")}.` } });
    try {
      await createMailTransport().verify();
      return Response.json({ data: { ok: true, message: `Connected to ${settings.host}:${settings.port} and the login was accepted.` } });
    } catch (error) {
      return Response.json({ data: { ok: false, message: describeMailError(error) } });
    }
  }
  await queueMail(user.email, "Champions Club test email", `Hello ${user.name},\n\nThis is a test message from the Champions Club owner workspace. If you can read it in your inbox, email delivery is working.\n\nSent ${new Date().toISOString()}.`);
  return Response.json({ data: { ok: true, message: settings.mode === "smtp" ? `Test email queued for ${user.email}. The worker sends it within a few seconds; check the delivery list below if it does not arrive.` : "Test email stored in the Local test inbox." } });
});
