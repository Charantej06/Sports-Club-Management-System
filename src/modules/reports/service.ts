import { z } from "zod";
import { db } from "@/lib/db";
import {
  roles,
  assert,
  slot,
  clubDay,
  weekRange,
  type Actor,
} from "@/modules/operations/core";

export const rangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .strict();
export function reportRange(input: z.infer<typeof rangeSchema>) {
  const start = slot(input.from, 0),
    end = new Date(+slot(input.to, 0) + 86400000);
  assert(
    +end > +start && +end - +start <= 366 * 86400000,
    "DATE_RANGE",
    "Choose an ordered range of at most 366 days.",
    422,
  );
  return { start, end };
}
export function presetRange(preset: string, now = new Date()) {
  const to = clubDay(now);
  return {
    from:
      preset === "week"
        ? clubDay(weekRange(now).start)
        : preset === "month"
          ? to.slice(0, 8) + "01"
          : to,
    to,
  };
}
const sum = (values: { amountPaise: number }[]) =>
  values.reduce((s, v) => s + v.amountPaise, 0);
export async function financialReport(
  actor: Actor,
  input: z.infer<typeof rangeSchema>,
) {
  roles(actor, ["OWNER"]);
  const { start, end } = reportRange(input);
  return db.$transaction(
    async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: { issuedAt: { lt: end } },
        include: {
          allocations: { where: { payment: { receivedAt: { lt: end } } } },
          credits: { where: { createdAt: { lt: end } } },
        },
        orderBy: { issuedAt: "desc" },
      });
      const payments = await tx.payment.findMany({
        where: { receivedAt: { gte: start, lt: end } },
        include: {
          allocations: {
            include: {
              invoice: { select: { id: true, number: true, department: true } },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
      });
      const credits = await tx.credit.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: {
          invoice: { select: { id: true, number: true, department: true } },
        },
      });
      const invoiceRefunds = await tx.refund.findMany({
        where: {
          OR: [
            { status: "RECORDED", recordedAt: { gte: start, lt: end } },
            {
              status: "RECORDED",
              recordedAt: null,
              createdAt: { gte: start, lt: end },
            },
            { status: "PENDING", createdAt: { gte: start, lt: end } },
          ],
        },
        include: {
          credit: {
            include: {
              invoice: { select: { id: true, number: true, department: true } },
            },
          },
        },
      });
      const repayments = await tx.gatewayRepayment.findMany({
        where: { createdAt: { gte: start, lt: end } },
      });
      const refunds = [
        ...invoiceRefunds.map((r) => ({
          id: r.id,
          reference: r.reference,
          method: r.method,
          source: r.source,
          status: r.status,
          amountPaise: r.amountPaise,
          createdAt: r.createdAt,
          recordedAt: r.recordedAt,
          credit: { invoiceId: r.credit.invoiceId, invoice: r.credit.invoice },
        })),
        ...repayments.map((r) => ({
          id: r.id,
          reference: r.reference,
          method: "GATEWAY",
          source: "PROVIDER_CONFIRMED",
          status: "RECORDED",
          amountPaise: r.amountPaise,
          createdAt: r.createdAt,
          recordedAt: r.createdAt,
          credit: {
            invoiceId: "",
            invoice: {
              id: "",
              number: "Unallocated capture " + r.intentId,
              department: r.department,
            },
          },
        })),
      ];
      const sales = invoices
        .filter((i) => i.issuedAt >= start)
        .map((i) => ({
          id: i.id,
          number: i.number,
          customerName: i.customerName,
          department: i.department,
          issuedAt: i.issuedAt,
          totalPaise: i.totalPaise,
        }));
      const outstanding = invoices
        .map((i) => ({
          id: i.id,
          number: i.number,
          customerName: i.customerName,
          department: i.department,
          dueAt: i.dueAt,
          totalPaise: i.totalPaise,
          paidPaise: sum(i.allocations),
          creditedPaise: sum(i.credits),
          outstandingPaise: Math.max(
            0,
            i.totalPaise - sum(i.allocations) - sum(i.credits),
          ),
        }))
        .filter((i) => i.outstandingPaise > 0);
      const departments = (
        ["MEMBERSHIP", "COURT", "SHOP", "CLUBHOUSE"] as const
      ).map((department) => ({
        department,
        salesPaise: sales
          .filter((i) => i.department === department)
          .reduce((s, i) => s + i.totalPaise, 0),
        collectionsPaise: payments
          .flatMap((p) => p.allocations)
          .filter((a) => a.invoice.department === department)
          .reduce((s, a) => s + a.amountPaise, 0),
        creditsPaise: sum(
          credits.filter((c) => c.invoice.department === department),
        ),
        refundsPaise: sum(
          refunds.filter(
            (r) =>
              r.status === "RECORDED" &&
              r.credit.invoice.department === department,
          ),
        ),
        outstandingPaise: outstanding
          .filter((i) => i.department === department)
          .reduce((s, i) => s + i.outstandingPaise, 0),
      }));
      // What the club owes for the month the report ends in: staff pay (finalized payslips are exact,
      // the rest is estimated from configured salaries) and the withholding to remit.
      const period = input.to.slice(0, 7);
      const [employees, payslips, clubSettings] = await Promise.all([
        tx.employee.findMany({ where: { active: true }, include: { payslips: { where: { period } } } }),
        tx.payslip.findMany({ where: { period, finalizedAt: { not: null } } }),
        tx.clubSettings.findUniqueOrThrow({ where: { id: "club" } }),
      ]);
      const finalized = new Map(payslips.map((p) => [p.employeeId, p.snapshot as { grossPaise: number; taxPaise: number; netPaise: number }]));
      let payrollGross = 0, payrollTax = 0, payrollNet = 0;
      for (const e of employees) {
        const slip = finalized.get(e.id);
        const gross = slip?.grossPaise ?? e.salaryPaise;
        const tax = slip?.taxPaise ?? Math.floor((gross * clubSettings.payrollTaxBps + 5000) / 10000);
        payrollGross += gross;
        payrollTax += tax;
        payrollNet += slip?.netPaise ?? gross - tax;
      }
      return {
        range: input,
        generatedAt: new Date(),
        obligations: {
          payrollPeriod: period,
          employeeCount: employees.length,
          payslipsFinalized: employees.filter((e) => finalized.has(e.id)).length,
          payrollGrossPaise: payrollGross,
          withholdingPaise: payrollTax,
          payrollNetPaise: payrollNet,
          withholdingLabel: clubSettings.payrollTaxLabel,
        },
        sales,
        payments,
        credits,
        refunds,
        outstanding,
        departments,
        totals: {
          salesPaise: sales.reduce((s, i) => s + i.totalPaise, 0),
          collectionsPaise: sum(payments),
          unallocatedPaise: payments.reduce(
            (s, p) => s + p.amountPaise - sum(p.allocations),
            0,
          ),
          creditsPaise: sum(credits),
          refundsPaise: sum(refunds.filter((r) => r.status === "RECORDED")),
          pendingRefundsPaise: sum(
            refunds.filter((r) => r.status === "PENDING"),
          ),
          outstandingPaise: outstanding.reduce(
            (s, i) => s + i.outstandingPaise,
            0,
          ),
        },
        methods: ["CASH", "CARD", "UPI", "LOCAL", "GATEWAY"].map((method) => ({
          method,
          amountPaise: sum(payments.filter((p) => p.method === method)),
        })),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
export async function operationalReport(
  actor: Actor,
  input: z.infer<typeof rangeSchema>,
) {
  roles(actor, ["OWNER"]);
  const { start, end } = reportRange(input),
    now = new Date();
  const [settings, courts, reservations, closures, lowStock, expiring, tabs] =
    await Promise.all([
      db.clubSettings.findUniqueOrThrow({ where: { id: "club" } }),
      db.court.findMany({ where: { status: { not: "INACTIVE" } } }),
      db.reservation.findMany({
        where: { status: "CONFIRMED", startsAt: { gte: start, lt: end } },
        select: {
          id: true,
          courtId: true,
          startsAt: true,
          endsAt: true,
          kind: true,
        },
      }),
      db.courtClosure.findMany({
        where: { active: true, startsAt: { lt: end }, endsAt: { gt: start } },
      }),
      db.productVariant.findMany({
        where: { product: { active: true } },
        include: { product: { select: { name: true } } },
        orderBy: { stock: "asc" },
      }),
      db.membership.findMany({
        where: { status: "ACTIVE", endsAt: { gte: now } },
        distinct: ["userId"],
        orderBy: { endsAt: "desc" },
        include: { user: { select: { name: true, championsId: true } } },
      }),
      db.invoice.findMany({
        where: { department: "CLUBHOUSE" },
        include: { allocations: true, credits: true },
      }),
    ]);
  const utilization = courts.map((court) => {
    let availableHours = 0;
    for (let at = +start; at < +end; at += 86400000)
      for (let h = settings.openHour; h < settings.closeHour; h++) {
        const a = new Date(at + h * 3600000),
          b = new Date(+a + 3600000);
        if (
          !closures.some(
            (c) => c.courtId === court.id && c.startsAt < b && c.endsAt > a,
          )
        )
          availableHours++;
      }
    const records = reservations.filter((r) => r.courtId === court.id);
    const bookedHours = records.reduce(
      (s, r) => s + (+r.endsAt - +r.startsAt) / 3600000,
      0,
    );
    return {
      id: court.id,
      name: court.name,
      availableHours,
      bookedHours,
      percent: availableHours
        ? Math.round((bookedHours / availableHours) * 100)
        : 0,
      records,
    };
  });
  // What the clubhouse sold in the range, split into the bar and the kitchen/cafeteria by menu category.
  const [lines, menu] = await Promise.all([
    db.kitchenLine.findMany({ where: { status: "ACTIVE", ticket: { createdAt: { gte: start, lt: end } } }, select: { menuId: true, quantity: true, totalPaise: true } }),
    db.menuItem.findMany({ select: { id: true, category: true } }),
  ]);
  const categoryOf = new Map(menu.map((m) => [m.id, m.category]));
  const byCategory = new Map<string, { category: string; quantity: number; totalPaise: number }>();
  for (const line of lines) {
    const category = categoryOf.get(line.menuId) ?? "Other";
    const row = byCategory.get(category) ?? { category, quantity: 0, totalPaise: 0 };
    row.quantity += line.quantity;
    row.totalPaise += line.totalPaise;
    byCategory.set(category, row);
  }
  const categories = [...byCategory.values()].sort((a, b) => b.totalPaise - a.totalPaise);
  return {
    clubhouse: {
      barPaise: categories.filter((c) => c.category === "Bar").reduce((n, c) => n + c.totalPaise, 0),
      kitchenPaise: categories.filter((c) => c.category !== "Bar").reduce((n, c) => n + c.totalPaise, 0),
      categories,
    },
    utilization,
    lowStock: lowStock.filter((v) => v.stock - v.reserved <= 5),
    expiring: expiring.filter((m) => m.endsAt <= new Date(+now + 7 * 86400000)),
    unpaidTabs: tabs
      .map((i) => ({
        id: i.id,
        number: i.number,
        customerName: i.customerName,
        dueAt: i.dueAt,
        outstandingPaise: Math.max(
          0,
          i.totalPaise - sum(i.allocations) - sum(i.credits),
        ),
      }))
      .filter((i) => i.outstandingPaise > 0),
  };
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
