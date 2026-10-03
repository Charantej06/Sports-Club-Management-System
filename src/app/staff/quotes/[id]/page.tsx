import { notFound } from "next/navigation";
import { pageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { money, date } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";
export default async function Quote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageUser(["OWNER"]);
  const { id } = await params;
  const q = await db.businessQuote.findUnique({ where: { id } });
  if (!q) notFound();
  const lines = q.lines as {
    description: string;
    quantity: number;
    unitPaise: number;
    totalPaise: number;
  }[];
  return (
    <div className="staff-theme py-10">
      <article className="surface mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-semibold">Champions Club · Quotation</h1>
        <p className="break-all text-xs">{q.id}</p>
        <h2 className="font-semibold">{q.customerName}</h2>
        <p>
          {q.customerEmail} · {q.department}
        </p>
        <p>Valid through {date(q.validUntil)}</p>
        {lines.map((l, i) => (
          <div
            key={i}
            className="flex flex-wrap justify-between gap-3 border-b border-slate-200 pb-3"
          >
            <span>
              {l.description} · {l.quantity} × {money(l.unitPaise)}
            </span>
            <strong>{money(l.totalPaise)}</strong>
          </div>
        ))}
        <p className="text-lg font-semibold">Total {money(q.totalPaise)}</p>
        <p className="text-xs text-slate-600">
          Estimate only. An issued invoice and recorded settlement appear in the
          shared ledger.
        </p>
        <PrintButton />
      </article>
    </div>
  );
}
