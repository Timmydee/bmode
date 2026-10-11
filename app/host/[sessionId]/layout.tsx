import type { Metadata } from "next";

// A live room: keep it out of search results.
export const metadata: Metadata = {
  title: { absolute: "Hosting | Bmode" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: LayoutProps<"/host/[sessionId]">) {
  return children;
}
