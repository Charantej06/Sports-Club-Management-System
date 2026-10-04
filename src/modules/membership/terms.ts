export const billingPeriods = ["monthly", "quarterly", "annual"] as const;
export type BillingPeriod = (typeof billingPeriods)[number];

// Existing plan prices are the quarterly (90-day) prices. Keep all amounts in paise.
export function termPrice(quarterlyPaise: number, period: BillingPeriod) {
  if (period === "monthly") return Math.ceil(quarterlyPaise / 3);
  if (period === "annual") return Math.round(quarterlyPaise * 4 * 0.9);
  return quarterlyPaise;
}

export function termDays(period: BillingPeriod, quarterlyDays = 90) {
  return period === "monthly" ? 30 : period === "annual" ? 365 : quarterlyDays;
}
