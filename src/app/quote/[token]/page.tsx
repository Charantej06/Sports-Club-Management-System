import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, date } from "@/lib/utils";
import { termLabel } from "@/modules/membership/terms";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Your membership quote", robots: { index: false, follow: false } };

// The page behind the link in a quote email. The unguessable token is the only key; no account is needed to read it.
export default async function Quote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{20,64}$|^[a-z0-9]{20,40}$/.test(token)) notFound();
  const [quote, session] = await Promise.all([
    db.leadQuote.findUnique({ where: { token }, include: { lead: { select: { name: true, email: true } } } }),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!quote) notFound();
  const snap = quote.snapshot as { name: string; months?: number; durationDays: number; courtDiscountBps: number; shopDiscountBps: number; foodDiscountBps: number; freeSessionsWeek: number };
  const expired = quote.validUntil < new Date();
  const perks = [`${snap.courtDiscountBps / 100}% off court bookings`, `${snap.shopDiscountBps / 100}% off at The Champions Shop`, `${snap.foodDiscountBps / 100}% off at the clubhouse`, ...(snap.freeSessionsWeek ? [`${snap.freeSessionsWeek} complimentary sessions every week`] : []), "Your personal digital club card"];
  return (
    <section className="site-width max-w-3xl py-16 md:py-24">
      <p className="eyebrow mb-5 text-orange-400">Your quote</p>
      <h1 className="section-title">Hi {quote.lead.name.split(" ")[0]}, here&apos;s your {snap.name} membership.</h1>
      <div className="mt-10 rounded-xl border border-white/15 bg-white/5 p-8">
        <p className="text-sm text-neutral-400">{termLabel(snap.months, snap.durationDays)}</p>
        <p className="mt-2 text-5xl font-medium tracking-tight">{money(quote.totalPaise)}</p>
        <p className={`mt-3 text-sm ${expired ? "text-red-400" : "text-neutral-400"}`}>{expired ? `This quote expired on ${date(quote.validUntil)}. Contact us for a fresh one.` : `Valid until ${date(quote.validUntil)}. The final price is confirmed when you join.`}</p>
        <ul className="mt-8 space-y-3 text-sm text-neutral-200">
          {perks.map((perk) => (
            <li key={perk} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-orange-400" aria-hidden="true" />{perk}</li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          {session ? (
            <Button asChild size="lg"><Link href="/memberships">Choose my membership</Link></Button>
          ) : (
            <>
              <Button asChild size="lg"><Link href={`/signup?email=${encodeURIComponent(quote.lead.email)}`}>Create my account to join</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/login">I already have an account</Link></Button>
            </>
          )}
          <Button asChild size="lg" variant="ghost"><Link href="/book">Look around first</Link></Button>
        </div>
      </div>
      <p className="soft-text mt-6 text-sm">Questions? Reply to the email we sent, or call the front desk. We&apos;re happy to help you pick a plan.</p>
    </section>
  );
}
