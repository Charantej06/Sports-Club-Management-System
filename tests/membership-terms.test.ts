import { test } from "node:test";
import assert from "node:assert/strict";
import { billingPeriods, termDays, termPrice } from "../src/modules/membership/terms";

test("Quarterly is the stored base price", () => {
  assert.equal(termPrice(399900, "quarterly"), 399900);
});

test("Monthly and annual are derived from the quarterly price", () => {
  assert.equal(termPrice(399900, "monthly"), 133300);
  assert.equal(termPrice(399900, "annual"), 1439640);
});

test("Annual is cheaper than twelve monthly terms", () => {
  const monthly = termPrice(219900, "monthly");
  const annual = termPrice(219900, "annual");
  assert.ok(annual < monthly * 12);
});

test("Supported periods are monthly, quarterly and annual", () => {
  assert.deepEqual(billingPeriods, ["monthly", "quarterly", "annual"]);
});

test("Term day counts follow billing period", () => {
  assert.equal(termDays("monthly", 90), 30);
  assert.equal(termDays("quarterly", 84), 84);
  assert.equal(termDays("annual", 90), 365);
});
