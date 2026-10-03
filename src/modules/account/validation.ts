import { z } from "zod";
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Use at least two characters.").max(80),
  phone: z.string().trim().regex(/^(\+?[0-9 ()-]{7,20})?$/, "Enter a valid phone number."),
  dateOfBirth: z.union([z.literal(""), z.iso.date()]).refine(value => value === "" || new Date(value) <= new Date() && new Date(value) > new Date("1906-01-01"), "Enter a valid past date of birth."),
}).strict();
