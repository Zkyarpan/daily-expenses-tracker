"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, ArrowRight, Coins, Info, Loader2, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api/client";
import { convert, useRates } from "@/lib/api/rates";
import {
  currencyName,
  currencyOption,
  currencySymbol,
  DEFAULT_CURRENCY,
  readStoredCurrency,
  saveCurrency,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** The currency chosen on this device; GBP during server render/hydration. */
export const useDisplayCurrency = () =>
  useSyncExternalStore(noopSubscribe, readStoredCurrency, () => DEFAULT_CURRENCY);

const formatIn = (code: string, amount: number) => {
  try {
    return new Intl.NumberFormat("en-GB", {
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 4 : 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
};

const rateText = (n: number) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: n >= 100 ? 2 : 4, minimumFractionDigits: 2 });

const POPULAR = ["USD", "EUR", "NPR", "INR", "GBP", "AUD", "CAD", "AED"];

function CurrencySelect({
  codes,
  id,
  label,
  onChange,
  value,
}: {
  codes: string[];
  id?: string;
  label: string;
  onChange: (code: string) => void;
  value: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label} className="w-full">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span aria-hidden>{currencyOption(value).flag}</span>
            <span className="font-medium">{value}</span>
            <span className="text-muted-foreground hidden truncate min-[26rem]:inline">{currencyOption(value).name}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            <span aria-hidden>{currencyOption(code).flag}</span>
            <span className="font-medium">{code}</span>
            <span className="text-muted-foreground">{currencyOption(code).name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Converter + all rates (/rates)
// ─────────────────────────────────────────────────────────────────────────────

export function ExchangeRatesView() {
  const display = useDisplayCurrency();
  const [base, setBase] = useState<string | null>(null);
  const baseCode = base ?? display;
  const rates = useRates(baseCode);

  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const fromCode = from ?? baseCode;
  const toCode = to ?? (baseCode === "NPR" ? "GBP" : baseCode === "USD" ? "NPR" : "USD");
  const [query, setQuery] = useState("");

  const allCodes = useMemo(() => {
    const codes = Object.keys(rates.data?.rates ?? {});
    const extra = SUPPORTED_CURRENCIES.map((c) => c.code).filter((c) => !codes.includes(c));
    return [...new Set([...POPULAR, ...codes, ...extra])];
  }, [rates.data]);

  const value = Number(amount.replace(/,/g, ""));
  const result =
    rates.data && Number.isFinite(value) ? convert(value, fromCode, toCode, rates.data.rates, rates.data.base) : NaN;
  const unit = rates.data ? convert(1, fromCode, toCode, rates.data.rates, rates.data.base) : NaN;

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!rates.data) return [];
    return Object.entries(rates.data.rates)
      .filter(([code]) => code !== rates.data!.base)
      .map(([code, rate]) => ({ code, name: currencyName(code), rate }))
      .filter((row) => !q || row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const pa = POPULAR.indexOf(a.code);
        const pb = POPULAR.indexOf(b.code);
        if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
        return a.code.localeCompare(b.code);
      });
  }, [q, rates.data]);

  const updated = rates.data
    ? new Date(rates.data.updatedAt).toLocaleString("en-GB", { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" })
    : null;

  if (rates.isError) {
    return (
      <ErrorState
        title="Exchange rates aren’t available right now"
        message={apiErrorMessage(rates.error)}
        onRetry={() => void rates.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Converter */}
      <section aria-labelledby="converter-heading" className="bg-card rounded-2xl p-4 shadow-md sm:p-6">
        <h2 id="converter-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <ArrowLeftRight className="text-primary size-4" aria-hidden />
          Convert
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="cv-amount" className="text-muted-foreground text-xs font-medium">
              Amount
            </label>
            <Input
              id="cv-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className="text-lg font-semibold tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">From</span>
            <CurrencySelect codes={allCodes} label="Convert from" value={fromCode} onChange={setFrom} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 justify-self-center"
            aria-label="Swap currencies"
            onClick={() => {
              setFrom(toCode);
              setTo(fromCode);
            }}
          >
            <ArrowLeftRight className="size-4" />
          </Button>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">To</span>
            <CurrencySelect codes={allCodes} label="Convert to" value={toCode} onChange={setTo} />
          </div>
        </div>

        <div className="bg-muted/50 mt-5 rounded-2xl p-4" aria-live="polite">
          {rates.isPending ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <>
              <p className="text-muted-foreground text-sm tabular-nums">
                {Number.isFinite(value) ? formatIn(fromCode, value) : "—"} =
              </p>
              <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
                {Number.isFinite(result) ? formatIn(toCode, result) : "—"}
              </p>
              {Number.isFinite(unit) && (
                <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                  1 {fromCode} = {rateText(unit)} {toCode} · 1 {toCode} = {rateText(1 / unit)} {fromCode}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* All rates */}
      <section aria-labelledby="rates-heading" className="bg-card overflow-hidden rounded-2xl shadow-md">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <h2 id="rates-heading" className="text-base font-semibold tracking-tight">
              All rates
            </h2>
            <p className="text-muted-foreground text-xs">
              What 1 {baseCode} is worth today{updated ? ` · updated ${updated}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-56">
              <CurrencySelect codes={allCodes} label="Base currency" value={baseCode} onChange={setBase} />
            </div>
            <div className="relative sm:w-56">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a currency…"
                aria-label="Find a currency"
                className="pr-9 pl-9"
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
        </div>

        {rates.isPending ? (
          <ul className="divide-y" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3 sm:px-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">No currency matches “{query}”.</p>
        ) : (
          <ul className="max-h-[32rem] divide-y overflow-y-auto overscroll-contain">
            {rows.map((row) => (
              <li key={row.code}>
                <button
                  type="button"
                  onClick={() => {
                    setFrom(baseCode);
                    setTo(row.code);
                    window.scrollTo({ behavior: "smooth", top: 0 });
                  }}
                  className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
                  aria-label={`Convert ${baseCode} to ${row.code}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="w-6 text-center text-lg">
                      {currencyOption(row.code).flag}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{row.code}</span>
                      <span className="text-muted-foreground block truncate text-xs">{row.name}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block text-sm font-semibold">{rateText(row.rate)}</span>
                    <span className="text-muted-foreground block text-[11px]">
                      1 {row.code} = {rateText(1 / row.rate)} {baseCode}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {rates.data && (
          <p className="text-muted-foreground border-t px-4 py-3 text-[11px] sm:px-5">
            Rates are for information only (mid-market, refreshed daily) —{" "}
            <a href={rates.data.source.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">
              Rates By Exchange Rate API
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile → Preferences: choose the app's currency
// ─────────────────────────────────────────────────────────────────────────────

export function CurrencySettings() {
  const current = useDisplayCurrency();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const choice = picked ?? current;
  const rates = useRates(choice);
  const changed = choice !== current;

  const quick = ["GBP", "USD", "NPR", "EUR"].filter((c) => c !== choice).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="pref-currency" className="text-sm font-medium">
          Currency
        </label>
        <CurrencySelect
          id="pref-currency"
          codes={SUPPORTED_CURRENCIES.map((c) => c.code)}
          label="App currency"
          value={choice}
          onChange={setPicked}
        />
      </div>

      <dl className="divide-y text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">Amounts look like</dt>
          <dd className="font-medium tabular-nums">{formatIn(choice, 1234.5)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">Today</dt>
          <dd className="text-right text-xs tabular-nums">
            {rates.isPending ? (
              <Loader2 className="text-muted-foreground ml-auto size-3.5 animate-spin" aria-label="Loading rates" />
            ) : rates.data ? (
              quick.map((code) => (
                <span key={code} className="block">
                  1 {choice} = {rateText(rates.data.rates[code] ?? NaN)} {code}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">Rates unavailable</span>
            )}
          </dd>
        </div>
      </dl>

      <p className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-xl p-3 text-xs leading-5">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Pick the currency you record in. Amounts you’ve already added keep their numbers — they aren’t converted.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!changed || saving}
          onClick={() => {
            setSaving(true);
            saveCurrency(choice);
          }}
          className="gap-1.5"
        >
          {saving ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : <Coins className="size-3.5" aria-hidden />}
          {changed ? `Use ${choice} (${currencySymbol(choice)})` : "Saved"}
        </Button>
        <Button asChild size="sm" variant="ghost" className="gap-1">
          <Link href="/rates">
            Exchange rates &amp; converter
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
      {changed && <p className={cn("text-muted-foreground text-xs")}>The app reloads to apply it everywhere.</p>}
    </div>
  );
}
