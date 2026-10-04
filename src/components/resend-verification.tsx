"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/** Sends a fresh verification link. Used on the sign-up confirmation, failed sign-in and expired-link screens. */
export function ResendVerification({ email: initial = "", showEmailField = false }: { email?: string; showEmailField?: boolean }) {
  const [email, setEmail] = useState(initial);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  async function resend() {
    setState("sending");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/email-verified" });
      if (result.error) throw new Error(result.error.message || "Unable to send the email.");
      setState("sent");
      setMessage(`A new link is on its way to ${email}. It can take a minute; check your spam folder too.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to send the email. Please try again shortly.");
    }
  }
  return (
    <div className="space-y-3">
      {showEmailField && (
        <div>
          <label htmlFor="resend-email">Email address</label>
          <Input id="resend-email" type="email" autoComplete="email" required className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      )}
      <Button type="button" variant="outline" disabled={!email || state === "sending" || state === "sent"} onClick={resend}>
        {state === "sending" ? "Sending…" : state === "sent" ? "Link sent" : "Resend verification email"}
      </Button>
      {state === "sent" && <p role="status" className="text-sm text-emerald-400">{message}</p>}
      {state === "error" && <p role="alert" className="field-error">{message}</p>}
    </div>
  );
}
