"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Compass,
  Database,
  Loader2,
  Plus,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { LogoMark } from "@/components/brand/Logo";
import { MoneyInput, QuickAmounts } from "@/components/money/fields";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/api/client";
import { localToday } from "@/lib/api/money";
import { onboardingApi } from "@/lib/api/onboarding";
import { writePrefs } from "@/lib/onboarding/prefs";
import {
  FIXED_COST_PRESETS,
  GOAL_PRESETS,
  type InterestId,
  INTERESTS,
  monthlyForGoal,
  setupSummary,
} from "@/lib/onboarding/schemas";
import { cn, formatCurrency } from "@/lib/utils";

const MONEY_TEXT = /^\d{1,7}(\.\d{1,2})?$/;
const asMoney = (text: string) => (MONEY_TEXT.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

type FixedRow = { amount: string; id: number; name: string };

const STEPS = ["You", "Your goals", "Income", "Bills", "Saving", "Reminders"] as const;

export interface WizardResult {
  name: string;
  tour: boolean;
}

function Choice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Wizard({
  initial,
  onFinish,
  onSkip,
}: {
  initial: { income: number | null; name: string };
  onFinish: (result: WizardResult) => void;
  onSkip: () => void;
}) {
  const today = localToday();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState(initial.name);
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [income, setIncome] = useState(initial.income ? String(initial.income) : "");
  const [fixed, setFixed] = useState<FixedRow[]>([{ amount: "", id: 1, name: "Rent" }]);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalMonth, setGoalMonth] = useState("");
  const [saving, setSaving] = useState("");
  const [tips, setTips] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [sample, setSample] = useState(false);

  const incomeValue = asMoney(income);
  const fixedValues = fixed.filter((f) => f.name.trim() && asMoney(f.amount)).map((f) => ({ amount: asMoney(f.amount)!, name: f.name.trim() }));
  const goalDate = goalMonth ? `${goalMonth}-01` : null;
  const goalTargetValue = asMoney(goalTarget);
  const goalMonthly = goalTargetValue && goalDate ? monthlyForGoal(goalTargetValue, goalDate, today) : null;
  const summary = setupSummary({ fixedCosts: fixedValues, income: incomeValue, saving: asMoney(saving), today });
  const afterFixed = incomeValue === null ? null : incomeValue - summary.fixed;
  // The goal's monthly amount, else ~20% of what is left after bills.
  const suggestedSaving =
    goalMonthly ?? (afterFixed && afterFixed > 0 ? Math.max(10, Math.round((afterFixed * 0.2) / 5) * 5) : null);

  const validate = (): string | null => {
    if (step === 0 && (name.trim().length < 2 || name.trim().length > 80)) return "Enter your name (at least 2 characters).";
    if (step === 2 && income.trim() && incomeValue === null) return "Enter your take-home pay like 1100 or 1100.50.";
    if (step === 3) {
      const bad = fixed.find((f) => f.amount.trim() && !asMoney(f.amount));
      if (bad) return `Check the amount for ${bad.name || "a cost"}.`;
    }
    if (step === 4) {
      if (goalName.trim() && !goalTargetValue) return "Enter how much you want to save for your goal.";
      if (goalMonth && goalDate! <= today) return "Pick a month in the future for your goal.";
      if (saving.trim() && !asMoney(saving)) return "Enter a monthly saving like 200.";
    }
    return null;
  };

  const next = () => {
    const problem = validate();
    setError(problem);
    if (!problem) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  async function finish() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    // Ask for notification permission while we still have the click gesture.
    if (reminder && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setBusy(true);
    try {
      const result = await onboardingApi.complete({
        fixedCosts: fixedValues,
        fullName: name.trim(),
        goal: goalName.trim() && goalTargetValue ? { name: goalName.trim(), targetAmount: goalTargetValue, targetDate: goalDate } : null,
        interests,
        loadSampleData: sample,
        monthlyIncome: incomeValue,
        monthlySavingsGoal: asMoney(saving),
      });
      writePrefs({ dailyReminder: reminder, reminderTime, tips });
      // One pop-up, however many parts needed attention.
      if (result.warnings.length > 0) {
        toast.warning("Almost there", { description: result.warnings.join(" "), duration: 9000, id: "setup-warnings" });
      }
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const firstName = name.trim().split(/\s+/)[0] ?? "";

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <span className="bg-success/12 text-success mx-auto flex size-16 items-center justify-center rounded-2xl">
          <Check className="size-8" aria-hidden />
        </span>
        <div className="space-y-2">
          <DialogTitle className="text-2xl">You’re all set, {firstName}!</DialogTitle>
          <DialogDescription className="text-base">Your money is set up. Here’s your month at a glance:</DialogDescription>
        </div>
        {incomeValue !== null && (
          <dl className="bg-muted/50 mx-auto grid max-w-sm grid-cols-3 gap-2 rounded-2xl p-3 text-left">
            <div>
              <dt className="text-muted-foreground text-xs">Take-home</dt>
              <dd className="font-semibold tabular-nums"><Money amount={incomeValue} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Bills</dt>
              <dd className="font-semibold tabular-nums"><Money amount={summary.fixed} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">To spend / day</dt>
              <dd className="font-semibold tabular-nums">{summary.perDay !== null ? <Money amount={summary.perDay} /> : "—"}</dd>
            </div>
          </dl>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="gap-1.5" autoFocus onClick={() => onFinish({ name: firstName, tour: true })}>
            <Compass className="size-4" aria-hidden />
            Show me around
          </Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => onFinish({ name: firstName, tour: false })}>
            Skip tour
          </Button>
        </div>
      </div>
    );
  }

  const titles = [
    { sub: "We’ll set things up around you. It takes about a minute.", title: "Welcome! What should we call you?" },
    { sub: "Pick everything that applies — we’ll tailor tips and your checklist.", title: `What do you want to do${firstName ? `, ${firstName}` : ""}?` },
    { sub: "Your monthly take-home pay — after tax. Leave it empty if it varies a lot.", title: "How much do you get each month?" },
    { sub: "Money that goes out every month whatever happens. Add amounts for the ones you pay.", title: "What are your fixed bills?" },
    { sub: "Pick a goal (optional) and how much you’d like to put aside each month.", title: "What are you saving for?" },
    { sub: "Gentle nudges so the app becomes part of your day.", title: "Stay on track" },
  ];

  return (
    <div className="space-y-6">
      {/* Header: logo, progress, skip */}
      <div className="flex items-center gap-3">
        <LogoMark className="size-9" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </span>
            <button type="button" onClick={onSkip} className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              Set up later
            </button>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <DialogTitle className="text-xl sm:text-2xl">{titles[step].title}</DialogTitle>
        <DialogDescription>{titles[step].sub}</DialogDescription>
      </div>

      {/* Steps */}
      {step === 0 && (
        <div className="space-y-2">
          <Label htmlFor="ob-name">Your name</Label>
          <Input id="ob-name" value={name} autoFocus autoComplete="name" placeholder="e.g. Arpan" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && next()} />
          <p className="text-muted-foreground text-xs">Only you see this — it’s used in greetings.</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                aria-pressed={active}
                onClick={() => setInterests((list) => (active ? list.filter((i) => i !== interest.id) : [...list, interest.id]))}
                className={cn(
                  "focus-visible:ring-ring flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active ? "border-primary bg-primary/5 ring-primary ring-1" : "hover:bg-muted/50",
                )}
              >
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border", active && "bg-primary border-primary text-primary-foreground")}>
                  {active && <Check className="size-3.5" aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{interest.label}</span>
                  <span className="text-muted-foreground block text-xs">{interest.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Label htmlFor="ob-income">Take-home pay per month</Label>
          <MoneyInput id="ob-income" value={income} autoFocus placeholder="1100" onChange={(e) => setIncome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && next()} />
          <QuickAmounts amounts={[1000, 1500, 2000, 2500, 3000].map((v) => ({ label: formatCurrency(v), value: v }))} onPick={(v) => setIncome(String(v))} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {fixed.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <Input aria-label="Bill name" value={row.name} className="flex-1" onChange={(e) => setFixed((rows) => rows.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))} />
                <div className="w-32">
                  <MoneyInput aria-label={`${row.name || "Bill"} amount`} value={row.amount} onChange={(e) => setFixed((rows) => rows.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)))} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${row.name || "bill"}`} onClick={() => setFixed((rows) => rows.filter((r) => r.id !== row.id))}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {FIXED_COST_PRESETS.filter((p) => !fixed.some((f) => f.name.toLowerCase() === p.toLowerCase())).map((preset) => (
              <Choice key={preset} active={false} onClick={() => setFixed((rows) => [...rows, { amount: "", id: Date.now(), name: preset }])}>
                <span className="inline-flex items-center gap-1">
                  <Plus className="size-3" aria-hidden />
                  {preset}
                </span>
              </Choice>
            ))}
            <Choice active={false} onClick={() => setFixed((rows) => [...rows, { amount: "", id: Date.now(), name: "" }])}>
              <span className="inline-flex items-center gap-1">
                <Plus className="size-3" aria-hidden />
                Other
              </span>
            </Choice>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">A goal (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_PRESETS.map((g) => (
                <Choice
                  key={g.name}
                  active={goalName === g.name}
                  onClick={() => {
                    if (goalName === g.name) {
                      setGoalName("");
                      setGoalTarget("");
                    } else {
                      setGoalName(g.name);
                      setGoalTarget(String(g.target));
                    }
                  }}
                >
                  {g.name}
                </Choice>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input aria-label="Goal name" placeholder="Or type your own" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
              <MoneyInput aria-label="Goal target" placeholder="Target" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
              <Input aria-label="Reach it by (month)" type="month" min={today.slice(0, 7)} value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} />
            </div>
            {goalMonthly && (
              <p className="text-muted-foreground text-xs">
                That’s about <Money amount={goalMonthly} className="text-foreground font-medium" /> a month.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ob-saving">I’d like to save each month</Label>
            <MoneyInput id="ob-saving" value={saving} placeholder={suggestedSaving ? String(suggestedSaving) : "200"} onChange={(e) => setSaving(e.target.value)} />
            {suggestedSaving && (
              <QuickAmounts amounts={[{ label: `Suggested ${formatCurrency(suggestedSaving)}`, value: suggestedSaving }]} onPick={(v) => setSaving(String(v))} />
            )}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <label className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <input type="checkbox" className="accent-primary mt-1 size-4" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Bell className="size-3.5" aria-hidden />
                Daily reminder to log spending
              </span>
              <span className="text-muted-foreground block text-xs">A nudge while the app is open — and a notification if you allow it.</span>
            </span>
            <Input type="time" aria-label="Reminder time" value={reminderTime} disabled={!reminder} onChange={(e) => setReminderTime(e.target.value)} className="h-8 w-28" />
          </label>
          <label className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <input type="checkbox" className="accent-primary mt-1 size-4" checked={tips} onChange={(e) => setTips(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-3.5" aria-hidden />
                One tip a day
              </span>
              <span className="text-muted-foreground block text-xs">Short “did you know…” pop-ups about features you haven’t tried.</span>
            </span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { desc: "Add your own expenses from today.", icon: Sprout, label: "Start fresh", value: false },
              { desc: "Explore with two years of realistic data (remove it any time).", icon: Database, label: "Explore with example data", value: true },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={sample === o.value}
                onClick={() => setSample(o.value)}
                className={cn(
                  "focus-visible:ring-ring flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  sample === o.value ? "border-primary bg-primary/5 ring-primary ring-1" : "hover:bg-muted/50",
                )}
              >
                <o.icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="text-muted-foreground block text-xs">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live summary */}
      {step >= 3 && incomeValue !== null && (
        <p className="bg-primary/5 text-foreground rounded-xl px-3 py-2.5 text-sm">
          After bills: <Money amount={afterFixed ?? 0} className="font-semibold" />
          {asMoney(saving) ? (
            <>
              {" "}· saving <Money amount={asMoney(saving)!} className="font-semibold" />
            </>
          ) : null}
          {summary.perDay !== null && (
            <>
              {" "}→ about <Money amount={summary.perDay} className="font-semibold" /> a day to spend
            </>
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="gap-1.5" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0 || busy}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" className="gap-1.5" onClick={next}>
            {step === 1 && interests.length === 0 ? "Skip" : "Continue"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" className="gap-1.5" onClick={finish} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {busy ? "Setting up…" : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function OnboardingWizard({
  initial,
  onFinish,
  onSkip,
  open,
}: {
  initial: { income: number | null; name: string };
  onFinish: (result: WizardResult) => void;
  onSkip: () => void;
  open: boolean;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        // Answers would be lost by a stray click: close only via the buttons.
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="bg-popover max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl p-6 shadow-2xl sm:max-w-xl sm:p-8"
      >
        {open && <Wizard initial={initial} onFinish={onFinish} onSkip={onSkip} />}
      </DialogContent>
    </Dialog>
  );
}
