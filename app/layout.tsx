import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Inter_Tight } from "next/font/google";
import "./globals.css";
import InsightsLayer from "./InsightsLayer";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";

// The Bmode brand pairing from the PRD: Bricolage Grotesque for headings
// and Figtree for reading. The cards use Inter Tight at heavy weights, in
// the spirit of the bold Helvetica on a Cards Against Humanity card.
const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

// Icons, the Open Graph and Twitter images, the manifest, robots.txt and
// the sitemap come from the matching files in app/ (favicon.ico, icon.svg,
// apple-icon.png, opengraph-image.png, manifest.ts, robots.ts, sitemap.ts).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "conversation questions",
    "icebreakers",
    "question game",
    "couples questions",
    "party game",
    "group game",
    "deep questions",
    "get to know you",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  appleWebApp: { title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#14152B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${figtree.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        {children}
        <InsightsLayer />
      </body>
    </html>
  );
}
