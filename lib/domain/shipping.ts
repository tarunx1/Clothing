/**
 * Shipping rates from Settings → Shipping, as pure functions shared by the
 * server (authoritative totals) and the checkout form (live estimate).
 * All amounts are integer minor units.
 */
export interface ShippingZone {
  id: string;
  name: string;
  enabled: boolean;
  countries: string[];
  regions: string[];
  methods: { code: string; enabled: boolean; rate: number | null }[];
}

export interface DeliveryMethodInfo {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  minDays: number;
  maxDays: number;
}

export interface FreeShippingRule {
  enabled: boolean;
  threshold: number;
  methods: string[];
}

/** First enabled zone covering the country (and region, when the zone lists regions). */
export function zoneFor(zones: readonly ShippingZone[], country: string, region?: string | null) {
  const upper = country.toUpperCase();
  return zones.find((zone) => zone.enabled && zone.countries.includes(upper) && (!zone.regions.length || (region != null && zone.regions.some((entry) => entry.toLowerCase() === region.toLowerCase())))) ?? null;
}

export const shipsTo = (zones: readonly ShippingZone[], country: string) => zones.some((zone) => zone.enabled && zone.countries.includes(country.toUpperCase()));

/** Methods offered for an address, with their rate after the free-shipping rule. */
export function methodsFor(input: { zones: readonly ShippingZone[]; methods: readonly DeliveryMethodInfo[]; freeShipping: FreeShippingRule; country: string; region?: string | null; subtotal: number; currency: string }) {
  const zone = zoneFor(input.zones, input.country, input.region);
  if (!zone) return [];
  return zone.methods
    .filter((entry) => entry.enabled)
    .map((entry) => {
      const method = input.methods.find((candidate) => candidate.code === entry.code && candidate.currency === input.currency);
      if (!method) return null;
      const base = entry.rate ?? method.price;
      const free = input.freeShipping.enabled && input.freeShipping.methods.includes(method.code) && input.subtotal >= input.freeShipping.threshold;
      return { ...method, rate: free ? 0 : base, free, baseRate: base };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.rate - b.rate);
}
