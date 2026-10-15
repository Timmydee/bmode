import type { MetadataRoute } from "next";
import { cardPath } from "@/lib/cards/library";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/cards", base).toString(), changeFrequency: "weekly", priority: 0.9 },
    { url: new URL("/join", base).toString(), changeFrequency: "monthly", priority: 0.6 },
    ...CIRCLE_QUESTIONS.map((card) => ({
      url: new URL(cardPath(card.id), base).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
