"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { amountText, MoneyInput, optionalAmountText, QuickAmounts, toAmountText } from "@/components/money/fields";
import { DatePicker } from "@/components/shared/DatePicker";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlanMutations } from "@/hooks/plan/usePlan";
import { useProfileMutations } from "@/hooks/profile/useProfileMutations";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import type { FixedCost, SavingsGoal } from "@/lib/plan/schemas";
import { cn, formatCurrency } from "@/lib/utils";

function Shell({
  children,
  description,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}

function Footer({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={busy} className="gap-1.5">
        {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label}
      </Button>
    </DialogFooter>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary (stored on the profile as monthly income)
// ─────────────────────────────────────────────────────────────────────────────

function SalaryForm({ income, onDone }: { income: number | null; onDone: () => void }) {
  const { updateProfile } = useProfileMutations();
  const [text, setText] = useState(toAmountText(income));
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = amountText.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter your salary.");
    try {
      await updateProfile.mutateAsync({ monthlyIncome: Number(parsed.data) });
      toast.success("Salary updated");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="salary">Take-home pay each month</Label>
        <MoneyInput id="salary" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="1100" />
        <p className="text-muted-foreground text-xs">What lands in your account after tax — the money you actually have to spend and save.</p>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <Footer busy={updateProfile.isPending} label="Save salary" onCancel={onDone} />
    </form>
  );
}

export function SalaryDialog({ income, onOpenChange, open }: { income: number | null; onOpenChange: (o: boolean) => void; open: boolean }) {
  return (
    <Shell open={open} onOpenChange={onOpenChange} title="Your monthly salary" description="Everything in your plan starts from this.">
      <SalaryForm income={income} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixed cost
// ─────────────────────────────────────────────────────────────────────────────

const fixedSchema = z.object({
  amount: amountText,
  dueDay: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 31), "Day 1–31, or leave empty."),
  name: z.string().trim().min(1, "Enter a name.").max(60, "Keep it under 60 characters."),
});
type FixedValues = z.infer<typeof fixedSchema>;

function FixedCostForm({ cost, onDone }: { cost?: FixedCost; onDone: () => void }) {
  const { createFixedCost, updateFixedCost } = usePlanMutations();
  const form = useForm<FixedValues>({
    defaultValues: { amount: toAmountText(cost?.amount), dueDay: cost?.dueDay ? String(cost.dueDay) : "", name: cost?.name ?? "" },
    resolver: zodResolver(fixedSchema),
  });

  async function onSubmit(values: FixedValues) {
    const fields = { amount: Number(values.amount), dueDay: values.dueDay ? Number(values.dueDay) : null, name: values.name };
    try {
      if (cost) await updateFixedCost.mutateAsync({ id: cost.id, update: fields });
      else await createFixedCost.mutateAsync(fields);
      toast.success(cost ? "Fixed cost updated" : `${values.name} added`);
      onDone();
    } catch (error) {
      const field = error instanceof ApiError ? (error.field as keyof FixedValues | undefined) : undefined;
      form.setError(field && field in values ? field : "root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is it?</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Rent, Phone, Gym membership" autoFocus={!cost} {...field} />
              </FormControl>
              <FormDescription>Use the same words as in your expenses (e.g. “Rent”) so it isn’t counted twice.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Each month</FormLabel>
                <FormControl>
                  <MoneyInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid on day (optional)</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {form.formState.errors.root && <p role="alert" className="text-destructive text-sm">{form.formState.errors.root.message}</p>}
        <Footer busy={form.formState.isSubmitting} label={cost ? "Save changes" : "Add fixed cost"} onCancel={onDone} />
      </form>
    </Form>
  );
}

export function FixedCostDialog({
  cost,
  onOpenChange,
  open,
}: {
  cost?: FixedCost;
  onOpenChange: (o: boolean) => void;
  open: boolean;
}) {
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={cost ? "Edit fixed cost" : "Add a fixed cost"}
      description="Money that goes out every month whatever happens — rent, phone, subscriptions."
    >
      <FixedCostForm key={cost?.id ?? "new"} cost={cost} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings goal
// ─────────────────────────────────────────────────────────────────────────────

const goalSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(60, "Keep it under 60 characters."),
    savedAmount: optionalAmountText,
    targetAmount: amountText,
    targetDate: z.string(),
  })
  .refine((v) => !v.savedAmount || Number(v.savedAmount) <= Number(v.targetAmount), {
    message: "Already saved can’t be more than the target.",
    path: ["savedAmount"],
  });
type GoalValues = z.infer<typeof goalSchema>;

function GoalForm({ goal, onDone, today }: { goal?: SavingsGoal; onDone: () => void; today: string }) {
  const { createGoal, updateGoal } = usePlanMutations();
  const form = useForm<GoalValues>({
    defaultValues: {
      name: goal?.name ?? "",
      savedAmount: toAmountText(goal?.savedAmount),
      targetAmount: toAmountText(goal?.targetAmount),
      targetDate: goal?.targetDate ?? "",
    },
    resolver: zodResolver(goalSchema),
  });

  async function onSubmit(values: GoalValues) {
    if (values.targetDate && values.targetDate <= today) {
      form.setError("targetDate", { message: "Pick a date in the future." });
      return;
    }
    try {
      if (goal) {
        await updateGoal.mutateAsync({
          id: goal.id,
          update: { action: "edit", name: values.name, targetAmount: Number(values.targetAmount), targetDate: values.targetDate || null },
        });
      } else {
        await createGoal.mutateAsync({
          name: values.name,
          savedAmount: Number(values.savedAmount || 0),
          targetAmount: Number(values.targetAmount),
          targetDate: values.targetDate || null,
        });
      }
      toast.success(goal ? "Goal updated" : `Goal “${values.name}” added`);
      onDone();
    } catch (error) {
      const field = error instanceof ApiError ? (error.field as keyof GoalValues | undefined) : undefined;
      form.setError(field && field in values ? field : "root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are you saving for?</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Emergency fund, Holiday, New laptop" autoFocus={!goal} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target</FormLabel>
                <FormControl>
                  <MoneyInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!goal && (
            <FormField
              control={form.control}
              name="savedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Already saved</FormLabel>
                  <FormControl>
                    <MoneyInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        <FormField
          control={form.control}
          name="targetDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reach it by (optional)</FormLabel>
              <FormControl>
                <DatePicker
                  clearable
                  min={today}
                  placeholder="No date"
                  presets={false}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormDescription>With a date, the plan works out how much to put aside each month.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && <p role="alert" className="text-destructive text-sm">{form.formState.errors.root.message}</p>}
        <Footer busy={form.formState.isSubmitting} label={goal ? "Save changes" : "Add goal"} onCancel={onDone} />
      </form>
    </Form>
  );
}

export function GoalDialog({
  goal,
  onOpenChange,
  open,
  today,
}: {
  goal?: SavingsGoal;
  onOpenChange: (o: boolean) => void;
  open: boolean;
  today: string;
}) {
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? "Edit goal" : "New savings goal"}
      description="Something you’re saving towards over months — not a one-off purchase."
    >
      <GoalForm key={goal?.id ?? "new"} goal={goal} today={today} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / take money
// ─────────────────────────────────────────────────────────────────────────────

function ContributeForm({ goal, monthlyNeed, onDone }: { goal: SavingsGoal; monthlyNeed: number | null; onDone: () => void }) {
  const { updateGoal } = usePlanMutations();
  const remaining = Math.max(0, Math.round((goal.targetAmount - goal.savedAmount) * 100) / 100);
  const [mode, setMode] = useState<"add" | "remove">(remaining > 0 ? "add" : "remove");
  const [text, setText] = useState(mode === "add" && monthlyNeed ? toAmountText(Math.min(monthlyNeed, remaining)) : "");
  const [error, setError] = useState<string | null>(null);
  const max = mode === "add" ? undefined : goal.savedAmount;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = amountText.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter an amount.");
    const value = Number(parsed.data);
    if (max !== undefined && value > max) return setError(`You’ve only saved ${formatCurrency(max)} so far.`);
    try {
      await updateGoal.mutateAsync({ id: goal.id, update: { action: "contribute", amount: mode === "add" ? value : -value } });
      toast.success(mode === "add" ? `${formatCurrency(value)} added to ${goal.name}` : "Savings updated");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const quick = [
    ...(monthlyNeed ? [{ label: `Monthly ${formatCurrency(monthlyNeed)}`, value: monthlyNeed }] : []),
    ...[25, 50, 100].map((v) => ({ label: formatCurrency(v), value: v })),
  ];

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or take out">
        {(["add", "remove"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            disabled={value === "remove" && goal.savedAmount <= 0}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={cn(
              "focus-visible:ring-ring rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40",
              mode === value ? "border-primary ring-primary bg-muted/40 ring-1" : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            {value === "add" ? "Add money" : "Take money out"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="contribute-amount">Amount</Label>
        <MoneyInput id="contribute-amount" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {mode === "add" && <QuickAmounts amounts={quick} onPick={(v) => setText(toAmountText(v))} />}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <Footer busy={updateGoal.isPending} label={mode === "add" ? "Add money" : "Take out"} onCancel={onDone} />
    </form>
  );
}

export function ContributeDialog({
  goal,
  monthlyNeed,
  onOpenChange,
}: {
  goal: SavingsGoal | null;
  monthlyNeed: number | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Shell
      open={!!goal}
      onOpenChange={onOpenChange}
      title={goal ? goal.name : "Goal"}
      description={
        goal ? (
          <>
            <Money amount={goal.savedAmount} /> of <Money amount={goal.targetAmount} /> saved.
          </>
        ) : null
      }
    >
      {goal && <ContributeForm goal={goal} monthlyNeed={monthlyNeed} onDone={() => onOpenChange(false)} />}
    </Shell>
  );
}
