import { z } from "zod";
import type { Permission } from "@/lib/admin/permissions";
import { siteConfig } from "@/config/site";
import { f, type FieldDef, type Option } from "./fields";

/**
 * Every configurable store setting, grouped into namespaces. This is the single
 * source of truth for validation, defaults, visibility (public vs private) and
 * which permission may change it. Nothing reads raw setting rows elsewhere:
 * use lib/settings/settingsService.
 */

// ---------- shared option lists ----------
export const CURRENCIES = [
  { value: "INR", label: "INR — Indian rupee" },
  { value: "USD", label: "USD — US dollar" },
  { value: "CAD", label: "CAD — Canadian dollar" },
] as const satisfies readonly Option[];
export const CHECKOUT_COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
] as const satisfies readonly Option[];
const LOCALES: Option[] = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "hi-IN", label: "Hindi (India)" },
  { value: "fr-CA", label: "French (Canada)" },
];
const TIMEZONES: Option[] = ["Asia/Kolkata", "America/Toronto", "America/Vancouver", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "Asia/Singapore", "UTC"].map((value) => ({ value, label: value }));
const MODES = [{ value: "test", label: "Test" }, { value: "live", label: "Live" }] as const;
const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code (ISO 3166)");

const link = z.object({ label: z.string().trim().min(1, "Add a label").max(40), href: z.string().trim().max(300).refine((value) => /^\/(?!\/)\S*$/.test(value) || /^https:\/\/\S+$/.test(value) || /^mailto:\S+@\S+$/.test(value), "Use /path, https:// or mailto:") });

// ---------- namespace definition ----------
export interface NamespaceDef<F extends readonly FieldDef[] = readonly FieldDef[]> {
  id: string;
  title: string;
  description: string;
  permission: Permission;
  fields: F;
  /** Cross-field rules, run after field validation. Return messages keyed by field. */
  refine?: (values: Record<string, unknown>) => Record<string, string> | null;
  /** Invalidate the whole storefront (chrome, metadata) when this namespace changes. */
  affectsStorefront?: boolean;
  /** Stable audit action for changes to this namespace. */
  auditAction: string;
}

const ns = <const F extends readonly FieldDef[]>(def: NamespaceDef<F>) => def;
const requireIdWhenEnabled = (pairs: [string, string, string][]) => (values: Record<string, unknown>) => {
  const issues: Record<string, string> = {};
  for (const [flag, id, message] of pairs) if (values[flag] && !values[id]) issues[id] = message;
  return Object.keys(issues).length ? issues : null;
};

