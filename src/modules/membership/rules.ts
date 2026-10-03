export function ageAt(birth: Date, at: Date) {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  if (at.getUTCMonth() < birth.getUTCMonth() || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
export function isActive(membership: { startsAt: Date; endsAt: Date; status: string }, at = new Date()) {
  return membership.status === "ACTIVE" && membership.startsAt <= at && membership.endsAt > at;
}
