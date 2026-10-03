import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <div className="site-width min-h-[60vh] py-24"><h1 className="section-title">Out of bounds.</h1><p className="soft-text my-6">That page couldn&apos;t be found.</p><Button asChild><Link href="/">Back to the club</Link></Button></div>; }
