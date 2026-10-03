import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export default function Forgot() { return <AuthShell title="Let's get you back." subtitle="Enter your account email and we'll send a reset link."><AuthForm mode="forgot" emailMode={process.env.EMAIL_MODE === "smtp" ? "smtp" : "local"}/></AuthShell>; }
