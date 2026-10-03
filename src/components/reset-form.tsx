"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function ResetForm({ token }: { token?: string }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!token) return <p role="alert" className="text-sm text-neutral-400">This link is invalid or expired. <Link className="text-orange-400" href="/forgot-password">Request a new link.</Link></p>;
  if (done) return <p role="status">Password updated. <Link className="text-orange-400" href="/login">Sign in with your new password.</Link></p>;
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirm")) { setError("Passwords must match."); setBusy(false); return; }
    try { const result = await authClient.resetPassword({ token, newPassword: password }); if (result.error) setError(result.error.message || "Unable to reset password."); else setDone(true); }
    catch { setError("Please try again."); } finally { setBusy(false); }
  }}><div><label htmlFor="new-password">New password</label><Input id="new-password" name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="mt-2"/></div><div><label htmlFor="confirm-password">Confirm password</label><Input id="confirm-password" name="confirm" type="password" required autoComplete="new-password" className="mt-2"/></div>{error && <p className="field-error" role="alert">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? "Updating…" : "Set new password"}</Button></form>;
}
