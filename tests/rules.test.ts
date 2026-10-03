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
