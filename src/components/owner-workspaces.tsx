"use client";
import { EmailHealth } from "./email-health";
import { PaymentHealth } from "./payment-health";
import Link from "next/link";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { money, date, dateTime } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ReceiptLink, type Json } from "./operations-ui";
import type {
  financialReport,
  operationalReport,
} from "@/modules/reports/service";
import type { hrData, shiftsData } from "@/modules/administration/service";
import type { BusinessQuote } from "@/generated/prisma/client";
type Finance = Json<Awaited<ReturnType<typeof financialReport>>>;
type Operations = Json<Awaited<ReturnType<typeof operationalReport>>>;
type HR = Json<Awaited<ReturnType<typeof hrData>>>;
type Cash = Json<Awaited<ReturnType<typeof shiftsData>>>;
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
function useAdmin() {
  const client = useQueryClient();
  const [retry, setRetry] = useState<{ payload: string; key: string } | null>(
    null,
  );
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const payload = JSON.stringify(input),
        key = retry?.payload === payload ? retry.key : crypto.randomUUID();
      setRetry({ payload, key });
      const result = await api<Record<string, unknown>>("/api/staff/admin", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: payload,
      });
      setRetry(null);
      return result;
    },
    onSuccess: () => client.invalidateQueries(),
  });
}
function Notice({ action }: { action: ReturnType<typeof useAdmin> }) {
  return (
    <>
      {action.error && (
        <p className="field-error" role="alert">
          {action.error.message}
        </p>
      )}
      {action.isSuccess && (
        <p className="text-sm text-emerald-700" role="status">
          Saved to club records.
        </p>
      )}
    </>
  );
}
function Load({ pending, error }: { pending: boolean; error: Error | null }) {
  return (
    <>
      {pending && <p role="status">Loading club records…</p>}
      {error && (
        <p role="alert" className="field-error">
          {error.message}
        </p>
      )}
    </>
  );
}
function Summary({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface text-left hover:border-orange-300"
    >
      <span className="text-xs text-slate-600">{label}</span>
      <span className="mt-3 block text-2xl font-semibold">{money(value)}</span>
      {onClick && (
        <span className="mt-3 block text-xs text-orange-800">
          View records →
        </span>
      )}
    </button>
  );
}
export function OwnerReports() {
  const [range, setRange] = useState({ from: today(), to: today() });
  const [detail, setDetail] = useState("sales"),
    [department, setDepartment] = useState("ALL"),
    [paymentMethod, setPaymentMethod] = useState("ALL");
  const recordsRef = useRef<HTMLDivElement>(null);
  const search = new URLSearchParams(range).toString();
  const query = useQuery({
    queryKey: ["reports", range],
    queryFn: () => api<Finance>(`/api/staff/reports?${search}`),
    refetchInterval: 15000,
  });
  const operations = useQuery({
    queryKey: ["report-operations", range],
    queryFn: () =>
      api<Operations>(`/api/staff/reports?area=operations&${search}`),
    refetchInterval: 15000,
  });
  const r = query.data,
    match = (d: string) => department === "ALL" || d === department;
  const scrollToRecords = () => {
    requestAnimationFrame(() => {
      recordsRef.current?.scrollIntoView({
        behavior:
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        block: "start",
      });
    });
  };
  const drill = (next: string) => {
    setDetail(next);
    setDepartment("ALL");
    setPaymentMethod("ALL");
    scrollToRecords();
  };
  return (
    <div className="space-y-5">
      <div className="surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Financial reports</h2>
            <p className="mt-2 text-sm text-slate-600">
              Asia/Kolkata dates. Sales, collections, credits and actual refunds
              are separate ledger events.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              className="text-orange-800 underline"
              href={`/staff/summary?${search}`}
              target="_blank"
              rel="noreferrer"
            >
              Printable summary
            </a>
            <a
              className="text-orange-800 underline"
              href={`/api/staff/reports?${search}&format=csv`}
            >
              Export ledger CSV
            </a>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {["today", "week", "month"].map((preset) => (
            <Button
              key={preset}
              variant="outline"
              size="sm"
              onClick={() => {
                const to = today();
                const d = new Date(to);
                d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
                setRange({
                  from:
                    preset === "week"
                      ? d.toISOString().slice(0, 10)
                      : preset === "month"
                        ? to.slice(0, 8) + "01"
                        : to,
                  to,
                });
              }}
            >
              {preset === "today" ? "Today" : `This ${preset}`}
            </Button>
          ))}
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setRange({ from: String(f.get("from")), to: String(f.get("to")) });
          }}
          key={search}
        >
          <label className="text-xs">
            From
            <Input name="from" type="date" required defaultValue={range.from} />
          </label>
          <label className="text-xs">
            Through
            <Input name="to" type="date" required defaultValue={range.to} />
          </label>
          <Button variant="outline">Apply custom range</Button>
        </form>
        <Load pending={query.isPending} error={query.error} />
      </div>
      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Summary
              label="Invoiced sales"
              value={r.totals.salesPaise}
              onClick={() => drill("sales")}
            />
            <Summary
              label="Collections"
              value={r.totals.collectionsPaise}
              onClick={() => drill("payments")}
            />
            <Summary
              label="Credits issued"
              value={r.totals.creditsPaise}
              onClick={() => drill("credits")}
            />
            <Summary
              label="Refunds recorded"
              value={r.totals.refundsPaise}
              onClick={() => drill("refunds")}
            />
            <Summary
              label="Refunds awaiting repayment"
              value={r.totals.pendingRefundsPaise}
              onClick={() => drill("pending")}
            />
            <Summary
              label="Outstanding through end date"
              value={r.totals.outstandingPaise}
              onClick={() => drill("outstanding")}
            />
          </div>
          <section className="surface" aria-labelledby="owed-title">
            <h3 id="owed-title" className="font-semibold">
              What the club owes · {r.obligations.payrollPeriod}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Staff pay for the month this range ends in ({r.obligations.payslipsFinalized} of {r.obligations.employeeCount} payslips finalized; the rest are estimated from configured salaries), plus refunds still to be repaid.
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Staff net pay", r.obligations.payrollNetPaise],
                [`${r.obligations.withholdingLabel} to remit`, r.obligations.withholdingPaise],
                ["Refunds awaiting repayment", r.totals.pendingRefundsPaise],
                ["Total to pay out", r.obligations.payrollNetPaise + r.obligations.withholdingPaise + r.totals.pendingRefundsPaise],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold text-slate-900">{money(value as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              Collected this period {money(r.totals.collectionsPaise)} − refunds {money(r.totals.refundsPaise)} − staff gross pay {money(r.obligations.payrollGrossPaise)} ={" "}
              <strong>{money(r.totals.collectionsPaise - r.totals.refundsPaise - r.obligations.payrollGrossPaise)}</strong> estimated net position. Still owed to the club: {money(r.totals.outstandingPaise)}.
            </p>
          </section>
          <div className="surface overflow-x-auto">
            <h3 className="font-semibold">Department breakdown</h3>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Department",
                    "Sales",
                    "Collections",
                    "Credits",
                    "Refunds",
                    "Outstanding",
                  ].map((h) => (
                    <th className="p-2" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.departments.map((d) => (
                  <tr key={d.department} className="border-t border-slate-200">
                    <td className="p-2">
                      <button
                        className="text-orange-800 underline"
                        onClick={() => {
                          setDepartment(d.department);
                          setPaymentMethod("ALL");
                          setDetail("sales");
                          scrollToRecords();
                        }}
                      >
                        {d.department}
                      </button>
                    </td>
                    {[
                      d.salesPaise,
                      d.collectionsPaise,
                      d.creditsPaise,
                      d.refundsPaise,
                      d.outstandingPaise,
                    ].map((v, i) => (
                      <td key={i} className="p-2">
                        <button
                          aria-label={`${d.department} ${["sales", "collections", "credits", "refunds", "outstanding"][i]} ${money(v)}: view supporting records`}
                          onClick={() => {
                            setDepartment(d.department);
                            setPaymentMethod("ALL");
                            setDetail(
                              [
                                "sales",
                                "payments",
                                "credits",
                                "refunds",
                                "outstanding",
                              ][i],
                            );
                            scrollToRecords();
                          }}
                        >
                          {money(v)}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="surface">
            <h3 className="font-semibold">Collections by method</h3>
            <div className="mt-4 flex flex-wrap gap-4">
              {r.methods.map((m) => (
                <button
                  key={m.method}
                  className="text-sm text-orange-800 underline"
                  onClick={() => {
                    setDetail("payments");
                    setDepartment("ALL");
                    setPaymentMethod(m.method);
                    scrollToRecords();
                  }}
                >
                  <strong>{m.method}</strong> {money(m.amountPaise)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Unallocated captured collections:{" "}
              {money(r.totals.unallocatedPaise)}. Department collections include
              invoice allocations. LOCAL is simulated. CASH/CARD/UPI are staff
              records. Payment records below show their source and allocation.
            </p>
          </div>
          <div
            ref={recordsRef}
            id="supporting-records"
            className="surface scroll-mt-6"
          >
            <h3 className="font-semibold">Records supporting totals</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                Ledger figure
                <select
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                >
                  {[
                    "sales",
                    "payments",
                    "credits",
                    "refunds",
                    "pending",
                    "outstanding",
                  ].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Department
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {["ALL", ...r.departments.map((d) => d.department)].map(
                    (d) => (
                      <option key={d}>{d}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {detail === "payments" && (
              <label className="mt-4 block text-xs">
                Payment method
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {["ALL", ...r.methods.map((m) => m.method)].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
            <p className="my-4 text-xs text-slate-600">
              All matching records are included; totals never use a truncated
              record list. Outstanding is historical through {range.to};
              receipts show the current ledger.
            </p>
            <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {detail === "sales" &&
                r.sales
                  .filter((i) => match(i.department))
                  .map((i) => (
                    <Record
                      key={i.id}
                      title={`${i.number} · ${i.customerName}`}
                      text={`${i.department} · ${date(i.issuedAt)}`}
                      amount={i.totalPaise}
                      invoiceId={i.id}
                    />
                  ))}
              {detail === "outstanding" &&
                r.outstanding
                  .filter((i) => match(i.department))
                  .map((i) => (
                    <Record
                      key={i.id}
                      title={`${i.number} · ${i.customerName}`}
                      text={`${i.department} · paid ${money(i.paidPaise)} · credits ${money(i.creditedPaise)}`}
                      amount={i.outstandingPaise}
                      invoiceId={i.id}
                    />
                  ))}
              {detail === "payments" &&
                r.payments
                  .filter(
                    (p) =>
                      (paymentMethod === "ALL" || p.method === paymentMethod) &&
                      (department === "ALL" ||
                        p.allocations.some((a) => match(a.invoice.department))),
                  )
                  .map((p) => (
                    <Record
                      key={p.id}
                      title={`${p.method} · ${p.reference}`}
                      text={`${p.source} · ${date(p.receivedAt)} · ${p.allocations
                        .filter((a) => match(a.invoice.department))
                        .map(
                          (a) => `${a.invoice.number}: ${money(a.amountPaise)}`,
                        )
                        .join("; ")}`}
                      amount={
                        department === "ALL"
                          ? p.amountPaise
                          : p.allocations
                              .filter((a) => match(a.invoice.department))
                              .reduce((s, a) => s + a.amountPaise, 0)
                      }
                      invoiceId={
                        p.allocations.find((a) => match(a.invoice.department))
                          ?.invoiceId
                      }
                    />
                  ))}
              {detail === "credits" &&
                r.credits
                  .filter((c) => match(c.invoice.department))
                  .map((c) => (
                    <Record
                      key={c.id}
                      title={`${c.invoice.number} · ${c.id}`}
                      text={c.reason}
                      amount={c.amountPaise}
                      invoiceId={c.invoiceId}
                    />
                  ))}
              {["refunds", "pending"].includes(detail) &&
                r.refunds
                  .filter(
                    (v) =>
                      match(v.credit.invoice.department) &&
                      v.status ===
                        (detail === "pending" ? "PENDING" : "RECORDED"),
                  )
                  .map((v) => (
                    <Record
                      key={v.id}
                      title={`${v.credit.invoice.number} · ${v.reference}`}
                      text={`${v.method} · ${v.source} · ${v.status}`}
                      amount={v.amountPaise}
                      invoiceId={v.credit.invoiceId}
                    />
                  ))}
              {((detail === "sales" &&
                !r.sales.some((i) => match(i.department))) ||
                (detail === "payments" &&
                  !r.payments.some(
                    (p) =>
                      (paymentMethod === "ALL" || p.method === paymentMethod) &&
                      (department === "ALL" ||
                        p.allocations.some((a) => match(a.invoice.department))),
                  )) ||
                (detail === "credits" &&
                  !r.credits.some((c) => match(c.invoice.department))) ||
                (detail === "outstanding" &&
                  !r.outstanding.some((i) => match(i.department))) ||
                (["refunds", "pending"].includes(detail) &&
                  !r.refunds.some(
                    (v) =>
                      match(v.credit.invoice.department) &&
                      v.status ===
                        (detail === "pending" ? "PENDING" : "RECORDED"),
                  ))) && (
                <p className="text-sm text-slate-600">No matching records.</p>
              )}
            </div>
          </div>
        </>
      )}
      <Load pending={operations.isPending} error={operations.error} />
      {operations.data && <OperationalAlerts data={operations.data} />}
    </div>
  );
}
function Record({
  title,
  text,
  amount,
  invoiceId,
}: {
  title: string;
  text: string;
  amount: number;
  invoiceId?: string;
}) {
  return (
    <article className="flex flex-wrap justify-between gap-3 rounded-lg border border-slate-200 p-4">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{title}</p>
        <p className="mt-2 break-words text-xs text-slate-600">{text}</p>
        {invoiceId && <ReceiptLink id={invoiceId} />}
      </div>
      <span className="text-sm font-semibold">{money(amount)}</span>
    </article>
  );
}
function OperationalAlerts({ data }: { data: Operations }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="surface xl:col-span-2">
        <h3 className="font-semibold">Clubhouse: bar and kitchen</h3>
        <p className="mt-2 text-xs text-slate-600">
          Items sold in the selected range (before member discounts are settled), split by menu category. Cancelled items are excluded.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Bar", data.clubhouse.barPaise],
            ["Kitchen & cafeteria", data.clubhouse.kitchenPaise],
            ["Clubhouse total", data.clubhouse.barPaise + data.clubhouse.kitchenPaise],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">{money(value as number)}</dd>
            </div>
          ))}
        </dl>
        {data.clubhouse.categories.length > 0 && (
          <p className="mt-4 text-xs text-slate-600">
            {data.clubhouse.categories.map((c) => `${c.category}: ${c.quantity} sold · ${money(c.totalPaise)}`).join("  ·  ")}
          </p>
        )}
      </div>
      <div className="surface">
        <h3 className="font-semibold">Court utilization</h3>
        <p className="mt-2 text-xs text-slate-600">
          Confirmed hours ÷ current opening hours less maintenance closures.
          Social courts count once.
        </p>
        {data.utilization.map((c) => (
          <details key={c.id} className="mt-3 border-t border-slate-200 pt-3">
            <summary className="cursor-pointer text-sm">
              {c.name} · {c.bookedHours}/{c.availableHours} hours · {c.percent}%
            </summary>
            {c.records.map((r) => (
              <p key={r.id} className="mt-2 break-all text-xs text-slate-600">
                {dateTime(r.startsAt)} · {r.kind} · {r.id}
              </p>
            ))}
          </details>
        ))}
      </div>
      <div className="surface">
        <h3 className="font-semibold">Low stock · five or fewer available</h3>
        {!data.lowStock.length && (
          <p className="mt-4 text-sm">No stock alerts.</p>
        )}
        {data.lowStock.map((v) => (
          <p className="mt-3 text-sm" key={v.id}>
            {v.product.name} · {v.label}:{" "}
            <strong>{v.stock - v.reserved}</strong> available ({v.stock} on
            hand, {v.reserved} reserved)
          </p>
        ))}
      </div>
      <div className="surface">
        <h3 className="font-semibold">
          Memberships expiring within seven days
        </h3>
        {!data.expiring.length && (
          <p className="mt-4 text-sm">No upcoming expiries.</p>
        )}
        {data.expiring.map((m) => (
          <p key={m.id} className="mt-3 text-sm">
            {m.user.name} · {m.user.championsId} · {date(m.endsAt)}
          </p>
        ))}
      </div>
      <div className="surface">
        <h3 className="font-semibold">Unpaid clubhouse charges · current</h3>
        {!data.unpaidTabs.length && (
          <p className="mt-4 text-sm">No unpaid charges.</p>
        )}
        {data.unpaidTabs.map((i) => (
          <Record
            key={i.id}
            title={`${i.number} · ${i.customerName}`}
            text={i.dueAt ? `Due ${date(i.dueAt)}` : "Settlement pending"}
            amount={i.outstandingPaise}
            invoiceId={i.id}
          />
        ))}
      </div>
    </div>
  );
}

type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
};
function AdminForm({
  title,
  fields,
  actionName,
  extra,
  description,
}: {
  title: string;
  fields: Field[];
  actionName: string;
  extra?: Record<string, unknown>;
  description?: string;
}) {
  const action = useAdmin();
  return (
    <form
      className="surface space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const input: Record<string, unknown> = { action: actionName, ...extra };
        for (const field of fields)
          input[field.name] =
            field.type === "number"
              ? Number(f.get(field.name))
              : field.type === "datetime-local"
                ? new Date(`${f.get(field.name)}:00+05:30`).toISOString()
                : String(f.get(field.name));
        action.mutate(input);
      }}
    >
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-xs text-slate-600">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label className="text-xs" key={field.name}>
            {field.label}
            {field.options ? (
              <select name={field.name} required defaultValue={field.value}>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="mt-2"
                name={field.name}
                type={field.type || "text"}
                defaultValue={field.value}
                min={field.min}
                max={field.max}
                required={field.name !== "reason" || actionName !== "cashClose"}
                maxLength={field.type ? undefined : 300}
              />
            )}
          </label>
        ))}
      </div>
      <Notice action={action} />
      <Button disabled={action.isPending}>
        {action.isPending ? "Saving…" : title}
      </Button>
    </form>
  );
}
export function CashWorkspace() {
  const query = useQuery({
    queryKey: ["cash"],
    queryFn: () => api<Cash>("/api/staff/admin?area=cash"),
    refetchInterval: 5000,
  });
  return (
    <div className="space-y-4">
      <AdminForm
        title="Open cash shift"
        description="Cash recorded while your shift is open is linked automatically. Prior unassigned transactions stay visible to the owner."
        actionName="cashOpen"
        fields={[
          {
            name: "openingPaise",
            label: "Opening float · paise",
            type: "number",
            min: 0,
            value: 0,
          },
        ]}
      />
      <Load pending={query.isPending} error={query.error} />
      {query.data?.shifts.length === 0 && (
        <p className="surface">No cash shifts yet.</p>
      )}
      {query.data?.shifts.map((s) => (
        <article className="surface space-y-4" key={s.id}>
          <h3 className="font-semibold">
            {s.closedAt ? "Finalized" : "Open"} shift · {dateTime(s.openedAt)}
          </h3>
          <p className="break-all text-xs text-slate-600">
            Staff account: {s.actorId}
          </p>
          <p className="text-sm">
            Opening {money(s.openingPaise)} + receipts {money(s.receiptsPaise)}{" "}
            − refunds {money(s.refundsPaise)} − payouts {money(s.payoutsPaise)}{" "}
            = <strong>expected {money(s.expectedPaise)}</strong>
          </p>
          {s.closedAt ? (
            <p className="text-sm">
              Counted {money(s.countedPaise || 0)} · difference{" "}
              {money((s.countedPaise || 0) - s.expectedPaise)} ·{" "}
              {s.discrepancyReason || "Balanced"}
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              <AdminForm
                title="Record payout"
                actionName="cashPayout"
                extra={{ id: s.id }}
                fields={[
                  {
                    name: "amountPaise",
                    label: "Amount · paise",
                    type: "number",
                    min: 1,
                  },
                  { name: "reason", label: "Payout reason" },
                ]}
              />
              <AdminForm
                title="Finalize cash shift"
                actionName="cashClose"
                extra={{ id: s.id }}
                fields={[
                  {
                    name: "countedPaise",
                    label: "Counted cash · paise",
                    type: "number",
                    min: 0,
                  },
                  {
                    name: "reason",
                    label: "Discrepancy explanation (required if unequal)",
                  },
                ]}
              />
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-sm">
              Supporting receipts, refunds and payouts
            </summary>
            {s.payments.map((p) => (
              <Record
                key={p.id}
                title={p.reference}
                text="Cash receipt"
                amount={p.amountPaise}
              />
            ))}
            {s.refunds.map((r) => (
              <Record
                key={r.id}
                title={r.reference}
                text="Cash refund"
                amount={r.amountPaise}
              />
            ))}
            {s.payouts.map((p) => (
              <Record
                key={p.id}
                title={p.reason}
                text="Cash payout"
                amount={p.amountPaise}
              />
            ))}
          </details>
        </article>
      ))}
      {!!query.data?.unassigned.length && (
        <div className="surface">
          <h3 className="font-semibold">Cash receipts without a shift</h3>
          {query.data.unassigned.map((p) => (
            <Record
              key={p.id}
              title={p.reference}
              text={date(p.receivedAt)}
              amount={p.amountPaise}
            />
          ))}
        </div>
      )}
      {!!query.data?.unassignedRefunds.length && (
        <div className="surface">
          <h3 className="font-semibold">Cash refunds without a shift</h3>
          {query.data.unassignedRefunds.map((r) => (
            <Record
              key={r.id}
              title={r.reference}
              text={date(r.recordedAt || r.createdAt)}
              amount={r.amountPaise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
export function PeopleWorkspace({ owner }: { owner: boolean }) {
  const query = useQuery({
    queryKey: ["hr"],
    queryFn: () => api<HR>("/api/staff/admin?area=hr"),
  });
  const action = useAdmin();
  const options =
    query.data
      ?.filter((e) => e.active)
      .map((e) => ({ value: e.id, label: `${e.user?.name} · ${e.title}` })) ||
    [];
  const employeeField: Field = {
    name: "employeeId",
    label: "Employee",
    options,
  };
  const dates: Field[] = [
    {
      name: "startsAt",
      label: "Starts · Asia/Kolkata",
      type: "datetime-local",
    },
    { name: "endsAt", label: "Ends · Asia/Kolkata", type: "datetime-local" },
  ];
  return (
    <div className="space-y-4">
      <div className="surface">
        <h2 className="text-xl font-semibold">
          {owner ? "People & payroll" : "My employment"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Configured monthly salary; explicit adjustments for leave or other
          changes. Finalized payslips retain employee and withholding snapshots.
        </p>
        {owner && (
          <a
            href="/api/staff/payroll-export"
            className="mt-3 inline-block text-sm text-orange-800 underline"
          >
            Export configurable withholding summary
          </a>
        )}
      </div>
      <Load pending={query.isPending} error={query.error} />
      <Notice action={action} />
      {owner && (
        <AdminForm
          title="Save employee"
          actionName="employee"
          extra={{ active: true }}
          fields={[
            { name: "email", label: "Existing staff email", type: "email" },
            { name: "title", label: "Job title" },
            {
              name: "salaryPaise",
              label: "Monthly salary · paise",
              type: "number",
              min: 0,
            },
          ]}
        />
      )}
      {!!options.length && (
        <div className="grid gap-4 xl:grid-cols-2">
          {owner && (
            <AdminForm
              title="Schedule shift"
              actionName="shift"
              fields={[employeeField, ...dates]}
            />
          )}
          <AdminForm
            title="Request leave"
            actionName="leave"
            fields={[
              employeeField,
              ...dates,
              { name: "reason", label: "Leave reason" },
            ]}
          />
          {owner && (
            <AdminForm
              title="Finalize payslip"
              description="Finalization is permanent. Review salary and tax settings first; later corrections use a new period or a separately documented adjustment."
              actionName="payslip"
              fields={[
                employeeField,
                { name: "period", label: "Payroll period", type: "month" },
                {
                  name: "adjustmentPaise",
                  label: "Adjustment · paise (may be negative)",
                  type: "number",
                  value: 0,
                },
                { name: "reason", label: "Adjustment / finalization reason" },
              ]}
            />
          )}
        </div>
      )}
      {query.data?.length === 0 && (
        <p className="surface">No employee record configured yet.</p>
      )}
      {query.data?.map((e) => (
        <div key={e.id} className="surface space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-semibold">
              {e.user?.name} · {e.title}
            </h3>
            <span className="text-sm">
              {money(e.salaryPaise)} / month ·{" "}
              {e.active ? "Active" : "Inactive"}
            </span>
            {owner && (
              <Button
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    action: "employee",
                    email: e.user?.email,
                    title: e.title,
                    salaryPaise: e.salaryPaise,
                    active: !e.active,
                  })
                }
              >
                {e.active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm">
              Scheduled shifts ({e.shifts.length})
            </summary>
            {e.shifts.map((s) => (
              <div key={s.id} className="mt-2 text-sm">
                <p>
                  {dateTime(s.startsAt)} → {dateTime(s.endsAt)} · {s.status}
                </p>
                {s.cancellationReason && <p>{s.cancellationReason}</p>}
                {owner && s.status === "SCHEDULED" && (
                  <AdminForm
                    title="Cancel shift"
                    actionName="shiftCancel"
                    extra={{ id: s.id }}
                    fields={[{ name: "reason", label: "Cancellation reason" }]}
                  />
                )}
              </div>
            ))}
          </details>
          <details open={e.leaves.some((l) => l.status === "PENDING")}>
            <summary className="cursor-pointer text-sm">
              Leave requests ({e.leaves.length})
            </summary>
            {e.leaves.map((l) => (
              <div
                key={l.id}
                className="mt-3 rounded border border-slate-200 p-3 text-sm"
              >
                <p>
                  {dateTime(l.startsAt)} → {dateTime(l.endsAt)} · {l.status}
                </p>
                <p className="mt-2">{l.reason}</p>
                {l.decisionReason && (
                  <p className="mt-2 text-slate-600">
                    Decision: {l.decisionReason}
                  </p>
                )}
                {owner && l.status === "PENDING" && (
                  <AdminForm
                    title="Decide leave"
                    actionName="leaveDecision"
                    extra={{ id: l.id }}
                    fields={[
                      {
                        name: "status",
                        label: "Decision",
                        options: ["APPROVED", "REJECTED"].map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                      { name: "reason", label: "Decision reason" },
                    ]}
                  />
                )}
              </div>
            ))}
          </details>
          <h4 className="text-sm font-semibold">Finalized payslips</h4>
          {!e.payslips.length && (
            <p className="text-sm text-slate-600">No payslips yet.</p>
          )}
          {e.payslips.map((p) => (
            <Link
              key={p.id}
              href={`/staff/payslips/${p.id}`}
              className="mr-4 inline-block text-sm text-orange-800 underline"
            >
              {p.period} · view / print
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
export function BusinessDocuments() {
  const query = useQuery({
    queryKey: ["business-quotes"],
    queryFn: () => api<Json<BusinessQuote>[]>("/api/staff/admin?area=quotes"),
  });
  const action = useAdmin();
  return (
    <div className="space-y-4">
      <form
        className="surface space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          action.mutate({
            action: "quote",
            customerName: String(f.get("name")),
            customerEmail: String(f.get("email")),
            department: String(f.get("department")),
            validUntil: new Date(
              `${f.get("validUntil")}T23:59:59+05:30`,
            ).toISOString(),
            lines: [
              {
                description: String(f.get("description")),
                quantity: Number(f.get("quantity")),
                unitPaise: Number(f.get("unitPaise")),
              },
            ],
          });
        }}
      >
        <h2 className="text-xl font-semibold">Business invoices & quotes</h2>
        <p className="text-sm text-slate-600">
          Owner-priced business services create immutable invoices in the shared
          ledger. Membership activation uses Reception membership checkout.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "name", label: "Business / client name" },
            { name: "email", label: "Billing email", type: "email" },
            { name: "validUntil", label: "Valid through", type: "date" },
            { name: "description", label: "Service description" },
            {
              name: "quantity",
              label: "Quantity",
              type: "number",
              min: 1,
              value: 1,
            },
            {
              name: "unitPaise",
              label: "Unit price · paise",
              type: "number",
              min: 1,
            },
          ].map((f) => (
            <label key={f.name} className="text-xs">
              {f.label}
              <Input
                className="mt-2"
                name={f.name}
                type={f.type || "text"}
                min={"min" in f ? f.min : undefined}
                defaultValue={"value" in f ? f.value : undefined}
                required
              />
            </label>
          ))}
          <label className="text-xs">
            Department
            <select name="department">
              {["MEMBERSHIP", "COURT", "SHOP", "CLUBHOUSE"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <Notice action={action} />
        <Button disabled={action.isPending}>
          {action.isPending ? "Saving…" : "Create quote"}
        </Button>
      </form>
      <Load pending={query.isPending} error={query.error} />
      {query.data?.length === 0 && (
        <p className="surface">No business quotes yet.</p>
      )}
      {query.data?.map((q) => (
        <article key={q.id} className="surface space-y-3">
          <h3 className="font-semibold">
            {q.customerName} · {money(q.totalPaise)}
          </h3>
          <p className="text-sm text-slate-600">
            {q.department} · valid through {date(q.validUntil)}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              className="text-sm text-orange-800 underline"
              href={`/staff/quotes/${q.id}`}
            >
              View / print quote
            </Link>
            {q.invoiceId ? (
              <ReceiptLink id={q.invoiceId} />
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  action.isPending || new Date(q.validUntil) <= new Date()
                }
                onClick={() =>
                  action.mutate({ action: "quoteInvoice", id: q.id })
                }
              >
                Issue invoice
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
type DeliveryData = {
  mode: string;
  configured: boolean;
  messages: {
    id: string;
    to: string;
    subject: string;
    mode: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
    jobId: string;
  }[];
  jobs: {
    id: string;
    status: string;
    attempts: number;
    lastError: string | null;
    runAt: string;
  }[];
};
export function DeliveryWorkspace() {
  const query = useQuery({
      queryKey: ["delivery"],
      queryFn: () => api<DeliveryData>("/api/staff/admin?area=mail"),
      refetchInterval: 5000,
    }),
    action = useAdmin();
  return (
    <div className="space-y-4">
      <PaymentHealth />
      <EmailHealth />
      <div className="surface space-y-4">
        <h2 className="text-xl font-semibold">
          Membership reminders & delivery
        </h2>
        <p className="text-sm text-slate-600">
          Default reminders: 7 days, 1 day and expiry day at 09:00 Asia/Kolkata.
          Edit days and hour in Business settings. Renewal suppresses obsolete
          notices. The worker schedules existing terms and processes due
          deliveries.
        </p>
        <Load pending={query.isPending} error={query.error} />
        <Notice action={action} />
        {query.data && (
          <>
            <p role="status" className="text-sm">
              Mode: {query.data.mode} ·{" "}
              {query.data.configured
                ? query.data.mode === "local"
                  ? "Local inbox enabled; no external email sent."
                  : "SMTP configuration present; deliveries below show actual status."
                : "Integration unconfigured; external delivery cannot succeed."}
            </p>
            {!query.data.messages.length && <p>No messages yet.</p>}
            {query.data.messages.map((m) => {
              const task = query.data.jobs.find((j) => j.id === m.jobId);
              return (
                <article
                  className="rounded-lg border border-slate-200 p-4 text-sm"
                  key={m.id}
                >
                  <h3 className="font-medium">{m.subject}</h3>
                  <p className="mt-2 break-all text-xs text-slate-600">
                    {m.to} ·{" "}
                    {m.mode === "local" && m.status === "DELIVERED"
                      ? "Delivered to local test inbox"
                      : m.status}{" "}
                    · attempts {task?.attempts ?? "—"}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {m.sentAt
                      ? `Delivered ${dateTime(m.sentAt)}`
                      : task
                        ? `Scheduled ${dateTime(task.runAt)}`
                        : "Job not in current history"}{" "}
                    {task?.lastError}
                  </p>
                  {task?.status === "FAILED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({ action: "retryMail", id: m.id })
                      }
                    >
                      Retry delivery
                    </Button>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>
      <GatewayReview />
    </div>
  );
}
function GatewayReview() {
  const query = useQuery({
    queryKey: ["gateway-review"],
    queryFn: () =>
      api<
        {
          id: string;
          userId: string;
          kind: string;
          amountPaise: number;
          state: string;
          paymentId: string | null;
        }[]
      >("/api/staff/admin?area=gateway"),
    refetchInterval: 5000,
  });
  return (
    <div className="surface space-y-4">
      <h3 className="font-semibold">Gateway payment monitoring</h3>
      <p className="text-xs text-slate-600">
        Captured payments with changed or expired checkouts require manual
        review and provider repayment. Pending status never means confirmed.
        Gateway refunds must be repaid through the provider before recording the
        refund in Billing.
      </p>
      <Load pending={query.isPending} error={query.error} />
      {query.data?.length === 0 && (
        <p className="text-sm">No gateway payment attempts.</p>
      )}
      {query.data?.map((i) => (
        <div key={i.id} className="space-y-3">
          <Record
            title={`${i.kind} · ${i.state}`}
            text={`Account ${i.userId} · ${i.paymentId || "Capture not verified"} · intent ${i.id}`}
            amount={i.amountPaise}
          />
          {i.state === "NEEDS_REVIEW" && (
            <AdminForm
              title="Verify full provider repayment"
              actionName="gatewayRepayment"
              extra={{ id: i.id }}
              description="Repay through the Razorpay dashboard first. This action fetches and verifies a processed full refund; it does not initiate another transfer."
              fields={[
                { name: "refundId", label: "Provider refund ID (rfnd_…)" },
                { name: "reason", label: "Review / repayment reason" },
              ]}
            />
          )}
        </div>
      ))}
    </div>
  );
}
type AuditData = {
  rows: {
    id: string;
    actorId: string;
    action: string;
    entityId: string;
    reason: string | null;
    createdAt: string;
  }[];
  next: string | null;
};
export function AuditWorkspace() {
  const [q, setQ] = useState(""),
    [cursor, setCursor] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["audit", q, cursor],
    queryFn: () =>
      api<AuditData>(
        `/api/staff/admin?area=audit&q=${encodeURIComponent(q)}${cursor ? `&cursor=${cursor}` : ""}`,
      ),
  });
  return (
    <div className="surface space-y-4">
      <h2 className="text-xl font-semibold">Audit history</h2>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get("q")));
          setCursor(null);
        }}
      >
        <label className="flex-1 text-xs">
          Action, actor or record ID
          <Input name="q" defaultValue={q} className="mt-2" maxLength={150} />
        </label>
        <Button variant="outline" className="self-end">
          Search history
        </Button>
      </form>
      <Load pending={query.isPending} error={query.error} />
      {query.data?.rows.length === 0 && <p>No matching audit records.</p>}
      {query.data?.rows.map((r) => (
        <article key={r.id} className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-medium">
            {r.action} · {dateTime(r.createdAt)}
          </h3>
          <p className="mt-2 break-all text-xs text-slate-600">
            Actor {r.actorId} · Record {r.entityId}
          </p>
          {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
        </article>
      ))}
      <div className="flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor(null)}>
            Latest records
          </Button>
        )}
        {query.data?.next && (
          <Button variant="outline" onClick={() => setCursor(query.data!.next)}>
            Older records
          </Button>
        )}
      </div>
    </div>
  );
}
