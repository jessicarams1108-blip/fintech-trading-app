import { useMemo } from "react";
import { listCurrencyOptions } from "@/lib/currencyCatalog";
import { listLanguageOptions } from "@/lib/languageCatalog";
import { usePreferences } from "@/state/PreferencesContext";

type SelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function CurrencyPreferenceSelect({ id, value, onChange, className }: SelectProps) {
  const { language, locale } = usePreferences();
  const options = useMemo(() => listCurrencyOptions(locale || language), [locale, language]);

  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LanguagePreferenceSelect({ id, value, onChange, className }: SelectProps) {
  const { language, locale } = usePreferences();
  const options = useMemo(() => listLanguageOptions(locale || language), [locale, language]);

  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
