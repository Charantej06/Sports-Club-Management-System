import { publicData } from "@/modules/public/queries";
import { Landing } from "@/components/landing";

export default async function Home() {
  const data = await publicData();
  const { settings } = data;
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  // Structured data so search engines can show the club, its sports, hours and contact details.
  const structured = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: "Champions Club",
    url: base,
    description: `${data.sports.map((s) => s.name).join(", ")} courts, a sports shop and a clubhouse. Book a court online or try a session.`,
    address: settings.address,
    telephone: settings.contactPhone,
    email: settings.contactEmail,
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: `${String(settings.openHour).padStart(2, "0")}:00`, closes: `${String(settings.closeHour % 24).padStart(2, "0")}:00` }],
    makesOffer: data.plans.map((p) => ({ "@type": "Offer", name: `${p.name} membership`, priceCurrency: "INR", price: (p.pricePaise / 100).toFixed(2), description: `${p.description} Price per month; 3-month and annual terms are discounted.` })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <Landing data={data} />
    </>
  );
}
