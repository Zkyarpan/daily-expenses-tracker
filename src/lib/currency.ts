/**
 * src/lib/currency.ts — the currency the app shows amounts in.
 *
 * The choice is the currency you RECORD in: amounts are stored as plain
 * numbers and are not converted when you switch (old entries keep their
 * numbers; only the symbol changes). Saved per device in localStorage and
 * applied on load (src/lib/config.ts → LOCALE_CONFIG), so every formatter,
 * input prefix and chart picks it up. Safe on the server (always GBP there).
 *
 * Exchange rates for the converter come from /api/rates.
 */

export const DEFAULT_CURRENCY = "GBP";
export const CURRENCY_STORAGE_KEY = "display-currency";

export interface CurrencyOption {
  code: string;
  flag: string;
  name: string;
}

/** Currencies offered in the picker (the converter shows every rate). */
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "GBP", flag: "🇬🇧", name: "British pound" },
  { code: "USD", flag: "🇺🇸", name: "US dollar" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
  { code: "NPR", flag: "🇳🇵", name: "Nepalese rupee" },
  { code: "INR", flag: "🇮🇳", name: "Indian rupee" },
  { code: "PKR", flag: "🇵🇰", name: "Pakistani rupee" },
  { code: "BDT", flag: "🇧🇩", name: "Bangladeshi taka" },
  { code: "LKR", flag: "🇱🇰", name: "Sri Lankan rupee" },
  { code: "AED", flag: "🇦🇪", name: "UAE dirham" },
  { code: "SAR", flag: "🇸🇦", name: "Saudi riyal" },
  { code: "QAR", flag: "🇶🇦", name: "Qatari riyal" },
  { code: "AUD", flag: "🇦🇺", name: "Australian dollar" },
  { code: "CAD", flag: "🇨🇦", name: "Canadian dollar" },
  { code: "NZD", flag: "🇳🇿", name: "New Zealand dollar" },
  { code: "JPY", flag: "🇯🇵", name: "Japanese yen" },
  { code: "CNY", flag: "🇨🇳", name: "Chinese yuan" },
  { code: "HKD", flag: "🇭🇰", name: "Hong Kong dollar" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore dollar" },
  { code: "MYR", flag: "🇲🇾", name: "Malaysian ringgit" },
  { code: "CHF", flag: "🇨🇭", name: "Swiss franc" },
  { code: "ZAR", flag: "🇿🇦", name: "South African rand" },
  { code: "NGN", flag: "🇳🇬", name: "Nigerian naira" },
];

const SUPPORTED = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));
export const isSupportedCurrency = (code: unknown): code is string => typeof code === "string" && SUPPORTED.has(code);

export const currencyOption = (code: string): CurrencyOption =>
  SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? { code, flag: "🏳️", name: currencyName(code) };

/** "Nepalese rupee" for "NPR" (any ISO code, via Intl). */
export function currencyName(code: string): string {
  try {
    const name = new Intl.DisplayNames(["en-GB"], { type: "currency" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** Short symbol for prefixes in inputs: "£", "$", "Rs", "€". */
export function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat("en-GB", { currency: code, currencyDisplay: "narrowSymbol", style: "currency" })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

/** The saved choice on this device (GBP on the server or when unset/invalid). */
export function readStoredCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isSupportedCurrency(stored) ? stored : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/**
 * Saves the choice and reloads, so every screen (including formatters that
 * were set up when the app loaded) shows the new currency consistently.
 */
export function saveCurrency(code: string) {
  if (!isSupportedCurrency(code) || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    return;
  }
  window.location.reload();
}

/**
 * Server-written text (assistant answers, AI insights) uses "£". When another
 * currency is chosen, show its symbol instead — the numbers are the same,
 * because amounts are never converted.
 */
export function withCurrencySymbol(text: string, code: string = readStoredCurrency()): string {
  if (code === DEFAULT_CURRENCY || !text.includes("£")) return text;
  const symbol = currencySymbol(code);
  return text.replace(/£/g, symbol.length > 1 ? `${symbol} ` : symbol);
}
