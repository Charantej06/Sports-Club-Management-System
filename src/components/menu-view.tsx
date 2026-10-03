"use client";
import { useState } from "react";
import { money } from "@/lib/utils";
import type { publicData } from "@/modules/public/queries";
import { Button } from "./ui/button";
export function MenuView({ menu }: { menu: Awaited<ReturnType<typeof publicData>>["menu"] }) {
  const [category, setCategory] = useState("All");
  const filtered = menu.filter(m => category === "All" || m.category === category);
  return <><nav className="mb-10 flex flex-wrap gap-3" aria-label="Menu categories">{["All", ...new Set(menu.map(m => m.category))].map(c => <Button variant={c === category ? "default" : "outline"} key={c} onClick={() => setCategory(c)} aria-pressed={c === category}>{c}</Button>)}</nav><div className="grid gap-x-14 md:grid-cols-2">{filtered.map(item => <article key={item.id} className="flex justify-between gap-6 border-b border-white/10 py-7"><div><div className="flex items-center gap-3"><span title={item.vegetarian ? "Vegetarian" : "Non-vegetarian"} aria-label={item.vegetarian ? "Vegetarian" : "Non-vegetarian"} className={`size-2 rounded-full ${item.vegetarian ? "bg-emerald-400" : "bg-amber-400"}`}/><h3 className="text-sm">{item.name}</h3></div><p className="mt-3 text-xs text-neutral-500">{item.description}</p>{!item.available && <p className="mt-3 text-xs text-orange-300">Currently unavailable</p>}</div><p className="text-sm text-neutral-300">{money(item.pricePaise)}</p></article>)}</div><p className="mt-6 text-xs text-neutral-500">Green: vegetarian · Amber: non-vegetarian · Bar service for ages 21+, subject to local policy.</p></>;
}
