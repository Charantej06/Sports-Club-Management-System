"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type Products = Awaited<ReturnType<typeof publicData>>["products"];

export function ShopView({ products }: { products: Products }) {
  const [sport, setSport] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = products.filter(
    (p) =>
      (sport === "all" || p.sport === sport) &&
      (category === "all" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Hero section with sports retail background */}
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#0c0c0c] py-16 md:py-24">
        {/* Background store image with atmospheric dark overlay */}
        <div className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden" aria-hidden="true">
          <Image
            src="/images/shop-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover object-center filter blur-[1px]"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 35% 35%, transparent 20%, rgba(0, 0, 0, 0.6) 65%, #0b0b0b 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0b0b] to-transparent" />
        </div>

        <div className="site-width relative z-10">
          <p className="eyebrow mb-5 text-neutral-300">The Champions Shop</p>
          <div className="flex flex-wrap items-end justify-between gap-7">
            <h1 className="display-title max-w-6xl text-white">
              Game-changing<br />essentials.
            </h1>
            <p className="soft-text max-w-xs text-sm text-neutral-200">
              From your first racket to your favourite kit. A considered collection for every kind of player.
            </p>
          </div>

          {/* Clean, high-contrast filter buttons without ugly orange */}
          <nav className="mb-7 mt-12 flex flex-wrap gap-3" aria-label="Filter products by sport">
            {["all", "tennis", "padel", "badminton", "cricket"].map((s) => (
              <Button
                key={s}
                variant={s === sport ? "secondary" : "outline"}
                className={
                  s === sport
                    ? "bg-white text-black font-semibold border-white hover:bg-neutral-200 shadow-md"
                    : "border-white/25 bg-black/60 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
                }
                onClick={() => setSport(s)}
                aria-pressed={s === sport}
              >
                {s === "all" ? "All gear" : s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </nav>

          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row">
            <div className="relative min-w-0 max-w-md flex-1">
              <label className="sr-only" htmlFor="shop-search">
                Search products
              </label>
              <Search className="absolute left-4 top-4 text-neutral-400" size={16} />
              <Input
                id="shop-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 border-white/20 bg-black/65 text-white placeholder:text-neutral-400 backdrop-blur-sm focus:border-white"
                placeholder="Find your next essential"
              />
            </div>
            <div className="w-full sm:w-52 sm:shrink-0">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Product category"
                className="border-white/20 bg-black/65 text-white backdrop-blur-sm focus:border-white"
              >
                <option value="all">All categories</option>
                {[...new Set(products.map((p) => p.category))].sort().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Product Catalog Grid */}
      <section className="site-width py-12 md:py-16">
        <p className="mb-6 text-xs text-neutral-400">
          {filtered.length} essentials · membership benefits apply at checkout
        </p>
        {!filtered.length && (
          <p className="soft-text py-16">
            No gear matches that search. Try another sport or category.
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Link key={p.id} href={`/shop/${p.id}`} className="group">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[#e7e5de]">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width:640px) 50vw, 25vw"
                  className="object-contain p-5 transition-transform duration-700 group-hover:scale-105"
                />
                <ArrowUpRight
                  className="absolute right-4 top-4 text-black/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  size={18}
                />
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-widest text-neutral-400">
                {p.category}
              </p>
              <h2 className="mt-2 text-sm text-white font-medium">{p.name}</h2>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                <span className="font-semibold text-white">
                  {money(Math.min(...p.variants.map((v) => v.pricePaise)))}
                </span>
                <span className="text-neutral-400">
                  {p.variants.some((v) => v.available > 0) ? "In stock" : "Sold out"}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="notice mt-12">
          Choose your kit, add it to the cart, then select club pickup or delivery. Your account keeps orders and receipts together.
        </p>
      </section>
    </div>
  );
}
