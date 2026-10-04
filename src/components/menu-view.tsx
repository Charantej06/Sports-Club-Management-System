"use client";
import { useState } from "react";
import Image from "next/image";
import { money } from "@/lib/utils";
import type { publicData } from "@/modules/public/queries";
import { Button } from "./ui/button";
export function MenuView({ menu }: { menu: Awaited<ReturnType<typeof publicData>>["menu"] }) {
  const [category, setCategory] = useState("All");
  const filtered = menu.filter(m => category === "All" || m.category === category);
  return <><nav className="mb-10 flex flex-wrap gap-3" aria-label="Menu categories">{["All", ...new Set(menu.map(m => m.category))].map(c => <Button variant={c === category ? "default" : "outline"} key={c} onClick={() => setCategory(c)} aria-pressed={c === category}>{c}</Button>)}</nav><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <article key={item.id} className="overflow-hidden rounded border border-white/10 bg-[#111]"><div className="relative aspect-[4/3] bg-neutral-900">{item.image && <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition-transform duration-500 hover:scale-[1.03]"/>}</div><div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><span title={item.vegetarian ? "Vegetarian" : "Non-vegetarian"} aria-label={item.vegetarian ? "Vegetarian" : "Non-vegetarian"} className={`size-2 shrink-0 rounded-full ${item.vegetarian ? "bg-emerald-400" : "bg-amber-400"}`}/><h3 className="text-sm font-medium">{item.name}</h3></div><p className="mt-3 text-xs leading-5 text-neutral-500">{item.description}</p>{!item.available && <p className="mt-3 text-xs text-orange-300">Currently unavailable</p>}</div><p className="shrink-0 text-sm text-neutral-200">{money(item.pricePaise)}</p></div></div></article>)}</div><p className="mt-6 text-xs text-neutral-500">Green: vegetarian · Amber: non-vegetarian · Bar service for ages 21+, subject to local policy.</p></>;
}
