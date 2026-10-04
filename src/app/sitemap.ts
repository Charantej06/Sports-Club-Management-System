import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const [sports, products] = await Promise.all([
    db.sport.findMany({ where: { status: { not: "INACTIVE" } }, select: { id: true } }),
    db.product.findMany({ where: { active: true }, select: { id: true } }),
  ]);
  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/book`, lastModified: now, priority: 0.9 },
    ...sports.map((s) => ({ url: `${base}/book?sport=${s.id}`, lastModified: now, priority: 0.8 })),
    { url: `${base}/memberships`, lastModified: now, priority: 0.8 },
    { url: `${base}/shop`, lastModified: now, priority: 0.7 },
    ...products.map((p) => ({ url: `${base}/shop/${p.id}`, lastModified: now, priority: 0.5 })),
    { url: `${base}/clubhouse`, lastModified: now, priority: 0.6 },
  ];
}
