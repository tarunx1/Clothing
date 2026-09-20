import { z } from "zod";

/** Shared by admin forms (React Hook Form) and server actions, so client and server agree. */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const uuid = z.string().uuid("Select an option");

export const slugField = z.string().trim().min(1, "Enter a slug").max(80).regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens");
export const moneyField = z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 2599 or 2599.50");
const optionalMoney = z.union([z.literal(""), moneyField]);
const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const assetUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^\/(media|models|images)\/[A-Za-z0-9/_.-]+$/.test(value) || /^https:\/\/\S+$/.test(value), "Use an uploaded file, a /models/… path or an https:// URL");

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(120),
  slug: slugField,
  subtitle: optionalText(120),
  description: z.string().trim().min(1, "Add a description").max(4000),
  details: optionalText(4000),
  collectionId: uuid,
  basePrice: moneyField,
  currency: z.enum(["INR", "CAD", "USD"]),
  material: optionalText(120),
  gsm: z.string().trim().regex(/^$|^\d{2,3}$/, "Enter a weight like 240"),
  fit: optionalText(60),
  fitAdvice: optionalText(300),
  fitNotes: optionalText(1000),
  print: optionalText(200),
  care: optionalText(1000),
  model3dUrl: assetUrl,
  featured: z.boolean(),
  enabled: z.boolean(),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const colorFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a colour name").max(40),
  slug: slugField,
  hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex value like #1a1a1a"),
});

export const variantRowSchema = z.object({
  colorId: uuid,
  sizeId: uuid,
  active: z.boolean(),
  sku: z.string().trim().toUpperCase().max(40),
  price: optionalMoney,
  compareAtPrice: optionalMoney,
  initialStock: z.string().trim().regex(/^\d{0,6}$/, "Whole numbers only"),
});
export const variantMatrixSchema = z.object({ rows: z.array(variantRowSchema).max(400) });
export type VariantRowValues = z.infer<typeof variantRowSchema>;

export const mediaItemSchema = z.object({ url: z.string().trim().min(1).max(500), alt: z.string().trim().max(200) });
export const IMAGE_TYPES = ["FRONT", "BACK", "DETAIL", "MODEL", "LIFESTYLE", "OTHER"] as const;
export const productImageUpdateSchema = z.object({
  alt: z.string().trim().min(1, "Describe the image for screen readers").max(200),
  type: z.enum(IMAGE_TYPES),
  colorId: z.union([z.literal(""), uuid]),
});

export const collectionFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a collection name").max(60),
  slug: slugField,
  shortDescription: z.string().trim().min(1, "Add a short description").max(160),
  description: z.string().trim().min(1, "Add a description").max(2000),
  enabled: z.boolean(),
  featured: z.boolean(),
});
export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export const ADJUSTMENT_REASONS = ["RESTOCK", "CORRECTION", "RETURN", "DAMAGED", "OTHER"] as const;
export const inventoryAdjustmentSchema = z.object({
  variantId: uuid,
  delta: z.coerce.number().int("Whole numbers only").min(-100000).max(100000).refine((value) => value !== 0, "Enter a change other than 0"),
  reason: z.enum(ADJUSTMENT_REASONS),
  note: z.string().trim().max(300),
});

export const shipmentSchema = z.object({
  carrier: optionalText(60),
  trackingNumber: optionalText(80),
  trackingUrl: z.string().trim().max(500).refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "Use an https:// link"),
});
export const orderTransitionSchema = shipmentSchema.extend({
  orderId: uuid,
  from: z.string(),
  to: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: optionalText(300),
});

export const lookbookUpdateSchema = z.object({
  alt: z.string().trim().min(1, "Describe the image").max(200),
  lane: z.coerce.number().int().min(1).max(3),
  enabled: z.boolean(),
  creditName: optionalText(80),
  creditUrl: z.string().trim().max(300).refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "Use an https:// link"),
});

export const toSlug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Suggested SKU like IMP-CHAR-L: product code, colour code, size. Uniqueness is checked on save. */
export function suggestSku(slug: string, color: string, size: string) {
  const code = (value: string, length: number) => value.replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/)[0]?.slice(0, length).toUpperCase() || "X";
  return [code(slug.replace(/-/g, " "), 3), code(color, 4), size.toUpperCase().replace(/[^A-Z0-9]/g, "")].join("-");
}

/** "2,599.50" → 259950n. Integer-only arithmetic; never parses through floats. */
export function toMinorUnits(value: string): bigint {
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

export const fromMinorUnits = (minor: bigint | null | undefined) => {
  if (minor == null) return "";
  const whole = minor / BigInt(100);
  const fraction = minor % BigInt(100);
  return fraction === BigInt(0) ? whole.toString() : `${whole}.${fraction.toString().padStart(2, "0")}`;
};

export const linesToList = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
