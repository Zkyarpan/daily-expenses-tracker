"use client";

import { ArrowRight, Bell, Camera, Check, HandCoins, Home, PartyPopper, PiggyBank, Receipt, Sparkles, Target, Wallet, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { Button } from "@/components/ui/button";
import { useMoneyOverview } from "@/hooks/money/useMoney";
import { usePlan } from "@/hooks/plan/usePlan";
import { useProfileStats } from "@/hooks/profile/useProfile";
import { setChecklistHidden, useEngagementStore } from "@/lib/onboarding/prefs";
import { cn } from "@/lib/utils";

interface Step {
  done: boolean;
  hint: string;
  icon: typeof Wallet;
  id: string;
  label: string;
  /** Link, or a quick action that opens a dialog in place. */
  to: string | (() => void);
}

/**
 * Home-page checklist that walks a new user to a fully set-up account:
 * salary, bills, a goal, first expense, a budget, an IOU, a receipt scan,
 * asking the AI and the daily reminder. Ticks come from real data where
 * there is some (and from this device for actions that leave none).
 */
export function GettingStarted() {
  const { checklistHidden, done, prefs, ready } = useEngagementStore();
  const stats = useProfileStats();
  const overview = useMoneyOverview();
  const plan = usePlan();
  const { openExpense, openIou, openReceiptScan } = useQuickAdd();

  if (!ready || checklistHidden || stats.isPending || overview.isPending || plan.isPending) return null;

  const planData = plan.data && !("setupRequired" in plan.data) ? plan.data : null;

  const steps: Step[] = [
    {
      done: overview.data?.savings.income != null,
      hint: "So we can work out what you can save.",
      icon: Wallet,
      id: "income",
      label: "Add your monthly pay",
      to: "/plan",
    },
    {
      done: (planData?.fixedCosts.length ?? 0) > 0,
      hint: "Rent and bills come off first.",
      icon: Home,
      id: "bills",
      label: "Add rent & bills",
      to: "/plan",
    },
    {
      done: (planData?.goals.length ?? 0) > 0,
      hint: "A holiday, a laptop, a safety net…",
      icon: Target,
      id: "goal",
      label: "Set a savings goal",
      to: "/plan",
    },
    {
      done: (stats.data?.expenses ?? 0) > 0,
      hint: "Takes about 10 seconds.",
      icon: Receipt,
      id: "expense",
      label: "Log an expense",
      to: openExpense,
    },
    {
      done: (stats.data?.budgets ?? 0) > 0,
      hint: "Get an alert at 80% and when you go over.",
      icon: PiggyBank,
      id: "budget",
      label: "Set a monthly budget",
      to: "/budgets",
    },
    {
      done: (overview.data?.ious?.openCount ?? 0) > 0 || Boolean(done.iou),
      hint: "Who owes you, and who you owe.",
      icon: HandCoins,
      id: "iou",
      label: "Record money lent or borrowed",
      to: () => openIou(),
    },
    {
      done: Boolean(done.receipt),
      hint: "AI reads the shop, total and date.",
      icon: Camera,
      id: "receipt",
      label: "Scan a receipt",
      to: openReceiptScan,
    },
    {
      done: Boolean(done["ask-ai"]),
      hint: "“How much did I spend on TfL?”",
      icon: Sparkles,
      id: "ai",
      label: "Ask AI a question",
      to: "/assistant",
    },
    {
      done: prefs.dailyReminder,
      hint: "A nudge to log the day’s spending.",
      icon: Bell,
      id: "reminder",
      label: "Turn on a daily reminder",
      to: "/profile?tab=preferences",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;
  const percent = Math.round((completed / steps.length) * 100);

  const hide = () => {
    setChecklistHidden(true);
    toast.info("Checklist hidden", { description: "Bring it back from Profile → Preferences." });
  };

  if (allDone) {
    return (
      <section data-tour="checklist" className="bg-card flex items-center gap-3 rounded-2xl p-4 shadow-md sm:p-5">
        <span className="bg-success/15 text-success flex size-10 shrink-0 items-center justify-center rounded-xl">
          <PartyPopper className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">You’re all set up</h2>
          <p className="text-muted-foreground text-sm">Everything is in place — the app now works for you every day.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={hide}>
          Hide
        </Button>
      </section>
    );
  }

  return (
    <section data-tour="checklist" aria-labelledby="getting-started-title" className="bg-card rounded-2xl p-4 shadow-md sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="getting-started-title" className="text-base font-semibold tracking-tight">
            Get the most out of your money app
          </h2>
          <p className="text-muted-foreground text-sm">
            {completed} of {steps.length} done — each step makes your numbers more useful.
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label="Hide the getting-started checklist"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring -mt-1 -mr-1 rounded-full p-1.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {/* Unfinished first, so the next step is always at the top. */}
        {[...steps.filter((s) => !s.done), ...steps.filter((s) => s.done)].map((step) => {
          const content = (
            <>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  step.done ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
                )}
              >
                {step.done ? <Check className="size-4" aria-hidden /> : <step.icon className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-medium", step.done && "text-muted-foreground line-through")}>{step.label}</span>
                <span className="text-muted-foreground block truncate text-xs">{step.done ? "Done" : step.hint}</span>
              </span>
              {!step.done && (
                <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              )}
            </>
          );
          const className = cn(
            "group focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
            step.done ? "bg-muted/30 border-transparent" : "hover:bg-muted/50",
          );
          return (
            <li key={step.id}>
              {typeof step.to === "string" ? (
                <Link href={step.to} className={className} aria-label={step.done ? `${step.label} (done)` : undefined}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={step.to} className={className} aria-label={step.done ? `${step.label} (done)` : undefined}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
