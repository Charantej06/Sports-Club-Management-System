"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAction } from "./operations-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Registered = { id: string; name: string; championsId: string; created: boolean };

/** Sign up someone standing at the front desk; their account is selected for the membership form below. */
export function MemberRegistration({ onRegistered }: { onRegistered: (member: { id: string; name: string; championsId: string }) => void }) {
  const action = useAction();
  const [done, setDone] = useState<Registered | null>(null);
  return (
    <div className="surface">
      <h3 className="flex items-center gap-2 font-semibold"><UserPlus size={18} aria-hidden="true" />Register a new member</h3>
      <p className="mt-2 text-xs text-slate-500">For someone at the desk without an account. They get their Champions ID now and an email to set their own password. Then choose their plan under &quot;Process membership&quot;.</p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const f = new FormData(form);
          const phone = String(f.get("phone") || "").trim();
          const dateOfBirth = String(f.get("dob") || "");
          action.mutate(
            { area: "member", input: { name: String(f.get("name")), email: String(f.get("email")), ...(phone ? { phone } : {}), ...(dateOfBirth ? { dateOfBirth } : {}) } },
            {
              onSuccess: (result) => {
                const member = result as unknown as Registered;
                setDone(member);
                onRegistered({ id: member.id, name: member.name, championsId: member.championsId });
                form.reset();
              },
            },
          );
        }}
      >
        <label className="block text-xs">Full name<Input className="mt-2" name="name" required minLength={2} maxLength={80} autoComplete="off" /></label>
        <label className="block text-xs">Email<Input className="mt-2" name="email" type="email" required autoComplete="off" /></label>
        <label className="block text-xs">Phone (optional)<Input className="mt-2" name="phone" minLength={7} maxLength={25} autoComplete="off" /></label>
        <label className="block text-xs">Date of birth (needed for Junior)<Input className="mt-2" name="dob" type="date" max={new Date().toISOString().slice(0, 10)} /></label>
        <div className="sm:col-span-2">
          <Button disabled={action.isPending}>{action.isPending ? "Registering…" : "Register member"}</Button>
        </div>
      </form>
      {action.error && <p role="alert" className="field-error mt-3">{action.error.message}</p>}
      {done && (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {done.created ? "Registered" : "This email already has an account"}: <strong>{done.name}</strong> · {done.championsId}. They are selected below; process their membership next.
        </p>
      )}
    </div>
  );
}
