"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, X } from "lucide-react";
import { PlanCard, type PlanView } from "./plan-card";
import { Button } from "./ui/button";
import { api } from "@/lib/api-client";
import { money, date } from "@/lib/utils";
import { GatewayCheckout, usePaymentModes } from "./gateway-checkout";
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
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [key, setKey] = useState("");
  const current = me.data && activeTerm(me.data.memberships);
  const latest = me.data?.memberships
    .filter((t) => t.status === "ACTIVE" && new Date(t.endsAt) > new Date())
    .sort((a, b) => +new Date(b.endsAt) - +new Date(a.endsAt))[0];
  const action = current
    ? plan?.id === latest?.planId
      ? "renew"
      : "change"
    : latest
      ? "renew"
      : me.data?.memberships.length
        ? "renew"
        : "purchase";
  const mutation = useMutation({
    mutationFn: () =>
      api<{ invoiceId: string }>("/api/me/membership", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({
          planId: plan?.id,
          action,
          acceptPolicy: true,
          planVersion: plan?.planVersion,
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
      await client.invalidateQueries({ queryKey: ["card"] });
      setPlan(null);
      router.push("/account?membership=success");
      router.refresh();
    },
  });
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p}>
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
                  setPlan(p);
                }}
              >
                {current?.planId === p.id
                  ? "Renew "
                  : current
                    ? "Switch to "
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
          if (!open && !mutation.isPending) setPlan(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-white/15 bg-[#141414] p-7 text-white md:p-9">
            <Dialog.Title className="text-3xl font-medium tracking-tight">
              {action === "renew"
                ? "Keep the good games going."
                : action === "change"
                  ? "A new way to play."
                  : "Welcome to your club."}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-neutral-400">
              Review your {plan?.name} membership before confirming.
            </Dialog.Description>
            <Dialog.Close
              disabled={mutation.isPending}
              aria-label="Close checkout"
              className="absolute right-4 top-4 p-1"
            >
              <X size={19} />
            </Dialog.Close>
            <div className="my-7 space-y-4 rounded border border-white/10 p-5 text-sm">
              <div className="flex justify-between">
                <span>{plan?.name} membership</span>
                <strong>{plan && money(plan.pricePaise)}</strong>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Term</span>
                <span>{plan?.durationDays} days</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Starts</span>
                <span>
                  {date(
                    action === "renew" && latest ? latest.endsAt : new Date(),
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-4">
                <span>Total · INR</span>
                <strong>{plan && money(plan.pricePaise)}</strong>
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
                  : "I agree to the membership policy. Renewals extend my term; paid memberships are non-refundable except for a club cancellation."}
              </span>
            </label>
            {mutation.error && (
              <p role="alert" className="field-error mt-4">
                {mutation.error.message}
              </p>
            )}
            {!localMode && modes.data?.gateway ? (
              <div className="mt-6">
                {accepted && (
                  <GatewayCheckout
                    input={{
                      kind: "membership",
                      input: {
                        planId: plan?.id,
                        action,
                        acceptPolicy: true,
                        planVersion: plan?.planVersion,
                      },
                    }}
                    onDone={() => {
                      setPlan(null);
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
                {mutation.isPending ? "Confirming…" : "Confirm local payment"}
                <ArrowUpRight size={16} />
              </Button>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
