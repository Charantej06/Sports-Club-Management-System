import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Sign in" };
export default function Login() { return <AuthShell title="Good to see you." subtitle="Sign in to your Champions Club account."><AuthForm mode="login" emailMode={process.env.EMAIL_MODE === "smtp" ? "smtp" : "local"}/>{process.env.PAYMENT_MODE === "local" && <details className="mt-9 rounded border border-white/10 p-4 text-xs text-neutral-400"><summary className="cursor-pointer">Local demo accounts</summary><p className="mt-4 leading-relaxed">member@champions.local · Gold membership<br/>new@champions.local · No membership<br/>owner@champions.local · Owner desk<br/>Password for each: Champions2026!</p></details>}</AuthShell>; }
