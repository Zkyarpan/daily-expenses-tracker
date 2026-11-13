import { DashboardPageSkeleton } from "@/components/shared/PageSkeletons";

/**
 * Route loading UI for Home (and any page without its own loading UI). Shown instantly on navigation (and used as
 * the prefetch boundary) while the page loads; it matches the page layout.
 */
export default function Loading() {
  return <DashboardPageSkeleton />;
}
