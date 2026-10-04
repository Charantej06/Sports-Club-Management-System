import { test } from "node:test";
import assert from "node:assert/strict";
import { ageAt, isActive } from "../src/modules/membership/rules";
import { discountedAmount } from "../src/modules/billing/service";
import { profileSchema } from "../src/modules/account/validation";
test("Junior eligibility changes on the eighteenth birthday", () => {
  const birth = new Date("2008-10-04");
  assert.equal(ageAt(birth, new Date("2026-10-03")), 17);
  assert.equal(ageAt(birth, new Date("2026-10-04")), 18);
});
test("Membership eligibility uses half-open confirmed term intervals", () => {
  const term = { startsAt: new Date("2026-01-01"), endsAt: new Date("2026-04-01"), status: "ACTIVE" };
  assert.equal(isActive(term, term.startsAt), true);
  assert.equal(isActive(term, term.endsAt), false);
  assert.equal(isActive({ ...term, status: "SUPERSEDED" }, term.startsAt), false);
});
test("Discounts round half-up once to paise", () => {
  assert.equal(discountedAmount(10001, 1500), 8501);
  assert.equal(discountedAmount(1, 5000), 0);
  assert.equal(discountedAmount(10000, 0), 10000);
});
test("Profile rejects invalid dates, privileged keys and invalid phone numbers", () => {
  assert.equal(profileSchema.safeParse({ name: "Test Player", phone: "", dateOfBirth: "2025-02-30" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Test Player", phone: "call me", dateOfBirth: "" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Test Player", phone: "", dateOfBirth: "", role: "OWNER" }).success, false);
});
test("Mail settings report what is missing without exposing the password", async () => {
  const { mailSettings, describeMailError } = await import("../src/modules/mail/transport");
  const env = { EMAIL_MODE: "smtp", SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_USER: "club@example.com", SMTP_PASSWORD: "hunter2-secret", EMAIL_FROM: "Club <club@example.com>", BETTER_AUTH_URL: "https://club.example.com" };
  const ok = mailSettings(env);
  assert.equal(ok.configured, true);
  assert.equal(ok.secure, true, "port 465 uses implicit TLS");
  assert.equal(JSON.stringify(ok).includes("hunter2"), false);
  assert.deepEqual(mailSettings({ ...env, SMTP_HOST: "", EMAIL_FROM: "" }).missing, ["SMTP_HOST", "EMAIL_FROM"]);
  assert.equal(mailSettings({ ...env, SMTP_PORT: "587" }).secure, false);
  assert.equal(mailSettings({ EMAIL_MODE: "local" }).configured, true);
  const text = describeMailError({ code: "EAUTH", responseCode: 535, response: "535 Login failed for hunter2-secret" }, env);
  assert.match(text, /EAUTH/);
  assert.equal(text.includes("hunter2-secret"), false, "credentials are redacted from stored errors");
});
test("Placeholder addresses stay local and only permanent provider rejections fail fast", async () => {
  const { isUndeliverable, isPermanentFailure } = await import("../src/modules/mail/transport");
  for (const address of ["member@champions.local", "a@example.com", "b@example.org", "c@mail.test", "d@x.invalid", "e@localhost"]) assert.equal(isUndeliverable(address), true, address);
  for (const address of ["player@gmail.com", "owner@clubhouse.in", "x+tag@outlook.com"]) assert.equal(isUndeliverable(address), false, address);
  assert.equal(isPermanentFailure({ responseCode: 550 }), true, "mailbox does not exist");
  assert.equal(isPermanentFailure({ responseCode: 421 }), false, "temporary failures are retried");
  assert.equal(isPermanentFailure(new Error("socket hang up")), false);
});
test("Payment settings explain what is wrong without exposing secrets", async () => {
  const { paymentSettings, verifyProvider } = await import("../src/modules/billing/health");
  const good = { PAYMENT_MODE: "razorpay", RAZORPAY_KEY_ID: "rzp_test_AbCdEf123456", RAZORPAY_KEY_SECRET: "x".repeat(24), RAZORPAY_WEBHOOK_SECRET: "club-webhook-secret", BETTER_AUTH_URL: "https://club.example.com" };
  const ok = paymentSettings(good);
  assert.equal(ok.configured, true);
  assert.equal(ok.testMode, true);
  assert.equal(ok.webhookUrl, "https://club.example.com/api/payments/webhook");
  assert.equal(JSON.stringify(ok).includes("x".repeat(24)), false, "the secret is never returned");
  assert.equal(JSON.stringify(ok).includes("club-webhook-secret"), false);
  assert.deepEqual(paymentSettings({ ...good, RAZORPAY_KEY_SECRET: "" }).missing, ["RAZORPAY_KEY_SECRET"]);
  assert.equal(paymentSettings({ ...good, RAZORPAY_KEY_SECRET: "short" }).warnings.some((w) => /24 characters/.test(w)), true);
  assert.equal(paymentSettings({ ...good, RAZORPAY_WEBHOOK_SECRET: "rzp_test_xyz" }).warnings.some((w) => /looks like a key ID/.test(w)), true);
  assert.equal(paymentSettings({ ...good, RAZORPAY_KEY_ID: "rzp_live_AbCdEf123456" }).testMode, false);
  assert.equal(paymentSettings({ ...good, RAZORPAY_KEY_ID: "rzp_live_AbCdEf123456" }).warnings.some((w) => /real money/.test(w)), true);
  assert.equal(paymentSettings({ ...good, BETTER_AUTH_URL: "http://localhost:3000" }).warnings.some((w) => /webhook/i.test(w)), true);
  assert.equal(paymentSettings({ PAYMENT_MODE: "local" }).configured, true);
  assert.equal(paymentSettings({}).configured, false);
  assert.equal((await verifyProvider({ PAYMENT_MODE: "local" })).ok, true, "local mode needs no provider");
  assert.equal((await verifyProvider({})).ok, false);
  assert.match((await verifyProvider({ ...good, RAZORPAY_KEY_SECRET: "" })).message, /Missing: RAZORPAY_KEY_SECRET/);
});
