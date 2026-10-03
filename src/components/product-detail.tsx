"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Package, Truck } from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { addCart, CartLink } from "./cart";
import { Button } from "./ui/button";
export function ProductDetail({ product }: { product: Awaited<ReturnType<typeof publicData>>["products"][number] }) {
  const [added,setAdded]=useState(false);
  const [variant, setVariant] = useState(product.variants[0]);
  return <section className="site-width py-14 md:py-20"><Link className="text-xs text-neutral-500" href="/shop">← The Champions Shop</Link><div className="mt-8 grid gap-12 md:grid-cols-2"><div className="relative aspect-square overflow-hidden rounded-lg bg-[#e7e5de]"><Image src={product.image} alt={product.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-contain p-12"/></div><div className="self-center"><p className="eyebrow mb-5 text-orange-400">{product.category} · {product.sport === "all" ? "Club essentials" : product.sport}</p><h1 className="section-title max-w-xl">{product.name}</h1><p className="mt-7 text-3xl">{money(variant.pricePaise)}</p><p className="soft-text mt-7 text-sm">{product.description}</p><p className="mb-3 mt-7 text-xs text-neutral-500">Choose your variant</p><div className="flex flex-wrap gap-3">{product.variants.map(v => <Button key={v.id} variant={v.id === variant.id ? "default" : "outline"} aria-pressed={v.id === variant.id} onClick={() => setVariant(v)} size="sm">{v.label}</Button>)}</div><p className="mt-5 flex items-center gap-2 text-xs text-neutral-400"><Check size={14} className="text-orange-400"/>{variant.available ? `${variant.available} available` : "Currently sold out"}</p><Button disabled={!variant.available} className="mt-8 w-full" onClick={()=>{addCart(variant.id);setAdded(true);}}>Add to cart</Button>{added&&<p role="status" className="mt-4 text-sm text-orange-400">Added to your cart. <CartLink/></p>}<div className="mt-7 flex flex-wrap gap-6 text-xs text-neutral-500"><span className="flex items-center gap-2"><Package size={15}/>Club pickup</span><span className="flex items-center gap-2"><Truck size={15}/>Delivery</span></div><p className="mt-7 text-xs leading-relaxed text-neutral-400">Membership discounts follow the benefits saved with your purchased plan. Explore memberships to compare shop benefits.</p></div></div></section>;
}
