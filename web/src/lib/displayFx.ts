import { normalizeCurrency, usdToCurrencyRate, type DisplayCurrency } from "@/lib/currencyCatalog";
import { localeForLanguage, type DisplayLanguage } from "@/lib/languageCatalog";

export function convertUsdForDisplay(amountUsd: number, currency: DisplayCurrency): number {
  if (!Number.isFinite(amountUsd)) return 0;
  return amountUsd * usdToCurrencyRate(currency);
}

export function formatDisplayMoney(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const code = normalizeCurrency(currency);
  const locale = localeForLanguage(language);
  if (!Number.isFinite(amountUsd)) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(0);
    } catch {
      return `${code} 0`;
    }
  }
  const converted = convertUsdForDisplay(amountUsd, code);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(converted);
  } catch {
    return `${code} ${converted.toLocaleString(locale)}`;
  }
}

export function formatDisplayPortfolioTotal(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(amountUsd)) return formatDisplayMoney(0, currency, language);
  const code = normalizeCurrency(currency);
  const locale = localeForLanguage(language);
  const converted = convertUsdForDisplay(amountUsd, code);
  const abs = Math.abs(converted);
  try {
    if (abs >= 1) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(converted);
    }
    if (abs < 1e-12) return formatDisplayMoney(0, currency, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return formatDisplayMoney(amountUsd, currency, language, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  } catch {
    return formatDisplayMoney(amountUsd, currency, language);
  }
}

export function formatDisplayPrice(
  priceUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(priceUsd)) return "—";
  const converted = convertUsdForDisplay(priceUsd, currency);
  const maxFrac = converted < 1 ? 6 : converted < 1000 ? 4 : 2;
  return formatDisplayMoney(priceUsd, currency, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

export function formatDisplayMoneyCompact(
  amountUsd: number,
  currency: DisplayCurrency,
  language: DisplayLanguage,
): string {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return "—";
  const code = normalizeCurrency(currency);
  const n = convertUsdForDisplay(amountUsd, code);
  const locale = localeForLanguage(language);
  let sym = code;
  try {
    sym =
      new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code;
  } catch {
    /* keep code */
  }
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
  const locale = localeForLanguage(language);
  const wantsTime = options?.timeStyle != null || options?.hour != null;
  const usesStyle = options?.dateStyle != null || options?.timeStyle != null;
  try {
    if (wantsTime || usesStyle) {
      return d.toLocaleString(locale, options);
    }
    return d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...options,
    });
  } catch {
    try {
      return d.toLocaleString(locale);
    } catch {
      return String(date);
    }
  }
}

export { localeForLanguage, normalizeLanguage } from "@/lib/languageCatalog";
export { normalizeCurrency } from "@/lib/currencyCatalog";
