import { z } from "zod";
export const planSchema = z.object({ id: z.enum(["gold", "silver", "junior"]), pricePaise: z.number().int().min(100).max(100000000), durationDays: z.number().int().min(1).max(730), courtDiscountBps: z.number().int().min(0).max(10000), shopDiscountBps: z.number().int().min(0).max(10000), foodDiscountBps: z.number().int().min(0).max(10000), freeSessionsWeek: z.number().int().min(0).max(14), active: z.boolean() }).strict();
export const settingsSchema = z.object({
  openHour: z.number().int().min(0).max(22), closeHour: z.number().int().min(1).max(24),
  bookingWindowDays: z.number().int().min(1).max(90), dailySessionLimit: z.number().int().min(1).max(10),
  holdMinutes: z.number().int().min(1).max(30), cancellationHours: z.number().int().min(0).max(72),
  waitOfferMinutes: z.number().int().min(5).max(240), socialCapacity: z.number().int().min(2).max(50),
  tabLimitPaise: z.number().int().min(0).max(100000000),
  trialDiscountBps:z.number().int().min(0).max(10000).optional(),
  socialPricePaise:z.number().int().min(0).max(1000000).optional(),
  deliveryFeePaise:z.number().int().min(0).max(1000000).optional(),
  tabDueDays:z.number().int().min(1).max(90).optional(),
  address: z.string().trim().min(5).max(200), contactEmail: z.email(), contactPhone: z.string().min(7).max(25),
  reminderDays: z.array(z.number().int().min(0).max(90)).min(1).max(5),
}).strict().refine(data => data.closeHour > data.openHour, "Closing hour must be after opening hour.");
export const roleSchema = z.object({ email: z.email(), role: z.enum(["MEMBER", "RECEPTION", "CASHIER", "KITCHEN", "OWNER"]) }).strict();
