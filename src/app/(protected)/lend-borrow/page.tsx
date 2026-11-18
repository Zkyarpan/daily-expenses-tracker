import type { Metadata } from "next";

import { LendBorrowView } from "@/components/money/LendBorrowView";

export const metadata: Metadata = { title: "Lend & borrow · Daily Expenses" };

export default function LendBorrowPage() {
  return <LendBorrowView />;
}
