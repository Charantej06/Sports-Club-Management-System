"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAction, Feedback, PaymentMethod } from "./operations-ui";
import { GatewayCheckout, usePaymentModes } from "./gateway-checkout";
export function Settlement({
  id,
  outstanding,
  staff,
}: {
  id: string;
  outstanding: number;
  staff: boolean;
}) {
  const action = useAction(),
    router = useRouter();
  const [method, setMethod] = useState("LOCAL");
  const modes = usePaymentModes();
  return (
    <form
      className="no-print mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          amount = String(f.get("amount"));
        action.mutate(
          {
            area: "payment",
            id,
            input: {
              method,
              ...(amount
                ? { amountPaise: Math.round(Number(amount) * 100) }
                : {}),
            },
          },
          { onSuccess: () => router.refresh() },
        );
      }}
    >
      <h2 className="font-semibold">Settle this invoice</h2>
      {!staff && modes.data?.gateway && (
        <GatewayCheckout
          input={{ kind: "invoice", targetId: id }}
          onDone={() => router.refresh()}
        />
      )}
      <PaymentMethod value={method} onChange={setMethod} staff={staff} />
      <label className="block">
        Amount ₹ (blank = full outstanding)
        <Input
          className="mt-2"
          name="amount"
          type="number"
          step="0.01"
          min={0.01}
          max={outstanding / 100}
        />
      </label>
      <p className="text-xs">
        Local test payments collect no funds. Staff-recorded cash/card/UPI
        payments require an actual payment at the club.
      </p>
      <Button disabled={action.isPending || (!staff && !modes.data?.local)}>
        {action.isPending ? "Processing…" : "Record settlement"}
      </Button>
      <Feedback action={action} />
    </form>
  );
}
