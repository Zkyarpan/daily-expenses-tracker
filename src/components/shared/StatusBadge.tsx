import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "brand" | "critical" | "info" | "neutral" | "success" | "warning";

const TONE_CLASS: Record<StatusTone, string> = {
  brand: "border-primary/20 bg-primary/10 text-primary",
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/20 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
};

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  /** Leading dot. Always pair status colour with a text label. */
  dot?: boolean;
  tone?: StatusTone;
}

/** Tinted status label built on the shadcn/ui Badge. */
export function StatusBadge({
  children,
  className,
  dot = false,
  tone = "neutral",
  ...props
}: StatusBadgeProps) {
  return (
    <Badge className={cn("gap-1.5", TONE_CLASS[tone], className)} variant="outline" {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  );
}
