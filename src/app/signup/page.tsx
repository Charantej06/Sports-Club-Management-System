import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Join the club" };
// A quote email links here with the visitor's address already filled in.
export default async function Signup({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const valid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
  return <AuthShell title="You're one of us." subtitle="Create your free account. Choose your membership whenever you're ready."><AuthForm mode="signup" defaultEmail={valid} emailMode={process.env.EMAIL_MODE === "smtp" ? "smtp" : "local"}/></AuthShell>;
}
