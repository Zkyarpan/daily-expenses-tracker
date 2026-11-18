import type { Metadata } from "next";

import { PlanView } from "@/components/plan/PlanView";

export const metadata: Metadata = { title: "Savings plan · Daily Expenses" };

export default function PlanPage() {
  return <PlanView />;
}
