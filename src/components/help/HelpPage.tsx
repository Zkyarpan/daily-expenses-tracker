"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Compass,
  Keyboard,
  Loader2,
  MessageSquareWarning,
  MessagesSquare,
  Search,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";

import { useHelp } from "@/components/help/HelpCenter";
import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useEngagement } from "@/components/onboarding/EngagementProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api/client";
import { feedbackApi } from "@/lib/api/feedback";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUS_LABEL,
  feedbackReference,
  feedbackSchema,
} from "@/lib/feedback/schemas";
import { HELP_GROUPS, HELP_TOPICS, type HelpAction, type HelpTopic } from "@/lib/help/topics";
import { getIsDemoMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { ALL_NAV_GROUPS } from "../layout/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// FAQs
// ─────────────────────────────────────────────────────────────────────────────

function TopicAction({ action }: { action: HelpAction }) {
  const { openExpense, openIou, openReceiptScan, openWishlist } = useQuickAdd();
  const { enabled, startTour } = useEngagement();
  if (action.kind === "link") {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
        <Link href={action.href}>
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    );
  }
  if (action.kind === "tour" && !enabled) return null;
  const run = () => {
    if (action.kind === "tour") startTour();
    else if (action.target === "expense") openExpense();
    else if (action.target === "receipt") openReceiptScan();
    else if (action.target === "iou") openIou();
    else openWishlist();
  };
  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={run}>
      {action.label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Button>
  );
}

function FaqItem({ topic }: { topic: HelpTopic }) {
  return (
    <li>
      <details className="group">
        <summary className="hover:bg-muted/40 flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {topic.question}
          <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-3 px-4 pb-4">
          <p className="text-muted-foreground max-w-prose text-sm leading-6">{topic.answer}</p>
          {topic.action && <TopicAction action={topic.action} />}
        </div>
      </details>
    </li>
  );
}

