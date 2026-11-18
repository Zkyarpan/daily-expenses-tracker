"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Pencil, RefreshCw, Shuffle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Money } from "@/components/shared/Money";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useProfileMutations } from "@/hooks/profile/useProfileMutations";
import { ApiError, apiErrorMessage } from "@/lib/api/profile";
import { LOCALE_CONFIG } from "@/lib/config";
import { type AccountInfo, AVATAR_SEED_PATTERN, fullNameSchema, type ProfileUpdate } from "@/lib/profile/schemas";
import { cn } from "@/lib/utils";

import { DetailRow, SettingsCard } from "./SettingsCard";

/** Form-side schema (income is typed as text); the API re-validates with the shared schema. */
const schema = z.object({
  avatarSeed: z.string().refine((v) => v === "" || AVATAR_SEED_PATTERN.test(v), "That avatar is not valid."),
  fullName: fullNameSchema,
  monthlyIncome: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) > 0),
      "Enter an amount such as 2500 or 2500.50, or leave it empty.",
    ),
  monthlySavingsGoal: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) > 0),
      "Enter an amount such as 300, or leave it empty.",
    ),
})
.refine((v) => !v.monthlySavingsGoal || !v.monthlyIncome || Number(v.monthlySavingsGoal) <= Number(v.monthlyIncome), {
  message: "Your savings goal can’t be more than your income.",
  path: ["monthlySavingsGoal"],
});

type ProfileValues = z.infer<typeof schema>;
type FieldName = keyof ProfileValues;

const CHOICES = 7;

const initialValues = (account: AccountInfo): ProfileValues => ({
  avatarSeed: account.avatarSeed ?? "",
  fullName: account.fullName,
  monthlyIncome: account.monthlyIncome ? String(account.monthlyIncome) : "",
  monthlySavingsGoal: account.monthlySavingsGoal ? String(account.monthlySavingsGoal) : "",
});

/**
 * Only the fields that differ from what is saved, so the activity log says
 * exactly what was edited (and an unchanged form sends nothing).
 */
const changesFrom = (account: AccountInfo, values: ProfileValues): ProfileUpdate => {
  const saved = initialValues(account);
  const patch: ProfileUpdate = {};
  if (values.fullName.trim() !== saved.fullName.trim()) patch.fullName = values.fullName.trim();
  if (values.avatarSeed !== saved.avatarSeed) patch.avatarSeed = values.avatarSeed || null;
  if (values.monthlyIncome.trim() !== saved.monthlyIncome) {
    patch.monthlyIncome = values.monthlyIncome.trim() ? Number(values.monthlyIncome) : null;
  }
  if (values.monthlySavingsGoal.trim() !== saved.monthlySavingsGoal) {
    patch.monthlySavingsGoal = values.monthlySavingsGoal.trim() ? Number(values.monthlySavingsGoal) : null;
  }
  return patch;
};

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

