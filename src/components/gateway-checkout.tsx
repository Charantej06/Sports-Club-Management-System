"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { money, date } from "@/lib/utils";
type CheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayCheckout = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  handler: (response: CheckoutResponse) => void;
  modal: { ondismiss: () => void };
}) => { open: () => void; on: (event: string, handler: () => void) => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCheckout;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = undefined;
        script.remove();
        reject(
          new Error(
            "Payment checkout could not load. Check your internet connection.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return scriptPromise;
}
export function usePaymentModes() {
  return useQuery({
    queryKey: ["payment-modes"],
    queryFn: () => api<{ local: boolean; gateway: boolean }>("/api/payments"),
  });
}
export function GatewayHistory() {
  const query = useQuery({
    queryKey: ["gateway-history"],
    queryFn: () =>
      api<
        {
          id: string;
          kind: string;
          amountPaise: number;
          state: string;
          createdAt: string;
        }[]
      >("/api/payments?history=true"),
    refetchInterval: 5000,
  });
  if (query.error)
    return (
      <p role="alert" className="field-error">
        {query.error.message}
      </p>
    );
  if (!query.data?.length) return null;
  return (
    <section className="rounded border border-current/15 p-6">
      <h2 className="text-xl">Online payment status</h2>
      {query.data.map((i) => (
        <article className="mt-4 text-sm" key={i.id}>
          <p>
            {i.kind} · {money(i.amountPaise)} · {date(i.createdAt)} · {i.state}
          </p>
          {i.state === "NEEDS_REVIEW" && (
            <p className="mt-2 text-orange-700">
              Captured payment needs staff review before confirmation or
              repayment. Contact reception; do not pay again.
            </p>
          )}
          {i.state === "PENDING" && (
            <p className="mt-2 text-xs">
              Provider payment or verification is pending. This is not a
              confirmed booking or purchase.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
export function GatewayCheckout({
  input,
  onDone,
}: {
  input: Record<string, unknown>;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState<{ input: string; key: string } | null>(
      null,
    ),
    client = useQueryClient();
  async function checkout() {
    setPending(true);
    setMessage("");
    try {
      await loadCheckout();
      const serialized = JSON.stringify(input),
        key = retry?.input === serialized ? retry.key : crypto.randomUUID();
      setRetry({ input: serialized, key });
      const intent = await api<{
        id: string;
        orderId: string;
        amountPaise: number;
        keyId: string;
      }>("/api/payments", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: serialized,
      });
      const checkout = new window.Razorpay!({
        key: intent.keyId,
        order_id: intent.orderId,
        amount: intent.amountPaise,
        currency: "INR",
        name: "Champions Club",
        modal: {
          ondismiss: () => {
            setPending(false);
            setMessage(
              "Checkout closed. No club confirmation has been recorded. Check My Account if a payment is processing.",
            );
          },
        },
        handler: async (response) => {
          try {
            const result = await api<{ state: string }>("/api/payments", {
              method: "PATCH",
              body: JSON.stringify({
                id: intent.id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            await client.invalidateQueries();
            if (result.state === "COMPLETE") {
              setRetry(null);
              onDone();
            } else
              setMessage(
                "Payment was captured, but the checkout changed or expired. Staff must review it and arrange any repayment. Do not pay again.",
              );
          } catch (error) {
            setMessage(
              `${error instanceof Error ? error.message : "Verification pending."} Check My Account before attempting another payment.`,
            );
          } finally {
            setPending(false);
          }
        },
      });
      checkout.on("payment.failed", () => {
        setPending(false);
        setMessage(
          "The provider reported a failed payment. No club confirmation was recorded.",
        );
      });
      checkout.open();
    } catch (error) {
      setPending(false);
      setMessage(
        error instanceof Error ? error.message : "Unable to open checkout.",
      );
    }
  }
  return (
    <div>
      <Button type="button" disabled={pending} onClick={checkout}>
        {pending ? "Verifying payment…" : "Pay securely · Razorpay"}
      </Button>
      {message && (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
