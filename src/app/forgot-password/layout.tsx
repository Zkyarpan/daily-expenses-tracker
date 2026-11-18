import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/forgot-password" },
  description: "Get a link to reset your password.",
  robots: { follow: true, index: false },
  title: "Reset your password",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