export const NAMESPACES = {
  general: ns({
    id: "general", title: "Store identity", description: "Names and contact details used across the storefront, emails and invoices.",
    permission: "settings:write", auditAction: "GENERAL_SETTINGS_UPDATED", affectsStorefront: true,
    refine: (values) => values.storeName ? null : { storeName: "Enter a store name" },
    fields: [
      f.text("storeName", "Store name", siteConfig.brand.name, { public: true, max: 40, help: "Header, footer, page titles and the payment window." }),
      f.text("legalName", "Legal business name", "", { max: 120, help: "For invoices and legal pages." }),
      f.textarea("shortDescription", "Short description", siteConfig.brand.description, { public: true, max: 200 }),
      f.email("supportEmail", "Support email", "", { public: true, group: "Customer support" }),
      f.tel("supportPhone", "Support phone", "", { public: true, group: "Customer support" }),
      f.email("businessEmail", "Business email", "", { group: "Business contact" }),
      f.tel("businessPhone", "Business phone", "", { group: "Business contact" }),
      f.select("defaultCountry", "Default country", CHECKOUT_COUNTRIES, "IN", { public: true, help: "Preselected at checkout." }),
    ],
  }),
  address: ns({
    id: "address", title: "Business address", description: "Your registered address. Used later for invoices, tax and as the default shipping origin.",
    permission: "settings:write", auditAction: "BUSINESS_ADDRESS_UPDATED",
    fields: [
      f.text("line1", "Address line 1", "", { max: 160 }),
      f.text("line2", "Address line 2", "", { max: 160 }),
      f.text("city", "City", "", { max: 100 }),
      f.text("region", "State / province", "", { max: 100 }),
      f.text("postalCode", "Postal code", "", { max: 12 }),
      f.text("country", "Country code", "IN", { max: 2, pattern: [/^[A-Z]{2}$/, "Use a 2-letter code like IN"] }),
    ],
  }),
  status: ns({
    id: "status", title: "Store status", description: "Close the storefront for maintenance or protect it with a password before launch. The admin always stays available.",
    permission: "security:manage", auditAction: "STORE_STATUS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("maintenanceEnabled", "Maintenance mode", false, { sensitive: true, help: "Visitors see a maintenance page. Payments already in progress can still complete." }),
      f.textarea("maintenanceMessage", "Maintenance message", "We’re making a few changes. Back shortly.", { max: 300 }),
      f.datetime("maintenanceReturnAt", "Expected back", { help: "Optional. Shown on the maintenance page." }),
      f.switch("passwordEnabled", "Password-protect the storefront", false, { sensitive: true, help: "Visitors must enter the store password. Set the password below first." }),
      f.textarea("passwordMessage", "Password page message", "Opening soon. Enter the password to preview the store.", { max: 300 }),
    ],
  }),
  returns: ns({
    id: "returns", title: "Returns", description: "Basic policy values shown to customers. A full returns workflow is not part of this release.",
    permission: "settings:write", auditAction: "RETURNS_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("enabled", "Accept returns", false, { public: true }),
      f.number("windowDays", "Return window (days)", 14, { min: 1, max: 365, public: true }),
      f.switch("exchangesEnabled", "Offer exchanges", false, { public: true }),
      f.textarea("instructions", "Return instructions", "", { max: 1000, public: true }),
    ],
  }),
  site: ns({
    id: "site", title: "Site notices and footer", description: "Announcement bar, checkout notice and footer contact and links. Layout stays as designed.",
    permission: "settings:write", auditAction: "SITE_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("announcementEnabled", "Show announcement bar", false, { public: true, group: "Announcement bar" }),
      f.text("announcementText", "Announcement", "", { public: true, max: 120, group: "Announcement bar" }),
      f.url("announcementHref", "Announcement link", "", { public: true, allowPath: true, group: "Announcement bar" }),
      f.textarea("storeNotice", "Store notice", "", { public: true, max: 300, help: "Shown on the bag and checkout pages, e.g. dispatch delays.", group: "Notices" }),
      f.email("footerEmail", "Footer contact email", "", { public: true, group: "Footer" }),
      f.tel("footerPhone", "Footer contact phone", "", { public: true, group: "Footer" }),
      f.rows("footerLinks", "Footer links", [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Link", type: "url", placeholder: "/shop or https://" }], link, [], { public: true, maxItems: 8, group: "Footer" }),
      f.rows("legalLinks", "Legal links", [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Link", type: "url", placeholder: "/terms or https://" }], link, [], { public: true, maxItems: 8, group: "Footer" }),
    ],
  }),
  branding: ns({
    id: "branding", title: "Branding", description: "Logos, favicon, social image and brand colour tokens. These swap assets; they don't change the layout.",
    permission: "settings:write", auditAction: "BRANDING_UPDATED", affectsStorefront: true,
    fields: [
      f.text("wordmark", "Wordmark text", "", { public: true, max: 40, help: "Shown when no logo is uploaded. Empty uses the store name." }),
      f.image("logoLight", "Logo for light backgrounds", { public: true, help: "PNG or WebP, transparent background. Shown in the header on light pages." }),
      f.image("logoDark", "Logo for dark backgrounds", { public: true, help: "Shown over the dark lookbook and hero sections." }),
      f.image("favicon", "Favicon", { public: true, help: "Square PNG, at least 64×64." }),
      f.image("socialImage", "Default social image", { public: true, help: "1200×630. Used when a page has no image of its own." }),
      f.image("emailLogo", "Email logo", { public: true, help: "Shown at the top of order emails." }),
      f.color("primaryColor", "Primary colour", "#111111", { public: true, help: "Buttons in emails and the payment window." }),
      f.color("accentColor", "Accent colour", "#f3f3ef", { public: true }),
    ],
  }),
  localization: ns({
    id: "localization", title: "Localization", description: "Currencies, language and units. Money is always stored as integer minor units with ISO 4217 codes; symbols come from the formatter.",
    permission: "settings:write", auditAction: "LOCALIZATION_UPDATED", affectsStorefront: true,
    refine: (values) => ((values.supportedCurrencies as string[]).includes(values.defaultCurrency as string) ? null : { supportedCurrencies: "Include the default currency" }),
    fields: [
      f.select("defaultCurrency", "Default currency", CURRENCIES, "INR", { public: true, help: "Preselected for new products. Existing prices are unchanged." }),
      f.multiselect("supportedCurrencies", "Supported currencies", CURRENCIES, ["INR"], { public: true, min: 1 }),
      f.select("defaultLocale", "Default locale", LOCALES, "en-IN", { public: true }),
      f.multiselect("supportedLocales", "Supported locales", LOCALES, ["en-IN"], { public: true, min: 1 }),
      f.select("timezone", "Timezone", TIMEZONES, "Asia/Kolkata", { public: true, help: "Dashboard “today”, dates in the admin and emails." }),
      f.select("measurementSystem", "Measurement system", [{ value: "METRIC", label: "Metric" }, { value: "IMPERIAL", label: "Imperial" }], "METRIC", { public: true }),
      f.select("sizeUnit", "Size guide default unit", [{ value: "CM", label: "Centimetres" }, { value: "INCHES", label: "Inches" }], "CM", { public: true }),
    ],
  }),

  // ---------- payments ----------
  "payments.razorpay": ns({
    id: "payments.razorpay", title: "Razorpay", description: "Cards, UPI, netbanking and wallets for India.",
    permission: "integrations:manage", auditAction: "PAYMENT_SETTINGS_UPDATED",
    fields: [
      f.switch("enabled", "Enabled", true, { sensitive: true }),
      f.select("mode", "Mode", MODES, "test", { sensitive: true }),
      f.text("testKeyId", "Test key ID", "", { group: "Test credentials", pattern: [/^rzp_test_[A-Za-z0-9]+$/, "Test key IDs start with rzp_test_"] }),
      f.secret("testKeySecret", "Test key secret", { group: "Test credentials" }),
      f.secret("testWebhookSecret", "Test webhook secret", { group: "Test credentials" }),
      f.text("liveKeyId", "Live key ID", "", { group: "Live credentials", pattern: [/^rzp_live_[A-Za-z0-9]+$/, "Live key IDs start with rzp_live_"] }),
      f.secret("liveKeySecret", "Live key secret", { group: "Live credentials" }),
      f.secret("liveWebhookSecret", "Live webhook secret", { group: "Live credentials" }),
    ],
  }),
  "payments.stripe": ns({
    id: "payments.stripe", title: "Stripe", description: "International cards and wallets. Credentials can be stored and tested now; the Stripe checkout adapter is not installed yet, so customers are not offered Stripe.",
    permission: "integrations:manage", auditAction: "PAYMENT_SETTINGS_UPDATED",
    fields: [
      f.switch("enabled", "Enabled", false, { sensitive: true }),
      f.select("mode", "Mode", MODES, "test", { sensitive: true }),
      f.text("testPublishableKey", "Test publishable key", "", { group: "Test credentials", pattern: [/^pk_test_\w+$/, "Test publishable keys start with pk_test_"] }),
      f.secret("testSecretKey", "Test secret key", { group: "Test credentials", format: [/^(sk|rk)_test_\w+$/, "Test secret keys start with sk_test_ or rk_test_"] }),
      f.secret("testWebhookSecret", "Test webhook secret", { group: "Test credentials", format: [/^whsec_\w+$/, "Webhook secrets start with whsec_"] }),
      f.text("livePublishableKey", "Live publishable key", "", { group: "Live credentials", pattern: [/^pk_live_\w+$/, "Live publishable keys start with pk_live_"] }),
      f.secret("liveSecretKey", "Live secret key", { group: "Live credentials", format: [/^(sk|rk)_live_\w+$/, "Live secret keys start with sk_live_ or rk_live_"] }),
      f.secret("liveWebhookSecret", "Live webhook secret", { group: "Live credentials", format: [/^whsec_\w+$/, "Webhook secrets start with whsec_"] }),
    ],
  }),
  "payments.paypal": ns({
    id: "payments.paypal", title: "PayPal", description: "Credentials can be stored and tested; the PayPal checkout adapter is not installed yet.",
    permission: "integrations:manage", auditAction: "PAYMENT_SETTINGS_UPDATED",
    fields: [
      f.switch("enabled", "Enabled", false, { sensitive: true }),
      f.select("mode", "Mode", MODES, "test", { sensitive: true, help: "Test uses the PayPal sandbox." }),
      f.text("testClientId", "Sandbox client ID", "", { group: "Test credentials", max: 120 }),
      f.secret("testClientSecret", "Sandbox client secret", { group: "Test credentials" }),
      f.text("liveClientId", "Live client ID", "", { group: "Live credentials", max: 120 }),
      f.secret("liveClientSecret", "Live client secret", { group: "Live credentials" }),
    ],
  }),
  "payments.routing": ns({
    id: "payments.routing", title: "Provider routing", description: "When several providers are enabled, the first matching rule wins; otherwise the priority order decides.",
    permission: "integrations:manage", auditAction: "PAYMENT_ROUTING_UPDATED",
    fields: [
      f.multiselect("priority", "Priority order", [{ value: "razorpay", label: "Razorpay" }, { value: "stripe", label: "Stripe" }, { value: "paypal", label: "PayPal" }], ["razorpay", "stripe", "paypal"], { help: "Drag order is saved top to bottom." }),
      f.rows("rules", "Routing rules", [
        { key: "provider", label: "Provider", type: "select", options: [{ value: "razorpay", label: "Razorpay" }, { value: "stripe", label: "Stripe" }, { value: "paypal", label: "PayPal" }] },
        { key: "countries", label: "Countries", type: "list", placeholder: "IN, CA (empty = any)" },
        { key: "currencies", label: "Currencies", type: "list", placeholder: "INR (empty = any)" },
      ], z.object({ provider: z.enum(["razorpay", "stripe", "paypal"]), countries: z.array(countryCode).max(50), currencies: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use ISO 4217 codes like INR")).max(20) }), [], { maxItems: 10 }),
    ],
  }),
  "payments.methods": ns({
    id: "payments.methods", title: "Payment methods", description: "Methods offered in the payment window, where the active provider supports them.",
    permission: "integrations:manage", auditAction: "PAYMENT_METHODS_UPDATED",
    fields: [
      f.switch("card", "Cards", true),
      f.switch("upi", "UPI", true),
      f.switch("netbanking", "Net banking", true),
      f.switch("wallet", "Wallets", true),
      f.switch("emi", "EMI / pay later", false),
      f.switch("applePay", "Apple Pay", false, { help: "Needs the Stripe adapter (not installed yet)." }),
      f.switch("googlePay", "Google Pay", false, { help: "Needs the Stripe adapter (not installed yet)." }),
    ],
  }),
  "payments.cod": ns({
    id: "payments.cod", title: "Cash on delivery", description: "Stored for when a COD flow is added. Checkout does not offer cash on delivery in this release, so enabling it has no effect yet.",
    permission: "integrations:manage", auditAction: "PAYMENT_SETTINGS_UPDATED",
    fields: [
      f.switch("enabled", "COD enabled", false, { readOnly: true, help: "Not available yet: checkout has no cash-on-delivery flow." }),
      f.money("minOrder", "Minimum order", 0),
      f.money("maxOrder", "Maximum order", 0, { help: "0 = no maximum." }),
      f.money("fee", "COD fee", 0),
      f.multiselect("countries", "Allowed countries", CHECKOUT_COUNTRIES, ["IN"]),
    ],
  }),

  // ---------- shipping & tax ----------
  shipping: ns({
    id: "shipping", title: "Shipping", description: "Origin, free-shipping rule and zones. Delivery methods (names, default rates, times) are managed below.",
    permission: "settings:write", auditAction: "SHIPPING_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("originSameAsBusiness", "Ship from the business address", true, { group: "Origin" }),
      f.text("originLine1", "Origin address", "", { group: "Origin", max: 160, showIf: { key: "originSameAsBusiness", in: [false] } }),
      f.text("originCity", "Origin city", "", { group: "Origin", max: 100, showIf: { key: "originSameAsBusiness", in: [false] } }),
      f.text("originPostalCode", "Origin postal code", "", { group: "Origin", max: 12, showIf: { key: "originSameAsBusiness", in: [false] } }),
      f.text("originCountry", "Origin country", "IN", { group: "Origin", max: 2, pattern: [/^[A-Z]{2}$/, "Use a 2-letter code"], showIf: { key: "originSameAsBusiness", in: [false] } }),
      f.switch("freeShippingEnabled", "Free shipping over a threshold", false, { public: true, group: "Free shipping" }),
      f.money("freeShippingThreshold", "Free shipping threshold", 399900, { public: true, group: "Free shipping", help: "Order subtotal (before shipping), in the store currency." }),
      f.list("freeShippingMethods", "Methods made free", ["STANDARD"], { public: true, group: "Free shipping", item: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, "Use delivery method codes like STANDARD"), help: "Delivery method codes, one per line." }),
    ],
  }),
  "shipping.zones": ns({
    id: "shipping.zones", title: "Shipping zones", description: "Where you ship and which methods (and rates) apply. Countries not in any enabled zone can't check out.",
    permission: "settings:write", auditAction: "SHIPPING_ZONES_UPDATED", affectsStorefront: true,
    fields: [
      f.rows("zones", "Zones", [], z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1, "Name the zone").max(60),
        enabled: z.boolean(),
        countries: z.array(countryCode).min(1, "Add at least one country").max(250),
        regions: z.array(z.string().trim().min(1).max(100)).max(100),
        methods: z.array(z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/), enabled: z.boolean(), rate: z.union([z.null(), z.number().int().min(0).max(1e10)]) })).max(20),
      }), [{ id: "default", name: "Everywhere we ship", enabled: true, countries: ["IN", "CA", "US"], regions: [], methods: [{ code: "STANDARD", enabled: true, rate: null }, { code: "EXPRESS", enabled: true, rate: null }] }], { public: true, maxItems: 20 }),
    ],
  }),
  "shipping.shiprocket": ns({ id: "shipping.shiprocket", title: "Shiprocket", description: "Courier aggregator (India). Credentials only; label and tracking sync arrive with courier integration.", permission: "integrations:manage", auditAction: "COURIER_SETTINGS_UPDATED",
    fields: [f.switch("enabled", "Enabled", false), f.email("email", "API user email"), f.secret("password", "API user password")] }),
  "shipping.delhivery": ns({ id: "shipping.delhivery", title: "Delhivery", description: "Credentials only in this release.", permission: "integrations:manage", auditAction: "COURIER_SETTINGS_UPDATED",
    fields: [f.switch("enabled", "Enabled", false), f.select("environment", "Environment", [{ value: "staging", label: "Staging" }, { value: "production", label: "Production" }], "staging"), f.secret("apiToken", "API token")] }),
  "shipping.bluedart": ns({ id: "shipping.bluedart", title: "Blue Dart", description: "Credentials only in this release.", permission: "integrations:manage", auditAction: "COURIER_SETTINGS_UPDATED",
    fields: [f.switch("enabled", "Enabled", false), f.text("loginId", "Login ID"), f.secret("licenseKey", "License key")] }),
  "shipping.canadapost": ns({ id: "shipping.canadapost", title: "Canada Post", description: "Credentials only in this release.", permission: "integrations:manage", auditAction: "COURIER_SETTINGS_UPDATED",
    fields: [f.switch("enabled", "Enabled", false), f.text("customerNumber", "Customer number"), f.text("username", "API username"), f.secret("password", "API password")] }),
  tax: ns({
    id: "tax", title: "Tax", description: "Owner-defined rates applied at checkout. No automatic GST/HST determination: rates here are exactly what is charged. A tax provider can replace this later.",
    permission: "settings:write", auditAction: "TAX_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("enabled", "Charge tax", false, { public: true }),
      f.switch("pricesIncludeTax", "Catalogue prices include tax", true, { public: true, help: "On: tax is shown as included and the total is unchanged. Off: tax is added at checkout." }),
      f.text("label", "Tax label", "GST", { public: true, max: 20 }),
      f.text("registrationNumber", "Tax registration number", "", { max: 40 }),
      f.text("gstin", "GSTIN", "", { max: 15, pattern: [/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"] }),
      f.percent("defaultRate", "Default rate (%)", 0),
      f.rows("rules", "Regional rates", [
        { key: "country", label: "Country", type: "text", placeholder: "IN" },
        { key: "region", label: "State / province", type: "text", placeholder: "Empty = whole country" },
        { key: "rate", label: "Rate %", type: "percent" },
      ], z.object({ country: countryCode, region: z.string().trim().max(100), rate: z.union([z.number().int().min(0).max(10_000), z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/).transform((value) => Math.round(Number(value) * 100)).refine((value) => value <= 10000, "Rates cannot exceed 100%")]) }), [], { maxItems: 60, help: "The most specific match wins (state, then country, then default)." }),
    ],
  }),

  // ---------- commerce rules ----------
  checkout: ns({
    id: "checkout", title: "Checkout", description: "Rules enforced by the server when an order is placed; the form mirrors them.",
    permission: "settings:write", auditAction: "CHECKOUT_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("guestCheckout", "Guest checkout", true, { public: true, readOnly: true, help: "Customer accounts aren’t available yet, so every checkout is a guest checkout." }),
      f.switch("phoneRequired", "Require a delivery phone number", true, { public: true }),
      f.switch("addressLine2Enabled", "Show address line 2", true, { public: true }),
      f.switch("companyFieldEnabled", "Show company field", false, { public: true }),
      f.switch("requireTerms", "Require agreement to terms", false, { public: true }),
      f.url("termsUrl", "Terms page", "", { public: true, allowPath: true }),
      f.money("minimumOrder", "Minimum order value", 0, { public: true, help: "Subtotal before shipping. 0 = no minimum." }),
      f.number("maxQuantityPerItem", "Maximum quantity per item", 10, { min: 1, max: 99, public: true }),
      f.multiselect("allowedCountries", "Countries you sell to", CHECKOUT_COUNTRIES, ["IN", "CA", "US"], { public: true, min: 1, help: "Also limited by your shipping zones." }),
    ],
  }),
  orders: ns({
    id: "orders", title: "Orders", description: "Numbering, post-payment status and unpaid-order clean-up.",
    permission: "settings:write", auditAction: "ORDER_SETTINGS_UPDATED",
    fields: [
      f.text("numberPrefix", "Order number prefix", "CLT", { max: 6, pattern: [/^[A-Z]{2,6}$/, "2–6 capital letters"], help: "New orders look like PREFIX-3F9A21C07B5E. Numbers stay random, so they can't be guessed." }),
      f.select("statusAfterPayment", "Status after payment", [{ value: "PAID", label: "Paid (fulfil manually)" }, { value: "PROCESSING", label: "Processing (start fulfilment immediately)" }], "PAID"),
      f.number("autoCancelUnpaidHours", "Cancel unpaid orders after (hours)", 0, { min: 0, max: 720, help: "0 keeps unpaid orders as Expired without cancelling them." }),
      f.text("invoicePrefix", "Invoice prefix", "INV", { max: 10, pattern: [/^[A-Z0-9-]{1,10}$/, "Capital letters, numbers and hyphens"], group: "Invoices" }),
      f.textarea("invoiceNotes", "Invoice notes", "", { max: 500, group: "Invoices" }),
      f.switch("invoiceShowTaxId", "Show tax ID on invoices", true, { group: "Invoices" }),
    ],
  }),
  inventory: ns({
    id: "inventory", title: "Inventory", description: "Stock rules used by the cart, checkout, reservations and the admin.",
    permission: "settings:write", auditAction: "INVENTORY_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("trackInventory", "Track inventory", true, { help: "Off: stock levels are ignored when selling (reservations still keep records)." }),
      f.switch("allowOverselling", "Allow overselling", false, { help: "Customers can buy more than you have in stock. Use for made-to-order items." }),
      f.number("lowStockThreshold", "Low stock threshold", 5, { min: 0, max: 1000, help: "Variants at or below this many available units are flagged." }),
      f.select("outOfStockBehaviour", "Sold-out products", [{ value: "show", label: "Show as sold out" }, { value: "hide", label: "Hide from the shop" }], "show", { public: true }),
      f.number("reservationMinutes", "Checkout reservation (minutes)", 30, { min: 5, max: 1440, help: "How long stock is held while a customer pays. The payment window closes before this runs out." }),
    ],
  }),

  // ---------- communication ----------
  email: ns({
    id: "email", title: "Email delivery", description: "Transactional email (order confirmations and notifications).",
    permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    refine: (values) => (values.provider !== "none" && !values.fromEmail ? { fromEmail: "Add a sender address" } : null),
    fields: [
      f.select("provider", "Provider", [{ value: "none", label: "Not configured" }, { value: "smtp", label: "SMTP" }, { value: "resend", label: "Resend" }, { value: "sendgrid", label: "SendGrid" }, { value: "postmark", label: "Postmark" }, { value: "ses", label: "Amazon SES" }], "none", { sensitive: true }),
      f.text("fromName", "From name", "", { max: 80 }),
      f.email("fromEmail", "From email", ""),
      f.email("replyTo", "Reply-to", ""),
    ],
  }),
  "email.smtp": ns({ id: "email.smtp", title: "SMTP", description: "Any SMTP server (Gmail/Workspace, Zoho, Mailgun SMTP…).", permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    fields: [
      f.text("host", "Host", "", { max: 200, pattern: [/^[a-z0-9.-]+$/i, "Enter a hostname like smtp.example.com"] }),
      f.number("port", "Port", 587, { min: 1, max: 65535 }),
      f.select("security", "Encryption", [{ value: "starttls", label: "STARTTLS (587)" }, { value: "tls", label: "TLS (465)" }, { value: "none", label: "None (development only)" }], "starttls"),
      f.text("username", "Username", "", { max: 200 }),
      f.secret("password", "Password"),
    ] }),
  "email.resend": ns({ id: "email.resend", title: "Resend", description: "API-based email.", permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    fields: [f.secret("apiKey", "API key", { format: [/^re_\w+$/, "Resend keys start with re_"] })] }),
  "email.sendgrid": ns({ id: "email.sendgrid", title: "SendGrid", description: "API-based email.", permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    fields: [f.secret("apiKey", "API key", { format: [/^SG\.[\w-]+\.[\w-]+$/, "SendGrid keys look like SG.xxxxx.yyyyy"] })] }),
  "email.postmark": ns({ id: "email.postmark", title: "Postmark", description: "API-based email.", permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    fields: [f.secret("serverToken", "Server token"), f.text("messageStream", "Message stream", "outbound", { max: 60 })] }),
  "email.ses": ns({ id: "email.ses", title: "Amazon SES", description: "SES v2 API with an IAM key limited to ses:SendEmail.", permission: "integrations:manage", auditAction: "EMAIL_SETTINGS_UPDATED",
    fields: [f.text("region", "Region", "ap-south-1", { max: 30, pattern: [/^[a-z]{2}-[a-z]+-\d$/, "Use a region like ap-south-1"] }), f.text("accessKeyId", "Access key ID", "", { max: 40 }), f.secret("secretAccessKey", "Secret access key")] }),
  notifications: ns({
    id: "notifications", title: "Notifications", description: "Which emails and texts are sent. Nothing is sent until an email or SMS provider is configured.",
    permission: "settings:write", auditAction: "NOTIFICATION_SETTINGS_UPDATED",
    fields: [
      f.switch("orderConfirmation", "Order confirmation", true, { group: "Customer emails" }),
      f.switch("paymentConfirmation", "Payment receipt", false, { group: "Customer emails", help: "A separate receipt in addition to the confirmation." }),
      f.switch("orderShipped", "Order shipped", true, { group: "Customer emails" }),
      f.switch("orderDelivered", "Order delivered", false, { group: "Customer emails" }),
      f.switch("orderCancelled", "Order cancelled", true, { group: "Customer emails" }),
      f.switch("adminNewOrder", "New order", true, { group: "Team emails" }),
      f.switch("adminLowStock", "Low stock", true, { group: "Team emails" }),
      f.list("adminRecipients", "Team recipients", [], { group: "Team emails", item: z.string().trim().toLowerCase().email("Enter valid email addresses"), maxItems: 10, help: "One email per line." }),
      f.switch("smsOrderShipped", "Text when shipped", false, { group: "Customer SMS" }),
      f.switch("smsOrderDelivered", "Text when delivered", false, { group: "Customer SMS" }),
    ],
  }),
  sms: ns({
    id: "sms", title: "SMS delivery", description: "Text messages to customers’ delivery phone numbers.",
    permission: "integrations:manage", auditAction: "SMS_SETTINGS_UPDATED",
    fields: [f.select("provider", "Provider", [{ value: "none", label: "Not configured" }, { value: "twilio", label: "Twilio" }, { value: "msg91", label: "MSG91" }], "none", { sensitive: true })],
  }),
  "sms.twilio": ns({ id: "sms.twilio", title: "Twilio", description: "", permission: "integrations:manage", auditAction: "SMS_SETTINGS_UPDATED",
    fields: [f.text("accountSid", "Account SID", "", { max: 40, pattern: [/^AC[0-9a-f]{32}$/, "Account SIDs start with AC and have 34 characters"] }), f.secret("authToken", "Auth token"), f.text("fromNumber", "Sender number", "", { max: 20, pattern: [/^\+\d{7,15}$/, "Use E.164 format like +14155550123"] })] }),
  "sms.msg91": ns({ id: "sms.msg91", title: "MSG91", description: "Indian SMS requires DLT-approved templates; add their IDs here.", permission: "integrations:manage", auditAction: "SMS_SETTINGS_UPDATED",
    fields: [f.secret("authKey", "Auth key"), f.text("senderId", "Sender ID", "", { max: 6, pattern: [/^[A-Z]{6}$/, "6 capital letters"] }), f.text("templateShipped", "Template ID: shipped", "", { max: 40 }), f.text("templateDelivered", "Template ID: delivered", "", { max: 40 })] }),

  // ---------- infrastructure ----------
  storage: ns({
    id: "storage", title: "Media storage", description: "Where new uploads go. Switching never moves or breaks existing images: their URLs keep working.",
    permission: "integrations:manage", auditAction: "STORAGE_SETTINGS_UPDATED",
    fields: [f.select("driver", "Upload destination", [{ value: "local", label: "This server’s disk" }, { value: "s3", label: "Amazon S3 / S3-compatible" }, { value: "r2", label: "Cloudflare R2" }, { value: "cloudinary", label: "Cloudinary" }], "local", { sensitive: true })],
  }),
  cdn: ns({ id: "cdn", title: "Asset delivery", description: "Optional public CDN origins. Configure your CDN to mirror the same paths before changing these URLs. Existing remote image URLs are preserved.", permission: "settings:write", auditAction: "CDN_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [f.url("assetBaseUrl", "Bundled asset base URL", "", { public: true, help: "Mirrors /images and /models. Empty serves bundled assets from this site." }), f.url("mediaBaseUrl", "Uploaded image CDN URL", "", { public: true, help: "Mirrors /media. Empty uses the stored upload URL." }), f.switch("optimizeLocalImages", "Optimize local images", true, { public: true, help: "Use Next.js responsive image optimization for same-origin images. Remote/CDN images are served directly." })] }),
  "storage.s3": ns({ id: "storage.s3", title: "Amazon S3 / S3-compatible", description: "", permission: "integrations:manage", auditAction: "STORAGE_SETTINGS_UPDATED",
    fields: [
      f.url("endpoint", "Endpoint", "", { help: "e.g. https://s3.ap-south-1.amazonaws.com or your MinIO URL" }),
      f.text("region", "Region", "ap-south-1", { max: 30 }),
      f.text("bucket", "Bucket", "", { max: 63, pattern: [/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Use a valid bucket name"] }),
      f.text("accessKeyId", "Access key ID", "", { max: 128 }),
      f.secret("secretAccessKey", "Secret access key"),
      f.url("publicUrl", "Public / CDN URL", "", { help: "Base URL images are served from, e.g. https://cdn.yourstore.com" }),
    ] }),
  "storage.r2": ns({ id: "storage.r2", title: "Cloudflare R2", description: "", permission: "integrations:manage", auditAction: "STORAGE_SETTINGS_UPDATED",
    fields: [
      f.text("accountId", "Account ID", "", { max: 64, pattern: [/^[a-f0-9]{32}$/, "32-character account ID"] }),
      f.text("bucket", "Bucket", "", { max: 63 }),
      f.text("accessKeyId", "Access key ID", "", { max: 128 }),
      f.secret("secretAccessKey", "Secret access key"),
      f.url("publicUrl", "Public URL", "", { help: "r2.dev URL or your custom domain" }),
    ] }),
  "storage.cloudinary": ns({ id: "storage.cloudinary", title: "Cloudinary", description: "", permission: "integrations:manage", auditAction: "STORAGE_SETTINGS_UPDATED",
    fields: [f.text("cloudName", "Cloud name", "", { max: 60, pattern: [/^[a-z0-9_-]+$/i, "Letters, numbers, dashes"] }), f.text("apiKey", "API key", "", { max: 40 }), f.secret("apiSecret", "API secret"), f.text("folder", "Folder", "store", { max: 60, pattern: [/^[a-z0-9_/-]*$/i, "Letters, numbers, dashes and slashes"] })] }),

  // ---------- marketing ----------
  seo: ns({
    id: "seo", title: "SEO", description: "Defaults for titles, descriptions, sharing cards and indexing. Pages with their own title/image keep them.",
    permission: "settings:write", auditAction: "SEO_SETTINGS_UPDATED", affectsStorefront: true,
    refine: (values) => (String(values.titleTemplate).includes("%s") ? null : { titleTemplate: "Include %s where the page title goes" }),
    fields: [
      f.text("siteTitle", "Home page title", "", { public: true, max: 70, help: "Empty: “Store name — hero headline”." }),
      f.text("titleTemplate", "Title template", "%s — {store}", { public: true, max: 70, help: "%s is the page title, {store} the store name." }),
      f.textarea("metaDescription", "Meta description", siteConfig.brand.description, { public: true, max: 170 }),
      f.image("ogImage", "Default share image", { public: true, help: "Overrides the branding social image for SEO." }),
      f.url("canonicalBaseUrl", "Canonical site URL", "", { public: true, help: "e.g. https://yourstore.com. Empty uses NEXT_PUBLIC_SITE_URL." }),
      f.switch("robotsIndex", "Allow search engines to index", true, { public: true }),
      f.switch("robotsFollow", "Allow search engines to follow links", true, { public: true }),
      f.select("twitterCard", "X / Twitter card", [{ value: "summary_large_image", label: "Large image" }, { value: "summary", label: "Summary" }], "summary_large_image", { public: true }),
      f.text("twitterHandle", "X / Twitter handle", "", { public: true, max: 16, pattern: [/^@\w{1,15}$/, "Like @yourstore"] }),
      f.text("organizationName", "Organisation name", "", { public: true, max: 120, help: "Structured data for search results. Empty uses the store name." }),
    ],
  }),
  social: ns({
    id: "social", title: "Social links", description: "Only links you fill in are shown in the footer.",
    permission: "settings:write", auditAction: "SOCIAL_LINKS_UPDATED", affectsStorefront: true,
    fields: [
      f.url("instagram", "Instagram", "", { public: true, placeholder: "https://instagram.com/yourstore" }),
      f.url("tiktok", "TikTok", "", { public: true }),
      f.url("youtube", "YouTube", "", { public: true }),
      f.url("x", "X", "", { public: true }),
      f.url("facebook", "Facebook", "", { public: true }),
      f.url("pinterest", "Pinterest", "", { public: true }),
    ],
  }),
  analytics: ns({
    id: "analytics", title: "Analytics and pixels", description: "Scripts load only when switched on, and only after visitors consent if consent is required.",
    permission: "settings:write", auditAction: "ANALYTICS_SETTINGS_UPDATED", affectsStorefront: true,
    refine: requireIdWhenEnabled([["ga4Enabled", "ga4Id", "Add a measurement ID"], ["gtmEnabled", "gtmId", "Add a container ID"], ["metaEnabled", "metaPixelId", "Add a pixel ID"], ["tiktokEnabled", "tiktokPixelId", "Add a pixel ID"], ["pinterestEnabled", "pinterestTagId", "Add a tag ID"], ["clarityEnabled", "clarityId", "Add a project ID"]]),
    fields: [
      f.switch("consentRequired", "Ask for consent before tracking", true, { public: true, help: "Shows a consent banner; nothing loads until the visitor accepts." }),
      f.switch("ga4Enabled", "Google Analytics 4", false, { public: true, group: "Google" }),
      f.text("ga4Id", "Measurement ID", "", { public: true, group: "Google", max: 20, pattern: [/^G-[A-Z0-9]{4,15}$/, "Looks like G-XXXXXXX"] }),
      f.switch("gtmEnabled", "Google Tag Manager", false, { public: true, group: "Google" }),
      f.text("gtmId", "Container ID", "", { public: true, group: "Google", max: 20, pattern: [/^GTM-[A-Z0-9]{4,12}$/, "Looks like GTM-XXXXXX"] }),
      f.switch("metaEnabled", "Meta Pixel", false, { public: true, group: "Social pixels" }),
      f.text("metaPixelId", "Meta pixel ID", "", { public: true, group: "Social pixels", max: 20, pattern: [/^\d{8,20}$/, "Digits only"] }),
      f.switch("tiktokEnabled", "TikTok Pixel", false, { public: true, group: "Social pixels" }),
      f.text("tiktokPixelId", "TikTok pixel ID", "", { public: true, group: "Social pixels", max: 30, pattern: [/^[A-Z0-9]{15,25}$/, "Capital letters and digits"] }),
      f.switch("pinterestEnabled", "Pinterest Tag", false, { public: true, group: "Social pixels" }),
      f.text("pinterestTagId", "Pinterest tag ID", "", { public: true, group: "Social pixels", max: 20, pattern: [/^\d{8,20}$/, "Digits only"] }),
      f.switch("clarityEnabled", "Microsoft Clarity", false, { public: true, group: "Behaviour" }),
      f.text("clarityId", "Clarity project ID", "", { public: true, group: "Behaviour", max: 16, pattern: [/^[a-z0-9]{6,16}$/, "Lowercase letters and digits"] }),
    ],
  }),
  marketing: ns({
    id: "marketing", title: "Newsletter", description: "Where homepage sign-ups go.",
    permission: "integrations:manage", auditAction: "MARKETING_SETTINGS_UPDATED",
    fields: [f.select("provider", "Newsletter provider", [{ value: "native", label: "Store database" }, { value: "mailchimp", label: "Mailchimp" }, { value: "klaviyo", label: "Klaviyo" }, { value: "brevo", label: "Brevo" }], "native", { sensitive: true })],
  }),
  "marketing.mailchimp": ns({ id: "marketing.mailchimp", title: "Mailchimp", description: "", permission: "integrations:manage", auditAction: "MARKETING_SETTINGS_UPDATED",
    fields: [f.secret("apiKey", "API key", { format: [/^[0-9a-f]{32}-[a-z]{2,4}\d{1,3}$/, "Mailchimp keys end with the data centre, e.g. -us21"] }), f.text("audienceId", "Audience ID", "", { max: 20, pattern: [/^[0-9a-z]{6,20}$/, "Lowercase letters and digits"] })] }),
  "marketing.klaviyo": ns({ id: "marketing.klaviyo", title: "Klaviyo", description: "", permission: "integrations:manage", auditAction: "MARKETING_SETTINGS_UPDATED",
    fields: [f.secret("privateKey", "Private API key", { format: [/^pk_\w+$/, "Private keys start with pk_"] }), f.text("listId", "List ID", "", { max: 20, pattern: [/^[A-Za-z0-9]{4,20}$/, "Letters and digits"] })] }),
  "marketing.brevo": ns({ id: "marketing.brevo", title: "Brevo", description: "", permission: "integrations:manage", auditAction: "MARKETING_SETTINGS_UPDATED",
    fields: [f.secret("apiKey", "API key", { format: [/^xkeysib-[\w-]+$/, "Brevo keys start with xkeysib-"] }), f.number("listId", "List ID", 0, { min: 0, max: 1e9 })] }),

  // ---------- system ----------
  security: ns({
    id: "security", title: "Admin security", description: "Sessions and sign-in protection for this admin. Root secrets stay in server configuration.",
    permission: "security:manage", auditAction: "SECURITY_SETTINGS_UPDATED",
    fields: [
      f.number("sessionTimeoutHours", "Session length (hours)", 12, { min: 1, max: 72, sensitive: true, help: "Applies to new sign-ins." }),
      f.number("stepUpMinutes", "Re-confirm password after (minutes)", 10, { min: 1, max: 60, sensitive: true, help: "Sensitive changes need a password confirmation this recent." }),
      f.number("maxFailedLogins", "Failed sign-ins before lockout", 5, { min: 3, max: 20, sensitive: true }),
      f.number("lockoutMinutes", "Lockout duration (minutes)", 15, { min: 5, max: 1440, sensitive: true }),
      f.email("adminNotificationEmail", "Security notification email", "", { help: "Receives notices about sign-ins and sensitive changes when email is configured." }),
      f.switch("requireMfa", "Require two-factor authentication", false, { readOnly: true, help: "Not available yet. This will enforce MFA once it ships." }),
    ],
  }),
  features: ns({
    id: "features", title: "Feature flags", description: "Turn storefront features on or off without deleting code. Features marked “not built yet” are reserved flags.",
    permission: "settings:write", auditAction: "FEATURE_FLAGS_UPDATED", affectsStorefront: true,
    fields: [
      f.switch("threeDViewer", "3D product viewer", true, { public: true }),
      f.switch("lookbook", "Homepage lookbook", true, { public: true }),
      f.switch("newsletter", "Newsletter sign-up", true, { public: true }),
      f.switch("arTryOn", "AR try-on", false, { public: true, readOnly: true, help: "Not built yet." }),
      f.switch("wishlist", "Wishlist", false, { public: true, readOnly: true, help: "Not built yet." }),
      f.switch("reviews", "Reviews", false, { public: true, readOnly: true, help: "Not built yet." }),
      f.switch("customerAccounts", "Customer accounts", false, { public: true, readOnly: true, help: "Not built yet (next phase)." }),
      f.switch("cod", "Cash on delivery", false, { public: true, readOnly: true, help: "Not built yet." }),
      f.switch("multiCurrency", "Multi-currency storefront", false, { public: true, readOnly: true, help: "Not built yet." }),
    ],
  }),
  ar: ns({
    id: "ar", title: "AR and 3D", description: "Quality defaults for the 3D viewer and configuration reserved for AR try-on (not built yet).",
    permission: "settings:write", auditAction: "AR_SETTINGS_UPDATED", affectsStorefront: true,
    fields: [
      f.select("defaultModelQuality", "3D quality on desktop", [{ value: "auto", label: "Automatic" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }], "auto", { public: true }),
      f.select("mobileQuality", "3D quality on phones", [{ value: "auto", label: "Automatic" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }], "auto", { public: true }),
      f.textarea("cameraPermissionMessage", "Camera permission message", "We use your camera only to place the garment on you. Nothing is recorded or uploaded.", { public: true, max: 300, group: "AR try-on (reserved)" }),
      f.select("provider", "AR provider", [{ value: "none", label: "None" }, { value: "custom", label: "Custom API" }], "none", { group: "AR try-on (reserved)" }),
      f.url("providerEndpoint", "Provider endpoint", "", { group: "AR try-on (reserved)" }),
      f.secret("providerApiKey", "Provider API key", { group: "AR try-on (reserved)" }),
    ],
  }),
} as const;

export type NamespaceId = keyof typeof NAMESPACES;
type FieldsOf<N extends NamespaceId> = (typeof NAMESPACES)[N]["fields"][number];
/** Non-secret values of a namespace, fully typed from the registry. */
export type SettingsOf<N extends NamespaceId> = {
  [F in FieldsOf<N> as F extends FieldDef<string, "secret", unknown> ? never : F["key"]]: F extends FieldDef<string, FieldDef["type"], infer V> ? V : never;
};
export type SecretKeyOf<N extends NamespaceId> = Extract<FieldsOf<N>, FieldDef<string, "secret", unknown>>["key"];

export const getNamespace = (id: string): NamespaceDef | null => (Object.hasOwn(NAMESPACES, id) ? (NAMESPACES as Record<string, NamespaceDef>)[id] : null);
export const NAMESPACE_IDS = Object.keys(NAMESPACES) as NamespaceId[];

/** Defaults for one namespace (non-secret fields). */
export function namespaceDefaults<N extends NamespaceId>(id: N): SettingsOf<N> {
  const out: Record<string, unknown> = {};
  for (const field of NAMESPACES[id].fields as readonly FieldDef[]) if (field.type !== "secret") out[field.key] = structuredClone(field.default);
  return out as SettingsOf<N>;
}

// ---------- settings navigation ----------
export interface SettingsPage {
  slug: string;
  title: string;
  group: string;
  description: string;
  permission: import("@/lib/admin/permissions").Permission;
  /** Namespaces rendered by the generic form, in order. `when` shows a namespace only for a provider choice. */
  namespaces?: { id: NamespaceId; when?: { namespace: NamespaceId; key: string; equals: string } }[];
}

export const SETTINGS_PAGES: SettingsPage[] = [
  { slug: "general", title: "General", group: "Store", permission: "settings:write", description: "Store name, description and contact details.", namespaces: [{ id: "general" }] },
  { slug: "store", title: "Store", group: "Store", permission: "settings:write", description: "Business address, returns policy, notices and footer.", namespaces: [{ id: "address" }, { id: "returns" }, { id: "site" }] },
  { slug: "branding", title: "Branding", group: "Store", permission: "settings:write", description: "Logos, favicon, share image and brand colours.", namespaces: [{ id: "branding" }] },
  { slug: "localization", title: "Localization", group: "Store", permission: "settings:write", description: "Currencies, locales, timezone and units.", namespaces: [{ id: "localization" }] },
  { slug: "payments", title: "Payments", group: "Commerce", permission: "integrations:manage", description: "Providers, test and live credentials, routing and methods." },
  { slug: "shipping", title: "Shipping", group: "Commerce", permission: "settings:write", description: "Origin, delivery methods, zones, free shipping and couriers." },
  { slug: "tax", title: "Tax", group: "Commerce", permission: "settings:write", description: "Tax registration and the rates charged at checkout.", namespaces: [{ id: "tax" }] },
  { slug: "checkout", title: "Checkout", group: "Commerce", permission: "settings:write", description: "Required fields, limits and where you sell.", namespaces: [{ id: "checkout" }] },
  { slug: "orders", title: "Orders", group: "Commerce", permission: "settings:write", description: "Numbering, post-payment status and invoices.", namespaces: [{ id: "orders" }] },
  { slug: "inventory", title: "Inventory", group: "Commerce", permission: "settings:write", description: "Stock tracking, overselling and reservations.", namespaces: [{ id: "inventory" }] },
  { slug: "email", title: "Email", group: "Communication", permission: "integrations:manage", description: "Email provider and sender details.", namespaces: [{ id: "email" }, { id: "email.smtp", when: { namespace: "email", key: "provider", equals: "smtp" } }, { id: "email.resend", when: { namespace: "email", key: "provider", equals: "resend" } }, { id: "email.sendgrid", when: { namespace: "email", key: "provider", equals: "sendgrid" } }, { id: "email.postmark", when: { namespace: "email", key: "provider", equals: "postmark" } }, { id: "email.ses", when: { namespace: "email", key: "provider", equals: "ses" } }] },
  { slug: "sms", title: "SMS", group: "Communication", permission: "integrations:manage", description: "Text message provider.", namespaces: [{ id: "sms" }, { id: "sms.twilio", when: { namespace: "sms", key: "provider", equals: "twilio" } }, { id: "sms.msg91", when: { namespace: "sms", key: "provider", equals: "msg91" } }] },
  { slug: "notifications", title: "Notifications", group: "Communication", permission: "settings:write", description: "Which emails and texts are sent.", namespaces: [{ id: "notifications" }] },
  { slug: "storage", title: "Storage", group: "Infrastructure", permission: "integrations:manage", description: "Where uploaded images and models are stored.", namespaces: [{ id: "storage" }, { id: "storage.s3", when: { namespace: "storage", key: "driver", equals: "s3" } }, { id: "storage.r2", when: { namespace: "storage", key: "driver", equals: "r2" } }, { id: "storage.cloudinary", when: { namespace: "storage", key: "driver", equals: "cloudinary" } }] },
  { slug: "cdn", title: "CDN", group: "Infrastructure", permission: "settings:write", description: "Public asset origins and local image optimization.", namespaces: [{ id: "cdn" }] },
  { slug: "seo", title: "SEO", group: "Marketing", permission: "settings:write", description: "Titles, descriptions, share cards and indexing.", namespaces: [{ id: "seo" }] },
  { slug: "social", title: "Social", group: "Marketing", permission: "settings:write", description: "Links shown in the footer.", namespaces: [{ id: "social" }] },
  { slug: "analytics", title: "Analytics", group: "Marketing", permission: "settings:write", description: "Analytics, tag manager and pixels, with consent.", namespaces: [{ id: "analytics" }] },
  { slug: "marketing", title: "Newsletter", group: "Marketing", permission: "integrations:manage", description: "Where newsletter sign-ups are sent.", namespaces: [{ id: "marketing" }, { id: "marketing.mailchimp", when: { namespace: "marketing", key: "provider", equals: "mailchimp" } }, { id: "marketing.klaviyo", when: { namespace: "marketing", key: "provider", equals: "klaviyo" } }, { id: "marketing.brevo", when: { namespace: "marketing", key: "provider", equals: "brevo" } }] },
  { slug: "integrations", title: "Integrations", group: "Developers", permission: "integrations:manage", description: "Status of every connection, plus custom credentials." },
  { slug: "webhooks", title: "Webhooks", group: "Developers", permission: "integrations:manage", description: "Notify other systems when things happen in the store." },
  { slug: "api-keys", title: "API keys", group: "Developers", permission: "integrations:manage", description: "Keys for external apps that call this store." },
  { slug: "security", title: "Security", group: "System", permission: "security:manage", description: "Team, sessions, sign-in protection and store access.", namespaces: [{ id: "security" }] },
  { slug: "features", title: "Features", group: "System", permission: "settings:write", description: "Feature flags.", namespaces: [{ id: "features" }] },
  { slug: "ar", title: "AR / 3D", group: "System", permission: "settings:write", description: "3D viewer quality and AR configuration.", namespaces: [{ id: "ar" }] },
  { slug: "advanced", title: "Advanced", group: "System", permission: "security:manage", description: "Import/export, history, caches and the danger zone." },
];

export const getSettingsPage = (slug: string) => SETTINGS_PAGES.find((page) => page.slug === slug) ?? null;
