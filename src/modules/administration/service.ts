import { z } from "zod";
import { db } from "@/lib/db";
import {
  assert,
  audit,
  operation,
  roles,
  reasonSchema,
  cashLock,
  type Actor,
  type Tx,
} from "@/modules/operations/core";
import { issueInvoice, type ChargeLine } from "@/modules/billing/service";
import { recordGatewayRepayment } from "@/modules/billing/gateway";
const paise = z.number().int().min(0).max(100000000);
const id = z.string().min(1).max(150);
const interval = { startsAt: z.iso.datetime(), endsAt: z.iso.datetime() };
export const adminSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("gatewayRepayment"),
      id,
      refundId: z.string().regex(/^rfnd_[a-zA-Z0-9]+$/),
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("employee"),
      email: z.email(),
      title: z.string().trim().min(2).max(100),
      salaryPaise: paise,
      active: z.boolean(),
    })
    .strict(),
  z
    .object({ action: z.literal("shift"), employeeId: id, ...interval })
    .strict(),
  z
    .object({ action: z.literal("shiftCancel"), id, reason: reasonSchema })
    .strict(),
  z
    .object({
      action: z.literal("leave"),
      employeeId: id,
      ...interval,
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("leaveDecision"),
      id,
      status: z.enum(["APPROVED", "REJECTED"]),
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("payslip"),
      employeeId: id,
      period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      adjustmentPaise: z.number().int().min(-100000000).max(100000000),
      reason: reasonSchema,
    })
    .strict(),
  z.object({ action: z.literal("cashOpen"), openingPaise: paise }).strict(),
  z
    .object({
      action: z.literal("cashPayout"),
      id,
      amountPaise: paise.refine((v) => v > 0),
      reason: reasonSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("cashClose"),
      id,
      countedPaise: paise,
      reason: z.string().trim().max(300),
    })
    .strict(),
  z
    .object({
      action: z.literal("quote"),
      customerName: z.string().trim().min(2).max(150),
      customerEmail: z.email(),
      department: z.enum(["MEMBERSHIP", "COURT", "SHOP", "CLUBHOUSE"]),
      validUntil: z.iso.datetime(),
      lines: z
        .array(
          z
            .object({
              description: z.string().trim().min(2).max(200),
              quantity: z.number().int().min(1).max(1000),
              unitPaise: paise,
            })
            .strict(),
        )
        .min(1)
        .max(30),
    })
    .strict(),
  z.object({ action: z.literal("quoteInvoice"), id }).strict(),
  z.object({ action: z.literal("retryMail"), id }).strict(),
]);
export async function cashTotals(tx: Tx, shiftId: string) {
  const [payments, refunds, payouts] = await Promise.all([
    tx.payment.findMany({ where: { cashShiftId: shiftId, method: "CASH" } }),
    tx.refund.findMany({
      where: { cashShiftId: shiftId, method: "CASH", status: "RECORDED" },
    }),
    tx.cashPayout.findMany({ where: { shiftId } }),
  ]);
  const receiptsPaise = payments.reduce((s, p) => s + p.amountPaise, 0),
    refundsPaise = refunds.reduce((s, r) => s + r.amountPaise, 0),
    payoutsPaise = payouts.reduce((s, p) => s + p.amountPaise, 0);
  return {
    receiptsPaise,
    refundsPaise,
    payoutsPaise,
    payments,
    refunds,
    payouts,
  };
}
async function employeeLock(tx: Tx, employeeId: string) {
  await tx.$queryRaw`SELECT id FROM "Employee" WHERE id=${employeeId} FOR UPDATE`;
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  assert(employee, "NOT_FOUND", "Employee not found.", 404);
  return employee;
}
export async function adminMutation(
  actor: Actor,
  key: string,
  input: z.infer<typeof adminSchema>,
) {
  if (input.action === "gatewayRepayment")
    return recordGatewayRepayment(actor, key, input);
  roles(
    actor,
    input.action.startsWith("cash")
      ? ["OWNER", "RECEPTION", "CASHIER"]
      : input.action === "leave"
        ? ["OWNER", "RECEPTION", "CASHIER", "KITCHEN"]
        : ["OWNER"],
  );
  return operation(actor, key, "admin." + input.action, input, async (tx) => {
    if (input.action === "employee") {
      const user = await tx.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      assert(
        user && user.role !== "MEMBER",
        "STAFF_REQUIRED",
        "Assign a staff role to this account first.",
        422,
      );
      const result = await tx.employee.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          title: input.title,
          salaryPaise: input.salaryPaise,
          active: input.active,
        },
        update: {
          title: input.title,
          salaryPaise: input.salaryPaise,
          active: input.active,
        },
      });
      await audit(tx, actor, "employee.configure", result.id);
      return result;
    }
    if (input.action === "shift" || input.action === "leave") {
      const employee = await employeeLock(tx, input.employeeId);
      assert(
        actor.role === "OWNER" || employee.userId === actor.id,
        "FORBIDDEN",
        "You can only request your own leave.",
        403,
      );
      assert(employee.active, "INACTIVE", "This employee is inactive.");
      const startsAt = new Date(input.startsAt),
        endsAt = new Date(input.endsAt);
      assert(
        endsAt > startsAt &&
          +endsAt - +startsAt <=
            (input.action === "shift" ? 24 : 90 * 24) * 3600000,
        "INTERVAL",
        "Choose a valid interval (shift at most 24 hours; leave at most 90 days).",
        422,
      );
      if (input.action === "shift") {
        assert(
          !(await tx.leaveRequest.findFirst({
            where: {
              employeeId: employee.id,
              status: "APPROVED",
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          })),
          "ON_LEAVE",
          "Employee has approved leave during this shift.",
        );
        const result = await tx.staffShift.create({
          data: { employeeId: employee.id, startsAt, endsAt },
        });
        await audit(tx, actor, "employee.shift", result.id);
        return result;
      }
      const result = await tx.leaveRequest.create({
        data: {
          employeeId: employee.id,
          startsAt,
          endsAt,
          reason: input.reason,
        },
      });
      await audit(tx, actor, "leave.request", result.id, input.reason);
      return result;
    }
    if (input.action === "shiftCancel") {
      const shift = await tx.staffShift.findUniqueOrThrow({
        where: { id: input.id },
      });
      await employeeLock(tx, shift.employeeId);
      const result = await tx.staffShift.update({
        where: { id: shift.id },
        data: { status: "CANCELLED", cancellationReason: input.reason },
      });
      await audit(tx, actor, "employee.shift.cancel", shift.id, input.reason);
      return result;
    }
    if (input.action === "leaveDecision") {
      const leave = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: input.id },
      });
      await employeeLock(tx, leave.employeeId);
      const current = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: leave.id },
      });
      assert(
        current.status === "PENDING",
        "DECIDED",
        "This leave request has already been decided.",
      );
      if (input.status === "APPROVED") {
        assert(
          !(await tx.staffShift.findFirst({
            where: {
              employeeId: leave.employeeId,
              status: "SCHEDULED",
              startsAt: { lt: leave.endsAt },
              endsAt: { gt: leave.startsAt },
            },
          })),
          "SHIFT_CONFLICT",
          "This leave overlaps a scheduled shift. Cancel that shift with a reason first.",
        );
        assert(
          !(await tx.leaveRequest.findFirst({
            where: {
              employeeId: leave.employeeId,
              status: "APPROVED",
              startsAt: { lt: leave.endsAt },
              endsAt: { gt: leave.startsAt },
            },
          })),
          "LEAVE_CONFLICT",
          "This leave overlaps approved leave.",
        );
      }
      const result = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: input.status,
          decidedBy: actor.id,
          decisionReason: input.reason,
        },
      });
      await audit(
        tx,
        actor,
        "leave." + input.status.toLowerCase(),
        leave.id,
        input.reason,
      );
      return result;
    }
    if (input.action === "payslip") {
      const employee = await employeeLock(tx, input.employeeId);
      assert(employee.active, "INACTIVE", "Employee is inactive.");
      const user = await tx.user.findUniqueOrThrow({
        where: { id: employee.userId },
      });
      const settings = await tx.clubSettings.findUniqueOrThrow({
        where: { id: "club" },
      });
      const grossPaise = employee.salaryPaise + input.adjustmentPaise;
      assert(
        grossPaise >= 0 && grossPaise <= 100000000,
        "PAYROLL_AMOUNT",
        "Gross pay must be between zero and ₹10,00,000.",
        422,
      );
      const taxPaise = Math.floor(
        (grossPaise * settings.payrollTaxBps + 5000) / 10000,
      );
      const result = await tx.payslip.create({
        data: {
          employeeId: employee.id,
          period: input.period,
          finalizedAt: new Date(),
          snapshot: {
            name: user.name,
            championsId: user.championsId,
            title: employee.title,
            basePaise: employee.salaryPaise,
            adjustmentPaise: input.adjustmentPaise,
            reason: input.reason,
            grossPaise,
            taxBps: settings.payrollTaxBps,
            taxLabel: settings.payrollTaxLabel,
            taxPaise,
            netPaise: grossPaise - taxPaise,
            finalizedBy: actor.id,
          },
        },
      });
      await audit(tx, actor, "payroll.finalize", result.id, input.reason);
      return result;
    }
    if (input.action === "cashOpen") {
      assert(
        !(await cashLock(tx, actor.id)),
        "SHIFT_OPEN",
        "Close your current cash shift first.",
      );
      const result = await tx.cashShift.create({
        data: { actorId: actor.id, openingPaise: input.openingPaise },
      });
      await audit(tx, actor, "cash.open", result.id);
      return result;
    }
    if (input.action === "cashPayout" || input.action === "cashClose") {
      const shift = await tx.cashShift.findUniqueOrThrow({
        where: { id: input.id },
      });
      assert(
        shift.actorId === actor.id || actor.role === "OWNER",
        "FORBIDDEN",
        "You can only reconcile your own shift.",
        403,
      );
      await cashLock(tx, shift.actorId);
      const current = await tx.cashShift.findUniqueOrThrow({
        where: { id: shift.id },
      });
      assert(
        !current.closedAt,
        "SHIFT_CLOSED",
        "This shift is already finalized.",
      );
      if (input.action === "cashPayout") {
        const totals = await cashTotals(tx, shift.id);
        assert(
          input.amountPaise <=
            shift.openingPaise +
              totals.receiptsPaise -
              totals.refundsPaise -
              totals.payoutsPaise,
          "CASH_AVAILABLE",
          "Payout exceeds the cash available in this shift.",
        );
        const result = await tx.cashPayout.create({
          data: {
            shiftId: shift.id,
            amountPaise: input.amountPaise,
            reason: input.reason,
            actorId: actor.id,
          },
        });
        await audit(tx, actor, "cash.payout", result.id, input.reason);
        return result;
      }
      const totals = await cashTotals(tx, shift.id);
      const expected =
        shift.openingPaise +
        totals.receiptsPaise -
        totals.refundsPaise -
        totals.payoutsPaise;
      assert(
        expected === input.countedPaise || input.reason.length >= 5,
        "EXPLAIN_DISCREPANCY",
        "Explain the difference between counted and expected cash.",
        422,
      );
      const result = await tx.cashShift.update({
        where: { id: shift.id },
        data: {
          receiptsPaise: totals.receiptsPaise,
          refundsPaise: totals.refundsPaise,
          payoutsPaise: totals.payoutsPaise,
          countedPaise: input.countedPaise,
          discrepancyReason: input.reason,
          closedAt: new Date(),
        },
      });
      await audit(tx, actor, "cash.close", shift.id, input.reason, {
        expectedPaise: expected,
        countedPaise: input.countedPaise,
      });
      return result;
    }
    if (input.action === "quote") {
      const lines: ChargeLine[] = input.lines.map((l) => ({
        ...l,
        discountPaise: 0,
        totalPaise: l.quantity * l.unitPaise,
      }));
      const totalPaise = lines.reduce((s, l) => s + l.totalPaise, 0);
      assert(
        totalPaise > 0 && totalPaise <= 100000000,
        "QUOTE_LIMIT",
        "Quote must be positive and at most ₹10,00,000.",
        422,
      );
      const validUntil = new Date(input.validUntil);
      assert(
        validUntil > new Date(),
        "QUOTE_EXPIRY",
        "Quote expiry must be in the future.",
        422,
      );
      const result = await tx.businessQuote.create({
        data: {
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          department: input.department,
          lines,
          totalPaise,
          validUntil,
          actorId: actor.id,
        },
      });
      await audit(tx, actor, "business.quote", result.id);
      return result;
    }
    if (input.action === "quoteInvoice") {
      await tx.$queryRaw`SELECT id FROM "BusinessQuote" WHERE id=${input.id} FOR UPDATE`;
      const quote = await tx.businessQuote.findUniqueOrThrow({
        where: { id: input.id },
      });
      if (quote.invoiceId) return { invoiceId: quote.invoiceId };
      assert(
        quote.validUntil > new Date(),
        "QUOTE_EXPIRED",
        "Create a new quote; this quote has expired.",
      );
      const invoice = await issueInvoice(tx, {
        userId: null,
        name: quote.customerName,
        email: quote.customerEmail,
        department: quote.department,
        originId: "business:" + quote.id,
        lines: quote.lines as ChargeLine[],
        dueAt: quote.validUntil,
      });
      await tx.businessQuote.update({
        where: { id: quote.id },
        data: { invoiceId: invoice.id },
      });
      await audit(tx, actor, "business.invoice", invoice.id);
      return { invoiceId: invoice.id };
    }
    const mail = await tx.mailMessage.findUniqueOrThrow({
      where: { id: input.id },
    });
    const task = await tx.job.findUniqueOrThrow({ where: { id: mail.jobId } });
    assert(
      task.status === "FAILED",
      "RETRY_STATE",
      "Only failed deliveries can be retried.",
    );
    await tx.job.update({
      where: { id: task.id },
      data: {
        status: "PENDING",
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        lockedAt: null,
      },
    });
    await tx.mailMessage.update({
      where: { id: mail.id },
      data: { status: "QUEUED" },
    });
    await audit(tx, actor, "mail.retry", mail.id);
    return { queued: true };
  });
}
export async function hrData(actor: Actor) {
  roles(actor, ["OWNER", "RECEPTION", "CASHIER", "KITCHEN"]);
  const employees = await db.employee.findMany({
    where: actor.role === "OWNER" ? {} : { userId: actor.id },
    include: {
      shifts: { orderBy: { startsAt: "desc" } },
      leaves: { orderBy: { createdAt: "desc" } },
      payslips: { orderBy: { period: "desc" } },
    },
  });
  const users = await db.user.findMany({
    where: { id: { in: employees.map((e) => e.userId) } },
    select: { id: true, name: true, email: true, championsId: true },
  });
  return employees.map((e) => ({
    ...e,
    user: users.find((u) => u.id === e.userId),
  }));
}
export async function shiftsData(actor: Actor) {
  roles(actor, ["OWNER", "RECEPTION", "CASHIER"]);
  return db.$transaction(
    async (tx) => {
      const shifts = await tx.cashShift.findMany({
        where: actor.role === "OWNER" ? {} : { actorId: actor.id },
        orderBy: { openedAt: "desc" },
      });
      const rows = [];
      for (const shift of shifts) {
        const totals = await cashTotals(tx, shift.id);
        rows.push({
          ...shift,
          ...totals,
          expectedPaise:
            shift.openingPaise +
            totals.receiptsPaise -
            totals.refundsPaise -
            totals.payoutsPaise,
        });
      }
      const unassigned =
        actor.role === "OWNER"
          ? await tx.payment.findMany({
              where: { method: "CASH", cashShiftId: null },
              orderBy: { receivedAt: "desc" },
            })
          : [];
      const unassignedRefunds =
        actor.role === "OWNER"
          ? await tx.refund.findMany({
              where: { method: "CASH", status: "RECORDED", cashShiftId: null },
            })
          : [];
      return { shifts: rows, unassigned, unassignedRefunds };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
