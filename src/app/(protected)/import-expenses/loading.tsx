import { ImportPageSkeleton } from "@/components/shared/PageSkeletons";

/**
 * Route loading UI for Import. Shown instantly on navigation (and used as
 * the prefetch boundary) while the page loads; it matches the page layout.
 */
export default function Loading() {
  return <ImportPageSkeleton />;
}
