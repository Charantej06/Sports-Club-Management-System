import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import { hrData } from "@/modules/administration/service";
import { csv } from "@/modules/reports/service";
export const GET = route(async (request) => {
  const actor = await requireUser(request, ["OWNER"]),
    data = await hrData(actor);
  const rows: unknown[][] = [
    [
      "Payslip",
      "Employee",
      "Period",
      "Gross paise",
      "Tax label",
      "Tax basis points",
      "Withheld paise",
      "Net paise",
      "Finalized UTC",
    ],
  ];
  const totals = new Map<
    string,
    {
      period: string;
      label: string;
      bps: number;
      gross: number;
      tax: number;
      net: number;
    }
  >();
  for (const e of data)
    for (const p of e.payslips) {
      const s = p.snapshot as {
        name: string;
        grossPaise: number;
        taxLabel: string;
        taxBps: number;
        taxPaise: number;
        netPaise: number;
      };
      rows.push([
        p.id,
        s.name,
        p.period,
        s.grossPaise,
        s.taxLabel,
        s.taxBps,
        s.taxPaise,
        s.netPaise,
        p.finalizedAt?.toISOString(),
      ]);
      const key = `${p.period}:${s.taxLabel}:${s.taxBps}`,
        total = totals.get(key) || {
          period: p.period,
          label: s.taxLabel,
          bps: s.taxBps,
          gross: 0,
          tax: 0,
          net: 0,
        };
      total.gross += s.grossPaise;
      total.tax += s.taxPaise;
      total.net += s.netPaise;
      totals.set(key, total);
    }
  for (const total of totals.values())
    rows.push([
      "PERIOD_SUMMARY",
      "All matching finalized payslips",
      total.period,
      total.gross,
      total.label,
      total.bps,
      total.tax,
      total.net,
      "",
    ]);
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="champions-payroll.csv"',
    },
  });
});
