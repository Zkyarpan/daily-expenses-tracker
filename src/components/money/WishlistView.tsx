"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Gift,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMoneyOverview, useWishlist } from "@/hooks/money/useMoney";
import { useMoneyMutations } from "@/hooks/money/useMoneyMutations";
import { apiErrorMessage } from "@/lib/api/client";
import { isSetupRequired } from "@/lib/api/money";
import { CATEGORY_ICONS_BY_NAME, DEFAULT_CATEGORIES } from "@/lib/config";
import type { Priority, WishlistItem } from "@/lib/money/schemas";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

import { ConfirmDialog, WishlistBuyDialog, WishlistSaveDialog } from "./ActionDialogs";
import { useQuickAdd } from "./QuickAddProvider";
import { SetupRequiredCard } from "./SetupRequiredCard";
import { PRIORITY_LABEL } from "./WishlistFormDialog";

const HEADER = {
  description: "Things you want to buy — save up for them, then tick them off.",
  title: "Wishlist",
};

const PRIORITY_TONE: Record<Priority, StatusTone> = { high: "critical", low: "neutral", medium: "info" };

const categoryName = (id: string) => DEFAULT_CATEGORIES.find((c) => c.id === id)?.name ?? "Shopping";

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ItemCard({
  item,
  onBuy,
  onDelete,
  onEdit,
  onSave,
  safeToSpend,
}: {
  item: WishlistItem;
  onBuy: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSave: () => void;
  safeToSpend: number | null;
}) {
  const remaining = Math.max(0, Math.round((item.price - item.savedAmount) * 100) / 100);
  const ready = remaining === 0;
  const affordable = !ready && safeToSpend !== null && remaining <= safeToSpend;
  const Icon = CATEGORY_ICONS_BY_NAME[categoryName(item.categoryId)] ?? ShoppingBag;

  return (
    <li className="bg-card flex min-w-0 flex-col rounded-2xl p-5 shadow-md">
      <div className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{item.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={PRIORITY_TONE[item.priority]} className="py-0 text-[11px]">
              {PRIORITY_LABEL[item.priority]}
            </StatusBadge>
            {ready && (
              <StatusBadge tone="success" dot className="py-0 text-[11px]">
                Ready to buy
              </StatusBadge>
            )}
            {affordable && (
              <StatusBadge tone="success" className="py-0 text-[11px]">
                Affordable this month
              </StatusBadge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-2" aria-label={`More actions for ${item.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              Edit
            </DropdownMenuItem>
            {item.url && (
              <DropdownMenuItem asChild>
                <a href={item.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden />
                  Open link
                </a>
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

      <div className="mt-5 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Money amount={item.price} className="text-xl font-semibold tracking-tight" />
          <span className="text-muted-foreground text-xs tabular-nums">
            {ready ? "Fully saved" : <><Money amount={remaining} /> to go</>}
          </span>
        </div>
        <Meter
          size="sm"
          tone={ready ? "success" : "brand"}
          label={`Saved for ${item.name}`}
          value={item.savedAmount}
          max={item.price}
          valueText={`${formatCurrency(item.savedAmount)} of ${formatCurrency(item.price)} saved`}
        />
        <p className="text-muted-foreground text-xs">
          <Money amount={item.savedAmount} /> saved
          {item.targetDate && (
            <span className="ml-2 inline-flex items-center gap-1">
              <CalendarClock className="size-3" aria-hidden />
              by {formatDay(item.targetDate)}
            </span>
          )}
        </p>
        {item.notes && <p className="text-muted-foreground line-clamp-2 text-xs">{item.notes}</p>}
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onSave} disabled={ready}>
          <PiggyBank className="size-3.5" aria-hidden />
          Add savings
        </Button>
        <Button size="sm" className="flex-1 gap-1.5" onClick={onBuy}>
          <ShoppingBag className="size-3.5" aria-hidden />
          Bought it
        </Button>
      </div>
    </li>
  );
}

export function WishlistView() {
  const query = useWishlist();
  const overview = useMoneyOverview();
  const { deleteWishlistItem, updateWishlistItem } = useMoneyMutations();
  const { openWishlist } = useQuickAdd();
  const [saving, setSaving] = useState<WishlistItem | null>(null);
  const [buying, setBuying] = useState<WishlistItem | null>(null);
  const [deleting, setDeleting] = useState<WishlistItem | null>(null);
  const [showBought, setShowBought] = useState(false);

  const data = query.data && !isSetupRequired(query.data) ? query.data : null;
  const open = useMemo(() => data?.items.filter((i) => !i.purchasedAt) ?? [], [data]);
  const bought = useMemo(() => data?.items.filter((i) => i.purchasedAt) ?? [], [data]);
  const safeToSpend = overview.data?.savings.safeToSpend ?? null;

  const addButton = (
    <Button size="sm" className="gap-1.5" onClick={() => openWishlist()}>
      <Plus className="size-3.5" aria-hidden />
      Add item
    </Button>
  );

  if (getIsDemoMode()) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <EmptyState headingLevel="h2" icon={Gift} title="Needs a signed-in account" description="Your wishlist saves to your own account, so it isn’t available with demo data." />
      </div>
    );
  }
  if (query.isPending) return <MoneyPageSkeleton />;
  if (query.isError) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState title="Your wishlist could not be loaded" message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} />
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
  const progress = summary.total > 0 ? Math.round((summary.saved / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader {...HEADER} actions={addButton} />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="On your list" icon={Gift} value={<Money amount={summary.total} />} hint={`${summary.openCount} ${summary.openCount === 1 ? "item" : "items"}`} />
        <StatCard label="Saved so far" icon={PiggyBank} value={<Money amount={summary.saved} />} hint={`${progress}% of the total`}>
          <Meter size="sm" tone="brand" label="Saved towards wishlist" value={summary.saved} max={Math.max(summary.total, 1)} className="mt-1" />
        </StatCard>
        <StatCard label="Still needed" icon={Target} value={<Money amount={summary.remaining} />} hint="To buy everything" />
        <StatCard
          label="Safe to spend"
          icon={Sparkles}
          value={safeToSpend === null ? <span className="text-muted-foreground">—</span> : <Money amount={safeToSpend} />}
          hint={safeToSpend === null ? "Add your income in Profile" : "This month, after your savings goal"}
        />
      </section>

      {open.length === 0 ? (
        <EmptyState
          headingLevel="h2"
          icon={Gift}
          title={bought.length > 0 ? "Everything on your list is bought" : "Your wishlist is empty"}
          description="Add things you’d like to buy. Put money aside for them over time, and mark them bought when you get them."
          actions={addButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Wishlist items">
          {open.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              safeToSpend={safeToSpend}
              onSave={() => setSaving(item)}
              onBuy={() => setBuying(item)}
              onEdit={() => openWishlist({ item })}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </ul>
      )}

      {bought.length > 0 && (
        <section className="bg-card overflow-hidden rounded-2xl shadow-md">
          <button
            type="button"
            aria-expanded={showBought}
            onClick={() => setShowBought((v) => !v)}
            className="hover:bg-muted/40 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
          >
            <span>
              <span className="block text-base font-semibold tracking-tight">Bought</span>
              <span className="text-muted-foreground block text-xs">
                {bought.length} {bought.length === 1 ? "item" : "items"} ticked off
              </span>
            </span>
            <ChevronDown className={cn("text-muted-foreground size-4 transition-transform", showBought && "rotate-180")} aria-hidden />
          </button>
          {showBought && (
            <ul className="divide-y border-t">
              {bought.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="bg-success/10 text-success flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <ShoppingBag className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Bought {item.purchasedAt ? formatDay(item.purchasedAt) : ""}
                      {item.expenseId ? " · in your expenses" : ""}
                    </p>
                  </div>
                  <Money amount={item.price} className="shrink-0 text-sm font-semibold" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      updateWishlistItem.mutate(
                        { id: item.id, update: { action: "restore" } },
                        {
                          onError: (error) => toast.error(apiErrorMessage(error)),
                          onSuccess: () =>
                            toast.success(`${item.name} is back on your list`, {
                              description: item.expenseId ? "Its expense was removed." : undefined,
                            }),
                        },
                      )
                    }
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Not bought</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <WishlistSaveDialog item={saving} onOpenChange={(o) => !o && setSaving(null)} />
      <WishlistBuyDialog item={buying} onOpenChange={(o) => !o && setBuying(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this item?"
        description={deleting ? `${deleting.name} (${formatCurrency(deleting.price)}) will be removed from your wishlist.` : ""}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await deleteWishlistItem.mutateAsync(deleting.id);
          toast.success("Item deleted");
        }}
      />
    </div>
  );
}
