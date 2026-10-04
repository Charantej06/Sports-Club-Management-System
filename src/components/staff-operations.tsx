"use client";
import { useEffect, useRef, useState } from "react";
import { useItemDraft } from "./safe-drafts";
import { promptText } from "./prompt-dialog";
import { MemberHistory } from "./member-history";
import { FreeSlots } from "./free-slots";
import { StatusBadge } from "./staff-ui";
import { MemberRegistration } from "./member-registration";
import { useQuery } from "@tanstack/react-query";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { api } from "@/lib/api-client";
import { money } from "@/lib/utils";
import { TERM_LABELS, TERM_MONTHS, termLabel } from "@/modules/membership/terms";
import type {
  Court,
  Reservation,
  CourtClosure,
  MembershipPlan,
  Lead,
  LeadActivity,
  LeadQuote,
  StaffNotification,
  Product,
  ProductVariant,
  ShopOrder,
  ShopOrderLine,
  DiningTable,
  MenuItem,
  KitchenOrder,
  KitchenTicket,
  KitchenLine,
  Invoice,
  InvoiceLine,
  Credit,
  Refund,
  PaymentAllocation,
  Payment,
} from "@/generated/prisma/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  useAction,
  Feedback,
  PaymentMethod,
  ReceiptLink,
  type Json,
} from "./operations-ui";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
type Member = { id: string; name: string; championsId: string };
type Booking = Json<Reservation> & {
  court: { name: string };
  user: Member | null;
};
type Ticket = Json<KitchenTicket> & { lines: Json<KitchenLine>[] };
type Bill = Json<KitchenOrder> & {
  totals: {
    totalPaise: number;
    paidPaise: number;
    creditPaise: number;
    outstandingPaise: number;
  };
  tickets: Ticket[];
  table: { name: string };
  member: Member | null;
};
type Order = Json<ShopOrder> & {
  orderLines: Json<ShopOrderLine>[];
  user: { name: string } | null;
};
type InvoiceView = Json<Invoice> & {
  lines: Json<InvoiceLine>[];
  credits: (Json<Credit> & { refund: Json<Refund> | null })[];
  allocations: (Json<PaymentAllocation> & { payment: Json<Payment> })[];
};
type LeadView = Json<Lead> & {
  activities: Json<LeadActivity>[];
  quotes: Json<LeadQuote>[];
};
function useWorkspace<T>(area: string, query = "") {
  return useQuery({
    queryKey: ["operations", area, query],
    queryFn: () => api<T>(`/api/operations/${area}${query ? "?" + query : ""}`),
    refetchInterval: 5000,
  });
}
async function reason(title = "Add a reason", confirmLabel = "Confirm") {
  return (
    (await promptText({
      title,
      label: "Reason",
      placeholder: "A short explanation for the record",
      minLength: 5,
      confirmLabel,
    })) || undefined
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = true,
  min,
  max,
}: {
  label: string;
  name?: string;
  type?: string;
  value?: string | number;
  onChange?: (v: string) => void;
  required?: boolean;
  min?: string | number;
  max?: string | number;
}) {
  return (
    <label className="block text-xs">
      {label}
      <Input
        className="mt-2"
        name={name}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
        min={min}
        max={max}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}
export function MemberFinder({
  onFound,
}: {
  onFound?: (member: Member) => void;
}) {
  const [query, setQuery] = useState(""),
    [member, setMember] = useState<
      | (Member & {
          membership: { plan: { name: string }; endsAt: string } | null;
        })
      | null
    >(null),
    [error, setError] = useState(""),
    [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null);
  const lookup = async (value: string) => {
    try {
      setError("");
      const result = await api<NonNullable<typeof member>>(
        `/api/staff/lookup?q=${encodeURIComponent(value.trim())}`,
      );
      setMember(result);
      onFound?.(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => () => controls.current?.stop(), []);
  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-end gap-3"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void lookup(query);
          }
        }}
      >
        <div className="grow">
          <Field
            label="Champions ID, email or QR value"
            value={query}
            onChange={setQuery}
          />
        </div>
        <Button type="button" onClick={() => void lookup(query)}>
          Find member
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            if (scanning) {
              controls.current?.stop();
              setScanning(false);
              return;
            }
            setScanning(true);
            try {
              await new Promise<void>((r) => requestAnimationFrame(() => r()));
              controls.current =
                await new BrowserQRCodeReader().decodeFromVideoDevice(
                  undefined,
                  video.current!,
                  (result, _error, c) => {
                    if (result) {
                      c.stop();
                      setScanning(false);
                      setQuery(result.getText());
                      void lookup(result.getText());
                    }
                  },
                );
            } catch {
              setScanning(false);
              setError(
                "Camera unavailable. Use the member ID, email or pasted QR value.",
              );
            }
          }}
        >
          {scanning ? "Stop camera" : "Scan QR camera"}
        </Button>
      </div>
      {scanning && (
        <video
          className="max-h-64 w-full rounded bg-black"
          ref={video}
          muted
          playsInline
          aria-label="QR camera preview"
        />
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {member && (
        <div className="rounded border border-slate-200 p-4">
          <p className="font-semibold">
            {member.name} · {member.championsId}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {member.membership
              ? `${member.membership.plan.name} · valid until ${new Date(member.membership.endsAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
              : "No active membership"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Identity identified. Payment needs separate authorization.
          </p>
          <MemberHistory id={member.id} />
        </div>
      )}
    </div>
  );
}
function Subject({
  member,
  setMember,
  guest,
  setGuest,
}: {
  member: Member | null;
  setMember: (m: Member | null) => void;
  guest: string;
  setGuest: (s: string) => void;
}) {
  const [isMember, setIsMember] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex gap-3 items-center">
        <input
          type="checkbox"
          checked={isMember}
          onChange={(e) => {
            setIsMember(e.target.checked);
            setMember(null);
            setGuest("");
          }}
        />
        Member customer
      </label>
      {isMember ? (
        <MemberFinder onFound={setMember} />
      ) : (
        <Field label="Guest name" value={guest} onChange={setGuest} />
      )}{" "}
      {member && (
        <p className="text-xs text-orange-700">
          Using benefits for {member.name}.
        </p>
      )}
    </div>
  );
}
export function Reception({ plans }: { plans: MembershipPlan[] }) {
  const [day, setDay] = useState(today()),
    [search, setSearch] = useState(""),
    [member, setMember] = useState<Member | null>(null),
    [guest, setGuest] = useState(""),
    [method, setMethod] = useState("CASH"),
    [selected, setSelected] = useState<string | null>(null),
    [courtChoice, setCourtChoice] = useState(""),
    [timeChoice, setTimeChoice] = useState("");
  const club = useQuery({
    queryKey: ["club-hours"],
    queryFn: () => api<{ settings: { openHour: number; closeHour: number; slotMinutes: number } }>("/api/public"),
    staleTime: 60000,
  });
  // Bookable start times follow the owner's opening hours and slot spacing (a one-hour session must finish by closing).
  const startTimes = (() => {
    const { openHour = 6, closeHour = 23, slotMinutes = 30 } = club.data?.settings ?? {};
    const out: string[] = [];
    for (let m = openHour * 60; m + 60 <= closeHour * 60; m += slotMinutes)
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    return out;
  })();
  const query = useWorkspace<{
    courts: Json<Court>[];
    bookings: Booking[];
    closures: Json<CourtClosure>[];
    members: (Member & { email: string })[];
    social: {
      id: string;
      active: boolean;
      title: string;
      reservation: Json<Reservation>;
      participants: {
        id: string;
        status: string;
        checkedInAt: string | null;
        user: Member;
      }[];
    }[];
  }>("reception", `day=${day}&q=${encodeURIComponent(search)}`);
  const action = useAction();
  const d = query.data;
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">Reception calendar</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Club date" type="date" value={day} onChange={setDay} />
          <Field
            label="Search member by name, email or ID"
            value={search}
            onChange={setSearch}
            required={false}
          />
        </div>
        {search && (
          <div className="mt-4 flex flex-wrap gap-2">
            {d?.members.map((m) => (
              <Button
                key={m.id}
                size="sm"
                variant="outline"
                onClick={() => {
                  setMember(m);
                  setSelected(null);
                }}
              >
                {m.name} · {m.championsId}
              </Button>
            ))}
          </div>
        )}
        <div className="mt-5">
          <MemberFinder onFound={setMember} />
        </div>
      </div>
      <Feedback action={action} />
      {query.error && (
        <p className="field-error" role="alert">
          {query.error.message}
        </p>
      )}
      <FreeSlots
        day={day}
        onPick={(court, time) => {
          setCourtChoice(court);
          setTimeChoice(time);
          document.getElementById("walk-in-booking")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />
      <div className="surface" id="walk-in-booking">
        <h3 className="font-semibold">One-hour walk-in / phone booking</h3>
        <div className="mt-5">
          <Subject
            member={member}
            setMember={setMember}
            guest={guest}
            setGuest={setGuest}
          />
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate(
              {
                area: "booking",
                input: {
                  courtId: courtChoice || String(f.get("courtId")),
                  day,
                  hour: Number((timeChoice || String(f.get("time"))).split(":")[0]),
                  minute: Number((timeChoice || String(f.get("time"))).split(":")[1]),
                  ...(member ? { userId: member.id } : { guestName: guest }),
                },
              },
              { onSuccess: (r) => setSelected(String(r.id)) },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Court
              <select name="courtId" value={courtChoice || undefined} onChange={(e) => setCourtChoice(e.target.value)}>
                {d?.courts.filter((c) => c.status === "ACTIVE").map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · {money(c.hourlyPaise)}/hour
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start time (club time)
              <select name="time" value={timeChoice || undefined} onChange={(e) => setTimeChoice(e.target.value)}>
                {startTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button disabled={action.isPending}>
            Hold session & review price
          </Button>
        </form>
        {selected && (
          <p className="mt-4 text-sm text-orange-700">
            Hold created. Find it in the calendar below to review its invoice
            and confirm payment.
          </p>
        )}
        <div className="mt-5">
          <PaymentMethod value={method} onChange={setMethod} staff />
        </div>
      </div>
      <div className="surface">
        <h3 className="font-semibold">Calendar · {day}</h3>
        {!d?.bookings.length && (
          <p className="mt-5 text-sm text-slate-500">
            No reservations on this date.
          </p>
        )}
        <div className="mt-5 space-y-4">
          {d?.bookings.map((b) => (
            <article
              key={b.id}
              className={`rounded border p-4 space-y-3 ${selected === b.id ? "border-orange-400" : "border-slate-200"}`}
            >
              <p className="text-sm font-semibold">
                {b.court.name} ·{" "}
                {new Date(b.startsAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}{" "}
                ·{" "}
                {b.kind === "SOCIAL"
                  ? "Social court reservation"
                  : b.user?.name || b.guestName}
              </p>
              <p className="text-xs text-slate-500">
                {b.status} · {money(b.pricePaise)}
                {b.checkedInAt ? " · Checked in" : ""}
                {b.status === "HOLD"
                  ? ` · expires ${new Date(b.holdUntil!).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`
                  : ""}
              </p>
              <ReceiptLink id={b.invoiceId} />
              {b.kind === "STANDARD" && (
                <div className="flex flex-wrap gap-2">
                  {b.status === "HOLD" && (
                    <Button
                      size="sm"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          area: "booking",
                          id: b.id,
                          input: { action: "confirm", method },
                        })
                      }
                    >
                      Confirm & record {method}
                    </Button>
                  )}
                  {b.status === "CONFIRMED" && !b.checkedInAt && (
                    <Button
                      size="sm"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          area: "booking",
                          id: b.id,
                          input: { action: "checkin" },
                        })
                      }
                    >
                      Check in
                    </Button>
                  )}
                  {["HOLD", "CONFIRMED"].includes(b.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.isPending}
                      onClick={async () => {
                        const r = await reason("Cancel this booking?", "Cancel booking");
                        if (r)
                          action.mutate({
                            area: "booking",
                            id: b.id,
                            input: {
                              action: "cancel",
                              reason: r,
                              override: true,
                            },
                          });
                      }}
                    >
                      Cancel · staff override
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
        {d?.social.map((e) => (
          <article className="mt-5 border-t pt-5 space-y-3" key={e.id}>
            <h3>
              {e.title} · {e.active ? "Open" : "Cancelled"}
            </h3>
            {e.participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <span>
                  {p.user.name} · {p.status}
                  {p.checkedInAt ? " · Checked in" : ""}
                </span>
                {p.status === "CONFIRMED" && !p.checkedInAt && (
                  <Button
                    size="sm"
                    onClick={() =>
                      action.mutate({
                        area: "social",
                        id: e.id,
                        input: { action: "checkin", participantId: p.id },
                      })
                    }
                  >
                    Check in social participant
                  </Button>
                )}
              </div>
            ))}
            {e.active && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await reason("Cancel this social event?", "Cancel event and credit participants");
                  if (r)
                    action.mutate({
                      area: "social",
                      id: e.id,
                      input: { action: "cancelEvent", reason: r },
                    });
                }}
              >
                Cancel event & credit participants
              </Button>
            )}
          </article>
        ))}
      </div>
      <MemberRegistration onRegistered={setMember} />
      <div className="surface">
        <h3 className="font-semibold">Process membership</h3>
        <p className="mt-3 text-xs text-slate-500">
          Identify the account above. Review the current plan and record the
          customer's policy acceptance.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              p = plans.find((p) => p.id === f.get("planId"));
            if (member && p)
              action.mutate({
                area: "membership",
                input: {
                  userId: member.id,
                  planId: p.id,
                  months: Number(f.get("months")),
                  planVersion: new Date(p.updatedAt).toISOString(),
                  action: String(f.get("action")),
                  acceptPolicy: true,
                  method,
                },
              });
          }}
        >
          <p className="text-sm">
            Account: {member?.name || "Identify a member first"}
          </p>
          <label>
            Plan
            <select name="planId">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.pricePaise)} / month
                </option>
              ))}
            </select>
          </label>
          <label>
            Term
            <select name="months" defaultValue="1">
              {TERM_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {TERM_LABELS[m]}
                  {m > 1 ? " · discount applied" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operation
            <select name="action">
              <option value="renew">Add membership (starts when the current one ends, or now if none)</option>
              <option value="change">Switch plan immediately (replaces time left)</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" required />
            Customer accepts the membership policy and reviewed price.
          </label>
          <Button disabled={!member || action.isPending}>
            Process membership · {method}
          </Button>
        </form>
      </div>
      <div className="surface">
        <h3 className="font-semibold">Friday social registration</h3>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate({
              area: "social-create",
              input: {
                courtId: String(f.get("courtId")),
                day,
                hour: Number(f.get("hour")),
                capacity: Number(f.get("capacity")),
                title: String(f.get("title")),
              },
            });
          }}
        >
          <label>
            Court
            <select name="courtId">
              {d?.courts.filter((c) => c.status === "ACTIVE").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Session hour"
            name="hour"
            type="number"
            min={0}
            max={23}
          />
          <Field
            label="Participant capacity"
            name="capacity"
            type="number"
            min={2}
            max={50}
          />
          <Field label="Session title" name="title" />
          <Button disabled={action.isPending}>
            Reserve court once & open event
          </Button>
        </form>
      </div>
      <div className="surface">
        <h3 className="font-semibold">Maintenance closures</h3>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate({
              area: "closure",
              input: {
                courtId: String(f.get("courtId")),
                startsAt: new Date(
                  `${day}T${f.get("start")}:00+05:30`,
                ).toISOString(),
                endsAt: new Date(
                  `${day}T${f.get("end")}:00+05:30`,
                ).toISOString(),
                reason: String(f.get("reason")),
              },
            });
          }}
        >
          <label>
            Court
            <select name="courtId">
              {d?.courts.filter((c) => c.status === "ACTIVE").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From (club time)" name="start" type="time" />
            <Field label="Until (club time)" name="end" type="time" />
          </div>
          <Field label="Closure reason" name="reason" />
          <Button disabled={action.isPending}>Save closure</Button>
          <p className="text-xs text-slate-500">
            Cancel or move existing reservations before closing their court.
          </p>
        </form>
        {d?.closures.map((c) => (
          <p key={c.id} className="mt-4 text-sm">
            {d.courts.find((x) => x.id === c.courtId)?.name} · {c.reason}{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const r = await reason("Reopen this court?", "Reopen court");
                if (r)
                  action.mutate({
                    area: "closure",
                    id: c.id,
                    input: { reason: r },
                  });
              }}
            >
              Reopen court
            </Button>
          </p>
        ))}
      </div>
    </div>
  );
}
export function CRM() {
  const query = useWorkspace<{
    leads: LeadView[];
    staff: { id: string; name: string }[];
    notifications: Json<StaffNotification>[];
  }>("crm");
  const action = useAction();
  const [quoteMonths, setQuoteMonths] = useState<number>(1);
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">Front-desk notifications</h2>
        {query.data?.notifications
          .filter((n) => !n.readAt)
          .map((n) => (
            <div
              key={n.id}
              className="mt-4 flex flex-wrap justify-between gap-3 text-sm"
            >
              <span>{n.message}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  action.mutate({
                    area: "notification",
                    id: n.id,
                    input: { read: true },
                  })
                }
              >
                Mark read
              </Button>
            </div>
          ))}
        {!query.data?.notifications.some((n) => !n.readAt) && (
          <p className="mt-4 text-sm text-slate-500">
            No unread notifications.
          </p>
        )}
      </div>
      <Feedback action={action} />
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      {query.data?.leads.map((l) => (
        <article className="surface space-y-4" key={l.id}>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {l.name}
            <StatusBadge tone={l.status === "NEW" ? "accent" : l.status === "CONVERTED" ? "success" : l.status === "LOST" ? "neutral" : "info"}>{l.status}</StatusBadge>
            {l.interest !== "GENERAL" && <StatusBadge>{l.interest.toLowerCase()}</StatusBadge>}
            {l.enquiryCount > 1 && <StatusBadge tone="warning">wrote {l.enquiryCount} times</StatusBadge>}
          </h3>
          <p className="text-xs text-slate-500">
            <a className="underline" href={`mailto:${l.email}`}>{l.email}</a>
            {l.phone && <> · <a className="underline" href={`tel:${l.phone}`}>{l.phone}</a></>} · {l.sport}
            {l.planId ? ` · asked about ${l.planId}` : ""} ·{" "}
            {l.followUpAt
              ? `Follow up ${new Date(l.followUpAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
              : "No follow-up scheduled"}
          </p>
          <p className="text-sm">{l.message}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Assign to
              <select
                value={l.assignedTo || ""}
                onChange={(e) =>
                  action.mutate({
                    area: "crm",
                    id: l.id,
                    input: {
                      action: "assign",
                      staffId: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">Unassigned</option>
                {query.data?.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={l.status}
                disabled={!!l.memberId}
                onChange={(e) =>
                  action.mutate({
                    area: "crm",
                    id: l.id,
                    input: { action: "status", status: e.target.value },
                  })
                }
              >
                {[
                  "NEW",
                  "CONTACTED",
                  "QUOTED",
                  "LOST",
                  ...(l.memberId ? ["CONVERTED"] : []),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <form
            className="flex flex-wrap gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate({
                area: "crm",
                id: l.id,
                input: { action: "note", note: String(f.get("note")) },
              });
            }}
          >
            <div className="grow">
              <Field label="Activity note" name="note" />
            </div>
            <Button size="sm" disabled={action.isPending}>
              Save note
            </Button>
          </form>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate({
                area: "crm",
                id: l.id,
                input: {
                  action: "followup",
                  at: new Date(String(f.get("at"))).toISOString(),
                  note: String(f.get("note")),
                },
              });
            }}
          >
            <Field label="Follow-up at" name="at" type="datetime-local" />
            <Field label="Follow-up note" name="note" />
            <Button size="sm" disabled={action.isPending}>
              Schedule reminder
            </Button>
          </form>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs">
              Quote term
              <select
                className="w-auto"
                value={quoteMonths}
                onChange={(e) => setQuoteMonths(Number(e.target.value))}
              >
                {TERM_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {TERM_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            {["gold", "silver", "junior"].map((planId) => (
              <Button
                size="sm"
                variant="outline"
                key={planId}
                onClick={() =>
                  action.mutate({
                    area: "crm",
                    id: l.id,
                    input: { action: "quote", planId, months: quoteMonths },
                  })
                }
              >
                Quote &amp; email {planId}
              </Button>
            ))}
            {!l.memberId && (
              <Button
                size="sm"
                onClick={() =>
                  action.mutate({
                    area: "crm",
                    id: l.id,
                    input: { action: "convert" },
                  })
                }
              >
                Convert / link member account
              </Button>
            )}
          </div>
          {l.memberId && (
            <p className="notice">
              Member account linked for {l.email}. Identify this email in
              Reception to process membership. Purchase remains a separate
              reviewed payment.
            </p>
          )}
          <details>
            <summary className="text-sm cursor-pointer">
              Quotes & activity ({l.quotes.length + l.activities.length})
            </summary>
            <div className="mt-4 space-y-3">
              {l.quotes.map((q) => (
                <p className="text-xs" key={q.id}>
                  <a className="mr-2 text-orange-800 underline" href={`/quote/${q.token}`} target="_blank" rel="noreferrer">Open quote page</a>
                  <button
                    type="button"
                    className="mr-2 text-orange-800 underline disabled:opacity-50"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ area: "crm", id: l.id, input: { action: "emailQuote", quoteId: q.id } })}
                  >
                    {q.sentAt ? "Email again" : "Email to visitor"}
                  </button>
                  {q.sentAt ? `Sent ${new Date(q.sentAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · ` : "Not sent · "}
                  {q.planId} · {money(q.totalPaise)} · valid until{" "}
                  {new Date(q.validUntil).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  · {termLabel((q.snapshot as { months?: number }).months, (q.snapshot as { durationDays: number }).durationDays)}
                  · court{" "}
                  {(q.snapshot as { courtDiscountBps: number })
                    .courtDiscountBps / 100}
                  % · shop{" "}
                  {(q.snapshot as { shopDiscountBps: number }).shopDiscountBps /
                    100}
                  % · clubhouse{" "}
                  {(q.snapshot as { foodDiscountBps: number }).foodDiscountBps /
                    100}
                  % discount
                </p>
              ))}
              {l.activities.map((a) => (
                <p className="text-xs text-slate-500" key={a.id}>
                  {new Date(a.createdAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  · {a.note}
                </p>
              ))}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
export function Inventory() {
  const query = useWorkspace<{
    products: (Json<Product> & { variants: Json<ProductVariant>[] })[];
    orders: Order[];
    movements: {
      id: string;
      delta: number;
      reason: string;
      variantId: string;
    }[];
  }>("inventory");
  const action = useAction();
  const [member, setMember] = useState<Member | null>(null),
    [guest, setGuest] = useState(""),
    [method, setMethod] = useState("CASH"),
    [items, setItems] = useItemDraft<{ variantId: string; quantity: number }>(
      "counter-items",
    ),
    [delivery, setDelivery] = useState(false);
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">
          Shared inventory & counter sale
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          Available = stock minus reserved. Online and counter checkout use this
          same inventory.
        </p>
        <div className="mt-5">
          <Subject
            member={member}
            setMember={setMember}
            guest={guest}
            setGuest={setGuest}
          />
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              variantId = String(f.get("variantId"));
            setItems((old) => {
              const existing = old.find((i) => i.variantId === variantId);
              return existing
                ? old.map((i) =>
                    i === existing
                      ? {
                          ...i,
                          quantity: Math.min(
                            20,
                            i.quantity + Number(f.get("quantity")),
                          ),
                        }
                      : i,
                  )
                : [...old, { variantId, quantity: Number(f.get("quantity")) }];
            });
          }}
        >
          <label>
            Product variant
            <select name="variantId">
              {query.data?.products
                .filter((p) => p.active)
                .flatMap((p) =>
                  p.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {p.name} · {v.label} · {money(v.pricePaise)} ·{" "}
                      {v.stock - v.reserved} available
                    </option>
                  )),
                )}
            </select>
          </label>
          <Field
            label="Quantity"
            name="quantity"
            type="number"
            min={1}
            max={20}
          />
          <Button variant="outline">Add to counter cart</Button>
        </form>
        {items.map((i) => (
          <p className="mt-3 text-xs" key={i.variantId}>
            {i.variantId} × {i.quantity}{" "}
            <button
              className="text-orange-700 underline"
              onClick={() => setItems(items.filter((x) => x !== i))}
            >
              Remove
            </button>
          </p>
        ))}
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate(
              {
                area: "order",
                input: {
                  items,
                  channel: "COUNTER",
                  delivery,
                  ...(member ? { userId: member.id } : { guestName: guest }),
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
              { onSuccess: () => setItems([]) },
            );
          }}
        >
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={delivery}
              onChange={(e) => setDelivery(e.target.checked)}
            />
            Delivery
          </label>
          {delivery && (
            <div className="grid gap-3 sm:grid-cols-2">
              {["line", "city", "postcode", "phone"].map((k) => (
                <Field label={k} key={k} name={k} />
              ))}
            </div>
          )}
          <Button disabled={!items.length || action.isPending}>
            Reserve cart & create invoice
          </Button>
        </form>
        <div className="mt-5">
          <PaymentMethod value={method} onChange={setMethod} staff />
        </div>
      </div>
      <Feedback action={action} />
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      <div className="surface">
        <h3 className="font-semibold">Orders · pickup / dispatch / returns</h3>
        {query.data?.orders.map((o) => (
          <article
            key={o.id}
            className="mt-5 space-y-3 border-t border-slate-200 pt-4"
          >
            <p className="text-sm font-semibold">
              {o.user?.name || o.guestName} · {o.status} · {o.channel} ·{" "}
              {money(o.totalPaise)}
            </p>
            {o.orderLines.map((l) => (
              <p className="text-xs" key={l.id}>
                {l.quantity} × {l.name} · {l.label} · {l.returned} returned
              </p>
            ))}
            {o.delivery && (
              <p className="text-xs">
                Delivery address:{" "}
                {Object.values(
                  (o.address as Record<string, string>) || {},
                ).join(", ")}{" "}
                · Tracking: {o.tracking || "awaiting dispatch"}
              </p>
            )}
            <ReceiptLink id={o.invoiceId} />
            <div className="flex flex-wrap gap-2">
              {o.status === "HOLD" && (
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      area: "order",
                      id: o.id,
                      input: { action: "confirm", method },
                    })
                  }
                >
                  Confirm & record {method}
                </Button>
              )}
              {o.status === "PAID" && (
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={async () => {
                    const tracking = o.delivery
                      ? await promptText({ title: "Dispatch this order", description: "The customer can see this reference on their order.", label: "Tracking / courier reference", placeholder: "e.g. Delhivery 1234567890", minLength: 3, confirmLabel: "Mark dispatched" })
                      : undefined;
                    if (o.delivery && !tracking) return;
                    action.mutate({
                      area: "order",
                      id: o.id,
                      input: {
                        action: o.delivery ? "dispatch" : "collect",
                        ...(tracking ? { tracking } : {}),
                      },
                    });
                  }}
                >
                  {o.delivery ? "Dispatch" : "Mark collected"}
                </Button>
              )}
              {o.status === "DISPATCHED" && (
                <Button
                  size="sm"
                  onClick={() =>
                    action.mutate({
                      area: "order",
                      id: o.id,
                      input: { action: "deliver" },
                    })
                  }
                >
                  Mark delivered
                </Button>
              )}
              {["HOLD", "PAID"].includes(o.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const r = await reason("Cancel this order?", "Cancel order");
                    if (r)
                      action.mutate({
                        area: "order",
                        id: o.id,
                        input: { action: "cancel", reason: r },
                      });
                  }}
                >
                  Cancel & credit
                </Button>
              )}
            </div>
            {["COLLECTED", "DELIVERED", "PART_RETURNED"].includes(o.status) && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  action.mutate({
                    area: "order",
                    id: o.id,
                    input: {
                      action: "return",
                      reason: String(f.get("reason")),
                      returns: [
                        {
                          variantId: String(f.get("variantId")),
                          quantity: Number(f.get("quantity")),
                          restock: f.get("restock") === "on",
                        },
                      ],
                    },
                  });
                }}
              >
                <label>
                  Return variant
                  <select name="variantId">
                    {o.orderLines
                      .filter((l) => l.returned < l.quantity)
                      .map((l) => (
                        <option key={l.id} value={l.variantId}>
                          {l.name} · {l.label} · {l.quantity - l.returned}{" "}
                          returnable
                        </option>
                      ))}
                  </select>
                </label>
                <Field
                  label="Return quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={20}
                />
                <Field label="Return reason" name="reason" />
                <label>
                  <input type="checkbox" name="restock" defaultChecked />{" "}
                  Restock sellable goods
                </label>
                <Button size="sm" disabled={action.isPending}>
                  Record return & credit
                </Button>
              </form>
            )}
          </article>
        ))}
      </div>
      <div className="surface">
        <h3 className="font-semibold">Restocking & corrections</h3>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate({
              area: "stock",
              input: {
                variantId: String(f.get("variantId")),
                delta: Number(f.get("delta")),
                reason: String(f.get("reason")),
              },
            });
          }}
        >
          <label>
            SKU
            <select name="variantId">
              {query.data?.products.flatMap((p) =>
                p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {p.name} · {v.label} · stock {v.stock}, reserved{" "}
                    {v.reserved}
                    {v.stock - v.reserved < 4 ? " · LOW STOCK" : ""}
                  </option>
                )),
              )}
            </select>
          </label>
          <Field
            label="Stock change (+ arrivals / − correction)"
            name="delta"
            type="number"
            min={-10000}
            max={10000}
          />
          <Field label="Reason / delivery reference" name="reason" />
          <Button disabled={action.isPending}>Record stock movement</Button>
        </form>
        <details className="mt-5">
          <summary>Recent movements</summary>
          {query.data?.movements.map((m) => (
            <p className="mt-3 text-xs" key={m.id}>
              {m.variantId} · {m.delta > 0 ? "+" : ""}
              {m.delta} · {m.reason}
            </p>
          ))}
        </details>
      </div>
    </div>
  );
}
export function POS() {
  const query = useWorkspace<{
    tables: Json<DiningTable>[];
    menu: Json<MenuItem>[];
    bills: Bill[];
  }>("pos");
  const action = useAction();
  const [member, setMember] = useState<Member | null>(null),
    [guest, setGuest] = useState(""),
    [table, setTable] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [items, setItems] = useItemDraft<{
      menuId: string;
      quantity: number;
      note: string;
    }>("pos-items"),
    [method, setMethod] = useState("CASH");
  const bill = query.data?.bills.find((b) => b.id === selected);
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">Waiter / POS · tables & tabs</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {query.data?.tables.map((t) => {
            const b = query.data.bills.find(
              (b) => b.tableId === t.id && b.status === "OPEN",
            );
            return (
              <button
                key={t.id}
                className={`rounded border p-4 text-left ${table === t.id ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}
                onClick={() => {
                  setTable(t.id);
                  setSelected(b?.id || null);
                  if (table && table !== t.id) setItems([]);
                }}
              >
                <p className="font-semibold">{t.name}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {b
                    ? `${b.member?.name || b.guestName} · ${b.paymentStatus}`
                    : `${t.capacity} seats · Available`}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <Feedback action={action} />
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      {table && (!bill || bill.status === "OPEN") && (
        <div className="surface space-y-5">
          <h3 className="text-lg font-semibold">
            {query.data?.tables.find((t) => t.id === table)?.name} ·{" "}
            {bill ? "Additional order" : "New bill"}
          </h3>
          {!bill && (
            <Subject
              member={member}
              setMember={setMember}
              guest={guest}
              setGuest={setGuest}
            />
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setItems([
                ...items,
                {
                  menuId: String(f.get("menuId")),
                  quantity: Number(f.get("quantity")),
                  note: String(f.get("note")),
                },
              ]);
            }}
          >
            <label>
              Menu item
              <select name="menuId">
                {query.data?.menu.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.name} · {money(m.pricePaise)}
                    {m.available ? "" : " · Unavailable"}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Quantity"
                name="quantity"
                type="number"
                min={1}
                max={30}
              />
              <Field
                label="Item notes / allergies"
                name="note"
                required={false}
              />
            </div>
            <Button variant="outline">Add item to draft</Button>
          </form>
          {items.map((i, n) => (
            <p className="text-sm" key={n}>
              {i.quantity} ×{" "}
              {query.data?.menu.find((m) => m.id === i.menuId)?.name} · {i.note}{" "}
              <button
                className="underline text-orange-700"
                onClick={() =>
                  setItems(items.filter((_, index) => index !== n))
                }
              >
                Remove
              </button>
            </p>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate(
                bill
                  ? {
                      area: "bill",
                      id: bill.id,
                      input: { action: "add", items },
                    }
                  : {
                      area: "bill",
                      input: {
                        tableId: table,
                        items,
                        ...(member
                          ? { userId: member.id }
                          : { guestName: guest }),
                        ageConfirmed: f.get("age") === "on",
                      },
                    },
                {
                  onSuccess: (r) => {
                    setItems([]);
                    setSelected(String(r.id));
                  },
                },
              );
            }}
          >
            {!bill && (
              <label className="mb-5 flex gap-3 text-xs">
                <input type="checkbox" name="age" />
                Guest age 21+ verified for bar orders
              </label>
            )}
            <Button disabled={!items.length || action.isPending}>
              Submit to kitchen · server prices & benefits
            </Button>
          </form>
        </div>
      )}
      {bill && (
        <BillControls
          bill={bill}
          action={action}
          method={method}
          setMethod={setMethod}
        />
      )}
      <div className="surface">
        <h3 className="font-semibold">Bills and receipts</h3>
        {query.data?.bills.map((b) => (
          <div
            key={b.id}
            className="mt-4 space-y-3 border-t border-slate-200 pt-4"
          >
            <button
              className="text-sm text-left font-semibold"
              onClick={() => {
                setSelected(b.id);
                setTable(b.tableId);
              }}
            >
              {b.table.name} · {b.member?.name || b.guestName} · {b.status} ·{" "}
              {b.paymentStatus}
              {b.tabEnabled ? " · Member tab" : ""}
            </button>
            <div className="flex flex-wrap gap-4">
              {b.tickets.map((t) => (
                <ReceiptLink id={t.invoiceId} key={t.id} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function BillControls({
  bill: b,
  action,
  method,
  setMethod,
}: {
  bill: Bill;
  action: ReturnType<typeof useAction>;
  method: string;
  setMethod: (v: string) => void;
}) {
  return (
    <div className="surface space-y-5">
      <h3 className="text-lg font-semibold">
        Current bill · payment {b.paymentStatus} ·{" "}
        {b.tabEnabled ? "Member tab" : "Pay at table"}
      </h3>
      <p className="text-sm">
        Invoiced {money(b.totals.totalPaise)} · Credits{" "}
        {money(b.totals.creditPaise)} · Allocated {money(b.totals.paidPaise)} ·
        Outstanding <strong>{money(b.totals.outstandingPaise)}</strong>
      </p>
      {b.tickets.map((t) => (
        <article
          key={t.id}
          className="rounded border border-slate-200 p-4 space-y-3"
        >
          <h4 className="text-sm font-semibold">
            Order #{t.revision} · Preparation {t.preparation} · revision{" "}
            {t.version}
          </h4>
          {t.lines.map((l) => (
            <div key={l.id} className="space-y-2">
              <p className="text-sm">
                {l.quantity} × {l.name} · {money(l.totalPaise)} · {l.status}
              </p>
              {l.note && (
                <p className="text-xs text-orange-800">Note: {l.note}</p>
              )}
              {l.status === "ACTIVE" &&
                ["INCOMING", "ACCEPTED"].includes(t.preparation) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.isPending || b.status !== "OPEN"}
                    onClick={async () => {
                      const r = await reason("Remove this kitchen item?", "Remove item");
                      if (r)
                        action.mutate({
                          area: "bill",
                          id: b.id,
                          input: {
                            action: "cancelItem",
                            lineId: l.id,
                            reason: r,
                          },
                        });
                    }}
                  >
                    Cancel item & credit
                  </Button>
                )}
            </div>
          ))}
          <ReceiptLink id={t.invoiceId} />
          {t.preparation === "READY" && (
            <Button
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  area: "kitchen",
                  input: {
                    ticketId: t.id,
                    version: t.version,
                    state: "SERVED",
                  },
                })
              }
            >
              Mark served
            </Button>
          )}
        </article>
      ))}
      {b.status === "OPEN" && (
        <>
          <PaymentMethod value={method} onChange={setMethod} staff />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                amount = String(f.get("amount"));
              action.mutate({
                area: "bill",
                id: b.id,
                input: {
                  action: "pay",
                  method,
                  ...(amount
                    ? { amountPaise: Math.round(Number(amount) * 100) }
                    : {}),
                },
              });
            }}
          >
            <Field
              label="Payment amount in ₹ (blank = full balance)"
              name="amount"
              type="number"
              min={0.01}
              required={false}
            />
            <Button disabled={action.isPending}>Record payment</Button>
          </form>
          <div className="flex flex-wrap gap-3">
            {b.memberId && !b.tabEnabled && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    area: "bill",
                    id: b.id,
                    input: { action: "tab" },
                  })
                }
              >
                Enable eligible member tab
              </Button>
            )}
            <Button
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  area: "bill",
                  id: b.id,
                  input: { action: "close" },
                })
              }
            >
              Close paid, served table
            </Button>
          </div>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate({
                area: "bill",
                id: b.id,
                input: {
                  action: "adjust",
                  invoiceId: String(f.get("invoiceId")),
                  amountPaise: Math.round(Number(f.get("amount")) * 100),
                  reason: String(f.get("reason")),
                },
              });
            }}
          >
            <label>
              Invoice adjustment
              <select name="invoiceId">
                {b.tickets.map((t) => (
                  <option key={t.id} value={t.invoiceId!}>
                    Order #{t.revision}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Credit amount in ₹"
              name="amount"
              type="number"
              min={0.01}
            />
            <Field label="Adjustment reason" name="reason" />
            <Button variant="outline" disabled={action.isPending}>
              Record credit / refund
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
export function Kitchen() {
  const query = useWorkspace<
    (Ticket & {
      order: {
        id: string;
        table: { name: string };
        paymentStatus: string;
        guestName: string | null;
      };
    })[]
  >("kitchen");
  const action = useAction();
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">Kitchen preparation queue</h2>
        <p className="mt-3 text-sm text-slate-500">
          Payment is independent of preparation. Additional orders appear as new
          tickets; cancelled items update the revision. Review an amendment
          before advancing.
        </p>
      </div>
      <Feedback action={action} />
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
      {!query.data?.length && (
        <div className="surface">No open kitchen tickets.</div>
      )}
      {query.data?.map((t) => (
        <article key={t.id} className="surface space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-semibold">
              {t.order.table.name} · Order #{t.revision}
              {t.revision > 1 ? " · ADDITION" : ""}
            </h3>
            <span className="text-xs text-orange-700">
              {t.preparation} · revision {t.version}
              {t.version > 1 ? " · updated" : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Waiting{" "}
            {Math.max(
              0,
              Math.floor((Date.now() - +new Date(t.createdAt)) / 60000),
            )}{" "}
            min · Bill payment: {t.order.paymentStatus}
          </p>
          {t.lines.map((l) => (
            <p
              key={l.id}
              className={`text-sm ${l.status === "CANCELLED" ? "line-through text-slate-400" : ""}`}
            >
              {l.quantity} × {l.name}
              {l.note ? ` · NOTE: ${l.note}` : ""} · {l.status}
            </p>
          ))}
          {["INCOMING", "ACCEPTED", "COOKING"].includes(t.preparation) && (
            <Button
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  area: "kitchen",
                  input: {
                    ticketId: t.id,
                    version: t.version,
                    state: (
                      {
                        INCOMING: "ACCEPTED",
                        ACCEPTED: "COOKING",
                        COOKING: "READY",
                      } as Record<string, string>
                    )[t.preparation],
                  },
                })
              }
            >
              Mark{" "}
              {
                (
                  {
                    INCOMING: "accepted",
                    ACCEPTED: "cooking",
                    COOKING: "ready",
                  } as Record<string, string>
                )[t.preparation]
              }
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
export function Financial() {
  const query = useWorkspace<InvoiceView[]>("billing");
  const action = useAction();
  const [method, setMethod] = useState("CASH");
  const invoices = query.data || [],
    sales = invoices.reduce((s, i) => s + i.totalPaise, 0),
    collections = invoices.reduce(
      (s, i) => s + i.allocations.reduce((n, a) => n + a.amountPaise, 0),
      0,
    ),
    credits = invoices.reduce(
      (s, i) => s + i.credits.reduce((n, c) => n + c.amountPaise, 0),
      0,
    ),
    refunds = invoices.reduce(
      (s, i) =>
        s +
        i.credits.reduce(
          (n, c) =>
            n + (c.refund?.status === "RECORDED" ? c.refund.amountPaise : 0),
          0,
        ),
      0,
    );
  return (
    <div className="space-y-6">
      <div className="surface">
        <h2 className="text-xl font-semibold">
          Billing, allocations & refunds
        </h2>
        <p className="mt-3 text-xs text-slate-500">
          Latest 150 permitted invoices. Collections and credits are separate;
          pending manual refunds need an actual repayment before being marked
          recorded.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <p className="text-sm">Invoiced: {money(sales)}</p>
          <p className="text-sm">Allocated collections: {money(collections)}</p>
          <p className="text-sm">Credits: {money(credits)}</p>
          <p className="text-sm">Recorded refunds: {money(refunds)}</p>
        </div>
        <div className="mt-5">
          <PaymentMethod value={method} onChange={setMethod} staff />
        </div>
      </div>
      <Feedback action={action} />
      {query.error && (
        <p className="field-error" role="alert">
          {query.error.message}
        </p>
      )}
      {invoices.map((i) => {
        const paid = i.allocations.reduce((s, a) => s + a.amountPaise, 0),
          credited = i.credits.reduce((s, c) => s + c.amountPaise, 0),
          outstanding = Math.max(0, i.totalPaise - paid - credited);
        return (
          <article className="surface space-y-4" key={i.id}>
            <h3 className="font-semibold">
              {i.number} · {i.customerName}
            </h3>
            <p className="text-xs text-slate-500">
              {i.department} · {money(i.totalPaise)} · outstanding{" "}
              {money(outstanding)}
              {i.dueAt
                ? ` · due ${new Date(i.dueAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
                : ""}
            </p>
            <ReceiptLink id={i.id} />
            {i.allocations.map((a) => (
              <p key={a.id} className="text-xs">
                {money(a.amountPaise)} · {a.payment.method} ·{" "}
                {a.payment.source === "LOCAL_SIMULATED"
                  ? "LOCAL TEST — no funds collected"
                  : a.payment.source === "MANUAL_RECORDED"
                    ? "STAFF RECORDED — not gateway verified"
                    : a.payment.source === "GATEWAY_VERIFIED"
                      ? "GATEWAY VERIFIED"
                      : a.payment.source}
              </p>
            ))}
            {i.credits.map((c) => (
              <div key={c.id} className="space-y-2">
                <p className="text-xs">
                  Credit {money(c.amountPaise)} · {c.reason}
                </p>
                {c.refund && (
                  <p className="text-xs">
                    Refund {money(c.refund.amountPaise)} · {c.refund.method} ·{" "}
                    {c.refund.source} · {c.refund.status}
                  </p>
                )}
                {c.refund?.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const r = await reason("Record this refund?", "Record refund");
                      if (r)
                        action.mutate({
                          area: "refund",
                          id: c.refund!.id,
                          input: { reason: r },
                        });
                    }}
                  >
                    Record completed manual refund
                  </Button>
                )}
              </div>
            ))}
            {!!outstanding && i.department === "CLUBHOUSE" && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  action.mutate({
                    area: "payment",
                    id: i.id,
                    input: {
                      method,
                      amountPaise: Math.round(Number(f.get("amount")) * 100),
                    },
                  });
                }}
              >
                <Field
                  label="Payment ₹"
                  name="amount"
                  type="number"
                  min={0.01}
                  max={outstanding / 100}
                />
                <Button size="sm" disabled={action.isPending}>
                  Allocate payment
                </Button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
