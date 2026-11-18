"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  Database,
  Download,
  FlaskConical,
  Gift,
  HandCoins,
  Loader2,
  PiggyBank,
  ReceiptText,
  Trash2,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/AuthShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSampleDataStatus } from "@/hooks/profile/useProfile";
import { useProfileMutations } from "@/hooks/profile/useProfileMutations";
import { ApiError, apiErrorMessage, downloadExpensesExport } from "@/lib/api/profile";
import { DELETE_CONFIRMATION, type ProfileStorage } from "@/lib/profile/schemas";
import { generateSampleData } from "@/lib/sampleData";

import { SettingsCard } from "./SettingsCard";

const plural = (n: number, word: string) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────

function SampleDataCard() {
  const { loadSampleData, removeSampleData } = useProfileMutations();
  const status = useSampleDataStatus();
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Exact preview of what will be added (generated locally, instantly).
  const preview = useMemo(() => generateSampleData(new Date()), []);
  const entryCount = preview.trackers.reduce((n, t) => n + t.entries.length, 0);

  const counts = status.data;
  const loaded = !!counts && counts.expenses + counts.budgets + counts.trackers + counts.ious + counts.wishlist > 0;
  const busy = loadSampleData.isPending || removeSampleData.isPending;

  const handleLoad = () =>
    loadSampleData.mutate(undefined, {
      onError: (error) => toast.error("Sample data could not be loaded", { description: apiErrorMessage(error) }),
      onSuccess: ({ counts: added, warnings }) => {
        toast.success("Sample data loaded", {
          description: `${plural(added.expenses, "expense")}, ${plural(added.budgets, "budget")}, ${plural(added.trackers, "tracker")}, ${plural(added.ious, "IOU")} and ${plural(added.wishlist, "wishlist item")} added. Explore any page to try it out.`,
        });
        warnings.forEach((w) => toast.warning(w));
      },
    });

  const handleRemove = () => {
    setConfirmRemove(false);
    removeSampleData.mutate(undefined, {
      onError: (error) => toast.error("Sample data could not be removed", { description: apiErrorMessage(error) }),
      onSuccess: ({ removed }) =>
        toast.success("Sample data removed", {
          description: `${plural(removed.expenses, "expense")}, ${plural(removed.budgets, "budget")}, ${plural(removed.trackers, "tracker")}, ${plural(removed.ious, "IOU")} and ${plural(removed.wishlist, "wishlist item")} deleted. Your own records were not touched.`,
        }),
    });
  };

  const included = [
    {
      icon: ReceiptText,
      text: `${plural(preview.expenses.length, "expense")} over ${preview.months} months — bills, groceries, takeaways, fuel, trips, Christmas, refunds and a few uncategorised`,
    },
    { icon: PiggyBank, text: `${plural(preview.budgets.length, "monthly budget")} for the last 6 months, some near or over the limit` },
    { icon: WalletCards, text: `${plural(preview.trackers.length, "tracker")} (credit card, emergency fund, car loan, holiday fund) with ${entryCount} entries` },
    {
      icon: HandCoins,
      text: `${plural(preview.ious.length, "IOU")} with friends and family — open, part-paid, overdue and settled`,
    },
    { icon: Gift, text: `${plural(preview.wishlist.length, "wishlist item")} at different stages of saving, one already bought` },
    {
      icon: PiggyBank,
      text: `A savings plan: ${plural(preview.fixedCosts.length, "fixed cost")} (rent £340 and bills) and ${plural(preview.goals.length, "savings goal")}`,
    },
    { icon: BellRing, text: "Spending alerts appear automatically from the over-limit budgets" },
  ];

  return (
    <SettingsCard
      className="lg:col-span-2"
      icon={FlaskConical}
      title="Sample data"
      description="Fill your account with realistic data to try every feature: charts, analytics, budgets, alerts, trackers and AI insights."
      action={
        status.isPending ? (
          <Skeleton className="h-6 w-20 rounded-full" />
        ) : loaded ? (
          <StatusBadge tone="success" dot>
            Loaded
          </StatusBadge>
        ) : (
          <StatusBadge>Not loaded</StatusBadge>
        )
      }
      footer={
        <>
          {busy && (
            <span role="status" className="text-muted-foreground mr-auto inline-flex items-center gap-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {loadSampleData.isPending ? `Adding ${preview.expenses.length} expenses, budgets and trackers…` : "Removing sample data…"}
            </span>
          )}
          {loaded ? (
            <Button
              variant="outline"
              size="sm"
              className="hover:border-destructive/40 hover:text-destructive gap-1.5"
              onClick={() => setConfirmRemove(true)}
              disabled={busy}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove sample data
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={handleLoad} disabled={busy || status.isPending}>
              <Database className="size-3.5" aria-hidden />
              Load sample data
            </Button>
          )}
        </>
      }
    >
      {status.isError && (
        <p role="alert" className="text-destructive mb-5 text-sm">
          {apiErrorMessage(status.error)}
        </p>
      )}
      {loaded && counts && (
        <div className="bg-success/10 text-success mb-5 rounded-xl px-4 py-3 text-sm">
          In your account now: {plural(counts.expenses, "sample expense")}, {plural(counts.budgets, "budget")},{" "}
          {plural(counts.trackers, "tracker")}, {plural(counts.ious, "IOU")} and {plural(counts.wishlist, "wishlist item")}. Edit or delete them freely — removing sample data only deletes what’s left of them.
        </div>
      )}

      <ul className="space-y-3">
        {included.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="pt-1 leading-5">{text}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-5 text-xs leading-5">
        Sample rows are marked internally, so “Remove sample data” deletes only them — never expenses, budgets or
        trackers you created. Existing budgets are never overwritten.
      </p>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove sample data?</AlertDialogTitle>
            <AlertDialogDescription>
              All sample expenses, budgets, trackers, IOUs and wishlist items are deleted from your account. Your own records stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" size="sm" onClick={handleRemove}>
              Remove sample data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

function ExportCard() {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const count = await downloadExpensesExport();
      toast.success(count > 0 ? `Exported ${plural(count, "expense")}` : "Export downloaded (no expenses yet)");
    } catch (error) {
      toast.error("Export failed", { description: apiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      icon={Download}
      title="Export your data"
      description="Download every expense as a CSV file that opens in Excel, Numbers or Google Sheets."
      footer={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
          {busy ? "Preparing…" : "Download CSV"}
        </Button>
      }
    >
      <p className="text-muted-foreground text-sm leading-6">
        Includes date, description, category, merchant, who paid and amount. The file is generated on the server from
        your own records only.
      </p>
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete account
// ─────────────────────────────────────────────────────────────────────────────

function DeleteAccountCard({ storage }: { storage: ProfileStorage }) {
  const { deleteAccount } = useProfileMutations();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const enabled = storage === "table";
  const ready = password.length > 0 && confirmation === DELETE_CONFIRMATION;

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPassword("");
      setConfirmation("");
      setError(null);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    deleteAccount.mutate(
      { confirmation: DELETE_CONFIRMATION, password },
      {
        onError: (err) => setError({ field: err instanceof ApiError ? err.field : undefined, message: apiErrorMessage(err) }),
        onSuccess: () => toast.success("Your account has been deleted"),
      },
    );
  };

  return (
    <SettingsCard
      className="border-destructive/30 border lg:col-span-3"
      icon={TriangleAlert}
      title="Delete account"
      description="Permanently delete your account and everything in it: expenses, budgets, alerts, trackers and history. This cannot be undone."
      footer={
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
          onClick={() => setOpen(true)}
          disabled={!enabled}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete my account
        </Button>
      }
    >
      <p className="text-muted-foreground text-sm leading-6">
        {enabled
          ? "Download a CSV export first if you want to keep a copy. You’ll be asked for your password."
          : "Account deletion needs the profiles migration (supabase/migrations/20261117000000_create_profiles.sql) to be applied to the database first."}
      </p>

      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent>
          <form onSubmit={submit} className="space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                All of your data is deleted immediately and permanently. You will be signed out.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                className="h-10 rounded-xl border pr-11 pl-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error?.field === "password"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-semibold">{DELETE_CONFIRMATION}</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                autoComplete="off"
                className="h-10 rounded-xl font-mono"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error.message}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" size="sm" disabled={!ready || deleteAccount.isPending} className="gap-1.5">
                {deleteAccount.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                Delete permanently
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

export function DataSettings({ storage }: { storage: ProfileStorage }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SampleDataCard />
      <ExportCard />
      <DeleteAccountCard storage={storage} />
    </div>
  );
}
