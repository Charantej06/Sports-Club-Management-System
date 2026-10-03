import { notFound } from "next/navigation";
import { pageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { money, date } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";
export default async function Payslip({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser(["OWNER", "RECEPTION", "CASHIER", "KITCHEN"]),
    { id } = await params;
  const p = await db.payslip.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!p || (actor.role !== "OWNER" && p.employee.userId !== actor.id))
    notFound();
  const s = p.snapshot as {
    name: string;
    championsId: string;
    title: string;
    basePaise: number;
    adjustmentPaise: number;
    reason: string;
    grossPaise: number;
    taxBps: number;
    taxLabel: string;
    taxPaise: number;
    netPaise: number;
  };
  return (
    <div className="staff-theme py-10">
      <article className="surface mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-semibold">Champions Club · Payslip</h1>
        <p>
          {p.period} · finalized{" "}
          {p.finalizedAt ? date(p.finalizedAt) : "Pending"}
        </p>
        <h2 className="font-semibold">
          {s.name} · {s.championsId}
        </h2>
        <p>{s.title}</p>
        <dl className="grid grid-cols-2 gap-3">
          <dt>Base salary</dt>
          <dd>{money(s.basePaise)}</dd>
          <dt>Adjustment</dt>
          <dd>{money(s.adjustmentPaise)}</dd>
          <dt>Gross</dt>
          <dd>{money(s.grossPaise)}</dd>
          <dt>
            {s.taxLabel} ({s.taxBps / 100}%)
          </dt>
          <dd>{money(s.taxPaise)}</dd>
          <dt>Net salary</dt>
          <dd className="font-semibold">{money(s.netPaise)}</dd>
        </dl>
        <p className="text-sm">{s.reason}</p>
        <p className="text-xs text-slate-600">
          Finalized calculation snapshot. Salary disbursement is recorded
          separately by the employer.
        </p>
        <PrintButton />
      </article>
    </div>
  );
}
