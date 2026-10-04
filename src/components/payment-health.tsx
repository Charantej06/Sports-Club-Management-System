"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { StatusBadge } from "./staff-ui";

type Health = {
  mode: "razorpay" | "local" | "off";
  configured: boolean;
  missing: string[];
  warnings: string[];
  testMode: boolean;
  keyId: string | null;
  webhookUrl: string;
  intents: Record<string, number>;
};

/** Owner-facing payment check: how online payments are configured and a live test that Razorpay accepts the keys. */
export function PaymentHealth() {
  const health = useQuery({ queryKey: ["payment-health"], queryFn: () => api<Health>("/api/staff/payments"), refetchInterval: 20000 });
  const verify = useMutation({ mutationFn: () => api<{ ok: boolean; message: string }>("/api/staff/payments", { method: "POST", body: JSON.stringify({ action: "verify" }) }) });
  const h = health.data;
  const rows: [string, string][] = h
    ? [
        ["Payment mode", h.mode === "razorpay" ? `Razorpay${h.testMode ? " · test mode (no real money)" : " · LIVE"}` : h.mode === "local" ? "Local demo (simulated payments)" : "Not set"],
        ["Key ID", h.keyId ?? "Not set"],
        ["Webhook address to give Razorpay", h.webhookUrl],
        ["Online payments", Object.entries(h.intents).map(([k, v]) => `${k.toLowerCase().replace("_", " ")} ${v}`).join(" · ") || "none yet"],
      ]
    : [];
  return (
    <section className="surface space-y-5" aria-labelledby="payment-health-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payment-health-title" className="text-xl font-semibold">Online payments</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Customers pay for memberships, courts and shop orders through Razorpay. Keys live in the server&apos;s <code>.env</code> file and are never shown here. Every payment is verified by the server before anything is confirmed.
          </p>
        </div>
        {h && <StatusBadge tone={h.configured ? (h.mode === "local" ? "info" : "success") : "danger"}>{h.mode === "local" ? "Local mode" : h.configured ? "Razorpay configured" : "Razorpay incomplete"}</StatusBadge>}
      </div>
      {health.isPending && <p role="status" className="text-sm text-slate-500">Checking payment settings…</p>}
      {health.error && <p role="alert" className="field-error">{health.error.message}</p>}
      {h && (
        <>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-1 break-words text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {h.missing.length > 0 && <p role="alert" className="field-error">Missing in .env: {h.missing.join(", ")}</p>}
          {h.warnings.map((w) => <p key={w} className="notice text-xs" role="note">{w}</p>)}
          <Button variant="outline" disabled={verify.isPending} onClick={() => verify.mutate()}><ShieldCheck size={16} />{verify.isPending ? "Checking with Razorpay…" : "Test Razorpay keys"}</Button>
        </>
      )}
      {verify.error && <p role="alert" className="field-error">{verify.error.message}</p>}
      {verify.data && <p role={verify.data.ok ? "status" : "alert"} className={verify.data.ok ? "text-sm text-emerald-700" : "field-error"}>{verify.data.message}</p>}
    </section>
  );
}
