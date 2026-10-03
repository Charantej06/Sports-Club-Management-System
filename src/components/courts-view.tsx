"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
type Availability = { id: string; name: string; indoor: boolean; hourlyPaise: number; slots: { hour: number; available: boolean }[] }[];
export function CourtsView({ data, initialSport, trial }: { data: Awaited<ReturnType<typeof publicData>>; initialSport: string; trial: boolean }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.settings.timezone }).format(new Date());
  const max = new Date(+new Date(today) + data.settings.bookingWindowDays * 86400000).toISOString().slice(0,10);
  const [sport, setSport] = useState(initialSport);
  const [day, setDay] = useState(today);
  const selected = data.sports.find(s => s.id === sport)!;
  const availability = useQuery({ queryKey: ["availability", sport, day], queryFn: () => api<Availability>(`/api/public/availability?sport=${sport}&date=${day}`), refetchInterval: 30000, enabled: !!day });
  return <section className="site-width py-16 md:py-20"><p className="eyebrow mb-5 text-orange-400">{trial ? "Try something new" : "Make time for your game"}</p><h1 className="display-title max-w-6xl">A court.<br/>A fresh start.</h1><p className="soft-text mt-6 max-w-xl text-sm">Choose your sport and explore one-hour sessions. All sessions start on the hour, in the club&apos;s local time.</p><nav className="my-10 flex flex-wrap gap-3" aria-label="Choose sport">{data.sports.map(s => <Button key={s.id} variant={sport === s.id ? "default" : "outline"} onClick={() => setSport(s.id)} aria-pressed={sport === s.id}>{s.name}</Button>)}</nav><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><div className="relative h-72 overflow-hidden rounded"><Image src={selected.image} fill alt={selected.name} sizes="(max-width:1023px) 100vw, 35vw" className="object-cover"/></div><h2 className="mt-6 text-2xl">{selected.name}, your way.</h2><p className="soft-text mt-4 text-sm">{selected.description}</p><p className="notice mt-7">Schedule preview. Online bookings and trial-session checkout arrive in stage two. Contact the front desk to arrange a session.</p><Button asChild className="mt-5" variant="outline"><Link href="/#contact">Ask about a session<ArrowUpRight size={16}/></Link></Button></div><div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><label htmlFor="court-date">Session date</label><Input id="court-date" className="mt-2 max-w-52 [color-scheme:dark]" type="date" min={today} max={max} value={day} onChange={e => setDay(e.target.value)}/></div><p className="text-xs text-neutral-500">{data.settings.timezone} · 60 minute sessions</p></div>{availability.isPending && <div className="skeleton h-64" role="status" aria-label="Loading availability"/>}{availability.error && <p role="alert" className="field-error">{availability.error.message}</p>}<div className="space-y-6">{availability.data?.map(court => <article key={court.id} className="rounded border border-white/15 p-6"><div className="flex justify-between gap-4"><div><h3>{court.name}</h3><p className="mt-2 text-xs text-neutral-500">{court.indoor ? "Indoor" : "Outdoor"} · {money(court.hourlyPaise)} / hour before membership benefits</p></div></div><div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6">{court.slots.map(slot => <span key={slot.hour} title={slot.available ? "Available in preview; booking is not enabled" : "Unavailable or elapsed"} className={`rounded border p-2 text-center text-xs ${slot.available ? "border-white/20 text-white" : "border-white/5 text-neutral-600 line-through"}`}>{slot.hour.toString().padStart(2,"0")}:00<span className="sr-only"> {slot.available ? "available" : "unavailable"}</span></span>)}</div></article>)}</div><p className="mt-5 text-xs text-neutral-500">Availability refreshes every 30 seconds. A displayed slot is not a reservation.</p></div></div></section>;
}
