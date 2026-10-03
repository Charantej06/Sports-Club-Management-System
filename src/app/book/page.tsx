import { publicData } from "@/modules/public/queries";
import { CourtsView } from "@/components/courts-view";
export const metadata = { title: "Book a Court" };
export default async function Book({ searchParams }: { searchParams: Promise<{ sport?: string; trial?: string }> }) {
  const [data, params] = await Promise.all([publicData(), searchParams]);
  return <CourtsView data={data} initialSport={data.sports.some(s => s.id === params.sport) ? params.sport! : "tennis"} trial={params.trial === "true"}/>;
}