/** The form itself. Mounted only while the dialog is open, so it always starts from the saved values. */
function EditProfileForm({ account, onDone }: { account: AccountInfo; onDone: () => void }) {
  const { updateProfile } = useProfileMutations();
  // Avatar suggestions are derived from the user id, so server and client
  // render the same pictures; "More" moves to the next set.
  const [round, setRound] = useState(0);
  const suggestions = Array.from({ length: CHOICES }, (_, i) => `${account.id.slice(0, 8)}-${round}-${i}`);

  const form = useForm<ProfileValues>({ defaultValues: initialValues(account), resolver: zodResolver(schema) });
  const avatarSeed = useWatch({ control: form.control, name: "avatarSeed" });
  const fullName = useWatch({ control: form.control, name: "fullName" });
  const { isSubmitting } = form.formState;

  const chooseAvatar = (seed: string) => form.setValue("avatarSeed", seed, { shouldDirty: true });

  async function onSubmit(values: ProfileValues) {
    const patch = changesFrom(account, values);
    if (Object.keys(patch).length === 0) {
      onDone();
      return;
    }
    try {
      await updateProfile.mutateAsync(patch);
      toast.success("Profile updated");
      onDone();
    } catch (error) {
      const field = error instanceof ApiError ? (error.field as FieldName | undefined) : undefined;
      if (field && field in values) form.setError(field, { message: apiErrorMessage(error) });
      else form.setError("root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Picture */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Profile picture</legend>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              name={fullName || account.email}
              seed={avatarSeed || null}
              size={72}
              className="ring-border ring-1"
            />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Choose a profile picture">
                {suggestions.map((seed) => {
                  const selected = seed === avatarSeed;
                  return (
                    <button
                      key={seed}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label="Generated picture"
                      onClick={() => chooseAvatar(seed)}
                      className={cn(
                        "rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        selected && "ring-primary ring-offset-background ring-2 ring-offset-2",
                      )}
                    >
                      <UserAvatar name="Generated picture" seed={seed} size={34} />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRound((r) => r + 1)}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  More
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => chooseAvatar(`${account.id.slice(0, 4)}${Date.now().toString(36)}`)}
                >
                  <Shuffle className="size-3.5" aria-hidden />
                  Surprise me
                </Button>
                {avatarSeed && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => chooseAvatar("")}>
                    Use initials
                  </Button>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Jane Doe" autoFocus={!account.fullName} {...field} />
                </FormControl>
                <FormDescription>Used in the greeting and sidebar.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="monthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly income (optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      {LOCALE_CONFIG.symbol}
                    </span>
                    <Input inputMode="decimal" placeholder="2500" className="pl-7" {...field} />
                  </div>
                </FormControl>
                <FormDescription>Shows how much of it you spend each month.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="monthlySavingsGoal"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Monthly savings goal (optional)</FormLabel>
                <FormControl>
                  <div className="relative sm:max-w-[calc(50%-0.625rem)]">
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      {LOCALE_CONFIG.symbol}
                    </span>
                    <Input inputMode="decimal" placeholder="300" className="pl-7" {...field} />
                  </div>
                </FormControl>
                <FormDescription>
                  How much you want to keep each month. Home shows if you’re on track and what’s safe to spend.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.formState.errors.root && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function EditProfileDialog({
  account,
  onOpenChange,
  open,
}: {
  account: AccountInfo;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Change your picture, name, income and savings goal. Only you can see this.</DialogDescription>
        </DialogHeader>
        {open && <EditProfileForm account={account} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only summary card
// ─────────────────────────────────────────────────────────────────────────────

const NotSet = () => <span className="text-muted-foreground font-normal">Not set</span>;

export function PersonalDetailsCard({
  account,
  className,
  onEdit,
}: {
  account: AccountInfo;
  className?: string;
  onEdit: () => void;
}) {
  return (
    <SettingsCard
      className={className}
      icon={UserRound}
      title="Personal details"
      description="How you appear in the app. Only you can see this."
      action={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      }
    >
      <dl className="divide-y">
        <DetailRow label="Picture">
          <span className="inline-flex items-center gap-2">
            <UserAvatar name={account.fullName || account.email} seed={account.avatarSeed} size={28} />
            <span className="text-muted-foreground font-normal">{account.avatarSeed ? "Generated" : "Initials"}</span>
          </span>
        </DetailRow>
        <DetailRow label="Full name">{account.fullName || <NotSet />}</DetailRow>
        <DetailRow label="Email">{account.email}</DetailRow>
        <DetailRow label="Monthly income">
          {account.monthlyIncome ? <Money amount={account.monthlyIncome} /> : <NotSet />}
        </DetailRow>
        <DetailRow label="Savings goal">
          {account.monthlySavingsGoal ? <><Money amount={account.monthlySavingsGoal} /> / month</> : <NotSet />}
        </DetailRow>
      </dl>
    </SettingsCard>
  );
}
