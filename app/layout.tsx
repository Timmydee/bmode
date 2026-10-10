import type { Metadata } from "next";
import { Inter_Tight, Noto_Sans } from "next/font/google";
import "./globals.css";

// Noto Sans for reading (close to Discord's own UI type) and Inter Tight
// at heavy weights for headings and the cards, in the spirit of the bold
// Helvetica on a Cards Against Humanity card.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
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
      className={`${notoSans.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
