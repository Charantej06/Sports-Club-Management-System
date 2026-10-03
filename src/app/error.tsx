"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="site-width min-h-[60vh] py-24"><h1 className="section-title">A little timeout.</h1><p className="soft-text mt-6">We couldn&apos;t load this page. Please try again in a moment.</p><Button className="mt-8" onClick={reset}>Try again</Button></div>;
}
