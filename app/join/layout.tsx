import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join a game",
  description: "Enter a code to join a Bmode game on your phone.",
};

export default function Layout({ children }: LayoutProps<"/join">) {
  return children;
}
