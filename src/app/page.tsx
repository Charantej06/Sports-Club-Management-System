import { publicData } from "@/modules/public/queries";
import { Landing } from "@/components/landing";
export default async function Home() { return <Landing data={await publicData()}/>; }
