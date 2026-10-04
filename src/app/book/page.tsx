import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { publicData } from "@/modules/public/queries";
import { CourtsView } from "@/components/courts-view";
export const metadata = { title: "Book a Court" };
export default async function Book({ searchParams }: { searchParams: Promise<{ sport?: string; trial?: string }> }) {
  const [data, params, session] = await Promise.all([publicData(), searchParams, auth.api.getSession({ headers: await headers() })]);
  return <CourtsView data={data} signedIn={!!session} initialSport={data.sports.some(s => s.id === params.sport) ? params.sport! : data.sports[0]?.id ?? ""} trial={params.trial === "true"}/>;
}
