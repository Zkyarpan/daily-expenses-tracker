"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, PartyPopper, X } from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";
import { tourId } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourStep {
  body: string;
  /** Centred card with no spotlight (welcome / finish). */
  centered?: { icon: typeof Compass };
  /** Skip the step when its target is not on screen (page-only cards, desktop-only links, the mobile menu). */
  optional?: boolean;
  /** First visible match wins. */
  selectors: string[];
  title: string;
}

const nav = (url: string) => [`[data-tour="${tourId(url)}"]`];

/**
 * The whole app, in order: the welcome card, every page in the top bar, the
 * actions on the right of the bar, then a closing card. Desktop shows one
 * step per page; on phones those links live in the menu, so a single "Menu"
 * step replaces them.
 */
const STEPS: TourStep[] = [
  {
    body: "Here’s a quick look at everything in the app — about a minute. You can skip at any time.",
    centered: { icon: Compass },
    selectors: [],
    title: "Welcome! Let’s show you around",
  },
  {
    body: "Saved this month, who owes you, what you owe and your wishlist — all in one row.",
    optional: true,
    selectors: ['[data-tour="glance"]'],
    title: "Your month at a glance",
  },
  {
    body: "Your dashboard: this month’s spending, budgets and recent activity. The logo brings you back here too.",
    optional: true,
    selectors: nav("/"),
    title: "Home",
  },
  {
    body: "Every expense in one table — add, edit, search and filter. Import a CSV or PDF bank statement from here too.",
    optional: true,
    selectors: nav("/expenses"),
    title: "Expenses",
  },
  {
    body: "Set a monthly limit per category. We warn you at 80% and again when you go over.",
    optional: true,
    selectors: nav("/budgets"),
    title: "Budgets",
  },
  {
    body: "Your savings plan: salary → bills → goals → what’s left to spend each day.",
    optional: true,
    selectors: nav("/plan"),
    title: "Plan",
  },
  {
    body: "Compare months, spot trends and export reports. Yearly charts open from here.",
    optional: true,
    selectors: nav("/analytics"),
    title: "Analytics",
  },
  {
    body: "Lend & borrow (who owes who), your wishlist, and trackers for debt, savings and loans.",
    optional: true,
    selectors: ['[data-tour="more"]'],
    title: "More",
  },
  {
    body: "Ask in plain English: “How much did I spend on TfL this month?” or “How much do I owe Sara?”",
    optional: true,
    selectors: nav("/assistant"),
    title: "Ask AI",
  },
  {
    body: "Every page lives here: Home, Expenses, Budgets, Plan, Analytics, Lend & borrow, Wishlist, Trackers and Ask AI.",
    optional: true,
    selectors: ['[data-tour="menu"]'],
    title: "Menu",
  },
  {
    body: "Add an expense, scan a receipt with AI, record money you lent or borrowed, add a wishlist item or import a statement — from any page.",
    selectors: ['[data-tour="new"]'],
    title: "+ New",
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
    body: "Your profile, password, appearance, reminders and data. You can replay this tour or run setup again from here.",
    optional: true,
    selectors: ['[data-tour="account"]'],
    title: "Your account",
  },
  {
    body: "Tick these off to make the app yours.",
    optional: true,
    selectors: ['[data-tour="checklist"]'],
    title: "Your getting-started checklist",
  },
  {
    body: "Start by adding today’s spending with + New. Replay this tour any time from your account menu.",
    centered: { icon: PartyPopper },
    selectors: [],
    title: "You’re all set!",
  },
];

const PAD = 6;
/** Welcome/finish cards match the setup window; cards beside a target are a little narrower. */
const CENTER_WIDTH = 480;
const CARD_WIDTH = 380;
/** Same dim as dialogs (bg-black/50), so the tour never looks like a different theme. */
const SCRIM = "rgba(0, 0, 0, 0.5)";

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
  const nextRef = useRef<HTMLButtonElement>(null);

  // Steps available on this page and screen size right now.
  const [steps, setSteps] = useState<TourStep[]>(() => STEPS.filter((s) => !s.optional));

  useEffect(() => {
    if (!open) return;
    window.scrollTo({ behavior: "smooth", top: 0 });
    const t = setTimeout(() => setSteps(STEPS.filter((s) => !s.optional || findTarget(s))), 50);
    return () => {
      clearTimeout(t);
      // Next time the tour opens, start from the welcome card.
      setIndex(0);
    };
  }, [open]);

  const step = steps[Math.min(index, steps.length - 1)];

  const measure = useCallback(() => {
    if (!step) return;
    const el = step.centered ? null : findTarget(step);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Bring the target into view, then follow it on scroll/resize.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = step.centered ? null : findTarget(step);
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
    // Focus the main button so Enter moves on (arrow keys and Esc also work).
    nextRef.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure, open, step]);

  const first = index === 0;
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
  let cardStyle: React.CSSProperties;
  if (rect) {
    const width = Math.min(CARD_WIDTH, vw - 24);
    const below = rect.bottom + PAD + 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
    cardStyle = below + 260 < vh ? { left, top: below, width } : { bottom: vh - rect.top + PAD + 12, left, width };
  } else {
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: Math.min(CENTER_WIDTH, vw - 24) };
  }

  const CenterIcon = step.centered?.icon;
  const progress = ((index + 1) / steps.length) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="App tour">
      {/* Dimmed backdrop with a spotlight cut-out around the target */}
      {rect ? (
        <div
          aria-hidden
          className="ring-primary pointer-events-none absolute rounded-2xl ring-2 transition-all duration-300 ease-out"
          style={{
            boxShadow: `0 0 0 9999px ${SCRIM}`,
            height: rect.height + PAD * 2,
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/50" />
      )}
      {/* Clicks outside the card do nothing (no accidental exits). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        aria-live="polite"
        className={cn(
          "bg-popover text-popover-foreground absolute overflow-hidden border shadow-2xl outline-none",
          // Centred cards don't animate position (they're placed with a transform).
          CenterIcon ? "rounded-3xl" : "rounded-2xl transition-[top,left,bottom] duration-300 ease-out",
        )}
        style={cardStyle}
      >
        <div className={cn("space-y-4", CenterIcon ? "p-6 sm:p-8" : "p-5")}>
          {/* Header: logo (welcome/finish) or step count, progress, skip */}
          <div className="flex items-center gap-3">
            {CenterIcon && <LogoMark className="size-10 shrink-0 sm:size-11" />}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-medium tabular-nums sm:text-sm">
                  Step {index + 1} of {steps.length}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Skip tour"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1.5 shrink-0 rounded-full p-1.5"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-primary h-full rounded-full transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className={cn("font-semibold tracking-tight", CenterIcon ? "text-2xl sm:text-[1.75rem] sm:leading-9" : "text-lg")}>
              {step.title}
            </h2>
            <p className={cn("text-muted-foreground leading-relaxed", CenterIcon ? "text-base" : "text-sm")}>{step.body}</p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {last ? (
              <span />
            ) : (
              <Button type="button" variant="ghost" className="text-muted-foreground -ml-3" onClick={onClose}>
                Skip tour
              </Button>
            )}
            <div className="flex gap-2">
              {!first && !last && (
                <Button type="button" variant="ghost" className="gap-1.5" onClick={back}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
              )}
              <Button ref={nextRef} type="button" className="h-11 gap-1.5 px-5" onClick={next}>
                {first ? "Start tour" : last ? "Done" : "Next"}
                {!last && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
