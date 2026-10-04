import { test } from "node:test";
import assert from "node:assert/strict";
import { ageAt, isActive } from "../src/modules/membership/rules";
import { discountedAmount } from "../src/modules/billing/service";
import { profileSchema } from "../src/modules/account/validation";
import { termDays, termPrice } from "../src/modules/membership/terms";
test("Membership periods derive integer paise and term lengths from the quarterly plan", () => {
  assert.equal(termPrice(650000, "monthly"), 216667);
  assert.equal(termPrice(650000, "quarterly"), 650000);
  assert.equal(termPrice(650000, "annual"), 2340000);
  assert.equal(termDays("monthly"), 30);
  assert.equal(termDays("quarterly"), 90);
  assert.equal(termDays("annual"), 365);
});
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
