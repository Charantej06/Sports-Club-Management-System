"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ResendVerification } from "./resend-verification";

const loginSchema = z.object({
  name: z.string(),
  email: z.email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});

const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  dateOfBirth: z
    .union([z.literal(""), z.iso.date()])
    .refine(
      (v) =>
        v === "" ||
        (new Date(v) <= new Date() && new Date(v) > new Date("1906-01-01")),
      "Enter a valid past date of birth.",
    )
    .optional(),
});

const forgotSchema = loginSchema.extend({ password: z.string() });

type SignupForm = z.infer<typeof signupSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;
type AnyForm = SignupForm & ForgotForm;


export function AuthForm({
  mode,
  emailMode = "local",
}: {
  mode: "login" | "signup" | "forgot";
  emailMode?: "local" | "smtp";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const resolver =
    mode === "signup"
      ? zodResolver(signupSchema)
      : mode === "forgot"
        ? zodResolver(forgotSchema)
        : zodResolver(loginSchema);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AnyForm>({
    resolver,
    defaultValues: { name: "", password: "", email: "", dateOfBirth: "" },
  });

  async function submit(data: AnyForm) {
    setError("");
    setUnverified(false);
    setSentTo(data.email);

    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: data.email,
          redirectTo: "/reset-password",
        });
        if (result.error) throw new Error(result.error.message);
        setSuccess(true);
        return;
      }

      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: data.name,
          email: data.email,
          password: data.password,
          callbackURL: "/email-verified",
        });
        if (result.error) throw new Error(result.error.message);

        // Save date of birth if provided — best-effort after account creation.
        if (data.dateOfBirth && data.dateOfBirth !== "") {
          try {
            await api("/api/me", {
              method: "PATCH",
              body: JSON.stringify({
                name: data.name.trim(),
                phone: "",
                dateOfBirth: data.dateOfBirth,
              }),
            });
          } catch {
            // Non-fatal: user can set it later in their profile.
          }
        }

        setSuccess(true);
        return;
      }

      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: "/email-verified",
      });
      if (result.error) {
        if (
          result.error.code === "EMAIL_NOT_VERIFIED" ||
          result.error.status === 403
        ) {
          setUnverified(true);
          return;
        }
        throw new Error(result.error.message);
      }
      router.push("/account");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }

  if (success)
    return (
      <div role="status" className="space-y-5">
        <CheckCircle2 className="text-orange-400" size={36} />
        <h2 className="text-2xl">Check your inbox.</h2>
        <p className="soft-text text-sm">
          {mode === "signup" ? (
            <>
              We&apos;ve sent a verification link to{" "}
              <strong className="text-white">{sentTo}</strong>. Open it to
              activate your account. Your Champions ID is already yours.
            </>
          ) : (
            "If an account exists for this email, we've sent a password reset link."
          )}
        </p>
        {emailMode === "local" ? (
          <p className="text-xs text-neutral-500">
            Demo mode: emails are not sent. The message is stored in the
            owner&apos;s Local test inbox.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            It can take a minute to arrive. Check your spam folder if you
            don&apos;t see it. The link works for one hour.
          </p>
        )}
        {mode === "signup" && emailMode === "smtp" && (
          <ResendVerification email={sentTo} />
        )}
        <Link href="/login" className="inline-block text-sm text-orange-400">
          Back to sign in
        </Link>
      </div>
    );

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submit)}>
      {mode === "signup" && (
        <div>
          <label htmlFor="auth-name">Full name</label>
          <Input
            id="auth-name"
            className="mt-2"
            autoComplete="name"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="field-error">{errors.name.message}</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="auth-email">Email address</label>
        <Input
          id="auth-email"
          className="mt-2"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="field-error">{errors.email.message}</p>
        )}
      </div>

      {mode !== "forgot" && (
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password">Password</label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-neutral-400"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="auth-password"
            className="mt-2"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
          )}
        </div>
      )}

      {mode === "signup" && (
        <div>
          <label htmlFor="auth-dob">
            Date of birth{" "}
            <span className="text-xs text-neutral-500">(optional)</span>
          </label>
          <Input
            id="auth-dob"
            className="mt-2 [color-scheme:dark]"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            autoComplete="bday"
            {...register("dateOfBirth")}
            aria-invalid={!!(errors as z.ZodFormattedError<SignupForm>).dateOfBirth}
          />
          <p className="mt-2 text-xs text-neutral-500">
            Required for Junior membership eligibility. You can also set this
            later in your profile.
          </p>
          {(errors as z.ZodFormattedError<SignupForm>).dateOfBirth && (
            <p className="field-error">
              {String((errors as z.ZodFormattedError<SignupForm>).dateOfBirth?._errors?.[0] ?? "")}
            </p>
          )}
        </div>
      )}

      {unverified && (
        <div role="alert" className="notice space-y-3">
          <p>
            <strong>Please verify your email first.</strong> We&apos;ve just
            sent a fresh link to {getValues("email")}. Open it, then sign in.
          </p>
          {emailMode === "local" && (
            <p className="text-xs">
              Demo mode: the link is in the owner&apos;s Local test inbox.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "One moment…"
          : mode === "signup"
            ? "Create your account"
            : mode === "forgot"
              ? "Send reset link"
              : "Welcome back"}
        <ArrowUpRight size={17} />
      </Button>

      <p className="text-center text-sm text-neutral-400">
        {mode === "login" ? (
          <>
            New to the club?{" "}
            <Link className="text-white" href="/signup">
              Join us
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-white">
            Already have an account? Sign in
          </Link>
        )}
      </p>
    </form>
  );
}
