"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Sun, Users, Coffee } from "lucide-react";
import type { publicData } from "@/modules/public/queries";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { PlanCard } from "./plan-card";
import { EnquiryForm } from "./enquiry-form";
import { LandingHero } from "./landing-hero";
type Data = Awaited<ReturnType<typeof publicData>>;
gsap.registerPlugin(ScrollTrigger, useGSAP);
const stories = [
  { title: "The post-match plans are part of the game.", text: "A quick rally becomes a long conversation. Finish your session, find your table, and let the good company do the rest.", image: "/images/clubhouse.jpg" },
  { title: "Find a new game. Keep the same feeling.", text: "From a first serve to your first six, there is always another way to play. Four sports, one welcoming club.", image: "/images/cricket.jpg" },
  { title: "Make room for your everyday ritual.", text: "Before work, after school, or just because. A place to put down your phone, pick up your racket, and feel like yourself.", image: "/images/tennis.jpg" },
];
export function Landing({ data }: { data: Data }) {
  const root = useRef<HTMLDivElement>(null);
  const [story, setStory] = useState(0);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>(".scale-image").forEach(element => {
        gsap.fromTo(element, { scale: .8 }, { scale: 1, ease: "none", scrollTrigger: { trigger: element, start: "top 95%", end: "top 40%", scrub: 1 } });
        gsap.to(element, { opacity: .2, ease: "none", scrollTrigger: { trigger: element, start: "bottom 20%", end: "bottom top", scrub: true } });
      });
      ScrollTrigger.create({ trigger: ".gear-section", start: "top 120px", end: "bottom 650px", pin: ".gear-title", pinSpacing: false });
    });
    return () => media.revert();
  }, { scope: root });
  const featured = data.products.filter(p => p.featured).slice(0, 4);
  return <div ref={root}>
    <LandingHero sports={data.sports}/>
    <section id="experience" className="chapter site-width"><div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><h2 className="section-title max-w-3xl">Made for play.<br/>Built for <span className="inline-block h-10 w-24 overflow-hidden rounded-full align-middle md:h-13 md:w-32"><Image src="/images/padel-court.jpg" alt="" width={150} height={70} className="h-full w-full object-cover"/></span> belonging.</h2><p className="soft-text max-w-sm text-sm">Every court, every corner, every little detail.<br/>We&apos;ve made space for the way you like to spend your day.</p></div>
      <div className="facility-grid grid-flow-dense"><Link href="/book" className="image-card scale-image"><Image src="/images/tennis.jpg" alt="Sunlit tennis courts" fill sizes="(max-width:640px) 100vw, 65vw"/><div className="caption"><span className="eyebrow text-white/65">Room to raise your game</span><h3 className="mt-3 text-3xl">Your next great session.</h3><p className="mt-3 max-w-sm text-sm text-white/70">Premium surfaces. Thoughtful lighting.<br/>A little less distraction. A little more play.</p></div></Link><div className="rounded bg-[#191919] p-7"><Sun className="text-orange-400" size={28}/><h3 className="mt-5 text-xl">Play on your time.</h3><p className="mt-3 text-sm text-neutral-400">Early riser or under-the-lights player?<br/>{data.settings.openHour}:00–{data.settings.closeHour}:00, every day.</p></div><div className="rounded bg-[#eeeae3] p-7 text-[#1a1a1a]"><Users className="text-[#b84613]" size={28}/><h3 className="mt-5 text-xl">Good company, included.</h3><p className="mt-3 text-sm text-neutral-600">Shared courts, social Fridays, and a community that welcomes your first game.</p></div></div>
    </section>
    <section className="chapter border-y border-white/10 bg-[#101010]"><div className="site-width"><div className="mb-12 flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow mb-5 text-orange-400">Make it your club</p><h2 className="section-title">More reasons to play.</h2></div><Link className="flex items-center gap-3 text-sm" href="/memberships">Compare memberships<ArrowUpRight size={18}/></Link></div><div className="grid gap-5 md:grid-cols-3">{data.plans.map(plan => <PlanCard plan={plan} key={plan.id}/>)}</div><p className="mt-6 text-center text-xs text-neutral-500">One club. Four sports. Membership benefits follow you, from court to clubhouse.</p></div></section>
    <section className="chapter site-width gear-section grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><div className="gear-title max-w-sm"><p className="eyebrow mb-5 text-orange-400">The Champions Shop</p><h2 className="section-title">Good gear.<br/>Great games.</h2><p className="soft-text mt-6 text-sm">The things that make a difference. Explore our edit of court essentials, performance kit and everyday favourites.</p><Button asChild variant="outline" className="mt-7"><Link href="/shop">Explore the shop<ArrowUpRight size={16}/></Link></Button></div></div><div className="grid grid-cols-2 gap-x-5 gap-y-9">{featured.map(product => <Link href={`/shop/${product.id}`} className="group" key={product.id}><div className="relative aspect-square overflow-hidden rounded bg-[#e7e5de]"><Image src={product.image} alt={product.name} fill sizes="(max-width:640px) 45vw, 30vw" className="object-contain p-7 transition-transform duration-700 group-hover:scale-105"/></div><p className="mt-4 text-[10px] uppercase tracking-widest text-neutral-500">{product.sport === "all" ? "Club essentials" : product.sport}</p><h3 className="mt-2 text-sm">{product.name}</h3><p className="mt-2 text-sm text-neutral-400">{money(product.variants[0]?.pricePaise || 0)}</p></Link>)}</div></section>
    <section className="chapter border-y border-white/10 bg-[#151515]"><div className="site-width grid items-center gap-14 lg:grid-cols-2"><div className="image-card scale-image relative h-[380px] md:h-[470px]"><Image src={stories[story].image} alt="The Champions Club experience" fill sizes="(max-width:1023px) 100vw, 50vw"/></div><div className="max-w-lg"><Coffee className="mb-6 text-orange-400" size={30}/><p className="eyebrow mb-5 text-neutral-500">Clubhouse Kitchen & Bar</p><div aria-live="polite"><h2 className="section-title">{stories[story].title}</h2><p className="soft-text mt-7 text-sm">{stories[story].text}</p></div><Link className="mt-8 inline-flex items-center gap-3 border-b border-white/50 pb-2 text-sm" href="/clubhouse">Find your flavour<ArrowUpRight size={16}/></Link><div className="mt-9 flex items-center gap-3"><button aria-label="Previous club story" className="rounded-full border border-white/20 p-3" onClick={() => setStory((story + 2) % 3)}><ArrowLeft size={18}/></button><button aria-label="Next club story" className="rounded-full border border-white/20 p-3" onClick={() => setStory((story + 1) % 3)}><ArrowRight size={18}/></button><span className="ml-3 text-xs text-neutral-500">{story + 1} / 3</span></div></div></div></section>
    <section className="chapter site-width"><div className="relative overflow-hidden rounded bg-orange-500 p-9 text-[#17100c] md:p-16"><div className="relative z-10 max-w-3xl"><p className="eyebrow mb-6">Your first game starts here</p><h2 className="section-title">A new favourite sport<br/>is one session away.</h2><p className="mt-6 max-w-lg text-sm leading-relaxed text-black/70">Curious about padel? Picking up a racket again? Explore our courts and ask the front desk about your first session.</p><Button asChild variant="secondary" className="mt-8 bg-[#141414] text-white hover:bg-[#303030]"><Link href="/book?trial=true">Explore trial sessions<ArrowUpRight size={16}/></Link></Button></div><div className="absolute -right-16 -top-24 size-[450px] rounded-full border-[70px] border-black/8"/></div></section>
    <section id="contact" className="chapter site-width grid gap-14 border-t border-white/10 lg:grid-cols-2"><div><p className="eyebrow mb-5 text-orange-400">Come say hello</p><h2 className="section-title">Let&apos;s get<br/>you in the game.</h2><p className="soft-text mt-7 max-w-sm text-sm">A question, a club visit, or a big idea? Our front desk would love to hear from you.</p><div className="mt-10 space-y-3 text-sm"><p>{data.settings.address}</p><p className="text-neutral-400">{data.settings.contactPhone}</p><a className="inline-block text-orange-400" href={`mailto:${data.settings.contactEmail}`}>{data.settings.contactEmail}</a></div></div><EnquiryForm/></section>
  </div>;
}
