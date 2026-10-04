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
  reminderHour: z.number().int().min(0).max(23).optional(),
  payrollTaxBps: z.number().int().min(0).max(10000).optional(),
  payrollTaxLabel: z.string().trim().min(2).max(100).optional(),
}).strict().refine(data => data.closeHour > data.openHour, "Closing hour must be after opening hour.");
export const roleSchema = z.object({ email: z.email(), role: z.enum(["MEMBER", "RECEPTION", "CASHIER", "KITCHEN", "OWNER"]) }).strict();
export const courtCreateSchema = z.object({
  id: z.string().trim().min(2, "Court ID must be at least 2 characters").max(80).regex(/^[a-z0-9-]+$/i, "Court ID must contain only letters, numbers, and hyphens").optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  sportId: z.string().trim().min(1, "Please select a sport").max(50),
  hourlyPaise: z.number().int().min(0, "Hourly price cannot be negative").max(100000000, "Hourly price cannot exceed 1,00,00,000 paise"),
  indoor: z.boolean().default(false),
  active: z.boolean().default(true),
}).strict();
export const courtUpdateSchema = z.object({
  id: z.string().trim().min(1, "Court ID is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  hourlyPaise: z.number().int().min(0, "Hourly price cannot be negative").max(100000000).optional(),
  indoor: z.boolean().optional(),
  active: z.boolean().optional(),
}).strict();
