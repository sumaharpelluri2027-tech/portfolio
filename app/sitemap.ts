import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const base = process.env.NEXT_PUBLIC_SITE_URL || "https://github.com/sumaharpelluri2027-tech/portfolio"; return [{ url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }]; }
