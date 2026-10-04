"use client";
import Link from "next/link";
import { useSyncExternalStore, useState, useRef } from "react";
import Image from "next/image";
import { ShoppingCart, Package, Truck, ShieldCheck, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAction } from "./operations-ui";
import { GatewayCheckout, usePaymentModes } from "./gateway-checkout";
import { CheckoutArt } from "./checkout-art";
import {
  readActiveCart,
  writeActiveCart,
  addCartItem,
  getActiveCartKey,
  cleanLegacyCarts,
  parseCartItems,
  type CartItem,
} from "@/lib/cart-store";
import { useCurrentUser } from "./auth-context";

export { setActiveCartUserId, clearActiveCart } from "@/lib/cart-store";

const empty = "[]";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("club-cart", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("club-cart", listener);
  };
}

function snapshot() {
  if (typeof window === "undefined") return empty;
  cleanLegacyCarts();
  const key = getActiveCartKey();
  try {
    return window.localStorage.getItem(key) || empty;
  } catch {
    return empty;
  }
}

export function addCart(variantId: string) {
  addCartItem(variantId);
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

type OrderCheckout = {
  id: string;
  totalPaise: number;
  holdUntil: string;
  invoiceId: string;
};
export function Cart() {
  const user = useCurrentUser();
  const raw = useSyncExternalStore(subscribe, snapshot, () => empty);
  const items: CartItem[] = parseCartItems(raw);
  const [delivery, setDelivery] = useState(false);
  const [hold, setHold] = useState<OrderCheckout | null>(null);
  const [complete, setComplete] = useState<OrderCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const [gatewayPending, setGatewayPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const submittedItems = useRef<CartItem[]>([]);
  const create = useAction(),
    confirm = useAction(),
    cancel = useAction();
  const modes = usePaymentModes();
  const query = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => api<Awaited<ReturnType<typeof publicData>>>("/api/public"),
  });
  const rows = items.map((i) => {
    const p = query.data?.products.find((p) =>
      p.variants.some((v) => v.id === i.variantId),
    );
    return {
      ...i,
      product: p,
      variant: p?.variants.find((v) => v.id === i.variantId),
    };
  });
  const subtotal = rows.reduce(
    (total, r) => total + (r.variant?.pricePaise || 0) * r.quantity,
    0,
  );
  const fee = delivery ? query.data?.settings.deliveryFeePaise || 0 : 0;
  const unavailable = rows.some(
    (r) => !r.variant || r.variant.available < r.quantity,
  );
  function change(id: string, quantity: number) {
    if (busy || hold) return;
    const current = readActiveCart();
    const next = current
      .map((i) => (i.variantId === id ? { ...i, quantity } : i))
      .filter((i) => i.quantity > 0);
    writeActiveCart(next);
  }
  function done(order: OrderCheckout) {
    // Remove only the submitted quantities, preserving any kit added in another tab.
    const submitted = new Map<string, number>(
      submittedItems.current.map((i) => [i.variantId, i.quantity]),
    );
    const current = readActiveCart();
    const remaining = current
      .map((i) => ({
        ...i,
        quantity: Math.max(
          0,
          i.quantity - (submitted.get(i.variantId) ?? 0),
        ),
      }))
      .filter((i) => i.quantity > 0);
    writeActiveCart(remaining);
    setComplete(order);
    setHold(null);
  }
  async function checkout(form: HTMLFormElement) {
    if (lock.current) return;
    if (!user) {
      setError("Please sign in to complete your checkout.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const f = new FormData(form);
      if (!hold) submittedItems.current = items.map((i) => ({ ...i }));
      const order =
        hold ||
        ((await create.mutateAsync({
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
        })) as unknown as OrderCheckout);
      setHold(order);
      if (!modes.data?.gateway) {
        await confirm.mutateAsync({
          area: "order",
          id: order.id,
          input: { action: "confirm", method: "LOCAL" },
        });
        done(order);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Checkout failed. Please try again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <div className="shop-checkout-shell">
      <CheckoutArt side="left" />
      <CheckoutArt side="right" />
      <section className="shop-light checkout-sheet">
        <Link className="shop-text-link" href="/shop">
          ← Continue shopping
        </Link>
        <div className="checkout-heading">
          <h1>Checkout</h1>
          <span>
            <ShieldCheck size={16} /> Secure checkout
          </span>
        </div>
        {complete ? (
          <div className="checkout-success" role="status">
            <Check size={44} />
            <h2>Your kit is on its way.</h2>
            <p>
              {delivery
                ? "Your delivery order is confirmed."
                : "Your order is confirmed for club pickup."}
            </p>
            <p>Order total: {money(complete.totalPaise)}</p>
            <Button asChild>
              <Link href={`/account/receipts/${complete.invoiceId}`}>
                View receipt
              </Link>
            </Button>
            <Link href="/account">View your orders</Link>
          </div>
        ) : (
          <>
            {query.isPending && (
              <p role="status" className="py-8">
                Loading your kit…
              </p>
            )}
            {(query.error || modes.error || error) && (
              <div role="alert" className="field-error my-5">
                <span>{error || query.error?.message || modes.error?.message}</span>
                {(error || "").toLowerCase().includes("sign in") && (
                  <Link href="/login" className="ml-2 font-semibold underline text-orange-400">
                    Sign in
                  </Link>
                )}
              </div>
            )}
            {!items.length ? (
              <div className="checkout-empty">
                <ShoppingCart size={40} />
                <h2>Your next game starts here.</h2>
                <p>Your cart is empty. Find the essentials for your sport.</p>
                <Button asChild>
                  <Link href="/shop">Explore the shop</Link>
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkout(e.currentTarget);
                }}
                className="checkout-columns"
              >
                <div>
                  <h2>
                    Your kit{" "}
                    <span>
                      ({items.reduce((n, i) => n + i.quantity, 0)} items)
                    </span>
                  </h2>
                  <fieldset
                    disabled={busy || !!hold}
                    className="checkout-items"
                  >
                    {rows.map((r) => (
                      <article key={r.variantId} className="checkout-item">
                        <div className="checkout-item-photo">
                          {r.product && (
                            <Image
                              src={r.product.image}
                              alt={r.product.name}
                              fill
                              sizes="100px"
                              className="object-contain"
                            />
                          )}
                        </div>
                        <div>
                          <h3>
                            {r.product?.name ||
                              (query.isPending
                                ? "Loading item…"
                                : "Product unavailable")}
                          </h3>
                          <p>{r.variant?.label}</p>
                          <strong>
                            {r.variant
                              ? money(r.variant.pricePaise * r.quantity)
                              : "—"}
                          </strong>
                          <div className="checkout-item-controls">
                            <label>
                              Quantity
                              <Input
                                type="number"
                                min={1}
                                max={Math.min(20, r.variant?.available || 20)}
                                value={r.quantity}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  if (Number.isInteger(n) && n >= 1 && n <= 20)
                                    change(r.variantId, n);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => change(r.variantId, 0)}
                            >
                              Remove
                            </button>
                          </div>
                          {r.variant &&
                            r.variant.available < r.quantity &&
                            !hold && (
                              <p className="field-error">
                                Only {r.variant.available} available. Update
                                your quantity.
                              </p>
                            )}
                        </div>
                      </article>
                    ))}
                  </fieldset>
                  <fieldset
                    disabled={busy || !!hold}
                    className="checkout-fulfilment"
                  >
                    <legend>How would you like your kit?</legend>
                    <div className="checkout-delivery-options">
                      <label className={!delivery ? "selected" : ""}>
                        <input
                          type="radio"
                          name="fulfilment"
                          checked={!delivery}
                          onChange={() => setDelivery(false)}
                        />
                        <Package size={22} />
                        <span>
                          Club pickup
                          <small>Collect at Champions Club · free</small>
                        </span>
                      </label>
                      <label className={delivery ? "selected" : ""}>
                        <input
                          type="radio"
                          name="fulfilment"
                          checked={delivery}
                          onChange={() => setDelivery(true)}
                        />
                        <Truck size={22} />
                        <span>
                          Home delivery
                          <small>
                            {money(query.data?.settings.deliveryFeePaise || 0)}
                          </small>
                        </span>
                      </label>
                    </div>
                    {delivery && (
                      <div className="checkout-address">
                        {[
                          ["line", "Street address"],
                          ["city", "City"],
                          ["postcode", "Six-digit postcode"],
                          ["phone", "Delivery phone"],
                        ].map(([name, label]) => (
                          <label key={name}>
                            {label}
                            <Input
                              name={name}
                              required
                              minLength={name === "line" ? 8 : 2}
                              maxLength={
                                name === "line"
                                  ? 200
                                  : name === "city"
                                    ? 80
                                    : name === "postcode"
                                      ? 6
                                      : 16
                              }
                              pattern={
                                name === "postcode"
                                  ? "[0-9]{6}"
                                  : name === "phone"
                                    ? "[+]?[0-9 -]{10,16}"
                                    : undefined
                              }
                              autoComplete={
                                name === "line"
                                  ? "street-address"
                                  : name === "city"
                                    ? "address-level2"
                                    : name === "postcode"
                                      ? "postal-code"
                                      : "tel"
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>
                <aside className="checkout-summary">
                  <h2>Order summary</h2>
                  <dl>
                    <div>
                      <dt>Items</dt>
                      <dd>{money(subtotal)}</dd>
                    </div>
                    <div>
                      <dt>{delivery ? "Delivery" : "Club pickup"}</dt>
                      <dd>{fee ? money(fee) : "Free"}</dd>
                    </div>
                    <div className="checkout-total">
                      <dt>
                        {hold ? "Final total" : "Total before member savings"}
                      </dt>
                      <dd>{money(hold?.totalPaise ?? subtotal + fee)}</dd>
                    </div>
                  </dl>
                  <p className="checkout-benefits">
                    Your membership savings apply automatically. Final pricing
                    is calculated securely at checkout.
                  </p>
                  {modes.data?.local && !modes.data.gateway && (
                    <p className="checkout-payment-note">
                      Local test payment. No money is charged.
                    </p>
                  )}
                  {!user ? (
                    <div className="space-y-3">
                      <Button asChild className="w-full">
                        <Link href="/login">Sign in to checkout</Link>
                      </Button>
                      <p className="text-center text-xs text-neutral-400">
                        Your cart items are saved.{" "}
                        <Link href="/login" className="text-orange-400 underline">
                          Sign in
                        </Link>{" "}
                        or{" "}
                        <Link href="/signup" className="text-orange-400 underline">
                          join the club
                        </Link>{" "}
                        to complete your order.
                      </p>
                    </div>
                  ) : hold && modes.data?.gateway ? (
                    <div className="checkout-payment">
                      <p>
                        Ready to pay {money(hold.totalPaise)} including your
                        benefits.
                      </p>
                      <GatewayCheckout
                        input={{ kind: "order", targetId: hold.id }}
                        autoStart
                        onPendingChange={setGatewayPending}
                        onDone={() => done(hold)}
                      />
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={
                        busy ||
                        query.isPending ||
                        !!query.error ||
                        modes.isPending ||
                        !!modes.error ||
                        (!hold && unavailable) ||
                        (!modes.data?.local && !modes.data?.gateway)
                      }
                    >
                      {busy ? "Processing checkout…" : "Checkout"}
                    </Button>
                  )}
                  {!modes.isPending &&
                    !modes.error &&
                    !modes.data?.local &&
                    !modes.data?.gateway && (
                      <p role="status" className="mt-3 text-sm">
                        Online payments are unavailable. Contact reception.
                      </p>
                    )}
                  {hold && (
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={busy || gatewayPending || cancel.isPending}
                      className="mt-3 w-full"
                      onClick={async () => {
                        try {
                          await cancel.mutateAsync({
                            area: "order",
                            id: hold.id,
                            input: {
                              action: "cancel",
                              reason: "Customer edited checkout",
                            },
                          });
                          setHold(null);
                          setError("");
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Unable to edit checkout.",
                          );
                        }
                      }}
                    >
                      Edit order
                    </Button>
                  )}
                  <div className="checkout-reassurance">
                    <ShieldCheck size={17} />
                    <span>Orders and receipts saved to your account.</span>
                  </div>
                  <Link className="shop-text-link text-xs" href="/account">
                    Order history & receipts
                  </Link>
                </aside>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
