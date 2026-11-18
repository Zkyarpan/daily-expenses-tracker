"use client";

import { useSyncExternalStore } from "react";
import { Check, Globe, Keyboard, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { LOCALE_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

import { NotificationSettings } from "./NotificationSettings";
import { DetailRow, SettingsCard } from "./SettingsCard";

const THEMES = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
] as const;

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search and jump to any page" },
  { keys: ["Tab"], label: "Move through links and buttons" },
  { keys: ["Esc"], label: "Close dialogs and menus" },
];

const noopSubscribe = () => () => {};

/** Miniature app window drawn in the theme's own colours. */
function ThemePreview({ mode }: { mode: "dark" | "light" | "system" }) {
  const pane = (dark: boolean) => (
    <div className={cn("flex h-full flex-1 gap-1 p-1.5", dark ? "bg-zinc-950" : "bg-zinc-100")}>
      <div className={cn("w-3 rounded-sm", dark ? "bg-zinc-800" : "bg-zinc-200")} />
      <div className={cn("flex flex-1 flex-col gap-1 rounded-sm p-1", dark ? "bg-zinc-900" : "bg-white")}>
        <div className={cn("h-1.5 w-2/3 rounded-full", dark ? "bg-zinc-600" : "bg-zinc-300")} />
        <div className="mt-auto flex items-end gap-0.5">
          {[40, 70, 55, 90].map((h) => (
            <div key={h} className="flex-1 rounded-[1px] bg-emerald-500/80" style={{ height: `${h / 6}px` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div aria-hidden className="flex h-20 overflow-hidden rounded-lg border">
      {mode === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === "dark")
      )}
    </div>
  );
}

export function PreferencesSettings() {
  const { setTheme, theme } = useTheme();
  // The active theme is only known in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SettingsCard
        className="lg:col-span-2"
        icon={Palette}
        title="Appearance"
        description="Choose how the app looks on this device."
      >
        <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ icon: Icon, label, value }) => {
            const selected = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "group relative space-y-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "border-primary ring-primary ring-1" : "hover:bg-muted/50",
                )}
              >
                <ThemePreview mode={value} />
                <span className="flex items-center gap-2 px-0.5 text-sm font-medium">
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                  {label}
                  {selected && (
                    <span className="bg-primary text-primary-foreground ml-auto flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3" aria-hidden />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard icon={Globe} title="Region" description="Formats used for money and dates.">
        <dl className="divide-y">
          <DetailRow label="Currency">
            Pound sterling ({LOCALE_CONFIG.symbol})
          </DetailRow>
          <DetailRow label="Format">English (UK)</DetailRow>
          <DetailRow label="Example">
            <span className="tabular-nums">
              {new Intl.NumberFormat(LOCALE_CONFIG.locale, { currency: LOCALE_CONFIG.currency, style: "currency" }).format(1234.5)}
            </span>
          </DetailRow>
        </dl>
      </SettingsCard>

      <NotificationSettings className="lg:col-span-3" />

      <SettingsCard className="lg:col-span-3" icon={Keyboard} title="Keyboard shortcuts" description="Move around faster.">
        <ul className="grid gap-2 sm:grid-cols-3">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="flex shrink-0 gap-1">
                {keys.map((key) => (
                  <kbd key={key} className="bg-background min-w-6 rounded-md border px-1.5 py-0.5 text-center font-sans text-xs font-medium shadow-xs">
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}
