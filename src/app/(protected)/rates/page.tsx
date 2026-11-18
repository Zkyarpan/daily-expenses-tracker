import type { Metadata } from "next";

import { ExchangeRatesView } from "@/components/currency/CurrencyTools";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Exchange rates" };

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="text-xs font-semibold tracking-wider uppercase">Tools</span>}
        title="Exchange rates"
        description="See what your money is worth in other currencies — pounds, dollars, rupees and more — and convert any amount."
      />
      <ExchangeRatesView />
    </div>
  );
}
