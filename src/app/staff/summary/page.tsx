import Link from "next/link";
import { pageUser } from "@/lib/access";
import { money, dateTime } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";
import { financialReport, operationalReport, presetRange, rangeSchema } from "@/modules/reports/service";

export const metadata = { title: "Business summary" };

// A clean, printable one-pager the owner can print, save as PDF or hand to an accountant or partner.
export default async function Summary({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const owner = await pageUser(["OWNER"]);
  const params = await searchParams;
  const parsed = rangeSchema.safeParse({ from: params.from, to: params.to });
  const range = parsed.success ? parsed.data : presetRange(params.preset === "week" || params.preset === "today" ? params.preset : "month");
  const [finance, operations] = await Promise.all([financialReport(owner, range), operationalReport(owner, range)]);
  const rows: [string, number][] = [
    ["Invoiced sales", finance.totals.salesPaise],
    ["Money collected", finance.totals.collectionsPaise],
    ["Credits issued", finance.totals.creditsPaise],
    ["Refunds paid", finance.totals.refundsPaise],
    ["Refunds still to pay", finance.totals.pendingRefundsPaise],
    ["Still owed to the club", finance.totals.outstandingPaise],
  ];
  const { obligations: o } = finance;
  return (
    <div className="staff-theme py-8">
      <article className="surface mx-auto max-w-4xl space-y-8 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Champions Club</p>
            <h1 className="mt-1 text-2xl font-semibold">Business summary</h1>
            <p className="mt-1 text-sm text-slate-600">{range.from} to {range.to} · Asia/Kolkata · generated {dateTime(finance.generatedAt)}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            {(["today", "week", "month"] as const).map((preset) => (
              <Link key={preset} href={`/staff/summary?preset=${preset}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">{preset === "today" ? "Today" : preset === "week" ? "This week" : "This month"}</Link>
            ))}
            <PrintButton label="Print or save as PDF" />
          </div>
        </header>
        <section aria-labelledby="s-money">
          <h2 id="s-money" className="text-lg font-semibold">Money in and out</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label}><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="text-xl font-semibold">{money(value)}</dd></div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="s-source">
          <h2 id="s-source" className="text-lg font-semibold">Where it came from</h2>
          <table className="mt-3">
            <thead><tr><th>Department</th><th>Sales</th><th>Collected</th><th>Credits</th><th>Refunds</th><th>Owed</th></tr></thead>
            <tbody>
              {finance.departments.map((d) => (
                <tr key={d.department}><td>{d.department[0] + d.department.slice(1).toLowerCase()}</td><td>{money(d.salesPaise)}</td><td>{money(d.collectionsPaise)}</td><td>{money(d.creditsPaise)}</td><td>{money(d.refundsPaise)}</td><td>{money(d.outstandingPaise)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-700">By payment method: {finance.methods.filter((m) => m.amountPaise).map((m) => `${m.method === "LOCAL" ? "Test payments" : m.method[0] + m.method.slice(1).toLowerCase()} ${money(m.amountPaise)}`).join(" · ") || "no payments in this range"}</p>
        </section>
        <section aria-labelledby="s-bar">
          <h2 id="s-bar" className="text-lg font-semibold">Bar and kitchen</h2>
          <p className="mt-2 text-sm">Bar {money(operations.clubhouse.barPaise)} · Kitchen & cafeteria {money(operations.clubhouse.kitchenPaise)}{operations.clubhouse.categories.length ? ` (${operations.clubhouse.categories.map((c) => `${c.category} ${money(c.totalPaise)}`).join(", ")})` : ""}</p>
        </section>
        <section aria-labelledby="s-owe">
          <h2 id="s-owe" className="text-lg font-semibold">What the club owes ({o.payrollPeriod})</h2>
          <p className="mt-2 text-sm">Staff net pay {money(o.payrollNetPaise)} · {o.withholdingLabel} to remit {money(o.withholdingPaise)} · refunds to repay {money(finance.totals.pendingRefundsPaise)} · {o.payslipsFinalized} of {o.employeeCount} payslips finalized.</p>
          <p className="mt-2 text-sm font-medium">Estimated net position: {money(finance.totals.collectionsPaise - finance.totals.refundsPaise - o.payrollGrossPaise)} (collected − refunds − staff gross pay).</p>
        </section>
        <section aria-labelledby="s-courts">
          <h2 id="s-courts" className="text-lg font-semibold">Courts</h2>
          <table className="mt-3">
            <thead><tr><th>Court</th><th>Booked hours</th><th>Available hours</th><th>Utilization</th></tr></thead>
            <tbody>{operations.utilization.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.bookedHours}</td><td>{c.availableHours}</td><td>{c.percent}%</td></tr>)}</tbody>
          </table>
        </section>
        <section aria-labelledby="s-watch" className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 id="s-watch" className="text-lg font-semibold">Low stock</h2>
            <p className="mt-2 text-sm">{operations.lowStock.length ? operations.lowStock.map((v) => `${v.label} (${v.stock - v.reserved})`).join(", ") : "Nothing is running low."}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Memberships ending within 7 days</h2>
            <p className="mt-2 text-sm">{operations.expiring.length ? operations.expiring.map((m) => `${m.user.name} (${m.user.championsId})`).join(", ") : "None."}</p>
          </div>
        </section>
      </article>
    </div>
  );
}
