"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TourStep {
  body: string;
  /** Skip the step when its target is not on this page (e.g. Home-only cards). */
  optional?: boolean;
  /** First visible match wins (desktop target first, then the mobile fallback). */
  selectors: string[];
  title: string;
}

const STEPS: TourStep[] = [
  {
    body: "Tap the logo any time to come back Home — your money at a glance.",
    selectors: ['[data-tour="home"]'],
    title: "Welcome to your money app",
  },
  {
    body: "What you’ve saved this month, who owes you, what you owe and your wishlist — all in one row.",
    optional: true,
    selectors: ['[data-tour="glance"]'],
    title: "Your month in one row",
  },
  {
    body: "Add an expense, scan a receipt with AI, record money you lent or borrowed, or add a wishlist item — from any page.",
    selectors: ['[data-tour="new"]'],
    title: "+ New",
  },
  {
    body: "Expenses, lend & borrow, wishlist, budgets, imports and trackers live here.",
    selectors: ['[data-tour="money"]', '[data-tour="menu"]'],
    title: "Money",
  },
  {
    body: "Your savings plan (salary → rent → goals → what’s left), analytics and yearly charts.",
    selectors: ['[data-tour="insights"]', '[data-tour="menu"]'],
    title: "Insights",
  },
  {
    body: "Ask in plain English: “How much did I spend on TfL this month?” or “How much do I owe Sara?”",
    selectors: ['[data-tour="ask-ai"]', '[data-tour="menu"]'],
    title: "Ask AI",
  },
  {
    body: "Press ⌘K (Ctrl+K) anywhere to jump to any page or switch theme.",
    selectors: ['[data-tour="search"]'],
    title: "Search",
  },
  {
    body: "Budget warnings land here — at 80% of a limit and when you go over.",
    selectors: ['[data-tour="alerts"]'],
    title: "Alerts",
  },
  {
    body: "Your profile, password, appearance, notifications and example data — and you can replay this tour from here.",
    selectors: ['[data-tour="account"]'],
    title: "You",
  },
  {
    body: "Tick these off to make the app yours. That’s the tour — enjoy!",
    optional: true,
    selectors: ['[data-tour="checklist"]'],
    title: "Your getting-started checklist",
  },
];

const PAD = 6;
const CARD_WIDTH = 320;

const isVisible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

const findTarget = (step: TourStep): Element | null => {
  for (const selector of step.selectors) {
    const el = [...document.querySelectorAll(selector)].find(isVisible);
    if (el) return el;
  }
  return null;
};

export function ProductTour({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Steps available on this page right now.
  const [steps, setSteps] = useState<TourStep[]>(STEPS);

  useEffect(() => {
    if (!open) return;
    window.scrollTo({ behavior: "smooth", top: 0 });
    document.body.dataset.tourActive = "true";
    const t = setTimeout(() => {
      setSteps(STEPS.filter((s) => !s.optional || findTarget(s)));
      setIndex(0);
    }, 50);
    return () => {
      clearTimeout(t);
      delete document.body.dataset.tourActive;
    };
  }, [open]);

  const step = steps[Math.min(index, steps.length - 1)];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Bring the target into view, then follow it on scroll/resize.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = findTarget(step);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 72 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    onChange();
    const settle = setTimeout(onChange, 350);
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    cardRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure, open, step]);

  const last = index >= steps.length - 1;
  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, next, onClose, open]);

  if (!open || !step || typeof document === "undefined") return null;

  // Card below the target when there is room, otherwise above; centred if no target.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_WIDTH, vw - 24);
  let cardStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + PAD + 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
    cardStyle = below + 200 < vh ? { left, top: below, width } : { bottom: vh - rect.top + PAD + 12, left, width };
  } else {
    cardStyle = { left: (vw - width) / 2, top: vh / 2 - 100, width };
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="App tour">
      {/* Dimmed backdrop with a spotlight cut-out around the target */}
      {rect ? (
        <div
          aria-hidden
          className="ring-primary pointer-events-none absolute rounded-2xl ring-2 transition-all duration-300 ease-out"
          style={{
            boxShadow: "0 0 0 9999px rgba(8, 8, 28, 0.62)",
            height: rect.height + PAD * 2,
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(8,8,28,0.62)]" />
      )}
      {/* Clicks outside the card do nothing (no accidental exits). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={cardRef}
        tabIndex={-1}
        aria-live="polite"
        className="bg-popover text-popover-foreground absolute space-y-3 rounded-2xl border p-4 shadow-2xl transition-all duration-300 ease-out outline-none"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-primary text-xs font-semibold">
              {index + 1} of {steps.length}
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight">{step.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="End tour" className="text-muted-foreground hover:text-foreground hover:bg-muted -mt-1 -mr-1 rounded-full p-1.5">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground text-sm leading-6">{step.body}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === index ? "bg-primary w-4" : "bg-muted w-1.5"}`} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {index > 0 && (
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={back}>
                <ArrowLeft className="size-3.5" aria-hidden />
                Back
              </Button>
            )}
            <Button type="button" size="sm" className="gap-1" onClick={next}>
              {last ? "Finish" : "Next"}
              {!last && <ArrowRight className="size-3.5" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
