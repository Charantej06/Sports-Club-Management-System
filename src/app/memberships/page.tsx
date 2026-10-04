import { MembershipBackground } from "@/components/membership-background";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { publicData } from "@/modules/public/queries";
import { MembershipOptions } from "@/components/membership-options";

export const metadata = { title: "Memberships" };

export default async function Memberships() {
  const [data, session] = await Promise.all([publicData(), auth.api.getSession({ headers: await headers() })]);
  const localMode = process.env.PAYMENT_MODE === "local";

  return (
    <div className="relative isolate min-h-[calc(100svh-88px)] overflow-hidden">
      <MembershipBackground priority />

      <section className="site-width relative z-10 py-16 md:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
          <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
          Make yourself at home
        </div>
        <h1 className="display-title max-w-6xl">
          Find your kind<br />of membership.
        </h1>
        <p className="soft-text mb-12 mt-7 max-w-xl text-sm">
          More court time. A little extra at the shop. Your favourite table afterwards. One membership brings it all together.
        </p>

        <MembershipOptions plans={data.plans} signedIn={!!session} localMode={localMode} />

        <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 text-sm md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-[#151515] p-6">
            <h2 className="text-base font-medium text-white">A term that works for you.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Renew anytime. Your next term starts when your current term ends. Your prices and benefits are saved when you purchase.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#151515] p-6">
            <h2 className="text-base font-medium text-white">One membership, every corner.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Court benefits apply to eligible sessions. Shop and clubhouse benefits apply at checkout. Complimentary sessions reset each club week.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#151515] p-6">
            <h2 className="text-base font-medium text-white">Clear policies. Better play.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Plan changes begin immediately without proration. Junior eligibility is checked at the term start. Court and retail benefits apply automatically to your confirmed purchases.
            </p>
          </div>
        </div>

      </section>
    </div>
  );
}
