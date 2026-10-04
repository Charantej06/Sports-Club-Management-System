"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, X } from "lucide-react";
import { PlanCard, TermPicker, type PlanView } from "./plan-card";
import { TERM_LABELS, addMonths, termPrice, type TermMonths } from "@/modules/membership/terms";
import { Button } from "./ui/button";
import { api } from "@/lib/api-client";
import { money, date } from "@/lib/utils";
import { GatewayCheckout, TestModeHint, usePaymentModes } from "./gateway-checkout";
import { activeTerm, type MeData } from "@/modules/account/types";
export function MembershipOptions({
  plans,
  signedIn,
  localMode,
}: {
  plans: PlanView[];
  signedIn: boolean;
  localMode: boolean;
}) {
  const router = useRouter();
  const modes = usePaymentModes();
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeData>("/api/me"),
    enabled: signedIn,
  });
  // Keep only the plan id so a refresh after a price change swaps in the new price and version.
  const [planId, setPlanId] = useState<string | null>(null);
  const plan = plans.find((p) => p.id === planId) ?? null;
  const [priceUpdated, setPriceUpdated] = useState(false);
  const [months, setMonths] = useState<TermMonths>(3);
  const [accepted, setAccepted] = useState(false);
  const [key, setKey] = useState("");
  const current = me.data && activeTerm(me.data.memberships);
  const latest = me.data?.memberships
    .filter((t) => t.status === "ACTIVE" && new Date(t.endsAt) > new Date())
    .sort((a, b) => +new Date(b.endsAt) - +new Date(a.endsAt))[0];
  // A second membership continues after the current one ends. Switching immediately is a separate, explicit choice.
  const [switchNow, setSwitchNow] = useState(false);
  const differsFromCurrent = !!current && !!plan && plan.id !== current.planId;
  const action = differsFromCurrent && switchNow
    ? "change"
    : latest || me.data?.memberships.length
      ? "renew"
      : "purchase";
  const price = plan ? termPrice(plan, months) : null;
  const startsAt = action !== "change" && latest ? new Date(latest.endsAt) : new Date();
  const mutation = useMutation({
    mutationFn: () =>
      api<{ invoiceId: string }>("/api/me/membership", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({
          planId: plan?.id,
          months,
          action,
          acceptPolicy: true,
          planVersion: plan?.planVersion,
        }),
      }),
    onError: (error) => {
      // The owner changed the plan while this page was open: fetch the new price rather than failing the customer.
      if (/plan has changed|PLAN_CHANGED/i.test(error.message)) {
        setPriceUpdated(true);
        setAccepted(false);
        setKey(crypto.randomUUID());
        router.refresh();
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
      await client.invalidateQueries({ queryKey: ["card"] });
      setPlanId(null);
      router.push("/account?membership=success");
      router.refresh();
    },
  });
  return (
    <>
      <div className="mb-8 flex flex-col items-start gap-3">
        <p className="text-sm text-neutral-300" id="term-label">How long would you like to join for?</p>
        <TermPicker plans={plans} value={months} onChange={setMonths} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} months={months}>
            {!signedIn ? (
              <Button asChild variant={p.id === "gold" ? "default" : "outline"}>
                <Link href="/login">
                  Choose {p.name}
                  <ArrowUpRight size={16} />
                </Link>
              </Button>
            ) : (
              <Button
                variant={p.id === "gold" ? "default" : "outline"}
                disabled={me.isPending || (!localMode && !modes.data?.gateway)}
                onClick={() => {
                  mutation.reset();
                  setAccepted(false);
                  setKey(crypto.randomUUID());
                  setPlanId(p.id);
                  setPriceUpdated(false);
                  setSwitchNow(false);
                }}
              >
                {current?.planId === p.id
                  ? "Renew "
                  : current
                    ? "Add next: "
                    : "Choose "}
                {p.name}
                <ArrowUpRight size={16} />
              </Button>
            )}
          </PlanCard>
        ))}
      </div>
      {me.error && (
        <p role="alert" className="field-error mt-5">
          {me.error.message}
        </p>
      )}
      <Dialog.Root
        open={!!plan}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPlanId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-white/15 bg-[#141414] p-7 text-white md:p-9">
            <Dialog.Title className="text-3xl font-medium tracking-tight">
              {action === "renew"
                ? current && plan?.id !== current.planId
                  ? "Your next membership."
                  : "Keep the good games going."
                : action === "change"
                  ? "A new way to play."
                  : "Welcome to your club."}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-neutral-400">
              {action === "renew" && latest
                ? `Starts ${date(latest.endsAt)}, right after your current membership ends. Nothing you've paid for is lost.`
                : `Review your ${plan?.name} membership before confirming.`}
            </Dialog.Description>
            <Dialog.Close
              disabled={mutation.isPending}
              aria-label="Close checkout"
              className="absolute right-4 top-4 p-1"
            >
              <X size={19} />
            </Dialog.Close>
            <div className="mt-6">
              <TermPicker plans={plan ? [plan] : plans} value={months} onChange={setMonths} />
            </div>
            {differsFromCurrent && (
              <fieldset className="mt-6 space-y-3 text-sm">
                <legend className="mb-2 text-xs uppercase tracking-wider text-neutral-400">When should {plan?.name} start?</legend>
                {[
                  [false, `After my ${current?.planSnapshot.name} membership ends`, latest ? date(latest.endsAt) : ""],
                  [true, "Switch right now", "replaces the time left, no refund"],
                ].map(([value, label, hint]) => (
                  <label key={String(value)} className="flex cursor-pointer items-start gap-3 rounded border border-white/10 p-3">
                    <input type="radio" name="when" className="mt-1 accent-orange-500" checked={switchNow === value} onChange={() => { setSwitchNow(value as boolean); setAccepted(false); }} />
                    <span>{label as string}<span className="block text-xs text-neutral-400">{hint as string}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="my-7 space-y-4 rounded border border-white/10 p-5 text-sm">
              <div className="flex justify-between">
                <span>{plan?.name} membership</span>
                <strong>{price && money(price.grossPaise)}</strong>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Term</span>
                <span>{TERM_LABELS[months]}</span>
              </div>
              {price && price.discountPaise > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>{months === 12 ? "Annual" : "3-month"} discount</span>
                  <span>−{money(price.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-400">
                <span>Starts</span>
                <span>{date(startsAt)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Valid until</span>
                <span>{date(addMonths(startsAt, months))}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-4">
                <span>Total · INR</span>
                <strong>{price && money(price.totalPaise)}</strong>
              </div>
            </div>
            <p className="notice">
              {localMode
                ? "Local payment mode. This checkout records a simulated payment and issues a test receipt. No money is collected."
                : "Secure payment is confirmed only after server verification of provider capture."}
            </p>
            {plan?.juniorOnly && (
              <p className="mt-4 text-xs text-neutral-400">
                Junior players must be under 18 at the start of the term. Add
                your date of birth in{" "}
                <Link className="text-orange-400" href="/account">
                  My Account
                </Link>
                .
              </p>
            )}
            <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-neutral-300">
              <input
                className="mt-1 size-4 shrink-0 accent-orange-500"
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                {action === "change"
                  ? "I understand this change starts immediately, replaces remaining and scheduled terms, and has no prorated refund."
                  : "I agree to the membership policy. A new membership starts when my current one ends; paid memberships are non-refundable except for a club cancellation."}
              </span>
            </label>
            {priceUpdated ? (
              <p role="status" className="notice mt-4">
                This plan&apos;s price was just updated. We&apos;ve refreshed it: please review the new total above and confirm again.
              </p>
            ) : (
              mutation.error && (
                <p role="alert" className="field-error mt-4">
                  {mutation.error.message}
                </p>
              )
            )}
            {!localMode && modes.data?.gateway ? (
              <div className="mt-6 space-y-3">
                <TestModeHint />
                {accepted && (
                  <GatewayCheckout
                    description={`${plan?.name} membership · ${TERM_LABELS[months]}`}
                    input={{
                      kind: "membership",
                      input: {
                        planId: plan?.id,
                        months,
                        action,
                        acceptPolicy: true,
                        planVersion: plan?.planVersion,
                      },
                    }}
                    onDone={() => {
                      setPlanId(null);
                      router.push("/account?membership=success");
                      router.refresh();
                    }}
                  />
                )}
              </div>
            ) : (
              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={!accepted || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Confirming…" : `Pay ${price ? money(price.totalPaise) : ""}`}
                <ArrowUpRight size={16} />
              </Button>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
