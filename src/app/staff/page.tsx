import { pageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { StaffDesk } from "@/components/staff-desk";
export const metadata = { title: "Staff desk" };
export default async function Staff() {
  const user = await pageUser(["OWNER", "RECEPTION", "CASHIER", "KITCHEN"]);
  const reception = ["OWNER", "RECEPTION"].includes(user.role);
  const [leads, notifications, activeMembers, plans] = await Promise.all([
    reception ? db.lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 50 }) : [],
    reception ? db.staffNotification.count({ where: { readAt: null } }) : 0,
    db.membership.count({ where: { status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } }),
    reception ? db.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }) : [],
  ]);
  return <StaffDesk userId={user.id} name={user.name} role={user.role} leads={leads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() }))} notifications={notifications} activeMembers={activeMembers} plans={plans}/>;
}
