"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench, CheckCircle2, Pencil, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/utils";
import { SPORT_IMAGES } from "@/modules/facilities/constants";
import type { FacilityInput } from "@/modules/facilities/service";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "./staff-ui";

type Status = "ACTIVE" | "MAINTENANCE" | "INACTIVE";
type CourtRow = { id: string; name: string; sportId: string; hourlyPaise: number; indoor: boolean; status: Status; statusNote: string | null; upcomingBookings: number };
type SportRow = { id: string; name: string; description: string; image: string; status: Status; statusNote: string | null; courts: CourtRow[] };

const STATUS_LABEL: Record<Status, string> = { ACTIVE: "Open for booking", MAINTENANCE: "Under maintenance", INACTIVE: "Retired · hidden" };
const STATUS_TONE = { ACTIVE: "success", MAINTENANCE: "warning", INACTIVE: "neutral" } as const;

function useFacilityAction(onDone?: () => void) {
  const router = useRouter();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: FacilityInput) => api("/api/staff/facilities", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async () => {
      onDone?.();
      router.refresh();
      await Promise.all([client.invalidateQueries({ queryKey: ["facilities"] }), client.invalidateQueries({ queryKey: ["availability"] })]);
    },
  });
}
function Problem({ error }: { error: Error | null }) {
  return error ? <p role="alert" className="field-error mt-3">{error.message}</p> : null;
}

export function FacilitiesWorkspace() {
  const [adding, setAdding] = useState(false);
  const query = useQuery({ queryKey: ["facilities"], queryFn: () => api<SportRow[]>("/api/staff/facilities"), refetchInterval: 15000 });
  const sports = query.data ?? [];
  const courts = sports.flatMap((s) => s.courts);
  const maintenance = courts.filter((c) => c.status === "MAINTENANCE" || sports.find((s) => s.id === c.sportId)?.status === "MAINTENANCE").length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Courts & sports"
        description="Add sports and courts, change hourly rates, and mark a court or a whole sport as under maintenance. Changes reach the booking page immediately. Facilities are retired rather than deleted so past bookings and invoices stay intact."
        actions={<Button onClick={() => setAdding((v) => !v)} aria-expanded={adding}>{adding ? <X size={16} /> : <Plus size={16} />}{adding ? "Close" : "Add a sport"}</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sports offered" value={sports.filter((s) => s.status !== "INACTIVE").length} hint={`${sports.length} in total`} />
        <StatCard label="Courts open" value={courts.filter((c) => c.status === "ACTIVE").length} hint={`${courts.length} in total`} />
        <StatCard label="Under maintenance" value={maintenance} tone={maintenance ? "warning" : "neutral"} hint="Cannot be booked right now" />
      </div>
      {adding && <SportForm onDone={() => setAdding(false)} />}
      {query.isPending && <p role="status" className="text-sm text-slate-500">Loading courts…</p>}
      {query.error && <p role="alert" className="field-error">{query.error.message}</p>}
      {query.data && !sports.length && <EmptyState title="No sports yet">Add your first sport, then add courts to it.</EmptyState>}
      {sports.map((sport) => <SportCard key={sport.id} sport={sport} />)}
    </div>
  );
}

