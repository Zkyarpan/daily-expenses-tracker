"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  Flag,
  Home,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/money/ActionDialogs";
import { SetupRequiredCard } from "@/components/money/SetupRequiredCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan, usePlanMutations } from "@/hooks/plan/usePlan";
import { useProfileMutations } from "@/hooks/profile/useProfileMutations";
import { apiErrorMessage } from "@/lib/api/client";
import { isSetupRequired, localToday } from "@/lib/api/money";
import { projectSavings } from "@/lib/plan/calc";
import type { FixedCost, GoalPlan, PlanMonth, PlanStatus, PlanSummary, SavingsGoal } from "@/lib/plan/schemas";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

import { ContributeDialog, FixedCostDialog, GoalDialog, SalaryDialog } from "./PlanDialogs";

const ChartSkeleton = ({ height }: { height: string }) => <Skeleton className={cn("w-full rounded-xl", height)} />;
const SavingsHistoryChart = dynamic(() => import("./PlanCharts").then((m) => m.SavingsHistoryChart), {
  loading: () => <ChartSkeleton height="h-[240px]" />,
  ssr: false,
});
const ProjectionChart = dynamic(() => import("./PlanCharts").then((m) => m.ProjectionChart), {
  loading: () => <ChartSkeleton height="h-[260px]" />,
  ssr: false,
});

const HEADER = {
  description: "Where your salary goes, how much to save for your goals, and where that gets you long-term.",
  title: "Savings plan",
};

const STATUS: Record<PlanStatus, { label: string; tone: StatusTone }> = {
  behind: { label: "Behind", tone: "warning" },
  "goals-unaffordable": { label: "Goals too big", tone: "critical" },
  "no-goals": { label: "No goals yet", tone: "neutral" },
  "no-income": { label: "Add your salary", tone: "neutral" },
  "on-track": { label: "On track", tone: "success" },
};

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

