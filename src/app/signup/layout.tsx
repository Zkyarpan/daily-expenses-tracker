import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/signup" },
  description: "Create a free account to track spending, plan savings, track who owes who and scan receipts with AI.",
  robots: { follow: true, index: true },
  title: "Create your free account",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
