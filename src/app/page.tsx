import { publicData } from "@/modules/public/queries";
import { Landing } from "@/components/landing";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
export default async function Home() {
  const [data, session] = await Promise.all([publicData(), auth.api.getSession({ headers: await headers() })]);
  return <Landing data={data} signedIn={!!session} localMode={process.env.PAYMENT_MODE === "local"}/>;
}
