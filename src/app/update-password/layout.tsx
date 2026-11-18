import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/update-password" },
  description: "Choose a new password for your account.",
  robots: { follow: true, index: false },
  title: "Set a new password",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
