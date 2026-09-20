import "server-only";
import type { CheckoutRules } from "@/lib/checkout/rules";
import { prisma } from "@/lib/db/prisma";
import type { DeliveryMethodInfo, FreeShippingRule, ShippingZone } from "@/lib/domain/shipping";
import type { TaxSettings } from "@/lib/domain/tax";
import { getSettings } from "@/lib/settings/settingsService";

/**
 * Commerce rules from Settings, loaded in one place so the cart, checkout,
 * reservations and storefront never keep their own copies of these values.
 */
export interface InventoryPolicy {
  /** False when inventory isn't tracked or overselling is allowed: stock never blocks a sale. */
  enforceStock: boolean;
  lowStockThreshold: number;
  hideSoldOut: boolean;
  reservationMinutes: number;
}

export async function getInventoryPolicy(): Promise<InventoryPolicy> {
  const settings = await getSettings("inventory");
  return {
    enforceStock: settings.trackInventory && !settings.allowOverselling,
    lowStockThreshold: settings.lowStockThreshold,
    hideSoldOut: settings.outOfStockBehaviour === "hide",
    reservationMinutes: settings.reservationMinutes,
  };
}

/** Units a customer may buy right now under the inventory policy. */
export const sellableQuantity = (inventory: { quantity: number; reservedQuantity: number } | null | undefined, policy: Pick<InventoryPolicy, "enforceStock">) =>
  policy.enforceStock ? Math.max(0, (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0)) : 9_999;

export interface CheckoutPolicy {
  rules: CheckoutRules;
  zones: ShippingZone[];
  freeShipping: FreeShippingRule;
  tax: TaxSettings;
  methods: DeliveryMethodInfo[];
  defaultCountry: string;
  storeNotice: string;
}

export async function getCheckoutPolicy(): Promise<CheckoutPolicy> {
  const [checkout, shipping, zones, tax, general, site, methods] = await Promise.all([
    getSettings("checkout"),
    getSettings("shipping"),
    getSettings("shipping.zones"),
    getSettings("tax"),
    getSettings("general"),
    getSettings("site"),
    prisma.deliveryMethod.findMany({ where: { enabled: true }, orderBy: { price: "asc" } }).catch(() => []),
  ]);
  return {
    rules: {
      phoneRequired: checkout.phoneRequired,
      addressLine2Enabled: checkout.addressLine2Enabled,
      companyFieldEnabled: checkout.companyFieldEnabled,
      requireTerms: checkout.requireTerms,
      termsUrl: checkout.termsUrl,
      minimumOrder: checkout.minimumOrder,
      maxQuantityPerItem: checkout.maxQuantityPerItem,
      allowedCountries: checkout.allowedCountries,
    },
    zones: zones.zones,
    freeShipping: { enabled: shipping.freeShippingEnabled, threshold: shipping.freeShippingThreshold, methods: shipping.freeShippingMethods },
    tax: { enabled: tax.enabled, pricesIncludeTax: tax.pricesIncludeTax, label: tax.label, defaultRate: tax.defaultRate, rules: tax.rules },
    methods: methods.map((method) => ({ code: method.code, name: method.name, description: method.description, price: Number(method.price), currency: method.currency, minDays: method.estimatedMinDays, maxDays: method.estimatedMaxDays })),
    defaultCountry: general.defaultCountry,
    storeNotice: site.storeNotice,
  };
}
