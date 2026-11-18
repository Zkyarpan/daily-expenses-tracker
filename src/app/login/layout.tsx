import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/login" },
  description: "Sign in to see your spending, savings goals and who owes who.",
  robots: { follow: true, index: true },
  title: "Sign in",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
