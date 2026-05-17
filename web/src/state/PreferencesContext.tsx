import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatDisplayDate,
  formatDisplayMoney,
  formatDisplayMoneyCompact,
  formatDisplayPortfolioTotal,
  formatDisplayPrice,
  localeForLanguage,
} from "@/lib/displayFx";
import { translate, type TranslationKey } from "@/lib/i18n";
import type { DisplayCurrency, DisplayLanguage } from "@/lib/preferencesTypes";

export type { DisplayCurrency, DisplayLanguage } from "@/lib/preferencesTypes";

type PreferencesContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  language: DisplayLanguage;
  setLanguage: (l: DisplayLanguage) => void;
  locale: string;
  /** Format a USD ledger amount in the user's display currency. */
  formatMoney: (amountUsd: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) => string;
  formatPortfolioTotal: (amountUsd: number) => string;
  formatPrice: (priceUsd: number) => string;
  formatMoneyCompact: (amountUsd: number) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const STORAGE_CURRENCY = "oove-currency";
const STORAGE_LANGUAGE = "oove-lang";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return "USD";
  const v = localStorage.getItem(STORAGE_CURRENCY);
  if (v === "USD" || v === "EUR" || v === "GBP") return v;
  return "USD";
}

function readLanguage(): DisplayLanguage {
  if (typeof window === "undefined") return "en";
  const v = localStorage.getItem(STORAGE_LANGUAGE);
  if (v === "en" || v === "es" || v === "fr") return v;
  return "en";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(readCurrency);
  const [language, setLanguageState] = useState<DisplayLanguage>(readLanguage);

  const locale = localeForLanguage(language);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_CURRENCY, c);
  }, []);

  const setLanguage = useCallback((l: DisplayLanguage) => {
    setLanguageState(l);
    localStorage.setItem(STORAGE_LANGUAGE, l);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(key, language, params),
    [language],
  );

  const formatMoney = useCallback(
    (amountUsd: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) =>
      formatDisplayMoney(amountUsd, currency, language, options),
    [currency, language],
  );

  const formatPortfolioTotal = useCallback(
    (amountUsd: number) => formatDisplayPortfolioTotal(amountUsd, currency, language),
    [currency, language],
  );

  const formatPrice = useCallback(
    (priceUsd: number) => formatDisplayPrice(priceUsd, currency, language),
    [currency, language],
  );

  const formatMoneyCompact = useCallback(
    (amountUsd: number) => formatDisplayMoneyCompact(amountUsd, currency, language),
    [currency, language],
  );

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => formatDisplayDate(date, language, options),
    [language],
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      language,
      setLanguage,
      locale,
      formatMoney,
      formatPortfolioTotal,
      formatPrice,
      formatMoneyCompact,
      formatDate,
      t,
    }),
    [
      currency,
      setCurrency,
      language,
      setLanguage,
      locale,
      formatMoney,
      formatPortfolioTotal,
      formatPrice,
      formatMoneyCompact,
      formatDate,
      t,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
