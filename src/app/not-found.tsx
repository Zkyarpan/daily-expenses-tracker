import type { Metadata } from "next";

import { NotFoundView } from "@/components/shared/NotFoundView";

export const metadata: Metadata = { robots: { index: false }, title: "Page not found" };

export default function NotFound() {
  return <NotFoundView />;
}
