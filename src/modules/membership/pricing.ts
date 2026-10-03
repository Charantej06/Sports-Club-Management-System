import type { Tx } from "@/modules/operations/core";
import { discountedAmount } from "@/modules/billing/service";
export type Benefits = {
  name: string;
  courtDiscountBps: number;
  shopDiscountBps: number;
  foodDiscountBps: number;
  freeSessionsWeek: number;
};
export async function benefits(tx: Tx, userId: string | null, at = new Date()) {
  if (!userId) return null;
  const term = await tx.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
  });
  return term
    ? { ...(term.planSnapshot as Benefits), membershipId: term.id }
    : null;
}
export function priced(unitPaise: number, quantity: number, bps: number) {
  const subtotal = unitPaise * quantity,
    totalPaise = discountedAmount(subtotal, bps);
  return {
    quantity,
    unitPaise,
    discountPaise: subtotal - totalPaise,
    totalPaise,
  };
}
