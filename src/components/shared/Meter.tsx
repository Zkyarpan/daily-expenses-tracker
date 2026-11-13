import { ALERT_THRESHOLDS } from "@/entities/Alert";
import { cn } from "@/lib/utils";

export type MeterTone = "brand" | "critical" | "neutral" | "success" | "warning";

const FILL_CLASS: Record<MeterTone, string> = {
  brand: "bg-primary",
  critical: "bg-destructive",
  neutral: "bg-muted-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
};

/**
 * Maps budget utilisation to the app-wide spending-alert thresholds
 * (warning at 80 %, critical at 100 %), so meters and alerts always agree.
 */
export function getUtilisationTone(percent: number): "critical" | "success" | "warning" {
  if (percent >= ALERT_THRESHOLDS.critical) return "critical";
  if (percent >= ALERT_THRESHOLDS.warning) return "warning";
  return "success";
}

interface MeterProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Accessible name, e.g. "Groceries budget used". */
  label: string;
  max?: number;
  size?: "md" | "sm";
  /** "auto" colours by utilisation threshold. */
  tone?: "auto" | MeterTone;
  value: number;
  /** Spoken value, e.g. "£80 of £100 spent". Defaults to the percentage. */
  valueText?: string;
}

/** Accessible progress meter. Values above max show a full bar but report the true percentage. */
export function Meter({
  className,
  label,
  max = 100,
  size = "md",
  tone = "auto",
  value,
  valueText,
  ...props
}: MeterProps) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const clamped = Math.min(100, Math.max(0, percent));
  const resolvedTone = tone === "auto" ? getUtilisationTone(percent) : tone;

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={valueText ?? `${Math.round(percent)}%`}
      className={cn(
        "bg-muted relative w-full overflow-hidden rounded-full",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
      role="progressbar"
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          FILL_CLASS[resolvedTone],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