function Card({
  action,
  children,
  className,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  icon: typeof Wallet;
  title: string;
}) {
  return (
    <section className={cn("bg-card flex min-w-0 flex-col rounded-2xl p-5 shadow-md sm:p-6", className)}>
      <div className="mb-5 flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs leading-5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Your month
// ─────────────────────────────────────────────────────────────────────────────

function MonthBreakdown({ onEditSalary, summary }: { onEditSalary: () => void; summary: PlanSummary }) {
  const income = summary.income ?? 0;
  const left = summary.leftToSpend ?? 0;
  const share = (v: number) => (income > 0 ? `${Math.max(0, Math.min(100, (v / income) * 100))}%` : "0%");
  const rows = [
    { amount: summary.fixedTotal, color: "bg-chart-2", label: "Fixed costs (rent, bills)", sign: "−" },
    { amount: summary.goalsMonthly, color: "bg-chart-1", label: "Save for your goals", sign: "−" },
  ];

  return (
    <Card
      className="lg:col-span-2"
      icon={Wallet}
      title="Your month"
      description="What happens to your salary each month."
      action={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEditSalary}>
          <Pencil className="size-3.5" aria-hidden />
          Salary
        </Button>
      }
    >
      {summary.income === null ? (
        <EmptyState
          variant="plain"
          icon={Wallet}
          title="Start with your salary"
          description="Add what you take home each month — then your rent, bills and goals."
          actions={
            <Button size="sm" onClick={onEditSalary}>
              Add salary
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-sm">Salary each month</span>
            <Money amount={income} className="text-2xl font-semibold tracking-tight" />
          </div>

          <div className="bg-muted flex h-3 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-chart-2 h-full" style={{ width: share(summary.fixedTotal) }} />
            <span className="bg-chart-1 h-full" style={{ width: share(summary.goalsMonthly) }} />
            <span className="bg-success h-full" style={{ width: share(Math.max(0, left)) }} />
          </div>

          <dl className="space-y-2.5 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", row.color)} aria-hidden />
                  {row.label}
                </dt>
                <dd className="font-medium tabular-nums">
                  {row.sign}
                  <Money amount={row.amount} />
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t pt-2.5">
              <dt className="flex items-center gap-2 font-medium">
                <span className="bg-success size-2.5 rounded-full" aria-hidden />
                Left for everyday spending
              </dt>
              <dd className="text-right">
                <Money amount={left} tone={left < 0 ? "negative" : "default"} className="text-base font-semibold" />
                {summary.leftToSpendPerDay !== null && left > 0 && (
                  <span className="text-muted-foreground block text-xs">
                    about <Money amount={summary.leftToSpendPerDay} /> a day
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}

function AdviceCard({
  monthlySavingsGoal,
  summary,
}: {
  monthlySavingsGoal: number | null;
  summary: PlanSummary;
}) {
  const { updateProfile } = useProfileMutations();
  const status = STATUS[summary.status];
  const need = summary.goalsMonthly;
  const avg = summary.avgSaved;

  const message: Record<PlanStatus, React.ReactNode> = {
    behind: (
      <>
        Your goals need <Money amount={need} /> a month, but lately you’ve saved about <Money amount={avg ?? 0} />. Spend about{" "}
        <Money amount={Math.max(0, need - (avg ?? 0))} className="font-semibold" /> less each month to catch up.
      </>
    ),
    "goals-unaffordable": (
      <>
        Your goals need <Money amount={need} /> a month, but after fixed costs you only have <Money amount={summary.afterFixed ?? 0} />.
        Move a deadline back or lower a target.
      </>
    ),
    "no-goals": <>Add a savings goal and the plan works out how much to put aside each month to reach it on time.</>,
    "no-income": <>Add your salary to see where your money goes and how much you can save.</>,
    "on-track": (
      <>
        Your goals need <Money amount={need} /> a month
        {avg !== null ? (
          <>
            {" "}and lately you’ve saved about <Money amount={avg} className="font-semibold" /> — keep it up.
          </>
        ) : (
          <>
            . Keep everyday spending under <Money amount={Math.max(0, summary.leftToSpend ?? 0)} /> and you’ll get there.
          </>
        )}
      </>
    ),
  };

  const canSync = summary.income !== null && need > 0 && Math.round(need * 100) !== Math.round((monthlySavingsGoal ?? 0) * 100);

  return (
    <Card icon={Flag} title="How you’re doing" action={<StatusBadge tone={status.tone} dot>{status.label}</StatusBadge>}>
      <p className="text-sm leading-6">{message[summary.status]}</p>
      {avg !== null && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-xl px-3 py-2">
            <dt className="text-muted-foreground text-[11px]">Avg. saved / month</dt>
            <dd className="text-sm font-semibold tabular-nums">
              <Money amount={avg} tone={avg < 0 ? "negative" : "default"} />
            </dd>
          </div>
          <div className="bg-muted/50 rounded-xl px-3 py-2">
            <dt className="text-muted-foreground text-[11px]">Avg. everyday spending</dt>
            <dd className="text-sm font-semibold tabular-nums">
              <Money amount={summary.avgEveryday ?? 0} />
            </dd>
          </div>
        </dl>
      )}
      {canSync && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5 w-full gap-1.5"
          disabled={updateProfile.isPending}
          onClick={() =>
            updateProfile.mutate(
              { monthlySavingsGoal: need },
              {
                onError: (error) => toast.error(apiErrorMessage(error)),
                onSuccess: () => toast.success(`Home will track saving ${formatCurrency(need)} a month`),
              },
            )
          }
        >
          <Home className="size-3.5" aria-hidden />
          Track {formatCurrency(need)}/month on Home
        </Button>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixed costs and goals
// ─────────────────────────────────────────────────────────────────────────────

function RowMenu({ label, onDelete, onEdit }: { label: string; onDelete: () => void; onEdit: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${label}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GoalCard({
  goal,
  milestone,
  onAdd,
  onDelete,
  onEdit,
}: {
  goal: GoalPlan;
  milestone: { onTime: boolean | null; reachedLabel: string | null } | undefined;
  onAdd: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const done = goal.savedAmount >= goal.targetAmount;
  return (
    <li className="bg-muted/30 flex min-w-0 flex-col rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{goal.name}</h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <CalendarClock className="size-3" aria-hidden />
            {goal.targetDate ? `By ${formatDay(goal.targetDate)}` : "No deadline"}
          </p>
        </div>
        <RowMenu label={goal.name} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <Money amount={goal.savedAmount} className="font-semibold" />
          <span className="text-muted-foreground text-xs">
            of <Money amount={goal.targetAmount} />
          </span>
        </div>
        <Meter size="sm" tone={done ? "success" : "brand"} label={`${goal.name} progress`} value={goal.savedAmount} max={goal.targetAmount} />
      </div>
      <div className="text-muted-foreground mt-3 space-y-1 text-xs">
        {done ? (
          <p className="text-success flex items-center gap-1 font-medium">
            <CircleCheck className="size-3.5" aria-hidden />
            Goal reached
          </p>
        ) : (
          <>
            {goal.monthlyNeed !== null && (
              <p>
                Save <Money amount={goal.monthlyNeed} className="text-foreground font-semibold" /> a month
                {goal.monthsLeft ? ` for ${goal.monthsLeft} ${goal.monthsLeft === 1 ? "month" : "months"}` : ""}
              </p>
            )}
            {milestone?.reachedLabel && (
              <p className={cn(milestone.onTime === false && "text-warning")}>
                At your chosen rate: {milestone.reachedLabel}
                {milestone.onTime === false ? " — after the deadline" : ""}
              </p>
            )}
          </>
        )}
      </div>
      {/* Pushes the button to the bottom so cards in a row line up. */}
      <div className="min-h-3 flex-1" aria-hidden />
      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onAdd}>
        <PiggyBank className="size-3.5" aria-hidden />
        Add money
      </Button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function PlanView() {
  const query = usePlan();
  const { deleteFixedCost, deleteGoal } = usePlanMutations();
  const today = localToday();

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [costDialog, setCostDialog] = useState<{ cost?: FixedCost; open: boolean }>({ open: false });
  const [goalDialog, setGoalDialog] = useState<{ goal?: SavingsGoal; open: boolean }>({ open: false });
  const [contributing, setContributing] = useState<GoalPlan | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; kind: "cost" | "goal"; name: string } | null>(null);
  const [monthly, setMonthly] = useState<number | null>(null);

  const data = query.data && !isSetupRequired(query.data) ? query.data : null;
  const summary = data?.summary;
  const chosenMonthly = monthly ?? summary?.suggestedMonthly ?? 0;
  const sliderMax = Math.max(100, Math.ceil(Math.max(summary?.afterFixed ?? 0, summary?.suggestedMonthly ?? 0, chosenMonthly) / 10) * 10);

  const projection = useMemo(
    () =>
      summary
        ? projectSavings({ goals: summary.goals, monthly: chosenMonthly, start: summary.totalSaved, today })
        : null,
    [chosenMonthly, summary, today],
  );

  const actions = (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCostDialog({ open: true })}>
        <Plus className="size-3.5" aria-hidden />
        Fixed cost
      </Button>
      <Button size="sm" className="gap-1.5" onClick={() => setGoalDialog({ open: true })}>
        <Target className="size-3.5" aria-hidden />
        New goal
      </Button>
    </>
  );

  if (getIsDemoMode()) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <EmptyState headingLevel="h2" icon={Target} title="Needs a signed-in account" description="Your plan is saved to your own account." />
      </div>
    );
  }
  if (query.isPending) return <MoneyPageSkeleton />;
  if (query.isError) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState title="Your plan could not be loaded" message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!data || !summary || !projection) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <SetupRequiredCard />
      </div>
    );
  }

  const at = (months: number) => projection.points[Math.min(months, projection.points.length - 1)]?.total ?? 0;
  const completeMonths = data.history.filter((h: PlanMonth) => h.complete);

  return (
    <div className="space-y-6">
      <PageHeader {...HEADER} actions={actions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <MonthBreakdown summary={summary} onEditSalary={() => setSalaryOpen(true)} />
        <AdviceCard summary={summary} monthlySavingsGoal={data.monthlySavingsGoal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          icon={Home}
          title="Fixed costs"
          description={
            <>
              <Money amount={summary.fixedTotal} className="text-foreground font-medium" /> a month
            </>
          }
          action={
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setCostDialog({ open: true })}>
              <Plus className="size-3.5" aria-hidden />
              Add
            </Button>
          }
        >
          {data.fixedCosts.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-6">Add rent, phone, subscriptions — money that goes out every month.</p>
          ) : (
            <ul className="-mx-2 divide-y">
              {data.fixedCosts.map((cost) => (
                <li key={cost.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cost.name}</p>
                    {cost.dueDay && <p className="text-muted-foreground text-xs">Paid on day {cost.dueDay}</p>}
                  </div>
                  <Money amount={cost.amount} className="text-sm font-semibold" />
                  <RowMenu
                    label={cost.name}
                    onEdit={() => setCostDialog({ cost, open: true })}
                    onDelete={() => setDeleting({ id: cost.id, kind: "cost", name: cost.name })}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          icon={Target}
          title="Savings goals"
          description={
            summary.goals.length > 0 ? (
              <>
                <Money amount={summary.totalSaved} className="text-foreground font-medium" /> saved across {summary.goals.length}{" "}
                {summary.goals.length === 1 ? "goal" : "goals"}
              </>
            ) : (
              "Long-term things you’re saving towards"
            )
          }
          action={
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setGoalDialog({ open: true })}>
              <Plus className="size-3.5" aria-hidden />
              Add
            </Button>
          }
        >
          {summary.goals.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={Target}
              title="No goals yet"
              description="An emergency fund, a holiday, a deposit… add one and see how much to save each month."
              actions={
                <Button size="sm" onClick={() => setGoalDialog({ open: true })}>
                  Add a goal
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {summary.goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  milestone={projection.milestones.find((m) => m.id === goal.id)}
                  onAdd={() => setContributing(goal)}
                  onEdit={() => setGoalDialog({ goal, open: true })}
                  onDelete={() => setDeleting({ id: goal.id, kind: "goal", name: goal.name })}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        icon={TrendingUp}
        title="What you’ve saved each month"
        description="Salary minus fixed costs and everything else you spent. Expenses named like a fixed cost (e.g. “Rent”) aren’t counted twice."
      >
        {summary.income === null ? (
          <p className="text-muted-foreground text-sm">Add your salary to see how much you’ve saved each month.</p>
        ) : completeMonths.every((h) => h.spent === 0) && data.history.at(-1)?.spent === 0 ? (
          <p className="text-muted-foreground text-sm">Record some expenses and your monthly savings will appear here.</p>
        ) : (
          <SavingsHistoryChart history={data.history} target={summary.goalsMonthly || data.monthlySavingsGoal} />
        )}
      </Card>

      <Card
        icon={PiggyBank}
        title="Long-term: if you save every month"
        description="Move the slider to see where saving a set amount each month gets you, and when each goal is reached."
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="monthly-saving" className="text-sm font-medium">
                I save each month
              </label>
              <Money amount={chosenMonthly} className="text-2xl font-semibold tracking-tight" />
            </div>
            <input
              id="monthly-saving"
              type="range"
              min={0}
              max={sliderMax}
              step={5}
              value={Math.min(chosenMonthly, sliderMax)}
              onChange={(e) => setMonthly(Number(e.target.value))}
              className="accent-primary w-full"
              aria-valuetext={`${formatCurrency(chosenMonthly)} a month`}
            />
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {summary.goalsMonthly > 0 && (
                <button type="button" className="hover:text-foreground underline-offset-2 hover:underline" onClick={() => setMonthly(summary.goalsMonthly)}>
                  Goals need {formatCurrency(summary.goalsMonthly)}
                </button>
              )}
              {summary.avgSaved !== null && summary.avgSaved > 0 && (
                <button type="button" className="hover:text-foreground underline-offset-2 hover:underline" onClick={() => setMonthly(Math.round(summary.avgSaved!))}>
                  What you usually save: {formatCurrency(summary.avgSaved)}
                </button>
              )}
              {summary.afterFixed !== null && chosenMonthly > summary.afterFixed && (
                <span className="text-warning flex items-center gap-1">
                  <TriangleAlert className="size-3" aria-hidden />
                  More than you have after fixed costs
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: "In 6 months", value: at(6) },
              { label: "In 1 year", value: at(12) },
              { label: "In 2 years", value: at(24) },
            ].map((s) => (
              <div key={s.label} className="bg-muted/50 min-w-0 rounded-xl px-2.5 py-2.5 sm:px-3">
                <dt className="text-muted-foreground text-xs">{s.label}</dt>
                <dd className="text-sm font-semibold tabular-nums sm:text-lg">
                  <Money amount={s.value} />
                </dd>
              </div>
            ))}
          </dl>

          <ProjectionChart points={projection.points} />

          {projection.milestones.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projection.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                  <span className="truncate font-medium">{m.name}</span>
                  <StatusBadge tone={m.reachedLabel === null ? "neutral" : m.onTime === false ? "warning" : "success"} className="shrink-0">
                    {m.reachedLabel ?? "Not at this rate"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <SalaryDialog income={summary.income} open={salaryOpen} onOpenChange={setSalaryOpen} />
      <FixedCostDialog cost={costDialog.cost} open={costDialog.open} onOpenChange={(open) => setCostDialog((s) => ({ ...s, open }))} />
      <GoalDialog goal={goalDialog.goal} open={goalDialog.open} today={today} onOpenChange={(open) => setGoalDialog((s) => ({ ...s, open }))} />
      <ContributeDialog goal={contributing} monthlyNeed={contributing?.monthlyNeed ?? null} onOpenChange={(open) => !open && setContributing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting?.kind === "goal" ? "Delete this goal?" : "Delete this fixed cost?"}
        description={deleting ? `“${deleting.name}” will be removed from your plan.` : ""}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          if (deleting.kind === "goal") await deleteGoal.mutateAsync(deleting.id);
          else await deleteFixedCost.mutateAsync(deleting.id);
          toast.success(`${deleting.name} deleted`);
        }}
      />
    </div>
  );
}
