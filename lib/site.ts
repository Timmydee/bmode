// Shared site details for metadata, the sitemap, robots.txt and the web
// app manifest.
export const SITE_NAME = "Bmode";
export const SITE_TITLE = "Bmode: helping people connect through better questions";
export const SITE_DESCRIPTION =
  "Bmode is a question game for groups, couples and friends. Everyone answers on their own phone, then the cards flip together. No app needed.";

// The live site, as set on the GitHub repo.
const PRODUCTION_URL = "https://bmode.vercel.app";

// The public origin, used for absolute URLs in Open Graph tags and the
// sitemap. NEXT_PUBLIC_SITE_URL wins (set it once a custom domain is live);
// on Vercel the production domain is used, and locally it falls back to
// the dev server.
//
// Any build on Vercel must end up with a public https origin: link previews
// (WhatsApp, iMessage, Slack) fetch og:image from it, and a localhost image
// URL baked into a static page leaves a preview with text but no card. So
// when Vercel doesn't expose its production domain, the known one is used.
// Preview deployment URLs are never used, as they sit behind Vercel's login.
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  if (process.env.VERCEL) return new URL(PRODUCTION_URL);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
