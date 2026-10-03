import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { publicData } from "@/modules/public/queries";
import { MembershipOptions } from "@/components/membership-options";
export const metadata = { title: "Memberships" };
export default async function Memberships() {
  const [data, session] = await Promise.all([publicData(), auth.api.getSession({ headers: await headers() })]);
  const localMode = process.env.PAYMENT_MODE === "local";
  return <section className="site-width py-16 md:py-24"><p className="eyebrow mb-6 text-orange-400">Make yourself at home</p><h1 className="display-title max-w-6xl">Find your kind<br/>of membership.</h1><p className="soft-text mb-12 mt-7 max-w-xl text-sm">More court time. A little extra at the shop. Your favourite table afterwards. One membership brings it all together.</p><MembershipOptions plans={data.plans} signedIn={!!session} localMode={localMode}/><div className="mt-10 grid gap-8 border-t border-white/10 pt-9 text-sm md:grid-cols-3"><div><h2 className="font-medium">A term that works for you.</h2><p className="soft-text mt-3">Renew anytime. Your next term starts when your current term ends. Your prices and benefits are saved when you purchase.</p></div><div><h2 className="font-medium">One membership, every corner.</h2><p className="soft-text mt-3">Court benefits apply to eligible sessions. Shop and clubhouse benefits apply at checkout. Complimentary sessions reset each club week.</p></div><div><h2 className="font-medium">Clear policies. Better play.</h2><p className="soft-text mt-3">Plan changes begin immediately without proration. Junior eligibility is checked at the term start. Court and retail checkout arrive in the next stage.</p></div></div><p className="notice mt-10">{localMode ? "Local demo: membership purchases use simulated payments. Receipts clearly identify the payment source." : "Online payments are awaiting configuration. Contact reception for membership enquiries."}</p></section>;
}
