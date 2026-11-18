import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The brand mark, used on its own (no wordmark): a deep-teal tile with a
 * coin, a tick inside it ("money on track") and a gold spark for the app's
 * smart/AI features. Drawn on a 32-unit grid so it stays crisp from 16 px
 * (favicon) upwards. The same artwork is in src/app/icon.svg.
 *
 * Decorative by default; pass `title` when it is the only content of a link
 * or heading so it has an accessible name.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const bg = `logo-bg-${id}`;
  const shine = `logo-shine-${id}`;

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-10 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2BC4AE" />
          <stop offset="0.5" stopColor="#00877C" />
          <stop offset="1" stopColor="#004A4B" />
        </linearGradient>
        <radialGradient id={shine} cx="0.2" cy="0.1" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#${bg})`} />
      <rect width="32" height="32" rx="9.5" fill={`url(#${shine})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="#fff" strokeOpacity="0.2" />
      {/* Coin */}
      <circle cx="14.25" cy="18" r="7.4" fill="none" stroke="#fff" strokeWidth="3.4" />
      {/* Tick: money on track */}
      <path d="M10.7 18.3l2.4 2.4 4.6-4.9" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Spark */}
      <path d="M23.1 3.4c.5 3.3 2 4.8 5.3 5.3-3.3.5-4.8 2-5.3 5.3-.5-3.3-2-4.8-5.3-5.3 3.3-.5 4.8-2 5.3-5.3z" fill="#F9D04F" />
    </svg>
  );
}

/** Logo link target content: the mark with an accessible name for screen readers. */
export function Logo({ className }: { className?: string }) {
  return <LogoMark className={className} title="Daily Expenses — home" />;
}
