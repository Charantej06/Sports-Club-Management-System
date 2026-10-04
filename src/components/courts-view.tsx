"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  ArrowRight,
  Info,
} from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAction, CheckoutHold, type Json } from "./operations-ui";
import type { socialList } from "@/modules/operations/queries";

type Availability = {
  id: string;
  name: string;
  indoor: boolean;
  hourlyPaise: number;
  slots: { hour: number; available: boolean; elapsed: boolean; reason: string | null }[];
}[];

type Hold = {
  id: string;
  pricePaise: number;
  totalPaise?: number;
  holdUntil: string;
  invoiceId: string;
  startsAt?: string;
  court?: { name: string };
  title?: string;
  priceSnapshot: { plan: string };
};

type TimeFilter = "all" | "morning" | "afternoon" | "evening";

const displayHour = (hour: number) =>
  `${hour === 12 ? 12 : hour % 12}:00 ${hour >= 12 ? "PM" : "AM"}`;

export function CourtsView({
  data,
  initialSport,
  trial,
}: {
  data: Awaited<ReturnType<typeof publicData>>;
  initialSport: string;
  trial: boolean;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.settings.timezone,
  }).format(new Date());

  const max = new Date(
    +new Date(today) + data.settings.bookingWindowDays * 86400000,
  )
    .toISOString()
    .slice(0, 10);

  const [sport, setSport] = useState(initialSport);
  const [day, setDay] = useState(today);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [attempt, setAttempt] = useState<{ area: "booking" | "social"; id: string; day?: string; hour?: number } | null>(null);
  const [hold, setHold] = useState<{
    area: "booking" | "social";
    hold: Hold;
    eventId?: string;
    courtId?: string;
    day?: string;
    hour?: number;
  } | null>(null);

  const action = useAction();
  const selected = data.sports.find((s) => s.id === sport) || data.sports[0];

  const availability = useQuery({
    queryKey: ["availability", sport, day],
    queryFn: () =>
      api<Availability>(`/api/public/availability?sport=${sport}&date=${day}`),
    refetchInterval: 5000,
    enabled: !!day,
  });

  const social = useQuery({
    queryKey: ["social"],
    queryFn: () =>
      api<Json<Awaited<ReturnType<typeof socialList>>>>(
        "/api/operations/social",
      ),
    refetchInterval: 5000,
  });

  const reserve = (courtId: string, hour: number) => {
    setAttempt({ area: "booking", id: courtId, day, hour });
    action.mutate(
      { area: "booking", input: { courtId, day, hour, trial } },
      {
        onSuccess: (d) =>
          setHold({ area: "booking", courtId, day, hour, hold: d as unknown as Hold }),
      },
    );
  };

  // Generate 7 upcoming day options starting today
  const dayOptions = useMemo(() => {
    return Array.from(
      { length: Math.min(7, data.settings.bookingWindowDays) },
      (_, i) => {
        const d = new Date(+new Date(today) + i * 86400000);
        const iso = d.toISOString().slice(0, 10);
        const dayOfWeek =
          i === 0
            ? "Today"
            : i === 1
              ? "Tomorrow"
              : new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  timeZone: data.settings.timezone,
                }).format(d);
        const dayNum = new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          timeZone: data.settings.timezone,
        }).format(d);
        const month = new Intl.DateTimeFormat("en-US", {
          month: "short",
          timeZone: data.settings.timezone,
        }).format(d);
        return { iso, dayOfWeek, dayNum, month };
      },
    );
  }, [today, data.settings.bookingWindowDays, data.settings.timezone]);

  // Filter slots by chosen time of day
  const filterSlots = (slots: Availability[number]["slots"]) => {
    if (timeFilter === "morning") return slots.filter((s) => s.hour < 12);
    if (timeFilter === "afternoon")
      return slots.filter((s) => s.hour >= 12 && s.hour < 17);
    if (timeFilter === "evening") return slots.filter((s) => s.hour >= 17);
    return slots;
  };

  const formattedSelectedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: data.settings.timezone,
      }).format(new Date(day));
    } catch {
      return day;
    }
  }, [day, data.settings.timezone]);

  return (
    <section className="booking-page min-h-screen bg-white text-neutral-900">
      {/* Hero section with video BG and text in front kept EXACTLY as requested */}
      <div className="booking-hero">
        <video
          className="booking-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/videos/booking.mp4" type="video/mp4" />
        </video>
        <div className="booking-hero-scrim" />
        <div className="site-width booking-hero-content">
          <p className="eyebrow mb-5 text-orange-600">
            {trial ? "Try something new" : "Make time for your game"}
          </p>
          <h1 className="display-title max-w-6xl text-white">
            A court.
            <br />A fresh start.
          </h1>
          <p className="booking-lead mt-6 max-w-xl">
            Choose your sport and a one-hour session. Membership benefits apply at
            the session date.{" "}
            {trial
              ? "Your introductory trial uses the same booking checkout."
              : ""}
          </p>
        </div>
      </div>

      {/* Main Professional White Booking Canvas */}
      <div className="border-t border-neutral-200 bg-[#fafafa] py-12 md:py-16">
        <div className="site-width space-y-12">
          {/* Keep checkout accessible if the customer changes to another sport. */}
          {hold && hold.area === "booking" && !data.sports.find((s) => s.id === sport)?.courts.some((c) => c.id === hold.courtId) && (
            <div>
              <CheckoutHold {...hold} onDone={() => setHold(null)} />
            </div>
          )}

          {/* STEP 1: Sport Selection */}
          <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                  Step 1 · Sport
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                  Select your sport
                </h2>
              </div>
              <p className="text-xs font-medium text-neutral-500">
                Tournament grade indoor and outdoor surfaces
              </p>
            </div>

            {/* Clean Professional Sport Tabs (No Emojis) */}
            <nav className="flex flex-wrap gap-2.5" aria-label="Select Sport">
              {data.sports.map((s) => {
                const isActive = sport === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSport(s.id)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-neutral-950 text-white shadow-xs"
                        : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    <span>{s.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isActive
                          ? "bg-neutral-800 text-neutral-200"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {s.courts.length}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Selected Sport Overview */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 md:p-6">
              <div className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
                <div className="relative h-40 w-full overflow-hidden rounded-lg border border-neutral-200 md:h-44">
                  <Image
                    src={selected.image}
                    fill
                    alt={selected.name}
                    sizes="(max-width:768px) 100vw, 200px"
                    className="object-cover object-center"
                  />
                  <div className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {selected.courts.length} active courts
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-950">
                      {selected.name} Facilities
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      {selected.description}
                    </p>
                  </div>

                  {/* Clean metadata pills (No emojis, no 12-hour cancellation) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 font-medium text-neutral-700">
                      60-Minute Sessions
                    </span>
                    <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 font-medium text-neutral-700">
                      {data.settings.dailySessionLimit} sessions daily quota
                    </span>
                    <Link
                      href="/account"
                      className="ml-auto inline-flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      Manage your bookings <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2: Interactive Date Selection */}
          <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                  Step 2 · Date
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                  Choose session date
                </h2>
              </div>
              <p className="text-xs font-medium text-neutral-500">
                Advance window: {data.settings.bookingWindowDays} days
              </p>
            </div>

            {/* 7-Day Quick Strip & Custom Date Picker */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
                {dayOptions.map((opt) => {
                  const isSelected = day === opt.iso;
                  return (
                    <button
                      key={opt.iso}
                      type="button"
                      onClick={() => setDay(opt.iso)}
                      className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-colors ${
                        isSelected
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider ${
                          isSelected ? "text-neutral-300" : "text-neutral-500"
                        }`}
                      >
                        {opt.dayOfWeek}
                      </span>
                      <span className="my-0.5 text-2xl font-extrabold tracking-tight">
                        {opt.dayNum}
                      </span>
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wider ${
                          isSelected ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      >
                        {opt.month}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Input Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-2.5">
                  <CalendarIcon className="size-4 text-orange-600" />
                  <span className="text-sm font-semibold text-neutral-900">
                    Selected: <strong className="text-neutral-950">{formattedSelectedDate}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <label htmlFor="custom-booking-date" className="text-xs font-medium text-neutral-600">
                    Specific date:
                  </label>
                  <Input
                    id="custom-booking-date"
                    type="date"
                    min={today}
                    max={max}
                    value={day}
                    onChange={(e) => e.target.value && setDay(e.target.value)}
                    className="h-9 w-44 rounded-lg border-neutral-300 bg-white text-xs text-neutral-900 font-medium"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: Court Schedule & Time Slots */}
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                  Step 3 · Availability
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                  Select court and time slot
                </h2>
              </div>

              {/* Visual Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-600" />
                  <span className="text-neutral-700">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                  <span className="text-neutral-400">Unavailable</span>
                </div>
              </div>
            </div>

            {/* Time of Day Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-neutral-600">Filter hours:</span>
              {[
                { id: "all", label: "All Hours" },
                { id: "morning", label: "Morning (6 AM – 12 PM)" },
                { id: "afternoon", label: "Afternoon (12 PM – 5 PM)" },
                { id: "evening", label: "Evening (5 PM – 11 PM)" },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeFilter(tf.id as TimeFilter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    timeFilter === tf.id
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Status notifications */}
            {availability.isPending && (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-44 w-full animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100 p-6"
                  />
                ))}
              </div>
            )}

            {availability.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
                <p className="text-sm font-semibold">Unable to load court schedule</p>
                <p className="mt-1 text-xs">{availability.error.message}</p>
              </div>
            )}

            {/* Courts Grid */}
            {availability.data && availability.data.length === 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
                <p className="text-base font-semibold text-neutral-900">No courts found for this sport</p>
                <p className="mt-1 text-xs text-neutral-500">Please choose another sport or date above.</p>
              </div>
            )}

            <div className="space-y-6">
              {availability.data?.map((c) => {
                const courtSlots = filterSlots(c.slots);
                const openSlots = c.slots.filter((s) => s.available).length;

                return (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md md:p-8"
                  >
                    {/* Court Header with clear price and status */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-xl font-bold tracking-tight text-neutral-950 md:text-2xl">
                            {c.name}
                          </h3>
                          <span
                            className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                              c.indoor
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : "bg-neutral-100 text-neutral-800 border border-neutral-200"
                            }`}
                          >
                            {c.indoor ? "Indoor" : "Outdoor"}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Member tier benefits applied automatically during checkout
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Money clearly visible and prominent */}
                        <div className="text-right">
                          <div className="text-2xl font-extrabold tracking-tight text-neutral-950">
                            {money(c.hourlyPaise)}
                            <span className="text-xs font-semibold text-neutral-500 ml-1">/ hour</span>
                          </div>
                          <span className="text-[11px] font-medium text-neutral-500">Standard rate</span>
                        </div>

                        <div>
                          {openSlots > 0 || (hold?.area === "booking" && hold.courtId === c.id) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                              <span className="size-1.5 rounded-full bg-emerald-600" />
                              {openSlots > 0 ? `${openSlots} ${openSlots === 1 ? "slot" : "slots"} available` : "Slot selected"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Slots Grid */}
                    <div className="mt-6">
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {courtSlots.map((s) => {
                          const isAvailable = s.available;
                          const isCheckoutSlot = hold?.area === "booking" && hold.courtId === c.id && hold.day === day && hold.hour === s.hour;
                          const isPendingSlot = action.isPending && attempt?.area === "booking" && attempt.id === c.id && attempt.day === day && attempt.hour === s.hour;
                          const isSelected = isCheckoutSlot || isPendingSlot;

                          if (isAvailable || isCheckoutSlot) {
                            return (
                              <button
                                key={s.hour}
                                type="button"
                                disabled={action.isPending || !!hold}
                                onClick={() => reserve(c.id, s.hour)}
                                aria-label={`${c.name}, ${day}, ${displayHour(s.hour)}, ${isSelected ? "selected for checkout" : "available to book"}`}
                                aria-pressed={isSelected}
                                className={`group relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${isSelected ? "border-orange-500 bg-orange-50/40 shadow-xs" : "border-neutral-300 bg-white hover:border-orange-500 hover:bg-orange-50/40 hover:shadow-xs active:scale-[0.98]"}`}
                              >
                                <span className={`text-sm font-bold ${isSelected ? "text-orange-950" : "text-neutral-900 group-hover:text-orange-950"}`}>
                                  {displayHour(s.hour)}
                                </span>
                                <span className={`mt-1 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isSelected ? "bg-[#ff6b2c] text-white" : "bg-emerald-100 text-emerald-800 group-hover:bg-[#ff6b2c] group-hover:text-white"}`}>
                                  Book
                                </span>
                              </button>
                            );
                          }

                          return (
                            <div
                              key={s.hour}
                              aria-disabled="true"
                              aria-label={`${c.name}, ${day}, ${displayHour(s.hour)}, unavailable`}
                              className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100/70 p-3 text-center opacity-60"
                            >
                              <span className="text-sm font-medium text-neutral-500">
                                {displayHour(s.hour)}
                              </span>
                              <span className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                                Unavailable
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {courtSlots.length === 0 && (
                        <p className="py-6 text-center text-xs text-neutral-500 font-medium">
                          No sessions scheduled in the selected time window. Switch to &quot;All Hours&quot; above.
                        </p>
                      )}
                      {attempt?.area === "booking" && attempt.id === c.id && action.error && (
                        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
                          <AlertCircle className="size-4 shrink-0 text-orange-600" />
                          <span>{action.error.message}</span>
                          {action.error.message.toLowerCase().includes("sign in") && <Link href="/login" className="font-semibold underline">Sign in to book</Link>}
                        </div>
                      )}
                      {hold?.area === "booking" && hold.courtId === c.id && (
                        <CheckoutHold {...hold} onDone={() => { void availability.refetch().finally(() => setHold(null)); }} />
                      )}
                    </div>

                    {/* Court closure message if any closures occur on this day */}
                    {c.slots.some((s) => s.reason) && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                        <Info className="size-4 shrink-0 text-amber-600" />
                        <span>
                          Notice: {c.slots.find((s) => s.reason)?.reason}. Alternative sessions and courts remain available.
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 font-medium">
              <p>Availability updates automatically every 5 seconds · Asia/Kolkata timezone</p>
              <p>Complete checkout to confirm your booking</p>
            </div>
          </section>

          {/* STEP 4: Friday Social Play Section */}
          <section className="space-y-6 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                  Community Play
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                  Friday social mixers
                </h2>
              </div>
              <p className="text-xs font-medium text-neutral-500">
                Shared court play · Connect with club players & doubles partners
              </p>
            </div>

            {social.isPending && (
              <div className="h-32 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100" />
            )}

            {social.error && (
              <p role="alert" className="text-xs text-red-600">
                {social.error.message}
              </p>
            )}

            {social.data && !social.data.length && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">
                Friday social mixer registration opens weekly on Mondays at reception.
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {social.data?.map((e) => {
                const isFull = e.remaining === 0;
                const capacityPercent = Math.min(
                  100,
                  Math.round(((e.capacity - e.remaining) / e.capacity) * 100),
                );

                return (
                  <article
                    key={e.id}
                    className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-950">{e.title}</h3>
                          <p className="mt-0.5 text-xs text-neutral-500">{e.court.name}</p>
                        </div>
                        {/* Legible price display */}
                        <div className="text-right">
                          <span className="text-xl font-bold text-neutral-950">
                            {money(e.pricePaise)}
                          </span>
                          <p className="text-[11px] text-neutral-500">per person</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                        <Clock className="size-4 text-orange-600" />
                        <span>
                          {new Date(e.startsAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Capacity progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium text-neutral-600">
                          <span>
                            {e.remaining > 0
                              ? `${e.remaining} of ${e.capacity} spots remaining`
                              : "Fully booked"}
                          </span>
                          <span>{capacityPercent}% filled</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full transition-all ${
                              isFull ? "bg-amber-500" : "bg-emerald-600"
                            }`}
                            style={{ width: `${capacityPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <Button
                        className={`w-full font-bold transition-all ${
                          !isFull
                            ? "bg-[#ff6b2c] text-white hover:bg-orange-600 shadow-xs"
                            : "border border-neutral-200 bg-neutral-100 text-neutral-500"
                        }`}
                        disabled={action.isPending || isFull}
                        onClick={() => {
                          setAttempt({ area: "social", id: e.id });
                          action.mutate(
                                { area: "social", id: e.id, input: { action: "join" } },
                                {
                                  onSuccess: (d) =>
                                    setHold({
                                      area: "social",
                                      eventId: e.id,
                                      hold: d as unknown as Hold,
                                    }),
                                },
                              );
                        }}
                      >
                        {e.remaining ? "Book" : "Unavailable"}
                      </Button>
                      {attempt?.area === "social" && attempt.id === e.id && action.error && (
                        <p role="alert" className="mt-3 text-sm text-orange-900">{action.error.message}</p>
                      )}
                      {hold?.area === "social" && hold.eventId === e.id && (
                        <CheckoutHold {...hold} onDone={() => setHold(null)} />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
