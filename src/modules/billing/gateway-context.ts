import { AsyncLocalStorage } from "node:async_hooks";
export const verifiedPayment = new AsyncLocalStorage<{
  userId: string;
  amountPaise: number;
  reference: string;
  invoiceId?: string;
}>();
