"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { dateTime, date, money } from "@/lib/utils";
import { StatusBadge } from "./staff-ui";

type Profile = {
  member: { id: string; name: string; email: string; phone: string | null; dateOfBirth: string | null; championsId: string; emailVerified: boolean; createdAt: string };
  current: { plan: { name: string }; startsAt: string; endsAt: string; pricePaise: number } | null;
  daysLeft: number | null;
  expiredOn: string | null;
  memberships: { id: string; plan: string; startsAt: string; endsAt: string; status: string; pricePaise: number }[];
  today: { id: string; court: string; startsAt: string; status: string; checkedInAt: string | null }[];
  bookings: { id: string; court: string; startsAt: string; status: string; checkedInAt: string | null; pricePaise: number }[];
  social: { id: string; title: string; startsAt: string; status: string }[];
  orders: { id: string; status: string; totalPaise: number; createdAt: string; channel: string }[];
  bills: { id: string; table: string; status: string; paymentStatus: string; createdAt: string }[];
  visitCount: number;
  lastVisit: string | null;
  outstandingPaise: number;
  lifetimePaidPaise: number;
};

/** Everything the front desk needs to recognise a member and see their history with the club. */
export function MemberHistory({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["member-profile", id], queryFn: () => api<Profile>(`/api/staff/member?id=${encodeURIComponent(id)}`), retry: false, refetchInterval: 15000 });
  // Cashiers get the short lookup only; the history endpoint is for owner and reception.
  if (query.error || query.isPending) return query.isPending ? <p role="status" className="mt-3 text-xs text-slate-500">Loading history…</p> : null;
  const p = query.data;
  const expiring = p.current && p.daysLeft !== null && p.daysLeft <= 14;
  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {p.current ? (
          <StatusBadge tone={expiring ? "warning" : "success"}>
            {p.current.plan.name} · valid until {date(p.current.endsAt)}
            {p.daysLeft !== null && ` · ${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"} left`}
          </StatusBadge>
        ) : p.expiredOn ? (
          <StatusBadge tone="danger">Membership expired {date(p.expiredOn)}</StatusBadge>
        ) : (
          <StatusBadge>No membership yet</StatusBadge>
        )}
        {p.outstandingPaise > 0 && <StatusBadge tone="danger">Unpaid {money(p.outstandingPaise)}</StatusBadge>}
        {p.today.some((b) => b.checkedInAt) && <StatusBadge tone="info">Checked in today</StatusBadge>}
        {!p.member.emailVerified && <StatusBadge tone="warning">Email not verified</StatusBadge>}
      </div>
      {expiring && <p className="notice text-xs">Membership ends in {p.daysLeft} day{p.daysLeft === 1 ? "" : "s"}. Offer a renewal below.</p>}
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ["Visits", String(p.visitCount)],
          ["Last visit", p.lastVisit ? date(p.lastVisit) : "—"],
          ["Paid to date", money(p.lifetimePaidPaise)],
          ["Member since", date(p.member.createdAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">
        {p.member.email}
        {p.member.phone ? ` · ${p.member.phone}` : ""}
        {p.member.dateOfBirth ? ` · born ${date(p.member.dateOfBirth)}` : ""}
      </p>
      {p.today.length > 0 && (
        <div>
          <h4 className="font-medium">Today&apos;s sessions</h4>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {p.today.map((b) => (
              <li key={b.id}>{b.court} · {dateTime(b.startsAt)} · {b.checkedInAt ? "checked in" : b.status.toLowerCase()}</li>
            ))}
          </ul>
        </div>
      )}
      <HistoryList title="Recent bookings" empty="No bookings yet." rows={p.bookings.map((b) => `${b.court} · ${dateTime(b.startsAt)} · ${b.checkedInAt ? "attended" : b.status.toLowerCase()} · ${b.pricePaise ? money(b.pricePaise) : "free"}`)} />
      <HistoryList title="Memberships" empty="No memberships." rows={p.memberships.map((m) => `${m.plan} · ${date(m.startsAt)} to ${date(m.endsAt)} · ${money(m.pricePaise)}${m.status === "SUPERSEDED" ? " · replaced" : ""}`)} />
      <HistoryList title="Shop orders" empty="No shop orders." rows={p.orders.map((o) => `${o.channel.toLowerCase()} · ${date(o.createdAt)} · ${o.status.toLowerCase()} · ${money(o.totalPaise)}`)} />
      <HistoryList title="Clubhouse bills" empty="No clubhouse bills." rows={[...p.bills.map((b) => `${b.table} · ${date(b.createdAt)} · ${b.status.toLowerCase()} · ${b.paymentStatus.toLowerCase()}`), ...p.social.map((s) => `${s.title} · ${dateTime(s.startsAt)} · ${s.status.toLowerCase()}`)]} />
    </div>
  );
}
function HistoryList({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <details>
      <summary className="font-medium">{title} ({rows.length})</summary>
      {rows.length ? <ul className="mt-2 space-y-1 text-xs text-slate-700">{rows.map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">{empty}</p>}
    </details>
  );
}
