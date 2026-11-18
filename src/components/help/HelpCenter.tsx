"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ChevronDown, Compass, LifeBuoy, Loader2, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useEngagement } from "@/components/onboarding/EngagementProvider";
import { displayNameOf, useCurrentUser } from "@/components/providers/context/CurrentUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { aiApi } from "@/lib/api/ai";
import { apiErrorMessage } from "@/lib/api/client";
import type { AssistantAnswer } from "@/lib/assistant/answer";
import type { AssistantContext } from "@/lib/assistant/query";
import { withCurrencySymbol } from "@/lib/currency";
import { HELP_TOPICS, type HelpAction, type HelpTopic, matchTopic, MONEY_QUESTIONS } from "@/lib/help/topics";
import { markDone } from "@/lib/onboarding/prefs";
import { getIsDemoMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Context: any button in the app can open the panel
// ─────────────────────────────────────────────────────────────────────────────

const HelpContext = createContext<{ openHelp: (question?: string) => void } | null>(null);

/** Opens the "Need help?" panel, optionally asking a question straight away. */
export const useHelp = () => useContext(HelpContext) ?? { openHelp: () => {} };

type Entry =
  | { id: number; kind: "question"; text: string }
  | { id: number; kind: "topic"; topic: HelpTopic }
  | { answer: AssistantAnswer; id: number; kind: "answer" }
  | { id: number; kind: "error"; text: string };

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({ action, onDone }: { action: HelpAction; onDone: () => void }) {
  const { openExpense, openIou, openReceiptScan, openWishlist } = useQuickAdd();
  const { enabled, startTour } = useEngagement();

  if (action.kind === "link") {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
        <Link href={action.href} onClick={onDone}>
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    );
  }
  if (action.kind === "tour" && !enabled) return null;

  const run = () => {
    onDone();
    if (action.kind === "tour") setTimeout(startTour, 250);
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

function HelpPanel({
  initialQuestion,
  onOpenChange,
  open,
}: {
  initialQuestion: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const user = useCurrentUser();
  const firstName = displayNameOf(user).split(" ")[0];
  const signedIn = !getIsDemoMode() && Boolean(user?.email);
  const { enabled, startTour } = useEngagement();

  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(false);
  const [context, setContext] = useState<AssistantContext>({});
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const close = () => onOpenChange(false);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || pending) return;
      setInput("");
      setEntries((list) => [...list, { id: nextId.current++, kind: "question", text: question }]);

      // How-to questions: answered instantly from the built-in help.
      const topic = matchTopic(question);
      if (topic || !signedIn) {
        const shown = topic ?? HELP_TOPICS.find((t) => t.id === "tour")!;
        setEntries((list) => [
          ...list,
          signedIn || topic
            ? { id: nextId.current++, kind: "topic", topic: shown }
            : {
                id: nextId.current++,
                kind: "error",
                text: "Questions about your own money need a signed-in account. Meanwhile, the topics below explain how everything works.",
              },
        ]);
        return;
      }

      // Questions about their own money: the assistant works it out from their data.
      setPending(true);
      try {
        const { answer } = await aiApi.ask({ context, previousQuestion: lastQuestion, question });
        setEntries((list) => [...list, { answer, id: nextId.current++, kind: "answer" }]);
        setContext(answer.context);
        setLastQuestion(question);
        markDone("ask-ai");
      } catch (error) {
        setEntries((list) => [...list, { id: nextId.current++, kind: "error", text: apiErrorMessage(error) }]);
      } finally {
        setPending(false);
      }
    },
    [context, lastQuestion, pending, signedIn],
  );

  // Opened with a question (e.g. from a chip elsewhere): ask it right away.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (open && initialQuestion && asked.current !== initialQuestion) {
      asked.current = initialQuestion;
      void ask(initialQuestion);
    }
    if (!open) asked.current = null;
  }, [ask, initialQuestion, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, pending]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-lg">
              <LifeBuoy className="size-4" aria-hidden />
            </span>
            {firstName ? `Hi ${firstName} — how can I help?` : "How can I help?"}
          </SheetTitle>
          <SheetDescription>Ask about the app or about your own money. Answers come from your data.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4" aria-live="polite">
          {entries.length === 0 && (
            <>
              {signedIn && (
                <section className="space-y-2">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ask about your money</h3>
                  <div className="flex flex-wrap gap-2">
                    {MONEY_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void ask(q)}
                        className="hover:bg-muted/60 focus-visible:ring-ring rounded-full border px-3 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Popular questions</h3>
                <ul className="divide-y rounded-xl border">
                  {HELP_TOPICS.map((topic) => (
                    <li key={topic.id}>
                      <details className="group">
                        <summary className="hover:bg-muted/40 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                          {topic.question}
                          <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="space-y-3 px-3.5 pb-3.5">
                          <p className="text-muted-foreground text-sm leading-6">{topic.answer}</p>
                          {topic.action && <ActionButton action={topic.action} onDone={close} />}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {entries.map((entry) => {
            if (entry.kind === "question") {
              return (
                <div key={entry.id} className="flex justify-end">
                  <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-md px-3.5 py-2 text-sm">
                    {entry.text}
                  </p>
                </div>
              );
            }
            if (entry.kind === "topic") {
              return (
                <div key={entry.id} className="bg-muted/50 space-y-3 rounded-2xl rounded-tl-md p-4">
                  <p className="text-sm font-semibold">{entry.topic.question}</p>
                  <p className="text-muted-foreground text-sm leading-6">{entry.topic.answer}</p>
                  {entry.topic.action && <ActionButton action={entry.topic.action} onDone={close} />}
                </div>
              );
            }
            if (entry.kind === "error") {
              return (
                <p key={entry.id} className="bg-muted/50 text-muted-foreground rounded-2xl rounded-tl-md p-4 text-sm leading-6">
                  {entry.text}
                </p>
              );
            }
            const { answer } = entry;
            return (
              <div key={entry.id} className="bg-muted/50 space-y-3 rounded-2xl rounded-tl-md p-4">
                <p className="text-sm leading-6">{withCurrencySymbol(answer.text)}</p>
                {answer.facts.length > 0 && (
                  <dl className="grid grid-cols-2 gap-2">
                    {answer.facts.slice(0, 4).map((fact) => (
                      <div key={fact.label} className="bg-background/70 rounded-xl px-3 py-2">
                        <dt className="text-muted-foreground text-[11px]">{fact.label}</dt>
                        <dd className="truncate text-sm font-semibold tabular-nums">{withCurrencySymbol(fact.value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="flex flex-wrap gap-2">
                  {answer.link && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                      <Link href={answer.link.href} onClick={close}>
                        {answer.link.label}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </Button>
                  )}
                  {/* The assistant suggests what to ask next. */}
                  {answer.followUps.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void ask(q)}
                      className="bg-background hover:bg-background/70 rounded-full border px-3 py-1 text-xs transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {pending && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Looking that up…
            </p>
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={signedIn ? "Ask anything… e.g. “How much on takeout?”" : "Ask how something works…"}
              aria-label="Your question"
              maxLength={300}
              className="h-10 flex-1"
            />
            <Button type="submit" size="icon" className="size-10 shrink-0" disabled={pending || !input.trim()} aria-label="Ask">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {entries.length > 0 && (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEntries([])}>
                ← All help topics
              </button>
            )}
            {enabled && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                onClick={() => {
                  close();
                  setTimeout(startTour, 250);
                }}
              >
                <Compass className="size-3.5" aria-hidden />
                Take the tour
              </button>
            )}
            <Link href="/help" onClick={close} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <LifeBuoy className="size-3.5" aria-hidden />
              All FAQs &amp; contact us
            </Link>
            {signedIn && (
              <Link href="/assistant" onClick={close} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <MessagesSquare className="size-3.5" aria-hidden />
                Open the full assistant
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider + floating button
// ─────────────────────────────────────────────────────────────────────────────

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const pathname = usePathname();

  const openHelp = useCallback((q?: string) => {
    setQuestion(q ?? null);
    setOpen(true);
  }, []);

  // "?" anywhere (outside text fields) opens help, like many web apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      openHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHelp]);

  const value = useMemo(() => ({ openHelp }), [openHelp]);
  // The assistant page is already a chat, so no floating button there.
  const showLauncher = pathname !== "/assistant";

  return (
    <HelpContext.Provider value={value}>
      {children}
      {showLauncher && (
        <button
          type="button"
          onClick={() => openHelp()}
          aria-label="Need help? Ask a question"
          className={cn(
            // Desktop only; on phones and tablets help lives in the menu, so
            // nothing floats over the content or the save bar.
            "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring fixed right-5 bottom-5 z-30 hidden h-11 items-center gap-2 rounded-full pr-4 pl-3.5 text-sm font-semibold shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex print:hidden",
          )}
        >
          <Sparkles className="size-4" aria-hidden />
          Need help?
        </button>
      )}
      <HelpPanel
        open={open}
        initialQuestion={question}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuestion(null);
        }}
      />
    </HelpContext.Provider>
  );
}
