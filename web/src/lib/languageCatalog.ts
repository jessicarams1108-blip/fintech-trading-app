/** ISO 639 language codes for display preferences (UI copy falls back to English when untranslated). */
export type DisplayLanguage = string;

const FALLBACK_LANGUAGES = [
  "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et",
  "fa", "fi", "fr", "ga", "gl", "gu", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "ka", "kk",
  "km", "kn", "ko", "ky", "lo", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my", "nb", "ne", "nl",
  "no", "pa", "pl", "pt", "ro", "ru", "si", "sk", "sl", "sq", "sr", "sv", "sw", "ta", "te", "th", "tl",
  "tr", "uk", "ur", "uz", "vi", "zh", "zu",
] as const;

function intlSupportedLanguages(): string[] | undefined {
  if (typeof Intl === "undefined" || !("supportedValuesOf" in Intl)) return undefined;
  try {
    const fn = Intl.supportedValuesOf as (key: string) => string[];
    return [...fn("language")];
  } catch {
    return undefined;
  }
}

export function listLanguageCodes(): string[] {
  const fromIntl = intlSupportedLanguages();
  if (fromIntl?.length) return fromIntl.sort();
  return [...FALLBACK_LANGUAGES];
}

const LANGUAGE_SET = new Set(listLanguageCodes());

export function normalizeLanguage(code: string): DisplayLanguage {
  const base = code.trim().toLowerCase().split("-")[0] ?? "en";
  if (LANGUAGE_SET.has(base)) return base;
  if (LANGUAGE_SET.has(code.trim().toLowerCase())) return code.trim().toLowerCase();
  return "en";
}

/** BCP 47 locale for dates/numbers from a language code. */
export function localeForLanguage(language: DisplayLanguage): string {
  const base = normalizeLanguage(language);
  try {
    return new Intl.Locale(base).maximize().toString();
  } catch {
    const map: Record<string, string> = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      pt: "pt-BR",
      zh: "zh-CN",
      ja: "ja-JP",
      ko: "ko-KR",
      ar: "ar-SA",
      hi: "hi-IN",
    };
    return map[base] ?? base;
  }
}

export type LanguageOption = { code: string; label: string };

export function listLanguageOptions(uiLocale = "en"): LanguageOption[] {
  let dn: Intl.DisplayNames | undefined;
  try {
    dn = new Intl.DisplayNames([uiLocale], { type: "language" });
  } catch {
    dn = undefined;
  }
  return listLanguageCodes().map((code) => ({
    code,
    label: dn?.of(code) ?? code,
  })).sort((a, b) => a.label.localeCompare(b.label, uiLocale, { sensitivity: "base" }));
}
