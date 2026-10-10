import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Inter_Tight } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Bmode",
  description: "Helping people connect through better questions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${figtree.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
