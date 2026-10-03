-- Plans now store a monthly rate. Members choose 1, 3 or 12 months at checkout;
-- longer terms receive the configurable discounts below.
ALTER TABLE "MembershipPlan"
  ADD COLUMN "quarterDiscountBps" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "annualDiscountBps" INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE "MembershipPlan" ALTER COLUMN "durationDays" SET DEFAULT 30;
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "plan_term_discounts"
  CHECK ("quarterDiscountBps" BETWEEN 0 AND 10000 AND "annualDiscountBps" BETWEEN 0 AND 10000);
-- Previous prices covered a 90-day term; convert them to a monthly rate rounded to ₹10.
-- Bumping updatedAt rejects any checkout still open on the old price.
UPDATE "MembershipPlan"
  SET "pricePaise" = GREATEST(100, (ROUND("pricePaise" / 3.0 / 1000) * 1000)::INTEGER),
      "durationDays" = 30,
      "updatedAt" = NOW();
