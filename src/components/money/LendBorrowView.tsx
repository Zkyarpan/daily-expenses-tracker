"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIous } from "@/hooks/money/useMoney";
import { useMoneyMutations } from "@/hooks/money/useMoneyMutations";
import { apiErrorMessage } from "@/lib/api/client";
import { isSetupRequired, localToday } from "@/lib/api/money";
import type { Iou, PersonBalance } from "@/lib/money/schemas";
import { isOverdue, outstanding } from "@/lib/money/summary";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

import { ConfirmDialog, IouPaymentDialog } from "./ActionDialogs";
import { useQuickAdd } from "./QuickAddProvider";
import { SetupRequiredCard } from "./SetupRequiredCard";

type StatusFilter = "all" | "open" | "settled";
type DirectionFilter = "all" | "borrowed" | "lent";

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Seed for a person's generated avatar (stable per name). */
const personSeed = (name: string) => `p-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}`;

const HEADER = {
  description: "Money you’ve lent and borrowed — who owes who, part-payments, and what’s settled.",
  title: "Lend & borrow",
};

function PersonCard({
  active,
  onClick,
  person,
}: {
  active: boolean;
  onClick: () => void;
  person: PersonBalance;
}) {
  const owesYou = person.balance > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "bg-card focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-2xl p-3.5 text-left shadow-md transition focus-visible:ring-2 focus-visible:outline-none",
        active ? "ring-primary ring-2" : "hover:bg-muted/40",
      )}
    >
      <UserAvatar name={person.person} seed={personSeed(person.person)} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{person.person}</span>
        <span className={cn("block text-xs", person.balance === 0 ? "text-muted-foreground" : owesYou ? "text-success" : "text-warning")}>
          {person.balance === 0 ? "Even" : owesYou ? "Owes you " : "You owe "}
          {person.balance !== 0 && <Money amount={Math.abs(person.balance)} className="font-semibold" />}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">{person.openCount} open</span>
    </button>
  );
}

