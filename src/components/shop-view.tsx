"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Search, Package, Truck, BadgePercent } from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { addCart } from "./cart";

type Products = Awaited<ReturnType<typeof publicData>>["products"];

export function ShopView({ products }: { products: Products }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [sport, setSport] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = products.filter(
    (p) =>
      (sport === "all" || p.sport === sport) &&
      (category === "all" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Shop hero */}
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#0c0c0c] py-16 md:py-24">
        {/* The image remains visible while the video loads and when motion is reduced. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden"
          aria-hidden="true"
        >
          <Image
            src="/images/shop-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover object-center filter blur-[1px]"
          />
          <video
            className="shop-background-video absolute inset-0 h-full w-full object-cover object-center"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/images/shop-bg.png"
          >
            <source src="/videos/storevid.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 35% 35%, transparent 20%, rgba(0, 0, 0, 0.6) 65%, #0b0b0b 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0b0b] to-transparent" />
        </div>

        <div className="site-width relative z-10">
          <p className="eyebrow mb-5 text-neutral-300">The Champions Shop</p>
          <div className="flex flex-wrap items-end justify-between gap-7">
            <h1 className="display-title max-w-6xl text-white">
              Game-changing
              <br />
              essentials.
            </h1>
            <p className="soft-text max-w-xs text-sm text-neutral-200">
              From your first racket to your favourite kit. A considered
              collection for every kind of player.
            </p>
          </div>

          {/* Clean, high-contrast filter buttons without ugly orange */}
          <nav
            className="mb-7 mt-12 flex flex-wrap gap-3"
            aria-label="Filter products by sport"
          >
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
              <Search
                className="absolute left-4 top-4 text-neutral-400"
                size={16}
              />
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
                {[...new Set(products.map((p) => p.category))]
                  .sort()
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="shop-light">
        <div className="shop-service-strip">
          <span>
            <Package size={18} /> Collect at your club
          </span>
          <span>
            <Truck size={18} /> Delivery to your door
          </span>
          <span>
            <BadgePercent size={18} /> Member savings at checkout
          </span>
        </div>
        <div className="site-width py-12 md:py-16">
          <div className="shop-catalogue-heading">
            <div>
              <h2>Built for your game.</h2>
              <p>Everyday training. Match-day performance. Find your kit.</p>
            </div>
            <Link href="/shop/cart" className="shop-text-link">
              View your cart
            </Link>
          </div>
          <div className="shop-catalogue-layout">
            <aside
              className="shop-category-rail"
              aria-label="Browse categories"
            >
              <h3>Shop by category</h3>
              {["all", ...new Set(products.map((p) => p.category))].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c === "all" ? "All essentials" : c}
                  <span>
                    {
                      products.filter(
                        (p) =>
                          (c === "all" || p.category === c) &&
                          (sport === "all" || p.sport === sport),
                      ).length
                    }
                  </span>
                </button>
              ))}
              <div className="shop-member-note">
                <BadgePercent size={26} />
                <h3>Your membership goes further.</h3>
                <p>Your club benefits are applied automatically at checkout.</p>
                <Link href="/memberships">Explore memberships</Link>
              </div>
            </aside>
            <div>
              <div className="shop-results-bar">
                <p aria-live="polite">{filtered.length} products</p>
                <span>
                  {sport === "all"
                    ? "All sports"
                    : sport[0].toUpperCase() + sport.slice(1)}
                </span>
              </div>
              {!filtered.length && (
                <div className="py-16">
                  <p>No products match your search.</p>
                  <button
                    className="shop-text-link mt-4"
                    onClick={() => {
                      setCategory("all");
                      setSport("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <p role="status" className="shop-cart-notice">
                {notice}
              </p>
              <div className="shop-product-grid">
                {filtered.map((p) => {
                  const available =
                    p.variants.find((v) => v.id === selected[p.id]) ||
                    p.variants.find((v) => v.available > 0);
                  return (
                    <article key={p.id} className="shop-product-card">
                      <Link
                        href={`/shop/${p.id}`}
                        className="shop-product-photo"
                        tabIndex={-1}
                      >
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="(max-width:640px) 50vw, (max-width:1100px) 33vw, 25vw"
                          className="object-contain"
                        />
                        {p.featured && (
                          <span className="shop-product-tag">
                            Club favourite
                          </span>
                        )}
                      </Link>
                      <div className="shop-product-info">
                        <p className="shop-product-category">{p.category}</p>
                        <Link
                          href={`/shop/${p.id}`}
                          className="shop-product-link"
                        >
                          <h3>{p.name}</h3>
                        </Link>
                        <strong>
                          {money(
                            Math.min(...p.variants.map((v) => v.pricePaise)),
                          )}
                        </strong>
                        <p className="shop-stock">
                          <span className={available ? "is-available" : ""} />
                          {available ? "Available now" : "Sold out"}
                        </p>
                        <div className="shop-card-controls">
                          {p.variants.length > 1 && (
                            <label className="shop-variant-label">
                              {p.category === "Apparel" ||
                              p.category === "Shoes"
                                ? "Size"
                                : "Variant"}
                              <select
                                aria-label={`Choose variant for ${p.name}`}
                                value={available?.id || ""}
                                onChange={(e) =>
                                  setSelected({
                                    ...selected,
                                    [p.id]: e.target.value,
                                  })
                                }
                              >
                                {p.variants.map((v) => (
                                  <option
                                    key={v.id}
                                    value={v.id}
                                    disabled={!v.available}
                                  >
                                    {v.label}
                                    {!v.available ? " · sold out" : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <div className="shop-card-actions">
                            <Button
                              variant="outline"
                              disabled={!available?.available}
                              onClick={() => {
                                if (!available) return;
                                addCart(available.id);
                                setNotice(`${p.name} added to your cart.`);
                              }}
                            >
                              Add to cart
                            </Button>
                            <Button
                              disabled={!available?.available}
                              onClick={() => {
                                if (!available) return;
                                addCart(available.id);
                                router.push("/shop/cart");
                              }}
                            >
                              Buy now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
