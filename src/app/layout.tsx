import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Champions Club — Your game. Your people.", template: "%s | Champions Club" }, description: "Tennis, padel, badminton and cricket. A home for every kind of player in Bengaluru." };
export const dynamic = "force-dynamic";
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  return <html lang="en" data-scroll-behavior="smooth"><body><Providers><a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-orange-500 focus:p-3 focus:text-black" href="#main">Skip to content</a><SiteHeader name={session?.user.name} staff={!!session && session.user.role !== "MEMBER"}/><main id="main" className="w-full max-w-full overflow-x-hidden">{children}</main><SiteFooter/></Providers></body></html>;
}
