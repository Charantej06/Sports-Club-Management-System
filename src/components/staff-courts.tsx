"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Filter,
  RefreshCw,
  Sun,
  Home,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type {
  ScheduleResult,
  CourtSlotView,
  CourtScheduleView,
} from "@/modules/staff/courts";

const getKolkataToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

export function StaffCourts({ role }: { role: string }) {
  const [day, setDay] = useState(getKolkataToday());
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "AVAILABLE" | "BOOKED" | "HOLD" | "CLOSED"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    slot: CourtSlotView;
    court: CourtScheduleView;
  } | null>(null);

  const canManageCourts = ["OWNER", "RECEPTION"].includes(role);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["staff-courts", day, sportFilter],
    queryFn: () =>
      api<ScheduleResult>(
        `/api/staff/courts?day=${day}${sportFilter !== "all" ? `&sport=${sportFilter}` : ""}`,
      ),
    refetchInterval: 5000,
  });

  const updateCourtMutation = useMutation({
    mutationFn: (data: { id: string; active?: boolean; hourlyPaise?: number }) =>
      api("/api/staff/courts", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-courts"] });
    },
  });

  const jumpTo = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDay(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d),
    );
  };

  const schedule = query.data;

  // Filter courts by search and slot status
  const displayedCourts = useMemo(() => {
    if (!schedule?.courts) return [];
    return schedule.courts.filter((c) => {
      if (
        searchQuery.trim() &&
        !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.sportName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (statusFilter !== "all") {
        const hasSlotWithStatus = c.slots.some((s) => s.status === statusFilter);
        if (!hasSlotWithStatus) return false;
      }
      return true;
    });
  }, [schedule?.courts, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="surface">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Facility Management
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Courts & Slot Availability
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Inspect real-time court availability, booked slots, holds, and
              closures. Add new courts or toggle operational status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              title="Refresh schedule"
              className="gap-2"
            >
              <RefreshCw
                size={14}
                className={query.isFetching ? "animate-spin" : ""}
              />
              Refresh
            </Button>
            {canManageCourts && (
              <Button
                onClick={() => setIsAddingCourt((prev) => !prev)}
                className="gap-2"
              >
                <Plus size={16} />
                {isAddingCourt ? "Close form" : "Add new court"}
              </Button>
            )}
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Date:</span>
          </div>
          <Input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-auto font-medium"
          />
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={day === getKolkataToday() ? "default" : "outline"}
              size="sm"
              onClick={() => jumpTo(0)}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => jumpTo(1)}
            >
              Tomorrow
            </Button>
          </div>
          <div className="ml-auto text-xs text-slate-500">
            Schedule timezone: <strong>Asia/Kolkata</strong>
          </div>
        </div>
      </div>

      {/* Add New Court Drawer */}
      {isAddingCourt && canManageCourts && (
        <AddCourtForm
          sports={schedule?.sports || []}
          onSuccess={() => {
            setIsAddingCourt(false);
            queryClient.invalidateQueries({ queryKey: ["staff-courts"] });
          }}
          onCancel={() => setIsAddingCourt(false)}
        />
      )}

      {/* KPI Stats Row */}
      {schedule && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="surface report-summary">
            <span className="report-summary-label">Total Courts</span>
            <strong className="report-summary-value">
              {schedule.stats.totalCourts}
            </strong>
            <span className="mt-2 block text-xs text-slate-500">
              {schedule.stats.activeCourts} active ·{" "}
              {schedule.stats.totalCourts - schedule.stats.activeCourts} inactive
            </span>
          </div>
          <div className="surface report-summary">
            <span className="report-summary-label">Booked & Held Slots</span>
            <strong className="report-summary-value text-slate-900">
              {schedule.stats.bookedSlots}
            </strong>
            <span className="mt-2 block text-xs text-slate-500">
              Out of {schedule.stats.totalSlots} total hourly slots
            </span>
          </div>
          <div className="surface report-summary">
            <span className="report-summary-label">Available Slots</span>
            <strong className="report-summary-value text-emerald-700">
              {schedule.stats.availableSlots}
            </strong>
            <span className="mt-2 block text-xs text-slate-500">
              Open for customer and walk-in reservations
            </span>
          </div>
          <div className="surface report-summary">
            <span className="report-summary-label">Day Occupancy Rate</span>
            <strong className="report-summary-value">
              {schedule.stats.occupancyRate}%
            </strong>
            <div className="report-utilization-track mt-3">
              <span
                style={{
                  width: `${Math.min(100, schedule.stats.occupancyRate)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Sport Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-slate-500">
              Sport:
            </span>
            <button
              onClick={() => setSportFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                sportFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Sports ({schedule?.stats.totalCourts ?? 0})
            </button>
            {schedule?.sports.map((s) => {
              const count =
                schedule.courts.filter((c) => c.sportId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSportFilter(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    sportFilter === s.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Slot Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              aria-label="Filter slots by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "all"
                    | "AVAILABLE"
                    | "BOOKED"
                    | "HOLD"
                    | "CLOSED",
                )
              }
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <option value="all">All Slot Statuses</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="BOOKED">Booked Only</option>
              <option value="HOLD">On Hold Only</option>
              <option value="CLOSED">Closed Only</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search court name (e.g. Court 1, Net 2)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Slot key:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-emerald-300 bg-emerald-100" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-slate-800" />
          Booked (Confirmed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-amber-300 bg-amber-200" />
          On Hold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-red-200 bg-red-100" />
          Closed / Maintenance
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          (Past sessions are marked accordingly)
        </span>
      </div>

      {/* Main Schedule Content */}
      {query.isPending && (
        <div className="surface text-center py-12">
          <RefreshCw size={24} className="mx-auto animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-600 font-medium">
            Loading court schedules…
          </p>
        </div>
      )}

      {query.error && (
        <div className="surface border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <strong className="text-base">Unable to load court schedule</strong>
          </div>
          <p className="mt-2 text-sm text-red-600">{query.error.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      )}

      {schedule && displayedCourts.length === 0 && (
        <div className="surface text-center py-12">
          <Layers size={36} className="mx-auto text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-800">
            No courts match your filters
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your sport filter, status filter, or search query.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSportFilter("all");
              setStatusFilter("all");
              setSearchQuery("");
            }}
            className="mt-4"
          >
            Reset all filters
          </Button>
        </div>
      )}

      {/* Court Schedule Cards */}
      {displayedCourts.map((court) => (
        <div
          key={court.id}
          className={`surface space-y-4 transition-all ${
            !court.active ? "opacity-75 bg-slate-50/70" : ""
          }`}
        >
          {/* Court Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900">{court.name}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {court.sportName}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {court.indoor ? (
                  <>
                    <Home size={11} /> Indoor
                  </>
                ) : (
                  <>
                    <Sun size={11} /> Outdoor
                  </>
                )}
              </span>
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                {money(court.hourlyPaise)} / hr
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  court.active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {court.active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                <strong>{court.stats.bookedSlots}</strong> /{" "}
                {court.stats.totalSlots} booked ({court.stats.occupancyPercent}%)
              </span>
              {canManageCourts && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateCourtMutation.isPending}
                  onClick={() =>
                    updateCourtMutation.mutate({
                      id: court.id,
                      active: !court.active,
                    })
                  }
                  className="text-xs"
                >
                  {court.active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          </div>

          {/* Slots Timeline Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {court.slots.map((slot) => {
              const isAvailable = slot.status === "AVAILABLE";
              const isBooked = slot.status === "BOOKED";
              const isHold = slot.status === "HOLD";
              const isClosed = slot.status === "CLOSED";

              return (
                <button
                  key={slot.hour}
                  type="button"
                  onClick={() => {
                    if (slot.booking || slot.closure) {
                      setSelectedSlot({ slot, court });
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all ${
                    isBooked
                      ? "border-slate-700 bg-slate-900 text-white shadow-sm hover:border-slate-500"
                      : isHold
                        ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                        : isClosed
                          ? "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
                          : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"
                  } ${slot.isElapsed ? "opacity-60" : ""}`}
                >
                  {/* Slot Top: Time */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{slot.displayTime}</span>
                    {slot.isElapsed && (
                      <span className="text-[10px] font-normal text-slate-400">
                        Past
                      </span>
                    )}
                  </div>

                  {/* Slot Center: Status / Title */}
                  <div className="my-2 min-h-8">
                    {isAvailable && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>Available</span>
                      </div>
                    )}
                    {isBooked && (
                      <div>
                        <p className="truncate text-xs font-bold text-white">
                          {slot.booking?.customerName}
                        </p>
                        <p className="truncate text-[10px] text-slate-300">
                          {slot.booking?.kind === "SOCIAL"
                            ? "Social play"
                            : "Standard booking"}
                        </p>
                      </div>
                    )}
                    {isHold && (
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                          <Clock size={12} className="shrink-0" />
                          <span>On Hold</span>
                        </div>
                        <p className="truncate text-[10px] text-amber-900">
                          {slot.booking?.customerName}
                        </p>
                      </div>
                    )}
                    {isClosed && (
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-red-800">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>Closed</span>
                        </div>
                        <p className="truncate text-[10px] text-red-700">
                          {slot.closure?.reason || "Maintenance"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Slot Bottom: Additional Details */}
                  <div className="flex items-center justify-between border-t border-slate-100/30 pt-1.5 text-[10px]">
                    <span className="text-slate-400">
                      {String(slot.hour).padStart(2, "0")}:00
                    </span>
                    {isBooked && slot.booking?.checkedIn && (
                      <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                        Checked in
                      </span>
                    )}
                    {isAvailable && (
                      <span className="font-semibold text-slate-600">
                        ₹{court.hourlyPaise / 100}
                      </span>
                    )}
                    {(isBooked || isHold || isClosed) && (
                      <span className="text-[10px] underline opacity-70 group-hover:opacity-100">
                        View
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Slot Details Modal Dialog */}
      {selectedSlot && (
        <SlotDetailModal
          data={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}

function AddCourtForm({
  sports,
  onSuccess,
  onCancel,
}: {
  sports: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [sportId, setSportId] = useState(sports[0]?.id || "tennis");
  const [name, setName] = useState("");
  const [rupees, setRupees] = useState("800");
  const [indoor, setIndoor] = useState(false);
  const [active, setActive] = useState(true);
  const [customId, setCustomId] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      sportId: string;
      hourlyPaise: number;
      indoor: boolean;
      active: boolean;
      id?: string;
    }) =>
      api("/api/staff/courts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create court.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsedRupees = Number(rupees);
    if (isNaN(parsedRupees) || parsedRupees < 0) {
      setError("Please enter a valid hourly rate.");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      sportId,
      hourlyPaise: Math.round(parsedRupees * 100),
      indoor,
      active,
      id: customId.trim() ? customId.trim() : undefined,
    });
  };

  return (
    <div className="surface border-2 border-slate-300 bg-slate-50/50 p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Add New Court to Club Facilities
          </h3>
          <p className="text-xs text-slate-500">
            Configure court specifications, sport discipline, and hourly rate.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="size-8 p-0"
        >
          <X size={16} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Court Name */}
          <div>
            <label
              htmlFor="court-name"
              className="block text-xs font-semibold text-slate-700"
            >
              Court Name *
            </label>
            <Input
              id="court-name"
              type="text"
              placeholder="e.g. Centre Court, Court 4, Glass Net 3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              className="mt-1"
            />
          </div>

          {/* Sport Selection */}
          <div>
            <label
              htmlFor="court-sport"
              className="block text-xs font-semibold text-slate-700"
            >
              Sport Discipline *
            </label>
            <select
              id="court-sport"
              value={sportId}
              onChange={(e) => {
                setSportId(e.target.value);
                if (e.target.value === "tennis") setRupees("800");
                if (e.target.value === "padel") setRupees("1200");
                if (e.target.value === "badminton") {
                  setRupees("500");
                  setIndoor(true);
                }
                if (e.target.value === "cricket") setRupees("600");
              }}
              required
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm"
            >
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hourly Rate */}
          <div>
            <label
              htmlFor="court-rate"
              className="block text-xs font-semibold text-slate-700"
            >
              Hourly Rate (₹ Rupees) *
            </label>
            <Input
              id="court-rate"
              type="number"
              min={0}
              step={10}
              value={rupees}
              onChange={(e) => setRupees(e.target.value)}
              required
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Equals{" "}
              <strong>
                {Math.round((Number(rupees) || 0) * 100).toLocaleString(
                  "en-IN",
                )}{" "}
                paise
              </strong>{" "}
              per 1-hour session.
            </span>
          </div>

          {/* Custom ID */}
          <div>
            <label
              htmlFor="court-id"
              className="block text-xs font-semibold text-slate-700"
            >
              Custom ID (Optional)
            </label>
            <Input
              id="court-id"
              type="text"
              placeholder="e.g. padel-3 (leave empty to auto-generate)"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              pattern="^[a-zA-Z0-9-]+$"
              className="mt-1 font-mono text-xs"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Only letters, numbers, and hyphens. Auto-generated if blank.
            </span>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-6 border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={indoor}
              onChange={(e) => setIndoor(e.target.checked)}
              className="size-4 rounded border-slate-300 accent-slate-900"
            />
            <span>Indoor facility</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-slate-300 accent-slate-900"
            />
            <span>Active (available for bookings immediately)</span>
          </label>
        </div>

        {error && (
          <p className="field-error rounded bg-red-50 p-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? "Creating court…" : "Create Court"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SlotDetailModal({
  data,
  onClose,
}: {
  data: { slot: CourtSlotView; court: CourtScheduleView };
  onClose: () => void;
}) {
  const { slot, court } = data;
  const booking = slot.booking;
  const closure = slot.closure;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Session Details
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              {court.name} · {slot.displayTime}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-50 p-2.5">
              <span className="text-slate-500">Sport:</span>
              <p className="font-semibold text-slate-800">{court.sportName}</p>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <span className="text-slate-500">Hourly Rate:</span>
              <p className="font-semibold text-slate-800">
                {money(court.hourlyPaise)}
              </p>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <span className="text-slate-500">Time Range:</span>
              <p className="font-semibold text-slate-800">{slot.timeRange}</p>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <span className="text-slate-500">Status:</span>
              <p
                className={`font-semibold ${
                  slot.status === "BOOKED"
                    ? "text-slate-900"
                    : slot.status === "HOLD"
                      ? "text-amber-700"
                      : "text-red-700"
                }`}
              >
                {slot.status}
              </p>
            </div>
          </div>

          {booking && (
            <div className="rounded-lg border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Customer Information
                </span>
                {booking.checkedIn && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Checked In
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-slate-900">
                {booking.customerName}
              </p>
              {booking.championsId && (
                <p className="text-xs text-slate-600">
                  Champions ID: <strong>{booking.championsId}</strong>
                </p>
              )}
              {booking.customerEmail && (
                <p className="text-xs text-slate-600">
                  Email: {booking.customerEmail}
                </p>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500">Session Price:</span>
                <span className="font-bold text-slate-900">
                  {money(booking.pricePaise)}
                </span>
              </div>
              {booking.invoiceId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-mono text-slate-700">
                    {booking.invoiceId}
                  </span>
                </div>
              )}
              {slot.status === "HOLD" && booking.holdUntil && (
                <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                  Hold expires at{" "}
                  {new Date(booking.holdUntil).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </div>
              )}
            </div>
          )}

          {closure && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <span className="text-xs font-semibold text-red-800">
                Court Closure Notice
              </span>
              <p className="mt-1 text-sm font-medium text-red-900">
                Reason: {closure.reason}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
