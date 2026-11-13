"use client";

import { useState } from "react";
import { ListChecks, Plus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { TrackersPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatCard } from "@/components/shared/StatCard";
import { AddEntrySheet } from "@/components/trackers/AddEntrySheet";
import { CreateTrackerSheet } from "@/components/trackers/CreateTrackerSheet";
import TrackerCard from "@/components/trackers/TrackerCard";
import { Button } from "@/components/ui/button";
import { Tracker, TrackerEntry } from "@/entities/Tracker";
import { useTrackers } from "@/hooks/trackers/useTrackers";
import { useTrackerMutations } from "@/hooks/trackers/useTrackersMutations";
import { formatCurrency } from "@/lib/utils";

const signed = (amount: number) =>
  amount < 0 ? `−${formatCurrency(Math.abs(amount))}` : formatCurrency(amount);

const TrackersPage = () => {
  const { data: trackers = [], isLoading } = useTrackers();
  const {
    create,
    update,
    delete: deleteTracker,
    addEntry,
    cleanup,
  } = useTrackerMutations();

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | undefined>();
  const [addEntrySheetOpen, setAddEntrySheetOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState<Tracker | undefined>();

  const totals = trackers.reduce(
    (acc, t) => {
      if (t.currentBalance >= 0) {
        acc.assets += t.currentBalance;
        acc.assetCount += 1;
      } else {
        acc.owed += Math.abs(t.currentBalance);
        acc.owedCount += 1;
      }
      acc.net += t.currentBalance;
      return acc;
    },
    { assetCount: 0, assets: 0, net: 0, owed: 0, owedCount: 0 },
  );

  const handleCreateTracker = async (
    newTracker: Omit<Tracker, "id" | "createdAt" | "updatedAt" | "entries">,
  ) => {
    await create({ ...newTracker, entries: [] });
    toast.success("Tracker created!", {
      description: `${newTracker.title} has been created`,
    });
  };

  const handleEditTracker = async (
    updated: Omit<Tracker, "id" | "createdAt" | "updatedAt" | "entries" | "initialBalance">,
  ) => {
    if (!editingTracker) return;
    await update({ id: editingTracker.id, ...updated });
    toast.success("Tracker updated!", {
      description: `${updated.title} has been updated`,
    });
    setEditingTracker(undefined);
  };

  const handleDeleteTracker = async (id: string) => {
    const tracker = trackers.find((t) => t.id === id);
    await deleteTracker(id);
    toast.success("Tracker deleted", {
      description: `${tracker?.title} has been removed`,
    });
  };

  const handleAddEntry = async (
    trackerId: string,
    entryData: Omit<TrackerEntry, "id" | "balance" | "createdAt">,
  ) => {
    await addEntry({ entryData, trackerId });
  };

  const openEditSheet = (tracker: Tracker) => setEditingTracker(tracker);

  const openAddEntrySheet = (tracker: Tracker) => {
    setSelectedTracker(tracker);
    setAddEntrySheetOpen(true);
  };


  const newTrackerButton = (
    <Button size="sm" className="gap-1.5" onClick={() => setCreateSheetOpen(true)}>
      <Plus className="size-3.5" />
      New tracker
    </Button>
  );

  const plural = (n: number) => `${n} ${n === 1 ? "tracker" : "trackers"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trackers"
        description="Running balances for debts, savings, loans and anything else you want to keep an eye on."
        actions={newTrackerButton}
      />

      {isLoading ? (
        <TrackersPageSkeleton withHeader={false} />
      ) : trackers.length > 0 ? (
        <>
          {/* Summary */}
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              className="col-span-2 sm:col-span-1"
              label="Net balance"
              icon={Scale}
              value={
                <span className={totals.net < 0 ? "text-destructive" : undefined}>
                  {signed(totals.net)}
                </span>
              }
              hint={`Across ${plural(trackers.length)}`}
            />
            <StatCard
              label="In credit"
              icon={TrendingUp}
              value={formatCurrency(totals.assets)}
              hint={totals.assetCount ? plural(totals.assetCount) : "None"}
            />
            <StatCard
              label="Owed"
              icon={TrendingDown}
              value={
                <span className={totals.owed > 0 ? "text-destructive" : undefined}>
                  {totals.owed > 0 ? `−${formatCurrency(totals.owed)}` : formatCurrency(0)}
                </span>
              }
              hint={totals.owedCount ? plural(totals.owedCount) : "Nothing owed"}
            />
          </section>

          {/* Trackers */}
          <section aria-label="Trackers" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {trackers.map((tracker) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                onEdit={openEditSheet}
                onDelete={handleDeleteTracker}
                onAddEntry={openAddEntrySheet}
                onCleanup={cleanup}
              />
            ))}
          </section>
        </>
      ) : (
        <EmptyState
          headingLevel="h2"
          icon={ListChecks}
          title="No trackers yet"
          description="Create a tracker to follow a debt being paid down, a savings goal, or money lent to a friend."
          actions={newTrackerButton}
        />
      )}

      {/* Create/Edit Tracker Sheet */}
      <CreateTrackerSheet
        open={createSheetOpen || !!editingTracker}
        onOpenChange={(open) => {
          if (!open) {
            setCreateSheetOpen(false);
            setEditingTracker(undefined);
          }
        }}
        tracker={editingTracker}
        onSave={editingTracker ? handleEditTracker : handleCreateTracker}
      />

      {/* Add Entry Sheet */}
      {selectedTracker && (
        <AddEntrySheet
          open={addEntrySheetOpen}
          onOpenChange={setAddEntrySheetOpen}
          trackerId={selectedTracker.id}
          trackerTitle={selectedTracker.title}
          currentBalance={selectedTracker.currentBalance}
          onSave={handleAddEntry}
        />
      )}
    </div>
  );
};

export default TrackersPage;
