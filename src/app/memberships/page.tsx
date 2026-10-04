import Image from "next/image";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { publicData } from "@/modules/public/queries";
import { gatewayConfigured } from "@/modules/billing/gateway";
import { MembershipOptions } from "@/components/membership-options";
import { EnquiryForm } from "@/components/enquiry-form";

export const metadata = { title: "Memberships" };

export default async function Memberships() {
  const [data, session] = await Promise.all([publicData(), auth.api.getSession({ headers: await headers() })]);
  const localMode = process.env.PAYMENT_MODE === "local";
  const gateway = gatewayConfigured();
  const testMode = gateway && (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");

  return (
    <div className="relative isolate min-h-[calc(100svh-88px)] overflow-hidden">
      {/* Sports turf background with progressive blur (crisp top, smooth blurred bottom) */}
      <div className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden" aria-hidden="true">
        {/* Crisp base layer - sharp near top */}
        <Image
          src="/images/membership-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover object-center"
        />
        {/* Blurred overlay transitioning in towards the cards */}
        <div
          className="absolute inset-0"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, transparent 15%, black 50%, black 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, transparent 15%, black 50%, black 100%)",
          }}
        >
          <Image
            src="/images/membership-bg.png"
            alt=""
            fill
            sizes="100vw"
            className="scale-105 object-cover object-center filter blur-[6px]"
          />
        </div>
        {/* Dark overlay: lighter near top so turf is vivid, deepening towards cards and bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[#0b0b0b]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b]/60 via-transparent to-[#0b0b0b]" />
      </div>

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
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="text-base font-medium text-white">A term that works for you.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Renew anytime. Your next term starts when your current term ends. Your prices and benefits are saved when you purchase.
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="text-base font-medium text-white">One membership, every corner.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Court benefits apply to eligible sessions. Shop and clubhouse benefits apply at checkout. Complimentary sessions reset each club week.
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="text-base font-medium text-white">Clear policies. Better play.</h2>
            <p className="soft-text mt-3 text-neutral-400">
              Plan changes begin immediately without proration. Junior eligibility is checked at the term start. Court and retail benefits apply automatically to your confirmed purchases.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-10 border-t border-white/10 pt-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-medium">Not sure which plan fits?</h2>
            <p className="soft-text mt-4 max-w-sm text-sm">Tell us how you like to play and we&apos;ll recommend a plan, send you a quote and answer any questions. No account needed.</p>
          </div>
          <EnquiryForm sports={data.sports} interest="MEMBERSHIP" askInterest={false} defaultMessage="I'd like a recommendation for the right membership plan." submitLabel="Get a quote" />
        </div>

        <p className="notice mt-10">
          {localMode
            ? "Local demo: membership purchases use simulated payments. Receipts clearly identify the payment source."
            : gateway
              ? testMode
                ? "Payments are processed securely by Razorpay in test mode: no real money moves. Receipts are emailed to you."
                : "Payments are processed securely by Razorpay. Your receipt is emailed to you."
              : "Online payments are awaiting configuration. Contact reception for membership enquiries."}
        </p>
      </section>
    </div>
  );
}
