"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Download,
  FlaskConical,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MonitorSmartphone,
  Send,
  ShieldAlert,
  Trash2,
  UserPen,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PasswordChecklist, PasswordInput } from "@/components/auth/AuthShell";
import { Meter, type MeterTone } from "@/components/shared/Meter";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileActivity } from "@/hooks/profile/useProfile";
import { useProfileMutations } from "@/hooks/profile/useProfileMutations";
import { ApiError, apiErrorMessage } from "@/lib/api/profile";
import { passwordStrength } from "@/lib/profile/format";
import {
  ACTIVITY_LABELS,
  type ActivityEventName,
  emailChangeSchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/profile/schemas";
import { cn } from "@/lib/utils";

import { SettingsCard } from "./SettingsCard";

const FIELD_CLASS = "h-10 rounded-xl";
/** Keeps room on the right for the show/hide button. */
const PASSWORD_CLASS = "h-10 rounded-xl border pl-3 pr-11";

// ─────────────────────────────────────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────────────────────────────────────

/** Form schema: the API schema plus a confirmation field (never sent). */
const passwordFormSchema = z
  .object({
    confirm: z.string(),
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer.`),
  })
  .refine((v) => v.next === v.confirm, { message: "Passwords do not match.", path: ["confirm"] })
  .refine((v) => v.next !== v.current, {
    message: "Choose a password different from your current one.",
    path: ["next"],
  });

type PasswordValues = z.infer<typeof passwordFormSchema>;

const STRENGTH: { label: string; tone: MeterTone }[] = [
  { label: "Too short", tone: "critical" },
  { label: "Weak", tone: "critical" },
  { label: "Fair", tone: "warning" },
  { label: "Good", tone: "success" },
  { label: "Strong", tone: "success" },
];

/** API field name → form field name. */
const PASSWORD_FIELDS: Record<string, keyof PasswordValues> = { currentPassword: "current", newPassword: "next" };

function ChangePasswordCard() {
  const { changePassword } = useProfileMutations();
  const form = useForm<PasswordValues>({
    defaultValues: { confirm: "", current: "", next: "" },
    resolver: zodResolver(passwordFormSchema),
  });
  const next = useWatch({ control: form.control, name: "next" });
  const confirm = useWatch({ control: form.control, name: "confirm" });
  const strength = passwordStrength(next);
  const { isSubmitting } = form.formState;

  async function onSubmit(values: PasswordValues) {
    try {
      await changePassword.mutateAsync({ currentPassword: values.current, newPassword: values.next });
      form.reset();
      toast.success("Password changed", { description: "Use your new password next time you sign in." });
    } catch (error) {
      const field = error instanceof ApiError && error.field ? PASSWORD_FIELDS[error.field] : undefined;
      form.setError(field ?? "root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <SettingsCard
          icon={KeyRound}
          title="Password"
          description="Your current password is checked on the server before anything changes."
          footer={
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          }
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="current"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="current-password" className={PASSWORD_CLASS} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="next"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        className={PASSWORD_CLASS}
                        hideLabel="Hide new password"
                        showLabel="Show new password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        className={PASSWORD_CLASS}
                        hideLabel="Hide confirmation"
                        showLabel="Show confirmation"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-muted/40 h-fit space-y-4 rounded-xl border p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Strength</span>
                  <span className="text-muted-foreground">{next ? STRENGTH[strength].label : "—"}</span>
                </div>
                <Meter
                  label="Password strength"
                  value={next ? strength : 0}
                  max={4}
                  tone={STRENGTH[strength].tone}
                  valueText={next ? STRENGTH[strength].label : "No password entered"}
                />
              </div>
              <PasswordChecklist password={next} confirm={confirm} />
              <p className="text-muted-foreground text-xs leading-5">
                Tip: a short phrase of three or four random words is long and easy to remember.
              </p>
            </div>
          </div>

          {form.formState.errors.root && (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {form.formState.errors.root.message}
            </p>
          )}
        </SettingsCard>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────────────────────

function ChangeEmailCard({ email }: { email: string }) {
  const { changeEmail } = useProfileMutations();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<{ email: string }>({
    defaultValues: { email: "" },
    resolver: zodResolver(
      emailChangeSchema.refine((v) => v.email.toLowerCase() !== email.toLowerCase(), {
        message: "This is already your email address.",
        path: ["email"],
      }),
    ),
  });
  const { isSubmitting } = form.formState;

  async function onSubmit(values: { email: string }) {
    try {
      const { sentTo: address } = await changeEmail.mutateAsync(values.email);
      setSentTo(address);
      form.reset();
    } catch (error) {
      form.setError("email", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="h-full">
        <SettingsCard
          className="h-full"
          icon={Mail}
          title="Email address"
          description={
            <>
              You sign in with <span className="text-foreground font-medium">{email}</span>.
            </>
          }
          footer={
            <Button type="submit" size="sm" variant="outline" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
              Send confirmation
            </Button>
          }
        >
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormLabel>New email address</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="you@example.com" className={FIELD_CLASS} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {sentTo ? (
              <p role="status" className="bg-success/10 text-success rounded-xl px-3 py-2.5 text-sm">
                Confirmation sent to <span className="font-medium">{sentTo}</span>. Your email changes once you
                follow the link (you may also need to confirm from your current address).
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                We’ll email a confirmation link. Nothing changes until you click it.
              </p>
            )}
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

function SessionsCard() {
  const { signOutEverywhere } = useProfileMutations();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    signOutEverywhere.mutate(undefined, {
      onError: (error) => toast.error("Could not sign out other devices", { description: apiErrorMessage(error) }),
    });

  return (
    <SettingsCard
      className="h-full"
      icon={MonitorSmartphone}
      title="Sessions"
      description="Signed in on a shared or lost device? End every session, including this one."
    >
      <Button
        variant="outline"
        size="sm"
        className="hover:border-destructive/40 hover:text-destructive gap-1.5"
        onClick={() => setOpen(true)}
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out of all devices
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ll be signed out on every browser and device, including this one. Your data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" size="sm" onClick={confirm} disabled={signOutEverywhere.isPending} className="gap-1.5">
              {signOutEverywhere.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Sign out everywhere
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<ActivityEventName, typeof Activity> = {
  data_exported: Download,
  email_change_requested: Mail,
  password_change_failed: ShieldAlert,
  password_changed: KeyRound,
  profile_updated: UserPen,
  sample_data_loaded: FlaskConical,
  sample_data_removed: Trash2,
  signed_out_everywhere: LogOut,
};

const relativeTime = (iso: string) => {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
};

function ActivityCard() {
  const activity = useProfileActivity();

  return (
    <SettingsCard
      icon={Activity}
      title="Recent activity"
      description="Security-relevant changes to your account, newest first."
    >
      {activity.isPending ? (
        <ul className="space-y-4" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40 rounded-full" />
                <Skeleton className="h-3 w-56 max-w-full rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : activity.isError ? (
        <p className="text-destructive text-sm">{apiErrorMessage(activity.error)}</p>
      ) : !activity.data.available ? (
        <p className="text-muted-foreground text-sm leading-6">
          Activity history needs the profiles migration
          (<code className="text-xs">supabase/migrations/20261117000000_create_profiles.sql</code>). Once it’s applied,
          password changes, sign-outs and exports appear here.
        </p>
      ) : activity.data.events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No account activity yet.</p>
      ) : (
        <ol className="divide-y">
          {activity.data.events.map((event) => {
            const Icon = ACTIVITY_ICONS[event.event] ?? Activity;
            const warning = event.event === "password_change_failed";
            return (
              <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    warning ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ACTIVITY_LABELS[event.event] ?? event.event}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[event.detail, event.device].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <time
                  dateTime={event.createdAt}
                  title={new Date(event.createdAt).toLocaleString("en-GB")}
                  className="text-muted-foreground shrink-0 text-xs"
                >
                  {relativeTime(event.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </SettingsCard>
  );
}

export function SecuritySettings({ email }: { email: string }) {
  return (
    <div className="space-y-4">
      <ChangePasswordCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChangeEmailCard email={email} />
        <SessionsCard />
      </div>
      <ActivityCard />
    </div>
  );
}
