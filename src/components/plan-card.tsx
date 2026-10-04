import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { money } from "@/lib/utils";
import { TERM_LABELS, TERM_MONTHS, termDiscountBps, termPrice, type TermMonths } from "@/modules/membership/terms";
import { Button } from "./ui/button";
export type PlanView = { id: string; name: string; description: string; pricePaise: number; quarterDiscountBps: number; annualDiscountBps: number; courtDiscountBps: number; shopDiscountBps: number; foodDiscountBps: number; freeSessionsWeek: number; juniorOnly: boolean; planVersion: string };

/** Three-way term chooser shared by the plan cards and checkout. */
export function TermPicker({ plans, value, onChange, dark = true }: { plans: PlanView[]; value: TermMonths; onChange: (months: TermMonths) => void; dark?: boolean }) {
  const best = (months: TermMonths) => Math.max(0, ...plans.map(p => termDiscountBps(p, months))) / 100;
  return (
    <div role="radiogroup" aria-label="Membership term" className={`inline-grid grid-cols-3 gap-1 rounded-full border p-1 ${dark ? "border-white/15 bg-white/5" : "border-neutral-200 bg-neutral-100"}`}>
      {TERM_MONTHS.map(months => {
        const selected = value === months;
        const saving = best(months);
        return (
          <button key={months} type="button" role="radio" aria-checked={selected} onClick={() => onChange(months)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-6 ${selected ? "bg-orange-500 text-black" : dark ? "text-neutral-300 hover:bg-white/10" : "text-neutral-700 hover:bg-white"}`}>
            {TERM_LABELS[months]}
            {saving > 0 && <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-black/70" : "text-orange-400"}`}>Save {saving}%</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PlanCard({ plan, months = 1, children }: { plan: PlanView; months?: TermMonths; children?: React.ReactNode }) {
  const price = termPrice(plan, months);
  return (
    <article className={`plan-card ${plan.id === "gold" ? "gold" : ""} flex h-full flex-col`}>
      <div className="flex items-center justify-between"><h3 className="text-2xl font-medium">{plan.name}</h3>{plan.id === "gold" && <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">All in</span>}</div>
      <p className="mt-3 text-sm text-neutral-400">{plan.description}</p>
      <p className="mb-1 mt-8 text-4xl font-medium tracking-tight">{money(price.totalPaise)}</p>
      <p className="text-xs text-neutral-500">{months === 1 ? "for 1 month" : months === 12 ? "for 12 months" : `for ${months} months`} · taxes included</p>
      <p className="mt-2 min-h-5 text-xs font-medium text-orange-400">
        {price.discountPaise > 0 ? `${money(price.monthlyEquivalentPaise)} a month · you save ${money(price.discountPaise)}` : `${money(plan.pricePaise)} a month`}
      </p>
      <div className="my-7 h-px bg-white/10"/>
      <ul className="mb-9 flex-1 space-y-4 text-sm text-neutral-300">{[`${plan.courtDiscountBps / 100}% off court bookings`, `${plan.shopDiscountBps / 100}% off at The Champions Shop`, `${plan.foodDiscountBps / 100}% off at the clubhouse`, plan.freeSessionsWeek ? `${plan.freeSessionsWeek} complimentary sessions per week` : "Access to every sport at the club", plan.juniorOnly ? "For players under 18" : "Your personal digital club card"].map(text => <li key={text} className="flex gap-3"><Check size={16} className="shrink-0 text-orange-400"/>{text}</li>)}</ul>
      {children || <Button asChild variant={plan.id === "gold" ? "default" : "outline"}><Link href={`/memberships?plan=${plan.id}`}>Explore {plan.name}<ArrowUpRight size={16}/></Link></Button>}
    </article>
  );
}
