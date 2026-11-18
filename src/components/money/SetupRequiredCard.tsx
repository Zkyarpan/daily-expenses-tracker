"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy, Database, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { moneyApi } from "@/lib/api/money";
import { cn } from "@/lib/utils";

/** Supabase dashboard SQL editor for this project (from the public project URL). */
const sqlEditorUrl = () => {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard";
};

/**
 * Shown while the tables for Lend & borrow / Wishlist (and profiles) do not
 * exist yet. The app cannot create tables itself (that needs database admin
 * rights), so this walks the user through the one-time SQL step.
 */
export function SetupRequiredCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [checking, setChecking] = useState(false);

  async function copySql() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(await moneyApi.setupSql());
      setCopied(true);
      toast.success("Setup SQL copied", { description: "Paste it into the Supabase SQL editor and press Run." });
    } catch {
      toast.error("Could not copy the SQL", {
        description: "Open supabase/migrations in the project and run the two newest files instead.",
      });
    } finally {
      setCopying(false);
    }
  }

  async function checkAgain() {
    setChecking(true);
    await queryClient.invalidateQueries();
    router.refresh();
    setChecking(false);
  }

  const steps = [
    "Copy the setup SQL",
    "Open the Supabase SQL editor, paste it and press Run",
    "Come back and press “Check again”",
  ];

  return (
    <section
      className={cn(
        "bg-card rounded-2xl border border-dashed p-5 shadow-md sm:p-6",
        compact ? "space-y-4" : "space-y-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Database className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Finish setup (one time, about a minute)</h2>
          <p className="text-muted-foreground mt-0.5 text-sm leading-6">
            Lend &amp; borrow, the wishlist and savings goals store their data in new database tables. Create them
            once and everything here starts working.
          </p>
        </div>
      </div>

      {!compact && (
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step} className="bg-muted/40 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm">
              <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" onClick={copySql} disabled={copying}>
          {copying ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <ClipboardCopy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy setup SQL"}
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={sqlEditorUrl()} target="_blank" rel="noreferrer">
            Open SQL editor
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={checkAgain} disabled={checking}>
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} aria-hidden />
          Check again
        </Button>
      </div>
    </section>
  );
}
