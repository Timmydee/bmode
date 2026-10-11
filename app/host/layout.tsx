import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host a session",
  description: "Start a Bmode session and invite people to join from their phones.",
};

export default function Layout({ children }: LayoutProps<"/host">) {
  return children;
}
