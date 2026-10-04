import type { MetadataRoute } from "next";

// Public pages are open to search engines; private areas and APIs are not.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/staff", "/account", "/api/", "/reset-password", "/email-verified"] }], sitemap: `${base}/sitemap.xml` };
}
