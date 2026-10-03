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
  slots: { hour: number; available: boolean; reason: string | null }[];
}[];
type Hold = {
  id: string;
  pricePaise: number;
  holdUntil: string;
  invoiceId: string;
  priceSnapshot: { plan: string };
};
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
    <section className="site-width py-16 md:py-20">
      <p className="eyebrow mb-5 text-orange-400">
        {trial ? "Try something new" : "Make time for your game"}
      </p>
      <h1 className="display-title max-w-6xl">
        A court.
        <br />A fresh start.
      </h1>
      <p className="soft-text mt-6 max-w-xl text-sm">
        Choose your sport and a one-hour session. Membership benefits apply at
        the session date.{" "}
        {trial ? "Your introductory trial uses the same booking checkout." : ""}
      </p>
      <nav className="my-10 flex flex-wrap gap-3" aria-label="Choose sport">
        {data.sports.map((s) => (
          <Button
            key={s.id}
            variant={sport === s.id ? "default" : "outline"}
            onClick={() => setSport(s.id)}
            aria-pressed={sport === s.id}
          >
            {s.name}
          </Button>
        ))}
      </nav>
      {hold && <CheckoutHold {...hold} onDone={() => setHold(null)} />}
      <Feedback action={action} />
      {action.error?.message.includes("sign in") && (
        <Link href="/login" className="text-orange-500 underline">
          Sign in to book →
        </Link>
      )}
      <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
        <div>
          <div className="relative h-72 overflow-hidden rounded">
            <Image
              src={selected.image}
              fill
              alt={selected.name}
              sizes="(max-width:1023px) 100vw, 35vw"
              className="object-cover"
            />
          </div>
          <h2 className="mt-6 text-2xl">{selected.name}, your way.</h2>
          <p className="soft-text mt-4 text-sm">{selected.description}</p>
          <p className="notice mt-7">
            {data.settings.dailySessionLimit} sessions per club day, including social play. Checkout places a
            temporary hold. Confirmed cancellation requires {data.settings.cancellationHours} hours of notice;
            reception can help with exceptions.
          </p>
          <Link
            href="/account"
            className="mt-6 inline-block text-orange-500 text-sm"
          >
            Manage bookings & waiting-list offers →
          </Link>
        </div>
        <div>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <label htmlFor="court-date">Session date</label>
              <Input
                id="court-date"
                className="mt-2 max-w-52 [color-scheme:dark]"
                type="date"
                min={today}
                max={max}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDay(today)}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDay(
                      new Date(+new Date(today) + 86400000)
                        .toISOString()
                        .slice(0, 10),
                    )
                  }
                >
                  Tomorrow
                </Button>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Asia/Kolkata · 60 minute sessions
            </p>
          </div>
          {availability.isPending && <p role="status">Loading sessions…</p>}
          {availability.error && (
            <p role="alert" className="field-error">
              {availability.error.message}
            </p>
          )}
          <div className="space-y-6">
            {availability.data?.map((c) => (
              <article
                key={c.id}
                className="rounded border border-white/15 p-6"
              >
                <h3>{c.name}</h3>
                <p className="mt-2 text-xs text-neutral-500">
                  {c.indoor ? "Indoor" : "Outdoor"} · {money(c.hourlyPaise)} /
                  hour before benefits
                </p>
                <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {c.slots.map((s) => (
                    <button
                      key={s.hour}
                      disabled={action.isPending || !!s.reason}
                      title={
                        s.reason ||
                        (s.available
                          ? "Hold this session"
                          : "Join waiting list")
                      }
                      className={`min-h-11 rounded border p-2 text-center text-xs ${s.available ? "border-white/20 hover:border-orange-500" : "border-white/5 text-neutral-500"}`}
                      onClick={() =>
                        s.available
                          ? reserve(c.id, s.hour)
                          : action.mutate({
                              area: "waiting",
                              input: { courtId: c.id, day, hour: s.hour },
                            })
                      }
                    >
                      {String(s.hour).padStart(2, "0")}:00
                      <span className="mt-1 block text-[9px]">
                        {s.reason
                          ? "Closed"
                          : s.available
                            ? "Book"
                            : "Wait list"}
                      </span>
                    </button>
                  ))}
                </div>
                {c.slots.some((s) => s.reason) && (
                  <p className="mt-4 text-xs text-orange-300">
                    Closure: {c.slots.find((s) => s.reason)?.reason}. Choose
                    another available court or hour above.
                  </p>
                )}
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-neutral-500">
            Availability refreshes every five seconds. Confirm checkout to
            reserve.
          </p>
        </div>
      </div>
      <section className="mt-16 border-t border-white/10 pt-10">
        <h2 className="text-3xl">Friday social play</h2>
        <p className="soft-text mt-4 text-sm">
          One court, a shared game. Reserve your place or join the waiting list
          when it is full.
        </p>
        {!social.data?.length && (
          <p className="mt-6 text-sm text-neutral-500">
            Friday sessions appear when reception opens registration.
          </p>
        )}
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {social.data?.map((e) => (
            <article
              className="rounded border border-white/15 p-6 space-y-4"
              key={e.id}
            >
              <h3>
                {e.title} · {e.court.name}
              </h3>
              <p className="text-sm">
                {new Date(e.startsAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} · {e.remaining}/
                {e.capacity} places
              </p>
              <p className="text-xs text-neutral-500">
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
      </section>
    </section>
  );
}
