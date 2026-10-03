import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Join the club" };
export default function Signup() { return <AuthShell title="You're one of us." subtitle="Create your free account. Choose your membership whenever you're ready."><AuthForm mode="signup"/></AuthShell>; }
