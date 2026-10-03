"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
const schema = z.object({ name: z.string(), email: z.email("Enter a valid email address."), password: z.string().min(10, "Use at least 10 characters.").max(128) });
type Form = z.infer<typeof schema>;
export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(mode === "signup" ? schema.extend({ name: z.string().trim().min(2, "Enter your name.").max(80) }) : mode === "forgot" ? schema.extend({ password: z.string() }) : schema), defaultValues: { name: "", password: "", email: "" } });
  async function submit(data: Form) {
    setError("");
    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: data.email, redirectTo: "/reset-password" });
        if (result.error) throw new Error(result.error.message);
        setSuccess(true); return;
      }
      if (mode === "signup") {
        const result = await authClient.signUp.email({ name: data.name, email: data.email, password: data.password, callbackURL: "/account" });
        if (result.error) throw new Error(result.error.message);
        setSuccess(true); return;
      }
      const result = await authClient.signIn.email({ email: data.email, password: data.password });
      if (result.error) throw new Error(result.error.message);
      router.push("/account"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
  }
  if (success) return <div role="status" className="space-y-5"><CheckCircle2 className="text-orange-400" size={36}/><h2 className="text-2xl">Check your inbox.</h2><p className="soft-text text-sm">{mode === "signup" ? "Verify your email to activate your account. Your Champions ID is already yours." : "If an account exists for this email, we've sent a password reset link."}</p><p className="text-xs text-neutral-500">In local email mode, your message is stored in the owner&apos;s test inbox.</p><Link href="/login" className="inline-block text-sm text-orange-400">Back to sign in</Link></div>;
  return <form className="space-y-6" onSubmit={handleSubmit(submit)}>
    {mode === "signup" && <div><label htmlFor="auth-name">Full name</label><Input id="auth-name" className="mt-2" autoComplete="name" {...register("name")} aria-invalid={!!errors.name}/>{errors.name && <p className="field-error">{errors.name.message}</p>}</div>}
    <div><label htmlFor="auth-email">Email address</label><Input id="auth-email" className="mt-2" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email}/>{errors.email && <p className="field-error">{errors.email.message}</p>}</div>
    {mode !== "forgot" && <div><div className="flex items-center justify-between"><label htmlFor="auth-password">Password</label>{mode === "login" && <Link href="/forgot-password" className="text-xs text-neutral-400">Forgot password?</Link>}</div><Input id="auth-password" className="mt-2" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} {...register("password")} aria-invalid={!!errors.password}/>{errors.password && <p className="field-error">{errors.password.message}</p>}</div>}
    {error && <p className="field-error" role="alert">{error}</p>}<Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? "One moment…" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Send reset link" : "Welcome back"}<ArrowUpRight size={17}/></Button>
    <p className="text-center text-sm text-neutral-400">{mode === "login" ? <>New to the club? <Link className="text-white" href="/signup">Join us</Link></> : <Link href="/login" className="text-white">Already have an account? Sign in</Link>}</p>
  </form>;
}
