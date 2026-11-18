import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Generative profile picture. A short random seed (saved in the user's
 * metadata as `avatar_seed`) picks a palette and places a few soft shapes, so
 * every account gets a distinctive picture without uploading anything or
 * calling an external avatar service. Without a seed it falls back to
 * initials.
 */

const PALETTES = [
  ["#0F766E", "#5EEAD4", "#FDE68A"],
  ["#1E3A8A", "#60A5FA", "#FCA5A5"],
  ["#581C87", "#C084FC", "#FBCFE8"],
  ["#7C2D12", "#FB923C", "#FEF08A"],
  ["#064E3B", "#34D399", "#BEF264"],
  ["#831843", "#F472B6", "#FDE68A"],
  ["#0C4A6E", "#38BDF8", "#BBF7D0"],
  ["#27272A", "#A1A1AA", "#FCD34D"],
  ["#4C1D95", "#818CF8", "#67E8F9"],
  ["#7F1D1D", "#F87171", "#FED7AA"],
] as const;

/** FNV-1a hash → 32-bit seed. */
const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Small deterministic PRNG (mulberry32). */
const prng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const avatarPalette = (seed: string) => PALETTES[hash(seed) % PALETTES.length];

export const newAvatarSeed = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, "0")).join("");

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

interface UserAvatarProps {
  className?: string;
  name: string;
  seed?: string | null;
  /** Rendered size in px (also scales the initials). */
  size?: number;
}

export function UserAvatar({ className, name, seed, size = 32 }: UserAvatarProps) {
  const clipId = `avatar-${useId().replace(/:/g, "")}`;

  if (!seed) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
          className,
        )}
        style={{ fontSize: Math.max(10, size * 0.36), height: size, width: size }}
      >
        <span aria-hidden>{initialsOf(name)}</span>
      </span>
    );
  }

  const [base, mid, light] = avatarPalette(seed);
  const rand = prng(hash(seed));
  const between = (min: number, max: number) => min + rand() * (max - min);

  const blob = { cx: between(14, 66), cy: between(14, 66), r: between(26, 38) };
  const square = { rotate: between(0, 90), size: between(26, 40), x: between(10, 50), y: between(10, 50) };
  const dot = { cx: between(18, 62), cy: between(18, 62), r: between(6, 11) };

  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={name}
      className={cn("shrink-0 rounded-full", className)}
      style={{ height: size, width: size }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="40" cy="40" r="40" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="80" height="80" fill={base} />
        <circle cx={blob.cx} cy={blob.cy} r={blob.r} fill={mid} opacity="0.95" />
        <rect
          x={square.x}
          y={square.y}
          width={square.size}
          height={square.size}
          rx={square.size * 0.28}
          fill={light}
          opacity="0.9"
          transform={`rotate(${square.rotate} ${square.x + square.size / 2} ${square.y + square.size / 2})`}
        />
        <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="#fff" opacity="0.85" />
      </g>
    </svg>
  );
}
