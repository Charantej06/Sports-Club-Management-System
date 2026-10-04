import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, termDays, termLabel, termPrice, TERM_MONTHS } from "../src/modules/membership/terms";

const gold = { pricePaise: 399900, quarterDiscountBps: 500, annualDiscountBps: 1500 };

test("One month is the monthly rate with no discount", () => {
  assert.deepEqual(termPrice(gold, 1), { months: 1, grossPaise: 399900, discountPaise: 0, totalPaise: 399900, monthlyEquivalentPaise: 399900 });
});
test("Three-month and annual terms apply their discounts and round to a whole rupee", () => {
  const quarter = termPrice(gold, 3);
  assert.equal(quarter.grossPaise, 1199700);
  assert.equal(quarter.totalPaise, 1139700);
  assert.equal(quarter.totalPaise % 100, 0);
  const annual = termPrice(gold, 12);
  assert.equal(annual.totalPaise, 4079000);
  assert.equal(annual.discountPaise, annual.grossPaise - annual.totalPaise);
});
test("Longer terms are always cheaper per month than shorter ones", () => {
  const monthly = TERM_MONTHS.map((m) => termPrice(gold, m).monthlyEquivalentPaise);
  assert.ok(monthly[0] > monthly[1] && monthly[1] > monthly[2]);
});
test("A term can never cost more than its undiscounted price", () => {
  const plan = { pricePaise: 100, quarterDiscountBps: 0, annualDiscountBps: 10000 };
  assert.equal(termPrice(plan, 12).totalPaise, 0);
  assert.equal(termPrice({ ...plan, annualDiscountBps: 1 }, 12).totalPaise <= 1200, true);
});
test("Calendar months clamp to the end of shorter months", () => {
  assert.equal(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(addMonths(new Date("2027-01-31T10:00:00Z"), 1).toISOString(), "2027-02-28T10:00:00.000Z");
  assert.equal(addMonths(new Date("2028-01-31T10:00:00Z"), 1).toISOString(), "2028-02-29T10:00:00.000Z");
  assert.equal(addMonths(new Date("2026-10-04T00:00:00Z"), 12).toISOString(), "2027-10-04T00:00:00.000Z");
  assert.equal(addMonths(new Date("2026-11-30T00:00:00Z"), 3).toISOString(), "2027-02-28T00:00:00.000Z");
});
test("Term day counts and labels", () => {
  assert.equal(termDays(new Date("2026-10-04T00:00:00Z"), 12), 365);
  assert.equal(termLabel(3, 90), "3 months");
  assert.equal(termLabel(undefined, 90), "90 days");
});
