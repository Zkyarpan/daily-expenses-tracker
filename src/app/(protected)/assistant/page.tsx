import type { Metadata } from "next";

import { AssistantView } from "@/components/assistant/AssistantView";

export const metadata: Metadata = { title: "Ask AI · Daily Expenses" };

export default function AssistantPage() {
  return <AssistantView />;
}
