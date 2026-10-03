"use client";
import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { CheckoutHold, Feedback, useAction } from "./operations-ui";
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
      className="text-xs text-orange-400 whitespace-nowrap"
      href="/shop/cart"
    >
      Cart ({count})
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
  const query = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => api<Awaited<ReturnType<typeof publicData>>>("/api/public"),
  });
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
      <Feedback action={action} />
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      {!items.length && (
        <p className="soft-text mt-8">
          Your cart is empty. Find your next favourite piece of kit in the shop.
        </p>
      )}
      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
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
                setHold(d as unknown as NonNullable<typeof hold>),
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
            <Button disabled={action.isPending || !!hold}>
              {action.isPending ? "Reserving stock…" : "Review checkout"}
            </Button>
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
