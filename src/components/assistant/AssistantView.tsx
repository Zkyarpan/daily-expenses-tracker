"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Loader2, Lock, MessageSquareText, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aiApi } from "@/lib/api/ai";
import { apiErrorMessage } from "@/lib/api/client";
import type { AssistantAnswer } from "@/lib/assistant/answer";
import type { AssistantContext } from "@/lib/assistant/query";
import { markDone } from "@/lib/onboarding/prefs";
import { getIsDemoMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Message =
  | { id: number; role: "user"; text: string }
  | { answer: AssistantAnswer; id: number; role: "assistant" }
  | { id: number; question: string; role: "error"; text: string };

const STARTERS = [
  "How much did I spend on TfL this month?",
  "Who owes me money?",
  "How much do I owe Mum?",
  "How much have I saved this month?",
  "How much should I save to reach my goals?",
  "Can I afford the headphones?",
  "How much did I spend on groceries last month?",
  "What did I spend in total this year?",
];

const STORAGE_KEY = "assistant-conversation";

function AnswerCard({ answer, onAsk }: { answer: AssistantAnswer; onAsk: (q: string) => void }) {
  return (
    <div className="bg-card max-w-[min(100%,42rem)] space-y-4 rounded-2xl rounded-tl-md p-4 shadow-md sm:p-5">
      <p className="text-sm leading-6">{answer.text}</p>

      {answer.facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {answer.facts.map((fact) => (
            <div key={fact.label} className="bg-muted/50 rounded-xl px-3 py-2">
              <dt className="text-muted-foreground text-[11px]">{fact.label}</dt>
              <dd className="truncate text-sm font-semibold tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {answer.items.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {answer.items.map((item, i) => (
            <li key={`${item.title}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{item.subtitle}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{item.amount}</span>
            </li>
          ))}
        </ul>
      )}

      {(answer.link || answer.followUps.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {answer.link && (
            <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-3 text-xs">
              <Link href={answer.link.href}>
                {answer.link.label}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </Button>
          )}
          {answer.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="bg-muted hover:bg-muted/70 focus-visible:ring-ring rounded-full px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [context, setContext] = useState<AssistantContext>({});
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Keep the conversation for this browser tab only (cleared when it closes).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { context: AssistantContext; lastQuestion: string | null; messages: Message[] };
       
      setMessages(parsed.messages ?? []);
      setContext(parsed.context ?? {});
      setLastQuestion(parsed.lastQuestion ?? null);
      nextId.current = (parsed.messages?.at(-1)?.id ?? 0) + 1;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ context, lastQuestion, messages: messages.slice(-40) }));
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [context, lastQuestion, messages, pending]);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || pending) return;
    setInput("");
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: question }]);
    setPending(true);
    try {
      const { answer } = await aiApi.ask({ context, previousQuestion: lastQuestion, question });
      setMessages((m) => [...m, { answer, id: nextId.current++, role: "assistant" }]);
      markDone("ask-ai");
      setContext(answer.context);
      setLastQuestion(question);
    } catch (error) {
      setMessages((m) => [...m, { id: nextId.current++, question, role: "error", text: apiErrorMessage(error) }]);
    } finally {
      setPending(false);
    }
  }

  const reset = () => {
    setMessages([]);
    setContext({});
    setLastQuestion(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const header = (
    <PageHeader
      eyebrow={
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          AI assistant
        </span>
      }
      title="Ask about your money"
      description="Ask in plain English — what you spent, who owes who, what you’ve saved and how to reach your goals."
      actions={
        messages.length > 0 ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
            <RotateCcw className="size-3.5" aria-hidden />
            New chat
          </Button>
        ) : undefined
      }
    />
  );

  if (getIsDemoMode()) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState headingLevel="h2" icon={MessageSquareText} title="Needs a signed-in account" description="The assistant answers from your own saved data." />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-12rem)] flex-col gap-6">
      {header}

      <div className="flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <section className="bg-card space-y-4 rounded-2xl p-5 shadow-md sm:p-6">
            <div className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">What would you like to know?</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">Try one of these, or type your own question.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void ask(q)}
                  className="hover:bg-muted/60 focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="bg-primary text-primary-foreground max-w-[min(85%,32rem)] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm">
                {message.text}
              </p>
            </div>
          ) : message.role === "assistant" ? (
            <div key={message.id} className="flex">
              <AnswerCard answer={message.answer} onAsk={(q) => void ask(q)} />
            </div>
          ) : (
            <div key={message.id} className="flex">
              <div className="border-destructive/30 bg-destructive/5 flex max-w-[min(100%,36rem)] items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                <span className="text-destructive">{message.text}</span>
                <Button variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => void ask(message.question)}>
                  Try again
                </Button>
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex" role="status">
            <span className="bg-card text-muted-foreground inline-flex items-center gap-2 rounded-2xl rounded-tl-md px-4 py-3 text-sm shadow-md">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Looking at your money…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer: sticks to the bottom of the scrolling panel */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="bg-background/80 sticky bottom-0 -mx-1 space-y-2 px-1 pt-2 pb-1 backdrop-blur"
      >
        <div className="bg-card focus-within:ring-ring flex items-end gap-2 rounded-2xl border p-2 shadow-md focus-within:ring-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={300}
            placeholder="Ask something, e.g. “how much do I owe him?”"
            aria-label="Your question"
            className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" className="size-10 shrink-0" disabled={pending || !input.trim()} aria-label="Send">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
        <p className={cn("text-muted-foreground flex items-center justify-center gap-1.5 text-[11px]")}>
          <Lock className="size-3" aria-hidden />
          Only your question goes to the AI — your numbers are worked out in the app from your own data.
        </p>
      </form>
    </div>
  );
}