function SportForm({ sport, onDone }: { sport?: SportRow; onDone: () => void }) {
  const mutation = useFacilityAction(onDone);
  const [status, setStatus] = useState<Status>(sport?.status ?? "ACTIVE");
  return (
    <form
      className="surface space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const base = { name: String(f.get("name")), description: String(f.get("description")), image: String(f.get("image")) };
        mutation.mutate(sport ? { action: "updateSport", id: sport.id, ...base, status, statusNote: String(f.get("statusNote") ?? "") } : { action: "createSport", ...base });
      }}
    >
      <h3 className="text-base font-semibold">{sport ? `Edit ${sport.name}` : "Add a sport"}</h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`sport-name-${sport?.id ?? "new"}`}>Sport name</label>
          <Input id={`sport-name-${sport?.id ?? "new"}`} name="name" className="mt-2" required minLength={2} maxLength={60} defaultValue={sport?.name} placeholder="e.g. Squash" />
        </div>
        <div>
          <label htmlFor={`sport-image-${sport?.id ?? "new"}`}>Photo</label>
          <select id={`sport-image-${sport?.id ?? "new"}`} name="image" className="mt-2" defaultValue={sport?.image ?? SPORT_IMAGES[4].path}>
            {SPORT_IMAGES.map((i) => <option key={i.path} value={i.path}>{i.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`sport-desc-${sport?.id ?? "new"}`}>Short description shown to players</label>
          <textarea id={`sport-desc-${sport?.id ?? "new"}`} name="description" className="mt-2 min-h-20" required minLength={10} maxLength={400} defaultValue={sport?.description} placeholder="Fast, friendly rallies on our glass-walled courts." />
        </div>
        {sport && <StatusFields idPrefix={`sport-${sport.id}`} status={status} onStatus={setStatus} note={sport.statusNote} label="Sport status" />}
      </div>
      <Problem error={mutation.error} />
      <div className="flex gap-3">
        <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : sport ? "Save sport" : "Add sport"}</Button>
        {sport && <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

function StatusFields({ idPrefix, status, onStatus, note, label, upcoming = 0 }: { idPrefix: string; status: Status; onStatus: (s: Status) => void; note: string | null; label: string; upcoming?: number }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-status`}>{label}</label>
        <select id={`${idPrefix}-status`} className="mt-2" value={status} onChange={(e) => onStatus(e.target.value as Status)}>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {status !== "ACTIVE" && (
        <div>
          <label htmlFor={`${idPrefix}-note`}>{status === "MAINTENANCE" ? "Maintenance note (shown to players)" : "Internal note"}</label>
          <Input id={`${idPrefix}-note`} name="statusNote" className="mt-2" maxLength={200} required={status === "MAINTENANCE"} defaultValue={note ?? ""} placeholder="Resurfacing until Friday 6 PM" />
        </div>
      )}
      {status !== "ACTIVE" && upcoming > 0 && (
        <p className="notice text-xs sm:col-span-2" role="note">
          {upcoming} upcoming booking{upcoming > 1 ? "s" : ""} stay in place. Cancel or move them from the Reception calendar so players are not turned away on the day.
        </p>
      )}
    </>
  );
}

function SportCard({ sport }: { sport: SportRow }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const upcoming = sport.courts.reduce((n, c) => n + c.upcomingBookings, 0);
  return (
    <section className="surface !p-0 overflow-hidden" aria-label={sport.name}>
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-200">
          <Image src={sport.image} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{sport.name}</h3>
            <StatusBadge tone={STATUS_TONE[sport.status]}>{STATUS_LABEL[sport.status]}</StatusBadge>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{sport.statusNote && sport.status !== "ACTIVE" ? sport.statusNote : sport.description}</p>
          <p className="mt-1 text-xs text-slate-400">{sport.courts.length} court{sport.courts.length === 1 ? "" : "s"} · {upcoming} upcoming booking{upcoming === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} aria-expanded={editing}><Pencil size={14} />Edit sport</Button>
          <Button size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Plus size={14} />Add court</Button>
        </div>
      </div>
      {editing && <div className="border-b border-slate-200 bg-slate-50/60 p-5"><SportForm sport={sport} onDone={() => setEditing(false)} /></div>}
      {adding && <div className="border-b border-slate-200 bg-slate-50/60 p-5"><CourtForm sport={{ id: sport.id, name: sport.name, courts: sport.courts.length, rate: sport.courts[0]?.hourlyPaise }} onDone={() => setAdding(false)} /></div>}
      {sport.courts.length ? (
        <ul className="divide-y divide-slate-100">{sport.courts.map((court) => <CourtItem key={court.id} court={court} sportName={sport.name} sportStatus={sport.status} />)}</ul>
      ) : (
        <div className="p-5"><EmptyState title="No courts yet">Add a court so players can start booking {sport.name}.</EmptyState></div>
      )}
    </section>
  );
}

type CourtSport = { id: string; name: string; courts: number; rate?: number };
function CourtForm({ sport, court, onDone }: { sport: CourtSport; court?: CourtRow; onDone: () => void }) {
  const mutation = useFacilityAction(onDone);
  const [status, setStatus] = useState<Status>(court?.status ?? "ACTIVE");
  const id = court?.id ?? `new-${sport.id}`;
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const hourlyPaise = Math.round(Number(f.get("rate")) * 100);
        const name = String(f.get("name")).trim() || undefined;
        const indoor = f.get("indoor") === "on";
        mutation.mutate(court ? { action: "updateCourt", id: court.id, name, hourlyPaise, indoor, status, statusNote: String(f.get("statusNote") ?? "") } : { action: "createCourt", sportId: sport.id, name, hourlyPaise, indoor });
      }}
    >
      <h4 className="text-sm font-semibold sm:col-span-2">{court ? `Edit ${court.name}` : `Add a ${sport.name} court`}</h4>
      <div>
        <label htmlFor={`court-name-${id}`}>Court name{court ? "" : " (optional)"}</label>
        <Input id={`court-name-${id}`} name="name" className="mt-2" minLength={2} maxLength={60} required={!!court} defaultValue={court?.name} placeholder={`${sport.name} ${sport.id === "cricket" ? "Net" : "Court"} ${sport.courts + 1}`} />
      </div>
      <div>
        <label htmlFor={`court-rate-${id}`}>Hourly rate · ₹ (guest price)</label>
        <Input id={`court-rate-${id}`} name="rate" type="number" min={0} max={1000000} step={1} required className="mt-2" defaultValue={court ? court.hourlyPaise / 100 : sport.rate !== undefined ? sport.rate / 100 : 500} />
      </div>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="indoor" defaultChecked={court?.indoor} className="size-4 accent-orange-600" />
        Indoor court
      </label>
      {court && <StatusFields idPrefix={`court-${court.id}`} status={status} onStatus={setStatus} note={court.statusNote} label="Court status" upcoming={court.upcomingBookings} />}
      <div className="sm:col-span-2">
        <Problem error={mutation.error} />
        <div className="mt-3 flex gap-3">
          <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : court ? "Save court" : "Add court"}</Button>
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

function CourtItem({ court, sportName, sportStatus }: { court: CourtRow; sportName: string; sportStatus: Status }) {
  const [editing, setEditing] = useState(false);
  const toggle = useFacilityAction();
  const effective: Status = court.status !== "ACTIVE" ? court.status : sportStatus === "ACTIVE" ? "ACTIVE" : sportStatus;
  return (
    <li className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{court.name}</p>
            <StatusBadge tone={STATUS_TONE[effective]}>{court.status === "ACTIVE" && sportStatus !== "ACTIVE" ? `Sport ${STATUS_LABEL[sportStatus].toLowerCase()}` : STATUS_LABEL[court.status]}</StatusBadge>
            <StatusBadge tone="info">{court.indoor ? "Indoor" : "Outdoor"}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {money(court.hourlyPaise)} / hour · {court.upcomingBookings} upcoming booking{court.upcomingBookings === 1 ? "" : "s"}
            {court.statusNote && court.status !== "ACTIVE" ? ` · ${court.statusNote}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {court.status === "ACTIVE" ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} title="Open the editor to set a maintenance note"><Wrench size={14} />Maintenance</Button>
          ) : court.status === "MAINTENANCE" ? (
            <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ action: "updateCourt", id: court.id, status: "ACTIVE" })}><CheckCircle2 size={14} />Reopen court</Button>
          ) : (
            <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ action: "updateCourt", id: court.id, status: "ACTIVE" })}>Restore court</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} aria-expanded={editing}><Pencil size={14} />Edit</Button>
        </div>
      </div>
      <Problem error={toggle.error} />
      {editing && <div className="mt-4 rounded-lg bg-slate-50 p-5"><CourtForm sport={{ id: court.sportId, name: sportName, courts: 0 }} court={court} onDone={() => setEditing(false)} /></div>}
    </li>
  );
}
