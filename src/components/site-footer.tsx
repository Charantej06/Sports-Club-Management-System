import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ClubMark } from "./site-header";
export function SiteFooter() {
  return <footer className="border-t border-white/12 bg-[#0b0b0b] py-12"><div className="site-width"><div className="flex flex-wrap items-start justify-between gap-10"><Link href="/" className="flex items-center gap-3"><ClubMark className="text-orange-500"/><span className="brand-wordmark">CHAMPIONS<span>CLUB</span></span></Link><p className="max-w-xs text-sm leading-relaxed text-neutral-400">Good games. Great company.<br/>A club you&apos;ll keep coming back to.</p><div className="flex gap-8 text-sm"><Link href="/memberships">Join the club <ArrowUpRight className="inline" size={14}/></Link><Link href="/#contact">Get in touch</Link></div></div><div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-6 text-xs text-neutral-500"><span>© {new Date().getFullYear()} Champions Club. Play your way.</span><span>Built for the Odoo hackathon · Bengaluru, India</span></div></div></footer>;
}
