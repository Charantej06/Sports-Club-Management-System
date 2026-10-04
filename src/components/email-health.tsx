"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck, Send } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";

type Health = {
  mode: "smtp" | "local";
  configured: boolean;
  missing: string[];
  warnings: string[];
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  from: string | null;
  baseUrl: string | null;
  queue: Record<string, number>;
};
type Result = { ok: boolean; message: string };

/** Owner-facing email check: how mail is configured, a live SMTP login test and a real test message. */
export function EmailHealth() {
  const client = useQueryClient();
  const health = useQuery({ queryKey: ["mail-health"], queryFn: () => api<Health>("/api/staff/mail"), refetchInterval: 15000 });
  const run = useMutation({
    mutationFn: (action: "verify" | "test") => api<Result>("/api/staff/mail", { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["mail-health"] }),
  });
  const h = health.data;
  const rows: [string, string][] = h
    ? [
        ["Sending mode", h.mode === "smtp" ? "Real email via SMTP" : "Local test inbox (nothing leaves this machine)"],
        ["SMTP server", h.host ? `${h.host}:${h.port} · ${h.secure ? "implicit TLS" : h.port === 587 ? "STARTTLS" : "plain / opportunistic TLS"}` : "Not set"],
        ["Login", h.user ?? "Not set"],
        ["Sender (From)", h.from ?? "Not set"],
        ["Links in emails point to", h.baseUrl ?? "Not set"],
      ]
    : [];
  return (
    <section className="surface space-y-5" aria-labelledby="email-health-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="email-health-title" className="text-xl font-semibold">Email delivery</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Verification, password-reset and membership reminder emails are sent by the background worker. Settings live in the server&apos;s <code>.env</code> file; the password is never shown here. Setup guide: <code>docs/SMTP.md</code>.
          </p>
        </div>
        {h && <span className={`rounded-md px-3 py-2 text-sm font-medium ${h.mode === "local" ? "bg-slate-100 text-slate-700" : h.configured ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{h.mode === "local" ? "Local mode" : h.configured ? "SMTP configured" : "SMTP incomplete"}</span>}
      </div>
      {health.isPending && <p role="status" className="text-sm text-slate-500">Checking email settings…</p>}
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
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {["QUEUED", "RETRYING", "DELIVERED", "FAILED"].map((s) => (
              <span key={s}>{s.charAt(0) + s.slice(1).toLowerCase()}: <strong className="text-slate-900">{h.queue[s] ?? 0}</strong></span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate("verify")}><MailCheck size={16} />{run.isPending && run.variables === "verify" ? "Testing…" : "Test SMTP connection"}</Button>
            <Button disabled={run.isPending} onClick={() => run.mutate("test")}><Send size={16} />{run.isPending && run.variables === "test" ? "Queuing…" : "Send me a test email"}</Button>
          </div>
        </>
      )}
      {run.error && <p role="alert" className="field-error">{run.error.message}</p>}
      {run.data && <p role={run.data.ok ? "status" : "alert"} className={run.data.ok ? "text-sm text-emerald-700" : "field-error"}>{run.data.message}</p>}
    </section>
  );
}