function Faqs() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? HELP_TOPICS.filter((t) => `${t.question} ${t.answer} ${t.keywords.join(" ")}`.toLowerCase().includes(q))
        : HELP_TOPICS,
    [q],
  );

  return (
    <section aria-labelledby="faq-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="faq-heading" className="text-lg font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground text-sm">Quick answers about how everything works.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search frequently asked questions"
            className="pr-9 pl-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-2xl p-6 text-center text-sm shadow-md">
          No questions match “{query}”. Try another word, or{" "}
          <a href="#report" className="text-primary font-medium underline-offset-2 hover:underline">
            ask us directly
          </a>
          .
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {HELP_GROUPS.map((group) => {
            const topics = matches.filter((t) => t.group === group);
            if (topics.length === 0) return null;
            return (
              <div key={group} className="bg-card overflow-hidden rounded-2xl shadow-md">
                <h3 className="text-muted-foreground border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                  {group}
                </h3>
                <ul className="divide-y">
                  {topics.map((topic) => (
                    <FaqItem key={topic.id} topic={topic} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report form
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = ALL_NAV_GROUPS.flatMap((g) => g.items)
  .filter((item, i, all) => !item.url.includes("?") && all.findIndex((x) => x.url === item.url) === i)
  .map((item) => ({ title: item.title, url: item.url }));

const formSchema = feedbackSchema.extend({ includeDevice: z.boolean() });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

function deviceDetails() {
  if (typeof window === "undefined") return null;
  return {
    language: navigator.language.slice(0, 40),
    screen: `${window.innerWidth}×${window.innerHeight}`,
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

function ReportForm({ signedIn }: { signedIn: boolean }) {
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, FormOutput>({
    defaultValues: { contactOk: true, includeDevice: true, kind: "problem", message: "", page: "", subject: "" },
    resolver: zodResolver(formSchema),
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });
  const message = useWatch({ control: form.control, name: "message" }) ?? "";
  const page = useWatch({ control: form.control, name: "page" });
  const includeDevice = useWatch({ control: form.control, name: "includeDevice" });
  const contactOk = useWatch({ control: form.control, name: "contactOk" });

  async function onSubmit({ includeDevice, ...values }: FormOutput) {
    try {
      const { reference } = await feedbackApi.send({ ...values, device: includeDevice ? deviceDetails() : null });
      setSent(reference);
      form.reset();
      toast.success("Thanks — your message was sent", { description: `Reference ${reference}` });
      void queryClient.invalidateQueries({ queryKey: ["feedback"] });
    } catch (error) {
      form.setError("root", { message: apiErrorMessage(error) });
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
        <span className="bg-success/12 text-success flex size-12 items-center justify-center rounded-2xl">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-semibold">Thanks — we’ve got it</p>
        <p className="text-muted-foreground max-w-sm text-sm leading-6">
          Your reference is <span className="text-foreground font-semibold">{sent}</span>. You can follow its status
          under “Your reports” below.
        </p>
        <Button variant="outline" size="sm" onClick={() => setSent(null)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What’s this about?</legend>
        <div role="radiogroup" aria-label="What’s this about?" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEEDBACK_KINDS.map((option) => {
            const active = kind === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => form.setValue("kind", option.id, { shouldValidate: true })}
                className={cn(
                  "focus-visible:ring-ring flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active ? "border-primary bg-primary/8" : "hover:bg-muted/50",
                )}
              >
                <span className={cn("text-sm font-medium", active && "text-primary")}>{option.label}</span>
                <span className="text-muted-foreground text-xs">{option.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-1.5">
          <Label htmlFor="fb-subject">Subject</Label>
          <Input
            id="fb-subject"
            placeholder={kind === "idea" ? "e.g. Split an expense between people" : "e.g. Budget total looks too high"}
            aria-invalid={!!errors.subject}
            maxLength={120}
            {...form.register("subject")}
          />
          {errors.subject && <p className="text-destructive text-xs">{errors.subject.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-page">Which page? (optional)</Label>
          <Select value={page || "none"} onValueChange={(v) => form.setValue("page", v === "none" ? "" : v)}>
            <SelectTrigger id="fb-page" className="w-full">
              <SelectValue placeholder="Choose a page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not sure / whole app</SelectItem>
              {PAGES.map((page) => (
                <SelectItem key={page.url} value={page.url}>
                  {page.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="fb-message">Details</Label>
          <span className="text-muted-foreground text-xs tabular-nums">{message.length}/2000</span>
        </div>
        <Textarea
          id="fb-message"
          rows={5}
          maxLength={2000}
          placeholder={
            kind === "problem" || kind === "wrong_data"
              ? "What did you do, what did you expect, and what happened instead?"
              : "Tell us as much as you like."
          }
          aria-invalid={!!errors.message}
          className="min-h-32"
          {...form.register("message")}
        />
        {errors.message && <p className="text-destructive text-xs">{errors.message.message}</p>}
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={includeDevice}
            onCheckedChange={(v) => form.setValue("includeDevice", v === true)}
          />
          <span>
            Include my browser and screen size
            <span className="text-muted-foreground block text-xs">Helps us reproduce problems. Never your data.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={contactOk ?? true}
            onCheckedChange={(v) => form.setValue("contactOk", v === true)}
          />
          <span>You can email me about this</span>
        </label>
      </div>

      {errors.root && (
        <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-3.5 py-2.5 text-sm">
          {errors.root.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">Your message goes only to the app team, never to other users.</p>
        <Button type="submit" className="gap-1.5 sm:w-auto" disabled={isSubmitting || !signedIn}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {isSubmitting ? "Sending…" : "Send"}
        </Button>
      </div>
      {!signedIn && <p className="text-muted-foreground text-xs">Sign in to send a report — demo mode can’t send messages.</p>}
    </form>
  );
}

function YourReports() {
  const query = useQuery({ queryFn: feedbackApi.list, queryKey: ["feedback"], retry: 1 });
  const reports = query.data?.reports ?? [];
  if (reports.length === 0) return null;

  return (
    <section aria-labelledby="reports-heading" className="bg-card overflow-hidden rounded-2xl shadow-md">
      <h2 id="reports-heading" className="border-b px-4 py-3 text-sm font-semibold sm:px-5">
        Your reports
      </h2>
      <ul className="divide-y">
        {reports.map((report) => (
          <li key={report.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{report.subject}</p>
              <p className="text-muted-foreground text-xs">
                {feedbackReference(report.id)} · {FEEDBACK_KINDS.find((k) => k.id === report.kind)?.label} ·{" "}
                {new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                report.status === "resolved" ? "bg-success/12 text-success" : report.status === "in_review" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {FEEDBACK_STATUS_LABEL[report.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search and jump to any page (Ctrl+K on Windows)" },
  { keys: ["?"], label: "Open help from anywhere" },
  { keys: ["←", "→"], label: "Move between cells in the expenses table" },
  { keys: ["Esc"], label: "Close a window or the tour" },
];

export function HelpPage() {
  const signedIn = !getIsDemoMode();
  const { openHelp } = useHelp();
  const { enabled, startTour } = useEngagement();

  const cards = [
    {
      description: "Ask in plain English — answers come from your own data.",
      icon: MessagesSquare,
      onClick: () => openHelp(),
      title: "Ask a question",
    },
    ...(enabled
      ? [{ description: "A one-minute look at every page and button.", icon: Compass, onClick: startTour, title: "Take the tour" }]
      : []),
    {
      description: "Something broken, or numbers that don’t add up?",
      href: "#report",
      icon: MessageSquareWarning,
      title: "Report a problem",
    },
    {
      description: "Choose which reminders and alerts you get.",
      href: "/profile?tab=notifications",
      icon: BellRing,
      title: "Alert settings",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<span className="text-xs font-semibold tracking-wider uppercase">Support</span>}
        title="Help & support"
        description="Answers to common questions, a guided tour, and a direct line to us if something isn’t right."
      />

      <section aria-label="Ways to get help" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        {cards.map((card) => {
          const inner = (
            <>
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <card.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{card.title}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-5">{card.description}</span>
              </span>
            </>
          );
          const className =
            "bg-card hover:bg-muted/40 focus-visible:ring-ring flex items-start gap-3 rounded-2xl p-4 text-left shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none";
          return "href" in card && card.href ? (
            <Link key={card.title} href={card.href} className={className}>
              {inner}
            </Link>
          ) : (
            <button key={card.title} type="button" onClick={"onClick" in card ? card.onClick : undefined} className={className}>
              {inner}
            </button>
          );
        })}
      </section>

      <Faqs />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section id="report" aria-labelledby="report-heading" className="bg-card scroll-mt-24 rounded-2xl p-4 shadow-md sm:p-6">
          <h2 id="report-heading" className="text-lg font-semibold tracking-tight">
            Contact us
          </h2>
          <p className="text-muted-foreground mt-1 mb-5 text-sm">
            Report a problem, tell us a number looks wrong, or suggest an idea.
          </p>
          <ReportForm signedIn={signedIn} />
        </section>

        <aside className="space-y-4">
          <section aria-labelledby="shortcuts-heading" className="bg-card rounded-2xl p-4 shadow-md sm:p-5">
            <h2 id="shortcuts-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="text-muted-foreground size-4" aria-hidden />
              Keyboard shortcuts
            </h2>
            <ul className="mt-3 space-y-2.5">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="flex shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="bg-muted rounded-md border px-1.5 py-0.5 font-sans text-[11px] font-medium">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="install-heading" className="bg-card rounded-2xl p-4 shadow-md sm:p-5">
            <h2 id="install-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="text-muted-foreground size-4" aria-hidden />
              Use it like an app
            </h2>
            <ol className="text-muted-foreground mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-6">
              <li>Open this site on your phone.</li>
              <li>iPhone: Share → Add to Home Screen. Android: ⋮ → Install app.</li>
              <li>Open it from your home screen — full screen, no browser bars.</li>
            </ol>
          </section>
        </aside>
      </div>

      {signedIn && <YourReports />}
    </div>
  );
}
