"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { startRouteProgress } from "@/components/layout/RouteProgress";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { ACCOUNT_GROUP, NAV_GROUPS } from "./navigation";

const THEMES = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Desktop, label: "System", value: "system" },
] as const;

/** Global ⌘K palette. Pages come from `NAV_GROUPS` in ./navigation. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (href: string) => {
    if (href !== window.location.pathname) startRouteProgress();
    router.push(href);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages or actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {[...NAV_GROUPS, ACCOUNT_GROUP].map((group) => (
          <CommandGroup key={group.label} heading={group.label === "Overview" ? "Pages" : group.label}>
            {group.items.map(({ hint, icon: Icon, title, url }) => (
              <CommandItem key={url} value={`${title} ${hint}`} onSelect={() => handleSelect(url)}>
                <Icon className="size-4" aria-hidden />
                <span>{title}</span>
                <span className="text-muted-foreground ml-auto truncate text-xs">{hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Theme">
          {THEMES.map(({ icon: Icon, label, value }) => (
            <CommandItem
              key={value}
              value={`${label} theme`}
              onSelect={() => {
                setTheme(value);
                setOpen(false);
              }}
            >
              <Icon className="size-4" aria-hidden />
              {label} theme
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
