import type { DisplayCurrency, DisplayLanguage } from "@/lib/preferencesTypes";

/** Display-only FX from USD (backend amounts stay USD). */
export const USD_TO_DISPLAY: Record<DisplayCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

export function localeForLanguage(language: DisplayLanguage): string {
  switch (language) {
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    default:
      return "en-US";
  }
}

export function convertUsdForDisplay(amountUsd: number, currency: DisplayCurrency): number {
  if (!Number.isFinite(amountUsd)) return 0;
  return amountUsd * USD_TO_DISPLAY[currency];
}

export function formatDisplayMoney(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  if (!Number.isFinite(amountUsd)) {
    return new Intl.NumberFormat(localeForLanguage(language), {
      style: "currency",
      currency,
    }).format(0);
  }
  const converted = convertUsdForDisplay(amountUsd, currency);
  return new Intl.NumberFormat(localeForLanguage(language), {
    style: "currency",
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(converted);
}

/** Headline totals: fewer decimals when large whole amounts. */
export function formatDisplayPortfolioTotal(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(amountUsd)) return formatDisplayMoney(0, currency, language);
  const converted = convertUsdForDisplay(amountUsd, currency);
  const abs = Math.abs(converted);
  if (abs >= 1) {
    return new Intl.NumberFormat(localeForLanguage(language), {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(converted);
  }
  if (abs < 1e-12) return formatDisplayMoney(0, currency, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return formatDisplayMoney(amountUsd, currency, language, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

/** Crypto / asset USD spot shown in user's display currency. */
export function formatDisplayPrice(
  priceUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(priceUsd)) return "—";
  const converted = convertUsdForDisplay(priceUsd, currency);
  const maxFrac = converted < 1 ? 6 : converted < 1000 ? 4 : 2;
  return new Intl.NumberFormat(localeForLanguage(language), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(converted);
}

export function formatDisplayMoneyCompact(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return "—";
  const n = convertUsdForDisplay(amountUsd, currency);
  const locale = localeForLanguage(language);
  const sym =
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency;
  if (n >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${sym}${(n / 1e3).toFixed(2)}K`;
  return formatDisplayMoney(amountUsd, currency, language, { maximumFractionDigits: 2 });
}

export function formatDisplayDate(
  date: Date | string,
  language: DisplayLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(localeForLanguage(language), {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}
