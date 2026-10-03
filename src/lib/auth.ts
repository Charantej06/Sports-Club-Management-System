import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { db } from "./db";
import { queueMail } from "@/modules/mail/service";

export const auth = betterAuth({
  appName: "Champions Club",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (process.env.TRUSTED_ORIGINS || "http://localhost:3000").split(","),
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true, minPasswordLength: 10, maxPasswordLength: 128,
    requireEmailVerification: true, autoSignIn: false, revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => { await queueMail(user.email, "Reset your Champions Club password", `Hello ${user.name},\n\nReset your password: ${url}\n\nThis link expires in one hour. If you did not request it, ignore this email.`); },
  },
  emailVerification: {
    sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => { await queueMail(user.email, "Welcome to Champions Club — verify your email", `Hello ${user.name},\n\nVerify your email: ${url}\n\nThis link expires in one hour.`); },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 80, customRules: { "/sign-in/email": { window: 60, max: 10 }, "/sign-up/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60, max: 5 } } },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "MEMBER", input: false },
      championsId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: { before: async user => {
        const name = user.name.trim();
        if (name.length < 2 || name.length > 80) throw new APIError("BAD_REQUEST", { message: "Name must contain 2–80 characters." });
        return { data: { ...user, name, role: "MEMBER", championsId: `CC-${randomBytes(5).toString("hex").toUpperCase()}` } };
      } },
      update: { before: async user => {
        if (user.name !== undefined && (user.name.trim().length < 2 || user.name.length > 80)) throw new APIError("BAD_REQUEST", { message: "Name must contain 2–80 characters." });
        return { data: user };
      } },
    },
  },
});
