import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DisplayCurrency = "USD" | "EUR" | "GBP";
export type DisplayLanguage = "en" | "es" | "fr";

type PreferencesContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  language: DisplayLanguage;
  setLanguage: (l: DisplayLanguage) => void;
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

  const value = useMemo(
    () => ({ currency, setCurrency, language, setLanguage }),
    [currency, setCurrency, language, setLanguage],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
