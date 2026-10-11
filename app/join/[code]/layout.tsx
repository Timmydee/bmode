import type { Metadata } from "next";

// A live room: keep it out of search results.
export const metadata: Metadata = {
  title: { absolute: "Playing | Bmode" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: LayoutProps<"/join/[code]">) {
  return children;
}