function IouRow({
  iou,
  onDelete,
  onEdit,
  onPay,
  onReopen,
  onSettle,
  today,
}: {
  iou: Iou;
  onDelete: () => void;
  onEdit: () => void;
  onPay: () => void;
  onReopen: () => void;
  onSettle: () => void;
  today: string;
}) {
  const lent = iou.direction === "lent";
  const settled = !!iou.settledAt;
  const left = outstanding(iou);
  const overdue = isOverdue(iou, today);

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5", settled && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="relative shrink-0">
          <UserAvatar name={iou.person} seed={personSeed(iou.person)} size={40} />
          <span
            aria-hidden
            className={cn(
              "ring-card absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2",
              lent ? "bg-success text-white" : "bg-warning text-white",
            )}
          >
            {lent ? <ArrowUpRight className="size-3" /> : <ArrowDownLeft className="size-3" />}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {lent ? (
              <>
                <span className="font-semibold">{iou.person}</span> owes you
              </>
            ) : (
              <>
                You owe <span className="font-semibold">{iou.person}</span>
              </>
            )}
            {iou.description && <span className="text-muted-foreground"> · {iou.description}</span>}
          </p>
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>{formatDay(iou.date)}</span>
            {iou.dueDate && !settled && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" aria-hidden />
                due {formatDay(iou.dueDate)}
              </span>
            )}
            {overdue && (
              <StatusBadge tone="critical" dot className="py-0 text-[11px]">
                Overdue
              </StatusBadge>
            )}
            {settled && (
              <StatusBadge tone="success" dot className="py-0 text-[11px]">
                Settled {iou.settledAt ? formatDay(iou.settledAt.slice(0, 10)) : ""}
              </StatusBadge>
            )}
          </p>
          {!settled && iou.paidAmount > 0 && (
            <div className="mt-2 max-w-xs space-y-1">
              <Meter size="sm" tone="success" label="Repaid" value={iou.paidAmount} max={iou.amount} />
              <p className="text-muted-foreground text-xs">
                <Money amount={iou.paidAmount} /> of <Money amount={iou.amount} /> paid back
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <Money
            amount={settled ? iou.amount : left}
            className={cn("block text-base font-semibold", !settled && (lent ? "text-success" : "text-warning"))}
          />
          {!settled && iou.paidAmount > 0 && <span className="text-muted-foreground text-xs">left</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!settled && (
            <>
              <Button variant="outline" size="sm" onClick={onPay} className="hidden sm:inline-flex">
                Part paid
              </Button>
              <Button size="sm" className="gap-1" onClick={onSettle}>
                <Check className="size-3.5" aria-hidden />
                Settled
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${iou.person}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!settled && (
                <DropdownMenuItem onSelect={onPay} className="sm:hidden">
                  <HandCoins aria-hidden />
                  Record part payment
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              {settled && (
                <DropdownMenuItem onSelect={onReopen}>
                  <RotateCcw aria-hidden />
                  Mark as not paid
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

export function LendBorrowView() {
  const query = useIous();
  const { deleteIou, updateIou } = useMoneyMutations();
  const { openIou } = useQuickAdd();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [person, setPerson] = useState<string | null>(null);
  const [paying, setPaying] = useState<Iou | null>(null);
  const [deleting, setDeleting] = useState<Iou | null>(null);
  const today = localToday();

  const data = query.data && !isSetupRequired(query.data) ? query.data : null;

  const visible = useMemo(() => {
    if (!data) return [];
    return data.ious
      .filter((i) => (status === "all" ? true : status === "open" ? !i.settledAt : !!i.settledAt))
      .filter((i) => direction === "all" || i.direction === direction)
      .filter((i) => !person || i.person.trim().toLowerCase() === person.toLowerCase())
      .sort((a, b) => {
        if (!!a.settledAt !== !!b.settledAt) return a.settledAt ? 1 : -1;
        const overdueFirst = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
        return overdueFirst || b.date.localeCompare(a.date);
      });
  }, [data, direction, person, status, today]);

  const act = (iou: Iou, action: "reopen" | "settle") =>
    updateIou.mutate(
      { id: iou.id, update: { action } },
      {
        onError: (error) => toast.error(apiErrorMessage(error)),
        onSuccess: () =>
          toast.success(action === "settle" ? `Settled with ${iou.person}` : "Marked as not paid", {
            action:
              action === "settle"
                ? { label: "Undo", onClick: () => updateIou.mutate({ id: iou.id, update: { action: "reopen" } }) }
                : undefined,
          }),
      },
    );

  const actions = (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openIou({ direction: "borrowed" })}>
        <ArrowDownLeft className="size-3.5" aria-hidden />I borrowed
      </Button>
      <Button size="sm" className="gap-1.5" onClick={() => openIou({ direction: "lent" })}>
        <ArrowUpRight className="size-3.5" aria-hidden />I lent
      </Button>
    </>
  );

  if (getIsDemoMode()) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <EmptyState headingLevel="h2" icon={HandCoins} title="Needs a signed-in account" description="Lend & borrow saves to your own account, so it isn’t available with demo data." />
      </div>
    );
  }
  if (query.isPending) return <MoneyPageSkeleton />;
  if (query.isError) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState title="Your entries could not be loaded" message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <SetupRequiredCard />
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      <PageHeader {...HEADER} actions={actions} />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="They owe you" icon={ArrowUpRight} value={<Money amount={summary.owedToMe} tone={summary.owedToMe > 0 ? "positive" : "default"} />} hint="Money to come back to you" />
        <StatCard label="You owe" icon={ArrowDownLeft} value={<Money amount={summary.iOwe} />} hint="Money to pay back" />
        <StatCard
          label="Net balance"
          icon={Scale}
          value={<Money amount={summary.net} signed tone={summary.net > 0 ? "positive" : summary.net < 0 ? "negative" : "default"} />}
          hint={summary.net > 0 ? "In your favour" : summary.net < 0 ? "You owe more than you’re owed" : "All square"}
        />
        <StatCard
          label="Open entries"
          icon={HandCoins}
          value={summary.openCount}
          hint={summary.overdueCount > 0 ? `${summary.overdueCount} overdue` : "Nothing overdue"}
        />
      </section>

      {summary.people.length > 0 && (
        <section aria-labelledby="people-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="people-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Users className="text-muted-foreground size-4" aria-hidden />
              People
            </h2>
            {person && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setPerson(null)}>
                <X className="size-3.5" aria-hidden />
                Show everyone
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summary.people.map((p) => (
              <PersonCard
                key={p.person}
                person={p}
                active={person?.toLowerCase() === p.person.toLowerCase()}
                onClick={() => setPerson((current) => (current?.toLowerCase() === p.person.toLowerCase() ? null : p.person))}
              />
            ))}
          </div>
        </section>
      )}

      <section className="bg-card overflow-hidden rounded-2xl shadow-md" aria-label="Entries">
        <div className="flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="open" className="px-3">Open</TabsTrigger>
              <TabsTrigger value="settled" className="px-3">Settled</TabsTrigger>
              <TabsTrigger value="all" className="px-3">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="all" className="px-3">Everyone</TabsTrigger>
              <TabsTrigger value="lent" className="px-3">Owes me</TabsTrigger>
              <TabsTrigger value="borrowed" className="px-3">I owe</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={HandCoins}
            title={data.ious.length === 0 ? "No one owes anyone yet" : "Nothing here"}
            description={
              data.ious.length === 0
                ? "Lent someone money, or borrowed some? Add it so you always know who owes who."
                : status === "open"
                  ? "Everything matching these filters is settled."
                  : "No entries match these filters."
            }
            actions={
              data.ious.length === 0 ? (
                <Button size="sm" className="gap-1.5" onClick={() => openIou()}>
                  <Plus className="size-3.5" aria-hidden />
                  Add an entry
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y">
            {visible.map((iou) => (
              <IouRow
                key={iou.id}
                iou={iou}
                today={today}
                onPay={() => setPaying(iou)}
                onSettle={() => act(iou, "settle")}
                onReopen={() => act(iou, "reopen")}
                onEdit={() => openIou({ iou })}
                onDelete={() => setDeleting(iou)}
              />
            ))}
          </ul>
        )}
      </section>

      <IouPaymentDialog iou={paying} onOpenChange={(open) => !open && setPaying(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this entry?"
        description={
          deleting
            ? `${deleting.direction === "lent" ? `${deleting.person} owes you` : `You owe ${deleting.person}`} ${formatCurrency(deleting.amount)}. This can’t be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await deleteIou.mutateAsync(deleting.id);
          toast.success("Entry deleted");
        }}
      />
    </div>
  );
}
