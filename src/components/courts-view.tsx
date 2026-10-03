"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAction, Feedback, CheckoutHold, type Json } from "./operations-ui";
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
  holdUntil: string;
  invoiceId: string;
  priceSnapshot: { plan: string };
};
const displayHour = (hour: number) => `${hour === 12 ? 12 : hour % 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
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
  const [sport, setSport] = useState(initialSport),
    [day, setDay] = useState(today),
    [expandedCourtId, setExpandedCourtId] = useState<string | null>(null),
    [hold, setHold] = useState<{
      area: "booking" | "social";
      hold: Hold;
      eventId?: string;
    } | null>(null);
  const action = useAction();
  const selected = data.sports.find((s) => s.id === sport)!;
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
  const reserve = (courtId: string, hour: number) =>
    action.mutate(
      { area: "booking", input: { courtId, day, hour, trial } },
      {
        onSuccess: (d) =>
          setHold({ area: "booking", hold: d as unknown as Hold }),
      },
    );
  return (
    <section className="booking-page">
      <div className="booking-hero">
      <video className="booking-hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true"><source src="/videos/booking.mp4" type="video/mp4" /></video><div className="booking-hero-scrim" />
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
        {trial ? "Your introductory trial uses the same booking checkout." : ""}
      </p>
      </div></div>
      <div className="site-width booking-content">
      <nav className="booking-sport-selection" aria-label="Choose sport">
        <div><p className="eyebrow text-orange-600">Choose your sport</p><h2>What are you playing?</h2></div><div className="flex flex-wrap gap-3">
        {data.sports.map((s) => (
          <Button
            key={s.id}
            variant={sport === s.id ? "default" : "outline"}
            className="booking-sport-button"
            onClick={() => { setSport(s.id); setExpandedCourtId(null); }}
            aria-pressed={sport === s.id}
          >
            {s.name}
          </Button>
        ))}
      </div></nav>
      {hold && <CheckoutHold {...hold} onDone={() => setHold(null)} />}
      <Feedback action={action} />
      {action.error?.message.includes("sign in") && (
        <Link href="/login" className="text-orange-500 underline">
          Sign in to book →
        </Link>
      )}
      <div className="booking-sport-summary">
          <div className="relative h-64 overflow-hidden rounded-[20px] md:h-72">
            <Image
              src={selected.image}
              fill
              alt={selected.name}
              sizes="(max-width:1023px) 100vw, 35vw"
              className="object-cover"
            />
          </div>
          <div className="booking-sport-copy"><p className="eyebrow text-orange-600">{selected.courts.length} courts available</p><h2 className="mt-3 text-3xl text-[#1e1b17]">{selected.name}, your way.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#625d55]">{selected.description}</p></div>
      </div>
      <p className="booking-notice">
            {data.settings.dailySessionLimit} sessions per club day, including social play. Checkout places a
            temporary hold. Confirmed cancellation requires {data.settings.cancellationHours} hours of notice;
            reception can help with exceptions.
          </p>
          <Link
            href="/account"
            className="mt-6 inline-block text-orange-700 text-sm font-medium"
          >
            Manage bookings & waiting-list offers →
          </Link>
      <section className="mt-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-orange-600">Choose a court</p><h2 className="mt-3 text-3xl text-[#1e1b17]">Find your hour.</h2></div><p className="text-xs text-[#6b655d]">Asia/Kolkata · 60 minute sessions</p></div>
          {availability.isPending && <p role="status">Loading sessions…</p>}
          {availability.error && (
            <p role="alert" className="field-error">
              {availability.error.message}
            </p>
          )}
          <div className="space-y-6">
            {availability.data?.map((c) => {
              const expanded = expandedCourtId === c.id;
              return (
              <article
                key={c.id}
                className={`booking-court ${expanded ? "is-expanded" : ""}`}
              >
                <button className="booking-court-trigger" onClick={() => setExpandedCourtId(expanded ? null : c.id)} aria-expanded={expanded} aria-controls={`court-booking-${c.id}`}><span><span className="booking-court-type">{c.indoor ? "Indoor court" : "Outdoor court"}</span><h3>{c.name}</h3><p>{money(c.hourlyPaise)} / hour before benefits</p></span><span className="booking-court-cta">{expanded ? "Close" : "Choose a time"} <span aria-hidden="true">↓</span></span></button>
                <div id={`court-booking-${c.id}`} className="booking-court-details" hidden={!expanded}>
                  <div className="booking-date-row"><div><label htmlFor={`court-date-${c.id}`}>Choose a session date</label><Input id={`court-date-${c.id}`} className="booking-date-input mt-2" type="date" min={today} max={max} value={day} onChange={(e) => setDay(e.target.value)}/></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setDay(today)}>Today</Button><Button size="sm" variant="outline" onClick={() => setDay(new Date(+new Date(today) + 86400000).toISOString().slice(0, 10))}>Tomorrow</Button></div></div>
                <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {c.slots.filter((s) => s.hour >= 13 && s.hour <= 23).map((s) => (
                    <button
                      key={s.hour}
                      disabled={action.isPending || !!s.reason || s.elapsed}
                      aria-label={`${c.name}, ${day}, ${String(s.hour).padStart(2, "0")}:00, ${s.elapsed ? "session started" : s.reason ? "closed" : s.available ? "book" : "join waiting list"}`}
                      title={
                        (s.elapsed ? "This session has started." : s.reason) ||
                        (s.available
                          ? "Hold this session"
                          : "Join waiting list")
                      }
                      className={`booking-slot ${s.available ? "is-available" : ""}`}
                      onClick={() =>
                        s.available
                          ? reserve(c.id, s.hour)
                          : action.mutate({
                              area: "waiting",
                              input: { courtId: c.id, day, hour: s.hour },
                            })
                      }
                    >
                      {displayHour(s.hour)}
                      <span className="mt-1 block text-[9px]">
                        {s.elapsed
                          ? "Started"
                          : s.reason
                          ? "Closed"
                          : s.available
                            ? "Book"
                            : "Wait list"}
                      </span>
                    </button>
                  ))}
                  </div>
                {c.slots.some((s) => s.reason) && (
                  <p className="mt-4 text-xs text-orange-700">
                    Closure: {c.slots.find((s) => s.reason)?.reason}. Choose
                    another available court or hour above.
                  </p>
                )}</div>
              </article>
            )})}
          </div>
          <p className="mt-5 text-xs text-[#6b655d]">
            Availability refreshes every five seconds. Confirm checkout to
            reserve.
          </p>
      </section>
      <section className="booking-social mt-16">
        <h2 className="text-3xl text-[#1e1b17]">Friday social play</h2>
        <p className="mt-4 text-sm text-[#625d55]">
          One court, a shared game. Reserve your place or join the waiting list
          when it is full.
        </p>
        {social.isPending && <p className="mt-6" role="status">Loading social sessions…</p>}
        {social.error && <p className="field-error mt-6" role="alert">{social.error.message}</p>}
        {social.data && !social.data.length && (
          <p className="mt-6 text-sm text-[#6b655d]">
            Friday sessions appear when reception opens registration.
          </p>
        )}
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {social.data?.map((e) => (
            <article
              className="booking-social-card space-y-4"
              key={e.id}
            >
              <h3>
                {e.title} · {e.court.name}
              </h3>
              <p className="text-sm">
                {new Date(e.startsAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} · {e.remaining}/
                {e.capacity} places
              </p>
              <p className="text-xs text-[#6b655d]">
                {money(e.pricePaise)} before benefits
              </p>
              <Button
                disabled={action.isPending}
                onClick={() =>
                  e.remaining
                    ? action.mutate(
                        { area: "social", id: e.id, input: { action: "join" } },
                        {
                          onSuccess: (d) =>
                            setHold({
                              area: "social",
                              eventId: e.id,
                              hold: d as unknown as Hold,
                            }),
                        },
                      )
                    : action.mutate({
                        area: "waiting",
                        input: {
                          courtId: e.court.id,
                          eventId: e.id,
                          day: new Intl.DateTimeFormat("en-CA", {
                            timeZone: "Asia/Kolkata",
                          }).format(new Date(e.startsAt)),
                          hour: Number(
                            new Intl.DateTimeFormat("en-GB", {
                              hour: "numeric",
                              hourCycle: "h23",
                              timeZone: "Asia/Kolkata",
                            }).format(new Date(e.startsAt)),
                          ),
                        },
                      })
                }
              >
                {e.remaining
                  ? "Reserve social place"
                  : "Join social waiting list"}
              </Button>
            </article>
          ))}
        </div>
      </section></div>
    </section>
  );
}
