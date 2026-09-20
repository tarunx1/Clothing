/**
 * Owner-configured tax, as a pure function shared by the server (authoritative)
 * and the checkout estimate. Rates are basis points (1800 = 18%). No jurisdiction
 * logic is inferred: the most specific configured rule wins. Integer minor units only.
 */
export interface TaxSettings {
  enabled: boolean;
  pricesIncludeTax: boolean;
  label: string;
  defaultRate: number;
  rules: { country: string; region: string; rate: number }[];
}

export function taxRateFor(settings: TaxSettings, country: string, region?: string | null) {
  const upper = country.toUpperCase();
  const regional = settings.rules.find((rule) => rule.country === upper && rule.region && region && rule.region.toLowerCase() === region.toLowerCase());
  const national = settings.rules.find((rule) => rule.country === upper && !rule.region);
  return (regional ?? national)?.rate ?? settings.defaultRate;
}

/** Tax on `amount` (minor units). Inclusive prices yield the tax portion already inside the amount. Rounds half up. */
export function computeTax(settings: TaxSettings, input: { amount: number; country: string; region?: string | null }) {
  if (!settings.enabled) return { rate: 0, amount: 0, inclusive: settings.pricesIncludeTax };
  const rate = taxRateFor(settings, input.country, input.region);
  const amount = BigInt(Math.round(input.amount));
  const bps = BigInt(rate);
  const tax = settings.pricesIncludeTax
    ? (amount * bps * BigInt(2) + (BigInt(10_000) + bps)) / ((BigInt(10_000) + bps) * BigInt(2))
    : (amount * bps + BigInt(5_000)) / BigInt(10_000);
  return { rate, amount: Number(tax), inclusive: settings.pricesIncludeTax };
}
