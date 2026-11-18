import { StatCardSkeleton } from "@/components/shared/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Page-shaped loading placeholders. Each route's `loading.tsx` and the page's
 * own "data is loading" state render the same skeleton, so navigating shows
 * one steady layout instead of a generic block that jumps to another shape.
 *
 * Plain components (no hooks), safe in server and client components.
 */

function Loading({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6" role="status">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Title + description on the left, `actions` button placeholders on the right. */
export function HeaderSkeleton({ actions = 1, eyebrow = false }: { actions?: number; eyebrow?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        {eyebrow && <Skeleton className="h-3.5 w-28 rounded-full" />}
        <Skeleton className="h-8 w-52 max-w-full rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded-full" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ count, className }: { className?: string; count: number }) {
  return (
    <div aria-hidden className={cn("grid grid-cols-2 gap-3 sm:gap-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A card-shaped block with a title line, used for charts and panels. */
function PanelSkeleton({ className, height = "h-64" }: { className?: string; height?: string }) {
  return (
    <div aria-hidden className={cn("bg-card space-y-5 rounded-2xl p-5 shadow-md sm:p-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36 rounded-full" />
        <Skeleton className="h-3 w-52 max-w-full rounded-full" />
      </div>
      <Skeleton className={cn("w-full rounded-xl", height)} />
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="bg-card overflow-hidden rounded-2xl shadow-md">
      <div className="flex gap-6 border-b px-5 py-4">
        {[16, 28, 20, 24, 20].map((w, i) => (
          <Skeleton key={i} className="h-3.5 rounded-full" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-4 w-[16%] rounded-full" />
            <Skeleton className="h-4 w-[28%] rounded-full" />
            <Skeleton className="h-4 w-[20%] rounded-full" />
            <Skeleton className="h-4 w-[24%] rounded-full" />
            <Skeleton className="h-4 w-[12%] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────

export function DashboardPageSkeleton() {
  return (
    <Loading label="Loading dashboard…">
      {/* Hero: greeting + this month's number, action tiles beside it */}
      <div aria-hidden className="bg-card grid gap-6 rounded-3xl p-5 shadow-md sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-40 rounded-full" />
          <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
          <Skeleton className="mt-4 h-4 w-28 rounded-full" />
          <Skeleton className="h-12 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PanelSkeleton height="h-[300px]" />
          <PanelSkeleton height="h-[280px]" />
        </div>
        <div className="space-y-6">
          <PanelSkeleton height="h-[260px]" />
          <PanelSkeleton height="h-[180px]" />
        </div>
      </div>
    </Loading>
  );
}

export function ExpensesPageSkeleton() {
  return (
    <Loading label="Loading expenses…">
      <HeaderSkeleton actions={2} />
      <div aria-hidden className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <StatRow count={4} className="xl:grid-cols-4" />
      <div aria-hidden className="bg-card grid gap-8 rounded-2xl p-5 shadow-md sm:p-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-3 w-20 rounded-full" />
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <Skeleton aria-hidden className="h-11 w-full rounded-2xl" />
      <TableSkeleton rows={8} />
    </Loading>
  );
}

export function BudgetsPageSkeleton() {
  return (
    <Loading label="Loading budgets…">
      <HeaderSkeleton actions={2} />
      <StatRow count={3} className="sm:grid-cols-3" />
      <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-card space-y-4 rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
            <div className="flex items-end justify-between">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Lend & borrow and Wishlist: header, four tiles, then a list panel. */
export function MoneyPageSkeleton() {
  return (
    <Loading label="Loading…">
      <HeaderSkeleton actions={2} />
      <StatRow count={4} className="lg:grid-cols-4" />
      <PanelSkeleton height="h-[320px]" />
    </Loading>
  );
}

export function ProfilePageSkeleton() {
  return (
    <Loading label="Loading profile…">
      <HeaderSkeleton actions={0} eyebrow />
      <div aria-hidden className="bg-card overflow-hidden rounded-2xl shadow-md">
        <Skeleton className="h-28 rounded-none sm:h-36" />
        <div className="space-y-6 px-5 pb-6 sm:px-6">
          <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
            <Skeleton className="ring-card size-24 rounded-full ring-4" />
            <div className="space-y-2 pb-1">
              <Skeleton className="h-6 w-40 rounded-full" />
              <Skeleton className="h-4 w-52 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton aria-hidden className="h-9 w-80 max-w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelSkeleton className="lg:col-span-2" height="h-[320px]" />
        <PanelSkeleton height="h-[320px]" />
      </div>
    </Loading>
  );
}

/** The analytics chart grid: trend + categories, then budget + year comparison. */
export function AnalyticsChartsSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelSkeleton className="lg:col-span-2" height="h-[300px]" />
        <PanelSkeleton height="h-[300px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton height="h-[300px]" />
        <PanelSkeleton height="h-[300px]" />
      </div>
    </div>
  );
}

/** Six overview tiles + charts; used by the route and while the page loads data. */
export function AnalyticsBodySkeleton() {
  return (
    <>
      <StatRow count={6} className="lg:grid-cols-3" />
      <AnalyticsChartsSkeleton />
    </>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <Loading label="Loading analytics…">
      <HeaderSkeleton actions={2} eyebrow />
      <Skeleton aria-hidden className="h-14 w-full rounded-2xl" />
      <AnalyticsBodySkeleton />
    </Loading>
  );
}

export function YearlyChartsPageSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  const body = (
    <>
      <StatRow count={4} className="xl:grid-cols-4" />
      <Skeleton aria-hidden className="h-9 w-80 max-w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton className="lg:col-span-2" height="h-[300px]" />
        <PanelSkeleton height="h-[260px]" />
        <PanelSkeleton height="h-[260px]" />
      </div>
    </>
  );

  return withHeader ? (
    <Loading label="Loading charts…">
      <HeaderSkeleton actions={4} eyebrow />
      {body}
    </Loading>
  ) : (
    <Loading label="Loading charts…">{body}</Loading>
  );
}

export function ImportPageSkeleton() {
  return (
    <Loading label="Loading import…">
      <HeaderSkeleton actions={0} />
      <Skeleton aria-hidden className="h-[66px] w-full rounded-2xl" />
      <div aria-hidden className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="bg-card space-y-5 rounded-2xl p-5 shadow-md sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-3.5 w-full max-w-64 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function TrackersPageSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  const body = (
    <>
      <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <StatCardSkeleton key={i} className="first:col-span-2 sm:first:col-span-1" />
        ))}
      </div>
      <div aria-hidden className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="bg-card space-y-5 rounded-2xl p-5 shadow-md sm:p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 w-36 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-8 w-44 rounded-lg" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        ))}
      </div>
    </>
  );

  return withHeader ? (
    <Loading label="Loading trackers…">
      <HeaderSkeleton />
      {body}
    </Loading>
  ) : (
    <Loading label="Loading trackers…">{body}</Loading>
  );
}
