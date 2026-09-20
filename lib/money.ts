import type { CurrencyCode } from "@/types/product";

/** Locale that reads naturally for each currency. */
const locales: Record<CurrencyCode, string> = { INR: "en-IN", CAD: "en-CA", USD: "en-US" };
const formatters = new Map<string, Intl.NumberFormat>();

/** The one place prices become text. Whole units unless the amount has cents. */
export function formatMoney(amount: number, currency: CurrencyCode, locale = locales[currency]): string {
  const fractional = !Number.isInteger(amount);
  const key = `${locale}|${currency}|${fractional}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractional ? 2 : 0,
      maximumFractionDigits: fractional ? 2 : 0,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(amount);
}
