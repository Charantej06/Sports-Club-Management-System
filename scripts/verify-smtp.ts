// Usage: npm run mail:verify            -> checks settings and the SMTP login
//        npm run mail:verify -- you@example.com  -> also sends a real test email
import "dotenv/config";
import { createMailTransport, describeMailError, mailSettings, senderDomain } from "../src/modules/mail/transport";

const settings = mailSettings();
const line = (ok: boolean, text: string) => console.log(`${ok ? "✔" : "✖"} ${text}`);
console.log(`\nEmail mode: ${settings.mode}`);
if (settings.mode !== "smtp") {
  console.log("EMAIL_MODE is not 'smtp', so no real email is sent. Emails go to the Local test inbox in the owner workspace.\nSet EMAIL_MODE=smtp and the SMTP_* values in .env, then run this again. Steps: docs/SMTP.md\n");
  process.exit(0);
}
line(!!settings.host, `SMTP_HOST ${settings.host ?? "(missing)"}`);
line(true, `SMTP_PORT ${settings.port} · ${settings.secure ? "implicit TLS" : settings.port === 587 ? "STARTTLS (required)" : "plain / opportunistic STARTTLS"}`);
line(!!settings.user, `SMTP_USER ${settings.user ?? "(missing)"}`);
line(!!settings.from, `EMAIL_FROM ${settings.from ?? "(missing)"}`);
for (const warning of settings.warnings) console.log(`! ${warning}`);
if (!settings.configured) {
  console.log(`\nMissing: ${settings.missing.join(", ")}. Fix .env and try again.\n`);
  process.exit(1);
}
const transport = createMailTransport();
try {
  await transport.verify();
  line(true, "Connected and logged in successfully.");
} catch (error) {
  line(false, `Connection failed: ${describeMailError(error)}`);
  process.exit(1);
}
const to = process.argv[2];
if (to) {
  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Champions Club SMTP test",
      text: "If you can read this, Champions Club can send email through your SMTP provider.",
      messageId: `<smtp-test-${Date.now()}@${senderDomain()}>`,
    });
    line(true, `Test email accepted by the server for ${to} (${info.response?.split("\n")[0] ?? "ok"}). Check the inbox and spam folder.`);
  } catch (error) {
    line(false, `Send failed: ${describeMailError(error)}`);
    process.exit(1);
  }
} else console.log("\nTip: run `npm run mail:verify -- you@example.com` to send a real test message.");
console.log();
