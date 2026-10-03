"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  GatewayCheckout,
  GatewayHistory,
  usePaymentModes,
} from "./gateway-checkout";
export type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
export function useAction() {
  const client = useQueryClient();
  const router = useRouter();
  const [retry, setRetry] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  return useMutation({
    mutationFn: async ({
      area,
      id,
      input,
    }: {
      area: string;
      id?: string;
      input: unknown;
    }) => {
      const fingerprint = JSON.stringify({ area, id, input });
      const key =
        retry?.fingerprint === fingerprint ? retry.key : crypto.randomUUID();
      setRetry({ fingerprint, key });
      const result = await api<Record<string, unknown>>(
        `/api/operations/${area}${id ? "/" + id : ""}`,
        {
          method: id ? "PATCH" : "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(input),
        },
      );
      setRetry(null);
      return result;
    },
    onSuccess: () => {
      router.refresh();
      return client.invalidateQueries();
    },
  });
}
export function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.error && (
        <p className="field-error my-3" role="alert">
          {action.error.message}
        </p>
      )}
      {action.isSuccess && (
        <p className="my-3 text-sm text-orange-500" role="status">
          Saved. All related views have been refreshed.
        </p>
      )}
    </>
  );
}
export function ReceiptLink({ id }: { id?: string | null }) {
  return id ? (
    <Link
      className="text-xs text-orange-400 hover:text-orange-300 underline font-medium inline-flex items-center gap-1 transition-colors"
      href={`/account/receipts/${id}`}
    >
      Draft invoice & receipt details →
    </Link>
  ) : null;
}
export function PaymentMethod({
  value,
  onChange,
  staff = false,
}: {
  value: string;
  onChange: (v: string) => void;
  staff?: boolean;
}) {
  return (
    <label className="block text-xs">
      Payment method
      <select
        className="mt-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {staff &&
          ["CASH", "CARD", "UPI"].map((m) => <option key={m}>{m}</option>)}
        <option value="LOCAL">Local test · no funds collected</option>
      </select>
    </label>
  );
}
type Hold = {
  id: string;
  pricePaise?: number;
  totalPaise?: number;
  holdUntil?: string;
  invoiceId?: string;
  startsAt?: string;
  court?: { name: string };
  title?: string;
  priceSnapshot?: { plan?: string; discountBps?: number };
};
export function CheckoutHold({
  area,
  hold,
  eventId,
  onDone,
}: {
  area: "booking" | "social" | "order";
  hold: Hold;
  eventId?: string;
  onDone: () => void;
}) {
  const action = useAction();
  const modes = usePaymentModes();
  const input = (kind: string) => ({
    action: kind,
    method: "LOCAL",
    ...(kind === "cancel" ? { reason: "Customer released checkout" } : {}),
    ...(area === "social" ? { participantId: hold.id } : {}),
  });

  const totalPaise = hold.totalPaise ?? hold.pricePaise ?? 0;
  const holdExpiryFormatted = hold.holdUntil
    ? new Date(hold.holdUntil).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div
      className="checkout-hold-card my-6 relative overflow-hidden rounded-xl border border-neutral-300 bg-white p-6 sm:p-8 text-neutral-900 shadow-sm"
      role="region"
      aria-label="Review checkout"
    >
      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-800">
          <span className="size-2 rounded-full bg-orange-600" />
          {area === "order" ? "Order Hold Active" : "Session Hold Active"}
        </div>
        {holdExpiryFormatted && (
          <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 border border-neutral-200">
            <span>
              Expires at <strong className="text-neutral-950 font-semibold">{holdExpiryFormatted}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left column: Session Details */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              Review your {area === "order" ? "order" : "session"}
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Your selection is reserved while you complete checkout.
            </p>
          </div>

          {hold.startsAt ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-1">
              <h3 className="text-base font-semibold text-neutral-950">
                {hold.title || hold.court?.name || "Court Session"}
              </h3>
              <p className="text-sm text-neutral-700">
                {new Date(hold.startsAt).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                {new Date(hold.startsAt).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {" · 1 hour session"}
              </p>
            </div>
          ) : null}

          {/* Pricing summary tile - crystal clear and bold */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-neutral-500">Total Amount</p>
              <p className="text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
                {money(totalPaise)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800">
                {hold.priceSnapshot?.plan || "Standard Rate"}
              </span>
              <p className="mt-1 text-[11px] text-neutral-500">Benefits applied</p>
            </div>
          </div>
        </div>

        {/* Right column: Payment Reassurance & Action CTAs */}
        <div className="flex flex-col justify-between space-y-5 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Payment Notice
            </div>
            <p className="text-xs leading-relaxed text-neutral-600">
              {modes.data?.local
                ? "Local test mode is active. No funds will be charged. Confirmed rates are saved with your account invoice."
                : modes.data?.gateway
                  ? "Payment is verified via secure Razorpay checkout before confirmation."
                  : "Online payments are not configured. Contact reception."}
            </p>
            <div className="pt-1">
              <ReceiptLink id={hold.invoiceId} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-neutral-200">
            {modes.data?.gateway && totalPaise > 0 ? (
              <GatewayCheckout
                input={{
                  kind: area === "order" ? "order" : area,
                  targetId: hold.id,
                }}
                onDone={onDone}
              />
            ) : (
              <Button
                size="lg"
                className="flex-1 min-w-[200px] bg-[#ff6b2c] hover:bg-[#ea580c] text-white font-bold transition-all shadow-sm active:scale-[0.99]"
                disabled={
                  action.isPending ||
                  modes.isPending ||
                  (!modes.data?.local && totalPaise > 0)
                }
                onClick={() =>
                  action.mutate(
                    { area, id: eventId || hold.id, input: input("confirm") },
                    { onSuccess: onDone },
                  )
                }
              >
                {action.isPending ? (
                  "Processing…"
                ) : totalPaise === 0 ? (
                  "Confirm Complimentary Session"
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-semibold"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  { area, id: eventId || hold.id, input: input("cancel") },
                  { onSuccess: onDone },
                )
              }
            >
              Release Hold
            </Button>
          </div>
        </div>
      </div>

      <Feedback action={action} />
    </div>
  );
}
export function History() {
  const query = useQuery({
    queryKey: ["operations", "history"],
    queryFn: () =>
      api<{
        bookings: (Hold & {
          status: string;
          startsAt: string;
          checkedInAt: string | null;
          court: { name: string };
        })[];
        social: (Hold & {
          status: string;
          eventId: string;
          event: { title: string; reservation: { startsAt: string } };
        })[];
        orders: (Hold & {
          status: string;
          createdAt: string;
          delivery: boolean;
          tracking: string | null;
          orderLines: {
            id: string;
            name: string;
            label: string;
            quantity: number;
            returned: number;
          }[];
        })[];
        waiting: {
          id: string;
          status: string;
          startsAt: string;
          offerUntil: string | null;
          reservationId: string | null;
          participantId: string | null;
          eventId: string | null;
        }[];
        bills: {
          id: string;
          status: string;
          paymentStatus: string;
          tabEnabled: boolean;
          table: { name: string };
          tickets: {
            id: string;
            preparation: string;
            invoiceId: string | null;
            lines: {
              id: string;
              name: string;
              quantity: number;
              note: string;
              status: string;
            }[];
          }[];
        }[];
      }>("/api/operations/history"),
    refetchInterval: 5000,
  });
  const action = useAction();
  const [hold, setHold] = useState<{
    area: "booking" | "social" | "order";
    hold: Hold;
    eventId?: string;
  } | null>(null);
  const cancel = (area: string, id: string, extra = {}) => {
    const reason = window.prompt(
      "Reason for cancellation (at least 5 characters)",
    );
    if (reason)
      action.mutate({
        area,
        id,
        input:
          area === "waiting"
            ? { action: "cancel" }
            : { action: "cancel", reason, ...extra },
      });
  };
  if (query.isPending)
    return (
      <p className="mt-8" role="status">
        Loading your club activity…
      </p>
    );
  if (query.error)
    return (
      <p role="alert" className="field-error">
        {query.error.message}
      </p>
    );
  const d = query.data!;
  return (
    <div className="mt-8 space-y-7">
      <GatewayHistory />
      {hold && <CheckoutHold {...hold} onDone={() => setHold(null)} />}
      <Feedback action={action} />
      <section className="rounded border border-current/15 p-6">
        <h2 className="text-xl">Courts & social play</h2>
        <p className="mt-3 text-xs text-neutral-500">
          Confirmed cancellations require the club notice period. Contact
          reception for exceptions.
        </p>
        {!d.bookings.length && !d.social.length && (
          <p className="mt-5 text-sm">
            No sessions yet.{" "}
            <Link href="/book" className="text-orange-500">
              Book a court →
            </Link>
          </p>
        )}
        {d.bookings.map((b) => (
          <article
            key={b.id}
            className="mt-5 space-y-3 border-t border-current/10 pt-4"
          >
            <p>
              {b.court.name} ·{" "}
              {new Date(b.startsAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              · {b.status}
              {b.checkedInAt ? " · Checked in" : ""}
            </p>
            <p className="text-sm">{money(b.pricePaise || 0)}</p>
            <ReceiptLink id={b.invoiceId} />
            <div className="flex flex-wrap gap-3">
              {b.status === "HOLD" && (
                <Button
                  size="sm"
                  onClick={() => setHold({ area: "booking", hold: b })}
                >
                  Review hold
                </Button>
              )}
              {["HOLD", "CONFIRMED"].includes(b.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => cancel("booking", b.id)}
                >
                  Cancel booking
                </Button>
              )}
            </div>
          </article>
        ))}
        {d.social.map((p) => (
          <article
            key={p.id}
            className="mt-5 space-y-3 border-t border-current/10 pt-4"
          >
            <p>
              {p.event.title} ·{" "}
              {new Date(p.event.reservation.startsAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              · {p.status}
            </p>
            <ReceiptLink id={p.invoiceId} />
            <div className="flex gap-3">
              {p.status === "HOLD" && (
                <Button
                  size="sm"
                  onClick={() =>
                    setHold({ area: "social", eventId: p.eventId, hold: p })
                  }
                >
                  Review social hold
                </Button>
              )}
              {["HOLD", "CONFIRMED"].includes(p.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    cancel("social", p.eventId, { participantId: p.id })
                  }
                >
                  Cancel place
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="rounded border border-current/15 p-6">
        <h2 className="text-xl">Waiting lists</h2>
        {!d.waiting.length && (
          <p className="mt-4 text-sm">No waiting-list requests.</p>
        )}
        {d.waiting.map((w) => (
          <article className="mt-4 space-y-2" key={w.id}>
            <p className="text-sm">
              {new Date(w.startsAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              · {w.status}
            </p>
            {w.status === "OFFERED" && (
              <p className="text-orange-500 text-sm">
                A place is held until{" "}
                {new Date(w.offerUntil!).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
                . Review the hold above to accept or release it.
              </p>
            )}
            {w.status === "WAITING" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancel("waiting", w.id)}
              >
                Leave waiting list
              </Button>
            )}
          </article>
        ))}
      </section>
      <section className="rounded border border-current/15 p-6">
        <h2 className="text-xl">Shop purchases</h2>
        {!d.orders.length && (
          <p className="mt-4">Your purchases will appear here.</p>
        )}
        {d.orders.map((o) => (
          <article
            key={o.id}
            className="mt-5 space-y-3 border-t border-current/10 pt-4"
          >
            <p>
              {new Date(o.createdAt).toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              · {o.delivery ? "Delivery" : "Club pickup"} · {o.status}
            </p>
            {o.orderLines.map((l) => (
              <p className="text-sm" key={l.id}>
                {l.quantity} × {l.name} · {l.label}
                {l.returned ? ` · ${l.returned} returned` : ""}
              </p>
            ))}
            {o.tracking && <p className="text-sm">Tracking: {o.tracking}</p>}
            <ReceiptLink id={o.invoiceId} />
            <div className="flex gap-3">
              {o.status === "HOLD" && (
                <Button
                  size="sm"
                  onClick={() => setHold({ area: "order", hold: o })}
                >
                  Review order
                </Button>
              )}
              {["HOLD", "PAID"].includes(o.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancel("order", o.id)}
                >
                  Cancel order
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="rounded border border-current/15 p-6">
        <h2 className="text-xl">Clubhouse bills & tabs</h2>
        {!d.bills.length && <p className="mt-4">No clubhouse bills.</p>}
        {d.bills.map((b) => (
          <article
            key={b.id}
            className="mt-5 space-y-3 border-t border-current/10 pt-4"
          >
            <p>
              {b.table.name} · {b.status} · Payment: {b.paymentStatus}
              {b.tabEnabled ? " · Member tab" : ""}
            </p>
            {b.tickets.map((t) => (
              <div className="space-y-2" key={t.id}>
                <p className="text-xs text-orange-500">
                  Preparation: {t.preparation}
                </p>
                {t.lines.map((l) => (
                  <p className="text-sm" key={l.id}>
                    {l.quantity} × {l.name} · {l.status}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                ))}
                <ReceiptLink id={t.invoiceId} />
              </div>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
