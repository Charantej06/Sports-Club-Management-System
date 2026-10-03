import { requireUser } from "@/lib/access";
import { route } from "@/lib/errors";
import {
  financialReport,
  operationalReport,
  rangeSchema,
  presetRange,
  csv,
} from "@/modules/reports/service";
export const GET = route(async (request) => {
  const actor = await requireUser(request, ["OWNER"]),
    url = new URL(request.url);
  const input = rangeSchema.parse({
    ...presetRange(url.searchParams.get("preset") || "today"),
    ...(url.searchParams.has("from")
      ? { from: url.searchParams.get("from"), to: url.searchParams.get("to") }
      : {}),
  });
  if (url.searchParams.get("area") === "operations")
    return Response.json({ data: await operationalReport(actor, input) });
  const report = await financialReport(actor, input);
  if (url.searchParams.get("format") === "csv") {
    const rows: unknown[][] = [
      [
        "Record",
        "ID",
        "Department / method",
        "Customer / source",
        "Date",
        "Paise",
        "Status",
      ],
    ];
    for (const i of report.sales)
      rows.push([
        "Invoice",
        i.number,
        i.department,
        i.customerName,
        i.issuedAt.toISOString(),
        i.totalPaise,
        "ISSUED",
      ]);
    for (const p of report.payments)
      rows.push([
        "Payment",
        p.reference,
        p.method,
        p.source,
        p.receivedAt.toISOString(),
        p.amountPaise,
        "RECEIVED",
      ]);
    for (const c of report.credits)
      rows.push([
        "Credit",
        c.id,
        c.invoice.department,
        c.invoice.number,
        c.createdAt.toISOString(),
        c.amountPaise,
        "ISSUED",
      ]);
    for (const r of report.refunds)
      rows.push([
        "Refund",
        r.reference,
        r.method,
        r.source,
        (r.recordedAt || r.createdAt).toISOString(),
        r.amountPaise,
        r.status,
      ]);
    for (const i of report.outstanding)
      rows.push([
        "Outstanding",
        i.number,
        i.department,
        i.customerName,
        input.to,
        i.outstandingPaise,
        "AS_OF_END_DATE",
      ]);
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="champions-${input.from}-${input.to}.csv"`,
      },
    });
  }
  return Response.json({ data: report });
});
