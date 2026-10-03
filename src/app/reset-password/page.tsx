import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/reset-form";
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token } = await searchParams; return <AuthShell title="A fresh start." subtitle="Use at least 10 characters for your new password."><ResetForm token={token}/></AuthShell>; }
