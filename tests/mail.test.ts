import { test } from "node:test";
import assert from "node:assert/strict";
import { mailSettings, describeMailError, createMailTransport } from "../src/modules/mail/transport";
import { verificationEmail, membershipReminderEmail } from "../src/modules/mail/templates";

test("SMTP settings validate credentials and select provider TLS defaults", () => {
  const env = { EMAIL_MODE: "smtp", SMTP_HOST: "smtp.example.com", EMAIL_FROM: "club@example.com", SMTP_USER: "owner@example.com" };
  assert.deepEqual(mailSettings(env).missing, ["SMTP_PASSWORD"]);
  assert.throws(() => createMailTransport(env), /SMTP_PASSWORD/);
  assert.equal(mailSettings({ ...env, SMTP_PASSWORD: "secret", SMTP_PORT: "465" }).secure, true);
  assert.equal(mailSettings({ ...env, SMTP_PASSWORD: "secret", SMTP_PORT: "587" }).secure, false);
  assert.ok(mailSettings({ ...env, SMTP_PORT: "invalid" }).missing.includes("SMTP_PORT"));
  assert.equal(mailSettings({}).mode, "local");
});
test("SMTP diagnostics redact authentication details", () => {
  const result = describeMailError({ code: "EAUTH", message: "Rejected owner@example.com password123" }, { SMTP_USER: "owner@example.com", SMTP_PASSWORD: "password123" });
  assert.ok(!result.includes("owner@example.com"));
  assert.ok(!result.includes("password123"));
  assert.match(result, /app password/);
});
test("HTML emails escape names, plan names and link attributes while keeping plain text", () => {
  const tpl = verificationEmail('<img src=x>', 'https://example.com/?token=a&next="bad"');
  assert.ok(!tpl.html.includes('<img src=x>'));
  assert.ok(tpl.html.includes('&lt;img'));
  assert.ok(tpl.html.includes('&amp;next=&quot;bad&quot;'));
  assert.ok(tpl.text.includes('<img src=x>'));
  const reminder = membershipReminderEmail("Member", '<script>plan</script>', "2026-10-10", 1);
  assert.ok(!reminder.html.includes('<script>plan'));
  assert.ok(reminder.html.includes('&lt;script&gt;plan'));
});
