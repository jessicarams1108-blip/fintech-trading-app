/** ISO 4217 currency code for display (amounts stored as USD on the server). */
export type DisplayCurrency = string;

/**
 * Units of each currency per 1 USD (display-only approximate rates).
 * Missing codes fall back to 1 (same numeric amount, local symbol).
 */
const UNITS_PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, CNY: 7.24, CHF: 0.88, CAD: 1.36, AUD: 1.52, NZD: 1.65,
  HKD: 7.82, SGD: 1.34, SEK: 10.5, NOK: 10.6, DKK: 6.9, PLN: 4.0, CZK: 23.0, HUF: 360, RON: 4.6,
  BGN: 1.8, HRK: 7.0, RUB: 92, UAH: 41, TRY: 32, ILS: 3.7, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  BHD: 0.38, OMR: 0.38, INR: 83, PKR: 278, BDT: 110, LKR: 300, NPR: 133, THB: 36, MYR: 4.7, IDR: 15800,
  PHP: 56, VND: 24500, KRW: 1330, TWD: 32, MXN: 17, BRL: 5.0, ARS: 900, CLP: 950, COP: 4100, PEN: 3.7,
  ZAR: 18.5, EGP: 48, NGN: 1550, KES: 130, GHS: 15, MAD: 10, TND: 3.1, DZD: 134, XOF: 605, XAF: 605,
  ETB: 56, UGX: 3800, TZS: 2600, RWF: 1300, ZMW: 27, BWP: 13.5, MUR: 46, SCR: 14, ISK: 138, RSD: 108,
  MKD: 57, ALL: 95, GEL: 2.7, AMD: 390, AZN: 1.7, KZT: 450, UZS: 12600, KGS: 89, TJS: 11, TMT: 3.5,
  MNT: 3400, LAK: 21000, KHR: 4100, MMK: 2100, BND: 1.34, FJD: 2.25, PGK: 3.8, WST: 2.75, TOP: 2.35,
  VUV: 120, SBD: 8.5, XPF: 110, CDF: 2800, AOA: 830, MZN: 64, MWK: 1700, LSL: 18.5, SZL: 18.5, NAD: 18.5,
  GMD: 68, SLL: 22000, LRD: 195, GNF: 8600, CVE: 101, STN: 22.5, BAM: 1.8, MDL: 18, BYN: 3.3, LBP: 89000,
  IQD: 1310, IRR: 42000, AFN: 71, JOD: 0.71, YER: 250, SYP: 13000, LYD: 4.85, SDG: 600, SOS: 570, DJF: 178,
  ERN: 15, BIF: 2850, KMF: 455, MGA: 4500, HTG: 132, BOB: 6.9, PYG: 7300, UYU: 39, VES: 36, GTQ: 7.8,
  HNL: 24.7, NIO: 36.7, CRC: 520, PAB: 1, DOP: 59, JMD: 155, TTD: 6.8, BBD: 2, BSD: 1, KYD: 0.83,
  AWG: 1.79, ANG: 1.79, XCD: 2.7, BZD: 2, GYD: 209, SRD: 38, CUP: 24, CUC: 1, USN: 1, UYI: 39,
};

const FALLBACK_CURRENCIES = Object.keys(UNITS_PER_USD).sort();

export function listCurrencyCodes(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      const supported = Intl.supportedValuesOf("currency");
      const merged = new Set([...supported, ...FALLBACK_CURRENCIES]);
      return [...merged].sort();
    } catch {
      /* ignore */
    }
  }
  return [...FALLBACK_CURRENCIES];
}

const CURRENCY_SET = new Set(listCurrencyCodes());

export function normalizeCurrency(code: string): DisplayCurrency {
  const u = code.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(u) && CURRENCY_SET.has(u)) return u;
  if (/^[A-Z]{3}$/.test(u)) return u;
  return "USD";
}

export function usdToCurrencyRate(currency: DisplayCurrency): number {
  const code = normalizeCurrency(currency);
  if (code === "USD") return 1;
  const rate = UNITS_PER_USD[code];
  return typeof rate === "number" && rate > 0 ? rate : 1;
}

export type CurrencyOption = { code: string; label: string };

export function listCurrencyOptions(uiLocale = "en"): CurrencyOption[] {
  let dn: Intl.DisplayNames | undefined;
  try {
    dn = new Intl.DisplayNames([uiLocale], { type: "currency" });
  } catch {
    dn = undefined;
  }
  return listCurrencyCodes().map((code) => {
    const name = dn?.of(code) ?? code;
    return { code, label: `${code} — ${name}` };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/** Whether Intl can format this currency (sanity check). */
export function canFormatCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code }).format(1);
    return true;
  } catch {
    return false;
  }
}
