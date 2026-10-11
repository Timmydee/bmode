import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join a session",
  description: "Enter a code to join a Bmode session on your phone.",
};

export default function Layout({ children }: LayoutProps<"/join">) {
  return children;
}
