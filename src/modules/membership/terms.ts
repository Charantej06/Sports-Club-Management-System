// Pure term maths shared by the server, checkout screens and staff forms.
export const TERM_MONTHS = [1, 3, 12] as const;
export type TermMonths = (typeof TERM_MONTHS)[number];
export const TERM_LABELS: Record<TermMonths, string> = { 1: "1 month", 3: "3 months", 12: "Annual" };
export type TermPlan = { pricePaise: number; quarterDiscountBps: number; annualDiscountBps: number };

export function isTermMonths(value: number): value is TermMonths {
  return (TERM_MONTHS as readonly number[]).includes(value);
}
export function termDiscountBps(plan: TermPlan, months: TermMonths) {
  return months === 12 ? plan.annualDiscountBps : months === 3 ? plan.quarterDiscountBps : 0;
}
/**
 * The full price for a term: the monthly rate times months, less the long-term discount.
 * Discounted totals are rounded half-up to a whole rupee so members see clean prices; amounts stay integer paise.
 */
export function termPrice(plan: TermPlan, months: TermMonths) {
  const gross = plan.pricePaise * months;
  const bps = termDiscountBps(plan, months);
  const total = bps ? Math.min(gross, Math.floor((gross * (10000 - bps) + 500000) / 1000000) * 100) : gross;
  return { months, grossPaise: gross, discountPaise: gross - total, totalPaise: total, monthlyEquivalentPaise: Math.round(total / months) };
}
/** Calendar-month arithmetic in UTC; a 31st start date ends on the last day of a shorter month. */
export function addMonths(start: Date, months: number) {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}
export function termDays(start: Date, months: number) {
  return Math.round((+addMonths(start, months) - +start) / 86400000);
}
/** Label for a stored term; terms created before term choices existed only have a day count. */
export function termLabel(months: number | undefined, days: number) {
  return months && isTermMonths(months) ? TERM_LABELS[months] : `${days} days`;
}
