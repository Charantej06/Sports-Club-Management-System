"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.email("Enter a valid email."),
  phone: z.string().trim().regex(/^$|^[0-9+()\-\s]{7,25}$/, "Enter a valid phone number."),
  sport: z.string().min(1),
  interest: z.enum(["GENERAL", "TRIAL", "BOOKING", "MEMBERSHIP", "SHOP"]),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000),
  website: z.string().max(0),
});
type Form = z.infer<typeof schema>;

/**
 * The way a visitor without an account reaches the club. Every submission becomes a lead the front desk
 * follows up. It can be preset for a context (a trial request for a chosen slot, a plan question, …).
 */
export function EnquiryForm({
  sports = [],
  interest = "GENERAL",
  planId,
  sport = "general",
  defaultMessage = "",
  submitLabel = "Let's talk",
  askInterest = true,
  onSent,
}: {
  sports?: { id: string; name: string }[];
  interest?: Form["interest"];
  planId?: "gold" | "silver" | "junior";
  sport?: string;
  defaultMessage?: string;
  submitLabel?: string;
  askInterest?: boolean;
  onSent?: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { sport, interest, message: defaultMessage, phone: "", website: "" } });
  const mutation = useMutation({
    mutationFn: ({ phone, ...data }: Form) => api<{ id: string; merged: boolean }>("/api/enquiries", { method: "POST", body: JSON.stringify({ ...data, ...(phone ? { phone } : {}), ...(planId ? { planId } : {}) }) }),
    onSuccess: () => onSent?.(),
  });
  if (mutation.isSuccess)
    return (
      <div className="flex min-h-60 flex-col justify-center gap-4" role="status">
        <CheckCircle2 className="text-orange-500" size={36} />
        <h3 className="text-2xl">{mutation.data.merged ? "Added to your earlier message." : "You're on our radar."}</h3>
        <p className="soft-text">Someone from the front desk will contact you within one working day. We&apos;ve emailed you a confirmation; check your spam folder if it doesn&apos;t arrive.</p>
      </div>
    );
  return (
    <form className="grid gap-5" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="enquiry-name">Your name</label>
          <Input className="mt-2" id="enquiry-name" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="enquiry-email">Email address</label>
          <Input className="mt-2" id="enquiry-email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="enquiry-phone">Phone (optional, so we can call you)</label>
          <Input className="mt-2" id="enquiry-phone" type="tel" autoComplete="tel" {...register("phone")} aria-invalid={!!errors.phone} />
          {errors.phone && <p className="field-error">{errors.phone.message}</p>}
        </div>
        <div>
          <label htmlFor="enquiry-sport">Which sport?</label>
          <select className="mt-2" id="enquiry-sport" {...register("sport")}>
            <option value="general">A little bit of everything</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      {askInterest ? (
        <div>
          <label htmlFor="enquiry-interest">What brings you here?</label>
          <select className="mt-2" id="enquiry-interest" {...register("interest")}>
            <option value="GENERAL">Just have a question</option>
            <option value="TRIAL">I&apos;d like a trial session</option>
            <option value="MEMBERSHIP">Membership plans and prices</option>
            <option value="SHOP">The shop</option>
          </select>
        </div>
      ) : (
        <input type="hidden" {...register("interest")} />
      )}
      <div>
        <label htmlFor="enquiry-message">Your message</label>
        <textarea className="mt-2 min-h-28" id="enquiry-message" placeholder="I'd love to know more about…" {...register("message")} aria-invalid={!!errors.message} />
        {errors.message && <p className="field-error">{errors.message.message}</p>}
      </div>
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" {...register("website")} />
      {mutation.error && <p role="alert" className="field-error">{mutation.error.message}</p>}
      <Button type="submit" size="lg" className="justify-self-start" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : submitLabel}
        <ArrowUpRight size={18} />
      </Button>
    </form>
  );
}
