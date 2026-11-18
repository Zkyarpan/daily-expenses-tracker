import type { Metadata } from "next";

import { WishlistView } from "@/components/money/WishlistView";

export const metadata: Metadata = { title: "Wishlist · Daily Expenses" };

export default function WishlistPage() {
  return <WishlistView />;
}
