import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Card shell for every section of the profile page. */
export function SettingsCard({
  action,
  children,
  className,
  description,
  footer,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** Right-aligned actions on a tinted strip, e.g. a Save button. */
  footer?: React.ReactNode;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <section className={cn("bg-card flex min-w-0 flex-col rounded-2xl shadow-md", className)}>
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        {Icon && (
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <div className="text-muted-foreground mt-0.5 text-sm leading-6">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex-1 p-5 sm:p-6">{children}</div>
      {footer && (
        <div className="bg-muted/30 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t px-5 py-3.5 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Label/value row used in detail lists. */
export function DetailRow({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** Date in the viewer's locale/time zone (server render may differ, so hydration warnings are suppressed). */
export function LocalDate({ iso, withTime = false }: { iso: string | null; withTime?: boolean }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" })}
    </time>
  );
}
