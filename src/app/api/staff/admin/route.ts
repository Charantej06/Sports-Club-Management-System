import { requireUser } from "@/lib/access";
import { route, sameOrigin, jsonBody } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  adminSchema,
  adminMutation,
  hrData,
  shiftsData,
} from "@/modules/administration/service";
import { keyFrom } from "@/modules/operations/core";
import { z } from "zod";
export const GET = route(async (request) => {
  const user = await requireUser(request, [
    "OWNER",
    "RECEPTION",
    "CASHIER",
    "KITCHEN",
  ]);
  const url = new URL(request.url),
    area = z.enum(["hr", "cash", "audit", "quotes", "gateway", "mail"])
      .parse(url.searchParams.get("area") || "audit");
  if (area === "hr") return Response.json({ data: await hrData(user) });
  if (area === "cash") return Response.json({ data: await shiftsData(user) });
  if (area === "audit" && user.role !== "OWNER")
    return Response.json({
      data: {
        rows: await db.auditLog.findMany({
          where: { actorId: user.id },
          select: {
            id: true,
            actorId: true,
            action: true,
            entityId: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        next: null,
      },
    });
  await requireUser(request, ["OWNER"]);
  if (area === "quotes")
    return Response.json({
      data: await db.businessQuote.findMany({ orderBy: { createdAt: "desc" } }),
    });
  if (area === "gateway")
    return Response.json({
      data: await db.gatewayIntent.findMany({
        select: {
          id: true,
          userId: true,
          kind: true,
          amountPaise: true,
          orderId: true,
          paymentId: true,
          state: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    });
  if (area === "mail")
    return Response.json({
      data: {
        mode: process.env.EMAIL_MODE || "local",
        configured:
          process.env.EMAIL_MODE !== "smtp" ||
          Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM),
        messages: await db.mailMessage.findMany({
          select: {
            id: true,
            to: true,
            subject: true,
            mode: true,
            status: true,
            membershipId: true,
            sentAt: true,
            createdAt: true,
            jobId: true,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        jobs: await db.job.findMany({
          where: { kind: { in: ["SEND_MAIL", "MEMBERSHIP_REMINDER"] } },
          select: {
            id: true,
            status: true,
            attempts: true,
            lastError: true,
            runAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
      },
    });
  const q = z
      .string()
      .max(150)
      .parse(url.searchParams.get("q") || ""),
    cursor = z
      .string()
      .max(150)
      .optional()
      .parse(url.searchParams.get("cursor") || undefined);
  const rows = await db.auditLog.findMany({
    where: q
      ? {
          OR: [
            { entityId: { contains: q } },
            { actorId: { contains: q } },
            { action: { contains: q } },
          ],
        }
      : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return Response.json({
    data: {
      rows: rows.slice(0, 50),
      next: rows.length > 50 ? rows[49].id : null,
    },
  });
});
export const POST = route(async (request) => {
  sameOrigin(request);
  const actor = await requireUser(request, [
    "OWNER",
    "RECEPTION",
    "CASHIER",
    "KITCHEN",
  ]);
  return Response.json(
    await adminMutation(
      actor,
      keyFrom(request),
      adminSchema.parse(await jsonBody(request)),
    ),
  );
});
