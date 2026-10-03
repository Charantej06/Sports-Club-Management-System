"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
const schema = z.object({ name: z.string().trim().min(2, "Enter your name.").max(80), email: z.email("Enter a valid email."), sport: z.enum(["general", "tennis", "padel", "badminton", "cricket"]), message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000), website: z.string().max(0) });
type Form = z.infer<typeof schema>;
export function EnquiryForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { sport: "general", website: "" } });
  const mutation = useMutation({ mutationFn: (data: Form) => api("/api/enquiries", { method: "POST", body: JSON.stringify(data) }) });
  if (mutation.isSuccess) return <div className="flex min-h-60 flex-col justify-center gap-4" role="status"><CheckCircle2 className="text-orange-500" size={36}/><h3 className="text-2xl">You&apos;re on our radar.</h3><p className="soft-text">Your enquiry has reached our front desk. We&apos;ll be in touch soon.</p></div>;
  return <form className="grid gap-5" onSubmit={handleSubmit(data => mutation.mutate(data))}>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="enquiry-name">Your name</label><Input className="mt-2" id="enquiry-name" autoComplete="name" {...register("name")} aria-invalid={!!errors.name}/>{errors.name && <p className="field-error">{errors.name.message}</p>}</div><div><label htmlFor="enquiry-email">Email address</label><Input className="mt-2" id="enquiry-email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email}/>{errors.email && <p className="field-error">{errors.email.message}</p>}</div></div>
    <div><label htmlFor="enquiry-sport">What brings you here?</label><select className="mt-2" id="enquiry-sport" {...register("sport")}><option value="general">A little bit of everything</option><option value="tennis">Tennis</option><option value="padel">Padel</option><option value="badminton">Badminton</option><option value="cricket">Cricket</option></select></div>
    <div><label htmlFor="enquiry-message">Your message</label><textarea className="mt-2 min-h-28" id="enquiry-message" placeholder="I'd love to know more about…" {...register("message")} aria-invalid={!!errors.message}/>{errors.message && <p className="field-error">{errors.message.message}</p>}</div>
    <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" {...register("website")}/>
    {mutation.error && <p role="alert" className="field-error">{mutation.error.message}</p>}<Button type="submit" size="lg" className="justify-self-start" disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Let's talk"}<ArrowUpRight size={18}/></Button>
  </form>;
}
