import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/host", base).toString(), changeFrequency: "monthly", priority: 0.6 },
    { url: new URL("/join", base).toString(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
