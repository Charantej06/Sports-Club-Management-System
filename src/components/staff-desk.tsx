"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Reception,
  CRM,
  Inventory,
  POS,
  Kitchen,
  Financial,
  MemberFinder,
} from "./staff-operations";
import {
  Settings,
  ScanLine,
  Users,
  Mail,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import type { ClubSettings, MembershipPlan } from "@/generated/prisma/client";
import { api } from "@/lib/api-client";
import { money, date } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  OwnerReports,
  CashWorkspace,
  PeopleWorkspace,
  BusinessDocuments,
  DeliveryWorkspace,
  AuditWorkspace,
} from "./owner-workspaces";
import { DraftScope } from "./safe-drafts";
type LeadView = {
  id: string;
  name: string;
  sport: string | null;
  message: string;
  email: string;
  createdAt: string;
};
export function StaffDesk({
  name,
  role,
  userId,
  plans,
}: {
  name: string;
  role: string;
  userId: string;
  leads: LeadView[];
  notifications: number;
  activeMembers: number;
  plans: MembershipPlan[];
}) {
  const [tab, setTab] = useState("today");
  const owner = role === "OWNER";
  const lookupAllowed = ["OWNER", "RECEPTION", "CASHIER"].includes(role);
  const tabs = [
    ...(owner
      ? [
          { id: "reports", name: "Owner reports", icon: ClipboardList },
          { id: "documents", name: "Business documents", icon: ClipboardList },
          { id: "delivery", name: "Reminders & delivery", icon: Mail },
        ]
      : []),
    {
      id: "audit",
      name: owner ? "Audit history" : "My audit history",
      icon: ClipboardList,
    },
    ...(lookupAllowed
      ? [{ id: "cash", name: "Cash reconciliation", icon: ClipboardList }]
      : []),
    {
      id: "people",
      name: owner ? "People & payroll" : "My employment",
      icon: Users,
    },
    ...(["OWNER", "RECEPTION"].includes(role)
      ? [
          { id: "reception", name: "Reception calendar", icon: ClipboardList },
          { id: "crm", name: "Enquiries & CRM", icon: Users },
        ]
      : []),
    ...(["OWNER", "CASHIER"].includes(role)
      ? [
          { id: "inventory", name: "Shop & inventory", icon: ClipboardList },
          { id: "pos", name: "Waiter / POS", icon: ClipboardList },
        ]
      : []),
    ...(["OWNER", "KITCHEN"].includes(role)
      ? [{ id: "kitchen", name: "Kitchen queue", icon: ClipboardList }]
      : []),
    ...(lookupAllowed
      ? [{ id: "billing", name: "Billing & refunds", icon: ClipboardList }]
      : []),
    { id: "today", name: "Club desk", icon: ClipboardList },
    ...(lookupAllowed
      ? [{ id: "lookup", name: "Member lookup", icon: ScanLine }]
      : []),
    ...(owner
      ? [
          { id: "settings", name: "Business settings", icon: Settings },
          { id: "plans", name: "Membership plans", icon: Users },
          { id: "users", name: "Staff access", icon: Users },
          { id: "inbox", name: "Local test inbox", icon: Mail },
        ]
      : []),
  ];
  return (
    <DraftScope userId={userId}>
      <div className="staff-theme min-h-[80vh]">
        <div className="site-width py-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Champions operations
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Hello, {name.split(" ")[0]}.
              </h1>
            </div>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-800">
              {role === "CASHIER"
                ? "Waiter / Cashier"
                : role[0] + role.slice(1).toLowerCase()}{" "}
              workspace
            </span>
          </div>
          <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
            <nav
              className="flex content-start gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
              aria-label="Staff navigation"
            >
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm lg:whitespace-normal ${tab === item.id ? "bg-[#26303d] text-white" : "text-slate-600 hover:bg-white"}`}
                >
                  <item.icon size={17} />
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="min-w-0">
              {tab === "today" && (
                <>
                  <OperationalHome role={role} onNavigate={setTab} />
                  <div className="surface mt-6">
                    <h2 className="text-lg font-semibold">
                      Your operational workspace
                    </h2>
                    <p className="mt-3 text-sm text-slate-500">
                      Use the live workspaces to manage arrivals, enquiries,
                      collections, tables and preparation. Records refresh every
                      five seconds.
                    </p>
                  </div>
                  {owner ? (
                    <OwnerReports />
                  ) : role === "KITCHEN" ? (
                    <Kitchen />
                  ) : role === "CASHIER" ? (
                    <POS />
                  ) : (
                    <Reception plans={plans} />
                  )}
                </>
              )}
              {tab === "reception" && <Reception plans={plans} />}{" "}
              {tab === "crm" && <CRM />} {tab === "inventory" && <Inventory />}{" "}
              {tab === "pos" && <POS />} {tab === "kitchen" && <Kitchen />}{" "}
              {tab === "billing" && <Financial />}
              {tab === "lookup" && <LookupForm />}
              {tab === "settings" && <SettingsForm />}
              {tab === "plans" && <PlansEditor plans={plans} />}{" "}
              {tab === "users" && <StaffAccess />}
              {tab === "inbox" && <LocalInbox />}
              {tab === "reports" && <OwnerReports />}
              {tab === "cash" && <CashWorkspace />}
              {tab === "people" && <PeopleWorkspace owner={owner} />}
              {tab === "documents" && <BusinessDocuments />}
              {tab === "delivery" && <DeliveryWorkspace />}
              {tab === "audit" && <AuditWorkspace />}
            </div>
          </div>
        </div>
      </div>
    </DraftScope>
  );
}
function OperationalHome({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate: (tab: string) => void;
}) {
  const query = useQuery({
    queryKey: ["staff-home", role],
    queryFn: () =>
      api<{ label: string; count: number; tab: string }[]>("/api/staff/home"),
    refetchInterval: 5000,
  });
  return (
    <div className="mb-5">
      <h2 className="mb-4 text-lg font-semibold">Today's actions</h2>
      {query.isPending && <p role="status">Loading actions…</p>}
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {query.data?.map((c) => (
          <button
            key={c.label}
            onClick={() => onNavigate(c.tab)}
            className="surface text-left hover:border-orange-300"
          >
            <span className="block text-xs text-slate-600">{c.label}</span>
            <strong className="mt-3 block text-2xl">{c.count}</strong>
            <span className="mt-3 block text-xs text-orange-800">
              Open workspace →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
function LookupForm() {
  return (
    <div className="surface">
      <h2 className="text-xl font-semibold mb-5">Identify a member</h2>
      <MemberFinder />
    </div>
  );
}
function SettingsForm() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<ClubSettings>("/api/staff/settings"),
  });
  if (query.isPending) return <p role="status">Loading settings…</p>;
  if (query.error || !query.data)
    return <p role="alert">{query.error?.message}</p>;
  return <SettingsFields settings={query.data} />;
}
function SettingsFields({ settings }: { settings: ClubSettings }) {
  const router = useRouter();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/staff/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      router.refresh();
      return client.invalidateQueries();
    },
  });
  const fields = [
    ["openHour", "Opening hour (0–22)", 0, 22],
    ["closeHour", "Closing hour (1–24)", 1, 24],
    ["bookingWindowDays", "Booking window · days", 1, 90],
    ["dailySessionLimit", "Sessions per member per day", 1, 10],
    ["holdMinutes", "Checkout hold · minutes", 1, 30],
    ["cancellationHours", "Cancellation notice · hours", 0, 72],
    ["waitOfferMinutes", "Waiting-list offer · minutes", 5, 240],
    ["socialCapacity", "Social event capacity", 2, 50],
    ["tabLimitPaise", "Member tab limit · paise", 0, 100000000],
    ["trialDiscountBps", "Trial discount · basis points", 0, 10000],
    ["socialPricePaise", "Social guest price · paise", 0, 1000000],
    ["deliveryFeePaise", "Delivery fee · paise", 0, 1000000],
    ["tabDueDays", "Member tab due · days", 1, 90],
    ["reminderHour", "Reminder hour · Asia/Kolkata (0–23)", 0, 23],
    ["payrollTaxBps", "Payroll withholding · basis points", 0, 10000],
  ] as const;
  return (
    <form
      className="surface space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const input: Record<string, unknown> = {};
        for (const [key] of fields) input[key] = Number(data.get(key));
        for (const key of [
          "address",
          "contactEmail",
          "contactPhone",
          "payrollTaxLabel",
        ])
          input[key] = String(data.get(key));
        input.reminderDays = String(data.get("reminderDays"))
          .split(",")
          .map((s) => Number(s.trim()));
        mutation.mutate(input);
      }}
    >
      <div>
        <h2 className="text-xl font-semibold">Business settings</h2>
        <p className="mt-3 text-sm text-slate-500">
          Club timezone: Asia/Kolkata. Operational modules read these saved
          policies.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map(([key, label, min, max]) => (
          <div key={key}>
            <label htmlFor={`setting-${key}`}>{label}</label>
            <Input
              className="mt-2"
              id={`setting-${key}`}
              name={key}
              type="number"
              min={min}
              max={max}
              step={1}
              required
              defaultValue={settings[key]}
            />
          </div>
        ))}
        <div>
          <label htmlFor="tax-label">Payroll withholding label</label>
          <Input
            id="tax-label"
            name="payrollTaxLabel"
            required
            minLength={2}
            maxLength={100}
            defaultValue={settings.payrollTaxLabel}
          />
        </div>
        <div>
          <label htmlFor="reminders">Reminder days before expiry</label>
          <Input
            id="reminders"
            name="reminderDays"
            className="mt-2"
            defaultValue={settings.reminderDays.join(",")}
            required
            pattern="[0-9, ]+"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="address">Club address</label>
          <Input
            id="address"
            name="address"
            className="mt-2"
            required
            minLength={5}
            maxLength={200}
            defaultValue={settings.address}
          />
        </div>
        <div>
          <label htmlFor="contact-email">Contact email</label>
          <Input
            id="contact-email"
            name="contactEmail"
            type="email"
            className="mt-2"
            required
            defaultValue={settings.contactEmail}
          />
        </div>
        <div>
          <label htmlFor="contact-phone">Contact phone</label>
          <Input
            id="contact-phone"
            name="contactPhone"
            className="mt-2"
            minLength={7}
            maxLength={25}
            required
            defaultValue={settings.contactPhone}
          />
        </div>
      </div>
      {mutation.error && (
        <p className="field-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          Business settings saved.
        </p>
      )}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
function PlansEditor({ plans }: { plans: MembershipPlan[] }) {
  return (
    <div className="space-y-5">
      <div className="surface">
        <h2 className="text-xl font-semibold">Membership plans</h2>
        <p className="mt-3 text-sm text-slate-500">
          These values apply to new purchases. Existing terms and receipts
          retain their saved benefits and prices.
        </p>
      </div>
      {plans.map((p) => (
        <PlanFields key={p.id} plan={p} />
      ))}
    </div>
  );
}
function PlanFields({ plan }: { plan: MembershipPlan }) {
  const router = useRouter();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<MembershipPlan>("/api/staff/plans", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      router.refresh();
      return client.invalidateQueries();
    },
  });
  const fields = [
    ["pricePaise", "Price · paise", 100, 100000000],
    ["durationDays", "Term · days", 1, 730],
    ["courtDiscountBps", "Court discount · basis points", 0, 10000],
    ["shopDiscountBps", "Shop discount · basis points", 0, 10000],
    ["foodDiscountBps", "Clubhouse discount · basis points", 0, 10000],
    ["freeSessionsWeek", "Free sessions per week", 0, 14],
  ] as const;
  return (
    <form
      className="surface"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const input: Record<string, unknown> = {
          id: plan.id,
          active: data.get("active") === "on",
        };
        for (const [key] of fields) input[key] = Number(data.get(key));
        mutation.mutate(input);
      }}
    >
      <div className="mb-6 flex justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <span className="text-sm text-slate-500">
          {money(mutation.data?.pricePaise ?? plan.pricePaise)} ·{" "}
          {plan.juniorOnly ? "Under 18" : "All players"}
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([key, label, min, max]) => (
          <div key={key}>
            <label htmlFor={`${plan.id}-${key}`}>{label}</label>
            <Input
              id={`${plan.id}-${key}`}
              name={key}
              className="mt-2"
              type="number"
              min={min}
              max={max}
              step={1}
              required
              defaultValue={plan[key]}
            />
          </div>
        ))}
      </div>
      <label className="mt-6 flex items-center gap-3">
        <input
          type="checkbox"
          name="active"
          defaultChecked={plan.active}
          className="size-4 accent-orange-600"
        />
        Available to purchase
      </label>
      <p className="mt-4 text-xs text-slate-400">
        100 basis points = 1%. Save 1500 for a 15% discount.
      </p>
      {mutation.error && (
        <p className="field-error mt-4" role="alert">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          Plan saved. Historical purchases preserved.
        </p>
      )}
      <Button className="mt-5" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : `Save ${plan.name}`}
      </Button>
    </form>
  );
}
function StaffAccess() {
  const mutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api<{ name: string; role: string }>("/api/staff/users", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  });
  return (
    <form
      className="surface max-w-2xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        mutation.mutate({
          email: String(data.get("email")),
          role: String(data.get("role")),
        });
      }}
    >
      <div>
        <h2 className="text-xl font-semibold">Owner-controlled access</h2>
        <p className="mt-3 text-sm text-slate-500">
          Ask the employee to create an account first. Assign their role here.
          Existing sessions are revoked when access changes.
        </p>
      </div>
      <div>
        <label htmlFor="staff-email">Account email</label>
        <Input
          id="staff-email"
          name="email"
          type="email"
          required
          className="mt-2"
        />
      </div>
      <div>
        <label htmlFor="staff-role">Role</label>
        <select id="staff-role" name="role" className="mt-2">
          {[
            ["MEMBER", "Member"],
            ["RECEPTION", "Reception"],
            ["CASHIER", "Waiter / Cashier"],
            ["KITCHEN", "Kitchen"],
            ["OWNER", "Owner"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {mutation.error && (
        <p className="field-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      {mutation.data && (
        <p role="status" className="text-sm text-emerald-700">
          {mutation.data.name} now has {mutation.data.role.toLowerCase()}{" "}
          access.
        </p>
      )}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Updating…" : "Assign role"}
      </Button>
    </form>
  );
}
function LocalInbox() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["inbox"],
    queryFn: () =>
      api<
        {
          id: string;
          to: string;
          subject: string;
          body: string;
          status: string;
          createdAt: string;
        }[]
      >("/api/staff/inbox"),
    refetchInterval: 5000,
  });
  return (
    <div className="surface">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Local test inbox</h2>
          <p className="mt-3 text-sm text-slate-500">
            Verification, reset and membership reminder emails stay on this
            machine in local mode.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => client.invalidateQueries({ queryKey: ["inbox"] })}
        >
          Refresh
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="field-error mt-5">
          {query.error.message}
        </p>
      )}
      {query.isPending && (
        <p role="status" className="mt-5">
          Loading messages…
        </p>
      )}
      {query.data?.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No messages yet. Create an account or request a password reset.
        </p>
      )}
      <div className="mt-6 space-y-4">
        {query.data?.map((message) => (
          <article
            key={message.id}
            className="rounded-lg border border-slate-200 p-5"
          >
            <h3 className="text-sm font-semibold">{message.subject}</h3>
            <p className="mt-2 text-xs text-slate-400">
              To {message.to} · {date(message.createdAt)} ·{" "}
              {message.status === "DELIVERED"
                ? "delivered to local inbox"
                : message.status.toLowerCase()}
            </p>
            <p className="mt-4 whitespace-pre-wrap break-all text-xs leading-relaxed text-slate-500">
              {message.body.split(/(https?:\/\/\S+)/).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <a key={i} href={part} className="text-orange-800 underline">
                    Open secure local link{" "}
                    <ArrowUpRight className="inline" size={12} />
                  </a>
                ) : (
                  part
                ),
              )}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
