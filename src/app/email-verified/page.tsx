import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { ResendVerification } from "@/components/resend-verification";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Email verification" };

// Better Auth sends people here after they open the link in a verification email.
export default async function EmailVerified({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, session] = await Promise.all([searchParams, auth.api.getSession({ headers: await headers() })]);
  if (error)
    return (
      <AuthShell title="That link didn't work." subtitle="Verification links expire after an hour and can only be used once.">
        <div className="space-y-6" role="alert">
          <AlertTriangle className="text-orange-400" size={36} aria-hidden="true" />
          <p className="soft-text text-sm">Enter your email and we&apos;ll send you a fresh link.</p>
          <ResendVerification showEmailField />
          <Link href="/login" className="inline-block text-sm text-orange-400">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell title="You're verified." subtitle="Your email is confirmed and your Champions ID is active.">
      <div className="space-y-6" role="status">
        <CheckCircle2 className="text-orange-400" size={36} aria-hidden="true" />
        <p className="soft-text text-sm">{session ? "You're signed in and ready to book a court or choose a membership." : "Sign in to book a court or choose a membership."}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href={session ? "/account" : "/login"}>{session ? "Go to my account" : "Sign in"}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/book">Book a court</Link></Button>
        </div>
      </div>
    </AuthShell>
  );
}
