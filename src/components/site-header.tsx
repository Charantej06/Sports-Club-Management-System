"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { CartLink } from "./cart";
import { cn } from "@/lib/utils";
export function ClubMark({ className }: { className?: string }) {
  return <svg className={className} width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M10 5H29L25 12H14L8 24H20L24 17H32L25 31H0L10 5Z" fill="currentColor"/><path d="M31 3L35 3L32 9H28L31 3Z" fill="currentColor"/></svg>;
}
const navigation = [{ href: "/", label: "Home" }, { href: "/book", label: "Book a Court" }, { href: "/memberships", label: "Memberships" }, { href: "/shop", label: "The Champions Shop" }, { href: "/clubhouse", label: "Clubhouse" }];
export function SiteHeader({ name, staff }: { name?: string; staff?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="site-width flex h-22 items-center justify-between gap-6">
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Champions Club home"><ClubMark className="text-orange-500"/><span className="brand-wordmark">CHAMPIONS<span>CLUB</span></span></Link>
    <nav className="hidden items-center gap-7 xl:flex" aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={path === item.href ? "page" : undefined} className={cn("nav-link", path === item.href && "active")}>{item.label}</Link>)}</nav>
    <div className="flex items-center gap-4"><CartLink/><Link href="/account" className="hidden items-center gap-2 text-sm font-medium sm:flex">{name ? `${name.split(" ")[0]}'s Account` : "My Account"}<ArrowUpRight size={16}/></Link>{staff && <Link className="hidden text-xs text-orange-400 sm:block" href="/staff">Staff desk</Link>}
      <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button className="rounded-md p-2 xl:hidden" aria-label="Open navigation"><Menu size={24}/></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/70"/><Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/15 bg-[#111] p-7 text-white"><Dialog.Title className="text-2xl font-semibold">Champions Club</Dialog.Title><Dialog.Description className="mt-2 text-sm text-neutral-400">Your club. One place.</Dialog.Description><Dialog.Close className="absolute right-5 top-6 p-2" aria-label="Close navigation"><X/></Dialog.Close><nav className="mt-10 flex flex-col gap-1" aria-label="Mobile navigation">{[...navigation, { href: "/account", label: "My Account" }, ...(staff ? [{ href: "/staff", label: "Staff desk" }] : [])].map(item => <Link key={item.href} className="border-b border-white/10 py-5 text-lg" href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}</nav></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
  </div></header>;
}
