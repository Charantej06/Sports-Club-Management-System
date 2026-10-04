"use client";
import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { CheckoutHold, ReceiptLink, useAction } from "./operations-ui";
import { usePaymentModes } from "./gateway-checkout";
const storage = "champions-cart-v2",
  empty = "[]";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("club-cart", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("club-cart", listener);
  };
}
function snapshot() {
  return localStorage.getItem(storage) || empty;
}
export function addCart(variantId: string) {
  const cart = JSON.parse(snapshot()) as {
    variantId: string;
    quantity: number;
  }[];
  const item = cart.find((i) => i.variantId === variantId);
  if (item) item.quantity = Math.min(20, item.quantity + 1);
  else cart.push({ variantId, quantity: 1 });
  localStorage.setItem(storage, JSON.stringify(cart));
  window.dispatchEvent(new Event("club-cart"));
}
export function CartLink() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => empty);
  const count = (JSON.parse(raw) as { quantity: number }[]).reduce(
    (s, i) => s + i.quantity,
    0,
  );
  return (
    <Link
      className="header-cart"
      href="/shop/cart"
      aria-label={`Shopping cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingCart size={20} strokeWidth={1.8} aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
    </Link>
  );
}
export function Cart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => empty);
  const items = JSON.parse(raw) as { variantId: string; quantity: number }[];
  const [delivery, setDelivery] = useState(false),
    [hold, setHold] = useState<{
      id: string;
      totalPaise: number;
      holdUntil: string;
      invoiceId: string;
    } | null>(null);
  const action = useAction();
  const router = useRouter();
  const client = useQueryClient();
  const modes = usePaymentModes();
  const [placed, setPlaced] = useState<{ totalPaise: number; invoiceId?: string; simulated: boolean } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const query = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => api<Awaited<ReturnType<typeof publicData>>>("/api/public"),
  });
  const subtotal = items.reduce((sum, i) => {
    const v = query.data?.products.flatMap((p) => p.variants).find((x) => x.id === i.variantId);
    return sum + (v ? v.pricePaise * i.quantity : 0);
  }, 0);
  const clearCart = () => {
    localStorage.removeItem(storage);
    window.dispatchEvent(new Event("club-cart"));
  };
  /** Local/complimentary orders complete in one step; online payment opens straight from the held order. */
  async function placeOrder(held: NonNullable<typeof hold>) {
    if (modes.data?.gateway && held.totalPaise > 0) return setHold(held);
    const patch = (input: Record<string, unknown>) =>
      api(`/api/operations/order/${held.id}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      });
    try {
      if (!modes.data?.local && held.totalPaise > 0) throw new Error("Online payments are not configured. Please contact the club to order.");
      await patch({ action: "confirm", method: "LOCAL" });
      clearCart();
      setPlaced({ totalPaise: held.totalPaise, invoiceId: held.invoiceId, simulated: !!modes.data?.local && held.totalPaise > 0 });
      router.refresh();
      await client.invalidateQueries();
    } catch (error) {
      await patch({ action: "cancel", reason: "Checkout could not be completed" }).catch(() => undefined);
      throw error;
    }
  }
  const change = (id: string, n: number) => {
    localStorage.setItem(
      storage,
      JSON.stringify(
        items
          .map((i) => (i.variantId === id ? { ...i, quantity: n } : i))
          .filter((i) => i.quantity > 0),
      ),
    );
    window.dispatchEvent(new Event("club-cart"));
  };
  return (
    <section className="site-width py-16 max-w-4xl">
      <Link className="text-xs text-neutral-500" href="/shop">
        ← The Champions Shop
      </Link>
      <h1 className="section-title mt-8">Your kit, ready.</h1>
      {hold && (
        <CheckoutHold
          area="order"
          hold={hold}
          onDone={() => {
            setHold(null);
            localStorage.removeItem(storage);
            window.dispatchEvent(new Event("club-cart"));
          }}
        />
      )}
      {(checkoutError || action.error) && (
        <p className="field-error my-3" role="alert">
          {checkoutError || action.error?.message}
        </p>
      )}
      {placed && (
        <div role="status" className="mt-8 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={26} aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-xl font-medium">Order placed.</h2>
            <p className="text-sm text-neutral-300">
              {money(placed.totalPaise)} · collect it at the club desk. {placed.simulated && "Local test mode: no money was collected."}
            </p>
            <ReceiptLink id={placed.invoiceId} />
            <div className="pt-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/shop">Keep shopping</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      {!items.length && !placed && (
        <p className="soft-text mt-8">
          Your cart is empty. Find your next favourite piece of kit in the shop.
        </p>
      )}
      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setCheckoutError(null);
          setPlaced(null);
          setWorking(true);
          action.mutate(
            {
              area: "order",
              input: {
                items,
                delivery,
                ...(delivery
                  ? {
                      address: {
                        line: String(f.get("line")),
                        city: String(f.get("city")),
                        postcode: String(f.get("postcode")),
                        phone: String(f.get("phone")),
                      },
                    }
                  : {}),
              },
            },
            {
              onSuccess: (d) =>
                placeOrder(d as unknown as NonNullable<typeof hold>)
                  .catch((error: Error) => setCheckoutError(error.message))
                  .finally(() => setWorking(false)),
              onError: () => setWorking(false),
            },
          );
        }}
      >
        {items.map((i) => {
          const p = query.data?.products.find((p) =>
              p.variants.some((v) => v.id === i.variantId),
            ),
            v = p?.variants.find((v) => v.id === i.variantId);
          return (
            <article
              className="flex flex-wrap items-center justify-between gap-4 rounded border border-white/15 p-5"
              key={i.variantId}
            >
              <div>
                <p>{p?.name || "Loading item…"}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {v?.label} · {v ? money(v.pricePaise) : ""} ·{" "}
                  {v?.available ?? 0} available
                </p>
              </div>
              <label className="text-xs">
                Quantity
                <Input
                  className="mt-2 w-20"
                  type="number"
                  min={0}
                  max={20}
                  value={i.quantity}
                  onChange={(e) => change(i.variantId, Number(e.target.value))}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => change(i.variantId, 0)}
              >
                Remove
              </Button>
            </article>
          );
        })}
        {!!items.length && (
          <>
            <p className="soft-text text-sm">
              Membership discounts apply at checkout. Stock is shared with the
              club counter.
            </p>
            <label className="flex gap-3 items-center">
              <input
                type="checkbox"
                checked={delivery}
                onChange={(e) => setDelivery(e.target.checked)}
              />
              Delivery instead of club pickup
            </label>
            {delivery && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["line", "Street address"],
                  ["city", "City"],
                  ["postcode", "Six-digit postcode"],
                  ["phone", "Delivery phone"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <Input
                      className="mt-2"
                      name={name}
                      required
                      minLength={name === "line" ? 8 : 2}
                      pattern={name === "postcode" ? "[0-9]{6}" : undefined}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <p className="text-xs text-neutral-500">Subtotal before member discounts</p>
                <p className="text-2xl font-medium">{money(subtotal)}</p>
              </div>
              <Button size="lg" disabled={working || action.isPending || modes.isPending || !!hold}>
                {working || action.isPending ? "Placing your order…" : modes.data?.gateway ? "Continue to payment" : "Place order"}
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              Your cart is a local draft. Checkout requires a live connection.
              Delivery fees appear in the invoice.
            </p>
          </>
        )}
      </form>
      <Link
        className="mt-8 inline-block text-orange-500 text-sm"
        href="/account"
      >
        Order history & receipts →
      </Link>
    </section>
  );
}
