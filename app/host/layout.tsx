import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host a game",
  description: "Start a Bmode question game and invite people to join from their phones.",
};

export default function Layout({ children }: LayoutProps<"/host">) {
  return children;
}
