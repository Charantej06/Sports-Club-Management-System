"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { money } from "@/lib/utils";

type Catalogue = { sports: { id: string; name: string }[] };
type Availability = { id: string; name: string; hourlyPaise: number; maintenance: boolean; slots: { hour: number; minute: number; available: boolean }[] }[];
const label = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** "What is free?": the answer for someone on the phone or at the counter, one tap away from a booking. */
export function FreeSlots({ day, onPick }: { day: string; onPick: (courtId: string, time: string) => void }) {
  const [sportChoice, setSport] = useState("");
  const catalogue = useQuery({ queryKey: ["club-sports"], queryFn: () => api<Catalogue>("/api/public"), staleTime: 60000 });
  const sports = catalogue.data?.sports ?? [];
  const sport = sportChoice || sports[0]?.id || "";
  const free = useQuery({
    queryKey: ["availability", sport, day],
    queryFn: () => api<Availability>(`/api/public/availability?sport=${sport}&date=${day}`),
    enabled: !!sport,
    refetchInterval: 5000,
  });
  return (
    <div className="surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">What&apos;s free on {day}?</h3>
          <p className="mt-1 text-xs text-slate-500">Live. Tap a time to fill the booking form below.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sport">
          {sports.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sport}
              onClick={() => setSport(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${s.id === sport ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {free.isPending && sport && <p role="status" className="mt-4 text-sm text-slate-500">Checking courts…</p>}
      {free.error && <p role="alert" className="field-error mt-4">{free.error.message}</p>}
      <div className="mt-4 space-y-4">
        {free.data?.map((court) => {
          const open = court.slots.filter((s) => s.available);
          return (
            <div key={court.id}>
              <p className="text-sm font-medium text-slate-900">
                {court.name} <span className="font-normal text-slate-500">· {money(court.hourlyPaise)}/hour · {court.maintenance ? "under maintenance" : `${open.length} free`}</span>
              </p>
              {!court.maintenance && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {open.length === 0 && <span className="text-xs text-slate-500">Fully booked for this day.</span>}
                  {open.map((s) => (
                    <button
                      key={`${s.hour}-${s.minute}`}
                      type="button"
                      onClick={() => onPick(court.id, label(s.hour, s.minute))}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 hover:border-orange-500 hover:bg-orange-50"
                      aria-label={`${court.name} at ${label(s.hour, s.minute)}: fill booking form`}
                    >
                      {label(s.hour, s.minute)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
