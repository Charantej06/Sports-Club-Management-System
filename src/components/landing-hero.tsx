"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

type Sport = { id: string; name: string; description: string; image: string; status?: string };

const media: Record<string, { video?: string; poster: string; label: string }> = {
  tennis: { video: "/videos/tennis.mp4", poster: "/videos/tennis.jpg", label: "Tennis" },
  padel: { video: "/videos/padel.mp4", poster: "/videos/padel.jpg", label: "Padel" },
  badminton: { video: "/videos/badminton.mp4", poster: "/videos/badminton.jpg", label: "Badminton" },
  cricket: { video: "/videos/cricket.mp4", poster: "/videos/cricket.jpg", label: "Cricket" },
};

const phrases = ["Your people.", "Your sport.", "Your moment."];

function SportIcon({ sport }: { sport: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg width="25" height="25" viewBox="0 0 32 32" aria-hidden="true" {...common}>
    {sport === "tennis" && <><circle cx="16" cy="16" r="11"/><path d="M9 7c7 3 9 15 5 20M23 7c-7 3-9 15-5 20"/></>}
    {sport === "padel" && <><rect x="7" y="3" width="17" height="20" rx="8" transform="rotate(20 15.5 13)"/><path d="m19 24 3 6M11 10h.01M16 10h.01M20 13h.01M10 15h.01M15 16h.01M19 19h.01"/></>}
    {sport === "badminton" && <><path d="m7 5 13 16M4 9l11 14M11 3l12 13M4 9l7-6M7 5l-3 4M15 23l5-2 3-5M20 21l7 7M26 29l2-2"/></>}
    {!["tennis", "padel", "badminton", "cricket"].includes(sport) && <><circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5v22"/></>}
    {sport === "cricket" && <><path d="m8 3 8 2-3 19-8-2L8 3ZM13 24l-1 5M23 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></>}
  </svg>;
}

export function LandingHero({ sports }: { sports: Sport[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setPhrase(current => (current + 1) % phrases.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  // Every sport the owner offers gets a panel; sports without bundled video fall back to their photo.
  const featured = sports.map(sport => ({ sport, media: media[sport.id] ?? { poster: sport.image, label: sport.name } }));

  return <section className="landing-hero" aria-label="Welcome to Champions Club">
    <div className="hero-panels" aria-label="Explore our sports">
      {featured.map(({ sport, media: panel }) => <article key={sport.id} className={`hero-panel ${active === sport.id ? "is-active" : ""}`} style={{ backgroundImage: `url(${panel.poster})` }}
        onPointerMove={event => { if (event.pointerType === "mouse" && event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight * .52) setActive(sport.id); }}
        onPointerLeave={() => setActive(current => current === sport.id ? null : current)}>
        {panel.video && <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster={panel.poster} aria-hidden="true"><source src={panel.video} type="video/mp4"/></video>}
        <div className="hero-panel-shade"/>
        <div className="hero-panel-content">
          <button type="button" className="hero-sport-trigger" onClick={() => setActive(sport.id)} aria-expanded={active === sport.id} aria-controls={`hero-${sport.id}-details`}>
            <SportIcon sport={sport.id}/><span>{panel.label}</span><ArrowUpRight className="hero-sport-arrow" size={19}/>
          </button>
          <div className="hero-sport-details" id={`hero-${sport.id}-details`} inert={active !== sport.id}>
            <p>{sport.description}</p>
            {sport.status === "MAINTENANCE" && <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Temporarily under maintenance</p>}
            <Link href={`/book?sport=${sport.id}`} className="hero-explore">Explore courts <ArrowRight size={16}/></Link>
          </div>
        </div>
      </article>)}
    </div>
    <div className="hero-center">
      <h1>Your game.<br/><span className="hero-rotating" key={phrase}>{phrases[phrase]}</span></h1>
      <div className="hero-actions"><Link href="#contact" className="hero-action-primary">Find your club <ArrowUpRight size={18}/></Link><Link href="/memberships" className="hero-action-secondary">Join the club <ArrowRight size={18}/></Link></div>
    </div>
  </section>;
}
