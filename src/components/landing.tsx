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
import { MembershipBackground } from "./membership-background";
import { MembershipOptions } from "./membership-options";
import { EnquiryForm } from "./enquiry-form";
import { LandingHero } from "./landing-hero";
import { TrialSportAnimation } from "./trial-sport-animation";
type Data = Awaited<ReturnType<typeof publicData>>;
gsap.registerPlugin(ScrollTrigger, useGSAP);
const stories = [
  { title: "The post-match plans are part of the game.", text: "A quick rally becomes a long conversation. Finish your session, find your table, and let the good company do the rest.", image: "/images/clubhouse.jpg" },
  { title: "Find a new game. Keep the same feeling.", text: "From a first serve to your first six, there is always another way to play. Four sports, one welcoming club.", image: "/images/cricket.jpg" },
  { title: "Make room for your everyday ritual.", text: "Before work, after school, or just because. A place to put down your phone, pick up your racket, and feel like yourself.", image: "/images/tennis.jpg" },
];
function CourtSketch() {
  return <svg className="court-sketch" viewBox="0 0 290 190" fill="none" aria-hidden="true">
    <g className="court-sketch-tennis" stroke="currentColor" strokeWidth="2"><circle cx="65" cy="87" r="35"/><path d="M43 59c18 13 27 38 16 57M87 59c-18 13-27 38-16 57"/></g>
    <g className="court-sketch-basketball" stroke="currentColor" strokeWidth="2"><circle cx="211" cy="95" r="44"/><path d="M167 95h88M211 51v88M180 63c22 16 30 46 18 71M242 63c-22 16-30 46-18 71"/></g>
    <path className="court-sketch-line" d="M5 151C61 131 102 182 151 150s79-6 134-31" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 7"/>
  </svg>;
}
export function Landing({ data, signedIn, localMode }: { data: Data; signedIn: boolean; localMode: boolean }) {
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
    <section id="experience" className="experience-section chapter"><div className="site-width"><div className="experience-intro mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="eyebrow mb-5 text-orange-600">A better way to spend your day</p><h2 className="section-title max-w-3xl text-[#191919]">Made for play.<br/>Built for <span className="text-orange-600">belonging.</span></h2></div><div className="experience-copy"><CourtSketch/><p>Every court, every corner, every little detail.<br/>We&apos;ve made space for the way you like to spend your day.</p></div></div>
      <div className="facility-grid grid-flow-dense"><Link href="/book" className="image-card experience-feature scale-image"><Image src="/images/tennis.jpg" alt="Sunlit tennis courts" fill sizes="(max-width:640px) 100vw, 65vw"/><div className="caption"><span className="eyebrow text-white/70">Room to raise your game</span><h3 className="mt-3 text-3xl font-medium text-white">Your next great session.</h3><p className="mt-3 max-w-sm text-sm text-white/75">Premium surfaces. Thoughtful lighting.<br/>A little less distraction. A little more play.</p></div></Link><div className="experience-card experience-card-dark"><Sun className="text-orange-500" size={28}/><h3 className="mt-5 text-xl">Play on your time.</h3><p className="mt-3 text-sm text-neutral-300">Early riser or under-the-lights player?<br/>{data.settings.openHour}:00–{data.settings.closeHour}:00, every day.</p><span className="experience-card-number">01</span></div><div className="experience-card experience-card-light"><Users className="text-orange-600" size={28}/><h3 className="mt-5 text-xl">Good company, included.</h3><p className="mt-3 text-sm text-[#5e5a54]">Shared courts, social Fridays, and a community that welcomes your first game.</p><span className="experience-card-number">02</span></div></div></div>
    </section>
    <section id="memberships" className="chapter relative overflow-hidden border-y border-white/10 bg-[#0a0a0a] isolate">
      <MembershipBackground />
      <div className="site-width relative z-10">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
              <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
              Make it your club
            </div>
            <h2 className="section-title">More reasons to play.</h2>
            <p className="soft-text mt-3 max-w-xl text-sm">
              More court time. A little extra at the shop. Your favourite table afterwards. One membership brings it all together.
            </p>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-orange-500 hover:bg-orange-500/10" href="/memberships">
            Compare memberships
            <ArrowUpRight size={16} className="text-orange-400" />
          </Link>
        </div>
        <MembershipOptions plans={data.plans} signedIn={signedIn} localMode={localMode}/>
        <p className="mt-8 text-center text-xs text-neutral-400">One club. Four sports. Membership benefits follow you, from court to clubhouse.</p>
      </div>
    </section>
    <section className="chapter site-width gear-section grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><div className="gear-title max-w-sm"><p className="eyebrow mb-5 text-orange-400">The Champions Shop</p><h2 className="section-title">Good gear.<br/>Great games.</h2><p className="soft-text mt-6 text-sm">The things that make a difference. Explore our edit of court essentials, performance kit and everyday favourites.</p><Button asChild variant="outline" className="mt-7"><Link href="/shop">Explore the shop<ArrowUpRight size={16}/></Link></Button></div></div><div className="grid grid-cols-2 gap-x-5 gap-y-9">{featured.map(product => <Link href={`/shop/${product.id}`} className="group" key={product.id}><div className="relative aspect-square overflow-hidden rounded bg-[#e7e5de]"><Image src={product.image} alt={product.name} fill sizes="(max-width:640px) 45vw, 30vw" className="object-contain p-7 transition-transform duration-700 group-hover:scale-105"/></div><p className="mt-4 text-[10px] uppercase tracking-widest text-neutral-500">{product.sport === "all" ? "Club essentials" : product.sport}</p><h3 className="mt-2 text-sm">{product.name}</h3><p className="mt-2 text-sm text-neutral-400">{money(product.variants[0]?.pricePaise || 0)}</p></Link>)}</div></section>
    <section className="chapter border-y border-white/10 bg-[#151515]"><div className="site-width grid items-center gap-14 lg:grid-cols-2"><div className="image-card scale-image relative h-[380px] md:h-[470px]"><Image src={stories[story].image} alt="The Champions Club experience" fill sizes="(max-width:1023px) 100vw, 50vw"/></div><div className="max-w-lg"><Coffee className="mb-6 text-orange-400" size={30}/><p className="eyebrow mb-5 text-neutral-500">Clubhouse Kitchen & Bar</p><div aria-live="polite"><h2 className="section-title">{stories[story].title}</h2><p className="soft-text mt-7 text-sm">{stories[story].text}</p></div><Link className="mt-8 inline-flex items-center gap-3 border-b border-white/50 pb-2 text-sm" href="/clubhouse">Find your flavour<ArrowUpRight size={16}/></Link><div className="mt-9 flex items-center gap-3"><button aria-label="Previous club story" className="rounded-full border border-white/20 p-3" onClick={() => setStory((story + 2) % 3)}><ArrowLeft size={18}/></button><button aria-label="Next club story" className="rounded-full border border-white/20 p-3" onClick={() => setStory((story + 1) % 3)}><ArrowRight size={18}/></button><span className="ml-3 text-xs text-neutral-500">{story + 1} / 3</span></div></div></div></section>
    <section className="chapter site-width"><div className="trial-neon-card"><div className="trial-neon-copy"><h2>Find your next game.</h2><p>Four sports. One place to start.<br/>Try a session and find your favourite.</p><Button asChild className="trial-book-button"><Link href="/book?trial=true">Explore trial sessions<ArrowUpRight size={16}/></Link></Button></div><TrialSportAnimation/></div></section>
    <section id="contact" className="chapter relative overflow-hidden border-t border-white/10 isolate">
      {/* Striped grass background with perimeter vignette */}
      <div className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden" aria-hidden="true">
        <Image
          src="/images/contact-turf.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Vignette: transparent in the center so the green grass is clearly visible, darkening towards edges and corners */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.45) 75%, #0b0b0b 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0b0b0b] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0b0b] to-transparent" />
      </div>

      {/* Solid Opaque Black Card */}
      <div className="site-width relative z-10">
        <div className="rounded-2xl border border-white/15 bg-[#121212] p-8 md:p-14 lg:p-16 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
                <span className="size-1.5 rounded-full bg-orange-400 animate-pulse" />
                Come say hello
              </div>
              <h2 className="section-title text-white">Let&apos;s get<br />you in the game.</h2>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-neutral-300">
                A question, a club visit, or a big idea? Our front desk would love to hear from you.
              </p>
              <div className="mt-10 space-y-3 text-sm">
                <p className="font-medium text-white">{data.settings.address}</p>
                <p className="text-neutral-400">{data.settings.contactPhone}</p>
                <a className="inline-block text-orange-400 transition-colors hover:text-orange-300" href={`mailto:${data.settings.contactEmail}`}>
                  {data.settings.contactEmail}
                </a>
              </div>
            </div>
            <div>
              <EnquiryForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
