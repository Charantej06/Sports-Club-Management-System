"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { CartLink } from "./cart";

export function ClubMark({ className }: { className?: string }) {
  return <svg className={className} width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M10 5H29L25 12H14L8 24H20L24 17H32L25 31H0L10 5Z" fill="currentColor"/><path d="M31 3L35 3L32 9H28L31 3Z" fill="currentColor"/></svg>;
}

const navigation = [
  { href: "/", label: "Home" },
  { href: "/book", label: "Book a Court" },
  { href: "/memberships", label: "Memberships" },
  { href: "/shop", label: "The Champions Shop" },
  { href: "/clubhouse", label: "Clubhouse" },
];

export function SiteHeader({ name, staff }: { name?: string; staff?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = navigation.findIndex(item => item.href === "/" ? path === "/" : path === item.href || path.startsWith(`${item.href}/`));

  const moveHighlight = (index: number) => {
    const link = links.current[index];
    if (link) setHighlight({ left: link.offsetLeft, width: link.offsetWidth });
  };

  useEffect(() => {
    const update = () => {
      const link = links.current[activeIndex];
      setHighlight(link ? { left: link.offsetLeft, width: link.offsetWidth } : null);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex]);

  return <header className="site-header"><div className="site-width header-inner">
    <Link href="/" className="header-brand" aria-label="Champions Club home"><ClubMark className="text-orange-500"/><span className="brand-wordmark">CHAMPIONS<span>CLUB</span></span></Link>
    <nav className="liquid-nav" aria-label="Main navigation" onPointerLeave={() => moveHighlight(activeIndex)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) moveHighlight(activeIndex); }}>
      <span className="liquid-nav-highlight" aria-hidden="true" style={highlight ? { left: highlight.left, width: highlight.width, opacity: 1 } : undefined}/>
      {navigation.map((item, index) => <Link key={item.href} href={item.href} ref={element => { links.current[index] = element; }} onPointerEnter={() => moveHighlight(index)} onFocus={() => moveHighlight(index)} aria-current={activeIndex === index ? "page" : undefined} className="liquid-nav-link">{item.label}</Link>)}
    </nav>
    <div className="header-actions"><CartLink/><Link href="/account" className="header-account">{name ? `${name.split(" ")[0]}'s Account` : "My Account"}<ArrowUpRight size={16}/></Link>{staff && <Link className="header-staff" href="/staff">Staff desk</Link>}
      <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button className="header-menu" aria-label="Open navigation"><Menu size={24}/></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/70"/><Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/15 bg-[#111] p-7 text-white"><Dialog.Title className="text-2xl font-semibold">Champions Club</Dialog.Title><Dialog.Description className="mt-2 text-sm text-neutral-400">Your club. One place.</Dialog.Description><Dialog.Close className="absolute right-5 top-6 p-2" aria-label="Close navigation"><X/></Dialog.Close><nav className="mt-10 flex flex-col gap-1" aria-label="Mobile navigation">{[...navigation, { href: "/account", label: "My Account" }, ...(staff ? [{ href: "/staff", label: "Staff desk" }] : [])].map(item => <Link key={item.href} className="border-b border-white/10 py-5 text-lg" href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}</nav></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
  </div></header>;
}
