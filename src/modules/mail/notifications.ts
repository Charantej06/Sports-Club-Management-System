import { money, date, dateTime } from "@/lib/utils";
import { shell } from "./templates";

const base = () => process.env.BETTER_AUTH_URL || "http://localhost:3000";
const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const row = (label: string, value: string) => `<tr><td style="padding:6px 0;color:#888;font-size:14px;">${esc(label)}</td><td style="padding:6px 0;color:#fff;font-size:14px;text-align:right;">${esc(value)}</td></tr>`;
const table = (rows: [string, string][]) => `<table style="width:100%;border-collapse:collapse;margin:8px 0 8px;">${rows.map(([l, v]) => row(l, v)).join("")}</table>`;
const button = (href: string, label: string) => `<a class="btn" href="${esc(href)}">${esc(label)}</a>`;
const lines = (rows: [string, string][]) => rows.map(([l, v]) => `${l}: ${v}`).join("\n");

export function membershipReceiptEmail(i: { name: string; plan: string; term: string; startsAt: Date; endsAt: Date; totalPaise: number; invoiceNumber: string; queued: boolean }) {
  const rows: [string, string][] = [["Plan", `${i.plan} · ${i.term}`], [i.queued ? "Starts (after your current membership)" : "Starts", date(i.startsAt)], ["Valid until", date(new Date(+i.endsAt - 1))], ["Paid", money(i.totalPaise)], ["Receipt", i.invoiceNumber]];
  return {
    subject: `Your ${i.plan} membership is confirmed`,
    text: `Hello ${i.name},\n\nThank you for joining Champions Club.\n\n${lines(rows)}\n\nSee your card and receipts: ${base()}/account\n`,
    html: shell(`<div class="chip">Membership confirmed</div><h1>You're in, ${esc(i.name.split(" ")[0])}.</h1><p>${i.queued ? "Your new membership will start automatically the day your current one ends." : "Your membership is active now."}</p>${table(rows)}${button(`${base()}/account`, "See my card and receipts")}`, `${i.plan} membership confirmed`),
  };
}
export function bookingConfirmationEmail(i: { name: string; court: string; startsAt: Date; totalPaise: number; invoiceNumber?: string }) {
  const rows: [string, string][] = [["Court", i.court], ["When", dateTime(i.startsAt)], ["Length", "1 hour"], ["Paid", i.totalPaise ? money(i.totalPaise) : "Included in your membership"], ...(i.invoiceNumber ? [["Receipt", i.invoiceNumber] as [string, string]] : [])];
  return {
    subject: `Court booked: ${i.court}, ${dateTime(i.startsAt)}`,
    text: `Hello ${i.name},\n\nYour court is booked.\n\n${lines(rows)}\n\nCancellations need 12 hours' notice. Manage your bookings: ${base()}/account\n`,
    html: shell(`<div class="chip">Court booked</div><h1>See you on court.</h1>${table(rows)}<p>Cancellations need 12 hours' notice. Arrive a few minutes early; reception will check you in.</p>${button(`${base()}/account`, "Manage my bookings")}`, `${i.court} · ${dateTime(i.startsAt)}`),
  };
}
export function orderConfirmationEmail(i: { name: string; totalPaise: number; delivery: boolean; invoiceNumber?: string }) {
  const rows: [string, string][] = [["Total", money(i.totalPaise)], ["How you get it", i.delivery ? "Delivery (we'll send tracking)" : "Collect at the club desk"], ...(i.invoiceNumber ? [["Receipt", i.invoiceNumber] as [string, string]] : [])];
  return {
    subject: "Your Champions Shop order is confirmed",
    text: `Hello ${i.name},\n\nThanks for your order.\n\n${lines(rows)}\n\nOrder history: ${base()}/account\n`,
    html: shell(`<div class="chip">Order confirmed</div><h1>Your kit is on its way to ready.</h1>${table(rows)}${button(`${base()}/account`, "Order history")}`, "Order confirmed"),
  };
}
export function enquiryAckEmail(i: { name: string; interest: string }) {
  const topic = i.interest === "TRIAL" ? "your trial session" : i.interest === "MEMBERSHIP" ? "membership" : i.interest === "SHOP" ? "the shop" : "your enquiry";
  return {
    subject: "We've got your message",
    text: `Hello ${i.name},\n\nThanks for getting in touch about ${topic}. Someone from the front desk will contact you within one working day.\n\nIn the meantime you can see what's free and our plans: ${base()}/book and ${base()}/memberships\n\nChampions Club\n`,
    html: shell(`<div class="chip">Message received</div><h1>Thanks, ${esc(i.name.split(" ")[0])}.</h1><p>We've got your message about ${esc(topic)}. Someone from the front desk will contact you within one working day.</p>${button(`${base()}/book`, "See what's free")}<p>Or compare <a href="${esc(base())}/memberships" style="color:#f97316">our plans and prices</a>.</p>`, "We'll be in touch soon"),
  };
}
export function enquiryAlertEmail(i: { name: string; email: string; phone: string | null; interest: string; message: string; repeat: boolean }) {
  const rows: [string, string][] = [["Name", i.name], ["Email", i.email], ["Phone", i.phone || "not given"], ["Interested in", i.interest.toLowerCase()]];
  return {
    subject: `${i.repeat ? "Follow-up enquiry" : "New enquiry"}: ${i.name} (${i.interest.toLowerCase()})`,
    text: `${i.repeat ? "A visitor wrote again" : "New website enquiry"}\n\n${lines(rows)}\n\nMessage:\n${i.message}\n\nOpen it: ${base()}/staff#crm\n`,
    html: shell(`<div class="chip">${i.repeat ? "Visitor wrote again" : "New enquiry"}</div><h1>${esc(i.name)}</h1>${table(rows)}<p style="white-space:pre-wrap;color:#e8e8e8">${esc(i.message)}</p>${button(`${base()}/staff#crm`, "Open in Enquiries & CRM")}`, `${i.name} · ${i.interest.toLowerCase()}`),
  };
}
export function quoteEmail(i: { name: string; plan: string; term: string; totalPaise: number; validUntil: Date; url: string; benefits: string[] }) {
  const rows: [string, string][] = [["Plan", i.plan], ["Term", i.term], ["Price", money(i.totalPaise)], ["Valid until", date(i.validUntil)]];
  return {
    subject: `Your ${i.plan} membership quote`,
    text: `Hello ${i.name},\n\nHere is your Champions Club quote.\n\n${lines(rows)}\n\nIncludes: ${i.benefits.join("; ")}\n\nView it and join: ${i.url}\n\nThe final price is confirmed when you join.\n`,
    html: shell(`<div class="chip">Your quote</div><h1>${esc(i.plan)} membership</h1>${table(rows)}<p>${i.benefits.map(esc).join(" · ")}</p>${button(i.url, "View quote and join")}<p style="font-size:13px">The final price is confirmed when you join.</p>`, `${i.plan} · ${money(i.totalPaise)}`),
  };
}
