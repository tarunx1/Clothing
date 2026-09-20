import { z } from "zod";

/**
 * Field builders for the settings registry. Each field carries its own Zod
 * schema (server-authoritative; the form reuses it), a default that matches
 * the store's current behaviour, and a visibility class. Safe on the client:
 * no values or secrets live here.
 */
export type FieldType =
  | "text" | "email" | "url" | "tel" | "textarea" | "number" | "money" | "percent"
  | "switch" | "select" | "multiselect" | "list" | "rows" | "color" | "image" | "secret" | "datetime";

export interface Option { value: string; label: string }
export interface RowColumn { key: string; label: string; type: "text" | "url" | "select" | "percent" | "list"; options?: readonly Option[]; placeholder?: string }

export interface FieldDef<K extends string = string, T extends FieldType = FieldType, V = unknown> {
  key: K;
  type: T;
  label: string;
  help?: string;
  placeholder?: string;
  options?: readonly Option[];
  columns?: readonly RowColumn[];
  /** Safe to expose to the storefront (getPublicSettings). Secrets are never public. */
  public?: boolean;
  /** Changing it requires a recent password confirmation (step-up). Secrets always do. */
  sensitive?: boolean;
  /** Informational only in this release (shown disabled with the help text). */
  readOnly?: boolean;
  group?: string;
  /** Show only when another field in the same namespace has one of these values. */
  showIf?: { key: string; in: readonly unknown[] };
  /** For secrets: format check applied to a new value before it is encrypted. */
  secretFormat?: { pattern: RegExp; message: string };
  schema: z.ZodType<V, z.ZodTypeDef, unknown>;
  default: V;
}

type Meta = Partial<Pick<FieldDef, "help" | "placeholder" | "public" | "sensitive" | "readOnly" | "group" | "showIf">>;

export function safePublicUrl(value: string, allowPath = false) {
  if (value.includes("\\") || /\s/.test(value)) return false;
  if (allowPath && /^\/(?!\/)/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}

const trimmed = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

export const MONEY_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
/** Decimal string or integer minor units → integer minor units. Never floats. */
const minorUnits = z.union([
  z.number().int().min(0).max(1e11),
  z.string().trim().regex(MONEY_PATTERN, "Enter an amount like 3999 or 3999.50").transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  }),
]);
/** "18" or "18.5" (percent) → basis points (1800 / 1850). */
const basisPoints = z.union([
  z.number().int().min(0).max(10_000),
  z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 18 or 12.5").transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  }).refine((value) => value <= 10_000, "Percentages can't exceed 100"),
]);

export const f = {
  text: <K extends string>(key: K, label: string, def = "", meta: Meta & { max?: number; pattern?: [RegExp, string] } = {}): FieldDef<K, "text", string> => ({
    key, label, type: "text", ...meta, default: def,
    schema: meta.pattern ? trimmed(meta.max ?? 200).refine((value) => value === "" || meta.pattern![0].test(value), meta.pattern[1]) : trimmed(meta.max ?? 200),
  }),
  textarea: <K extends string>(key: K, label: string, def = "", meta: Meta & { max?: number } = {}): FieldDef<K, "textarea", string> => ({ key, label, type: "textarea", ...meta, default: def, schema: trimmed(meta.max ?? 2000) }),
  email: <K extends string>(key: K, label: string, def = "", meta: Meta = {}): FieldDef<K, "email", string> => ({
    key, label, type: "email", ...meta, default: def, schema: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address").max(200)]),
  }),
  tel: <K extends string>(key: K, label: string, def = "", meta: Meta = {}): FieldDef<K, "tel", string> => ({
    key, label, type: "tel", ...meta, default: def, schema: z.string().trim().max(30).refine((value) => value === "" || /^\+?[\d ()-]{6,24}$/.test(value), "Enter a phone number like +91 98200 00000"),
  }),
  url: <K extends string>(key: K, label: string, def = "", meta: Meta & { allowPath?: boolean } = {}): FieldDef<K, "url", string> => ({
    key, label, type: "url", ...meta, default: def,
    schema: z.string().trim().max(500).refine(
      (value) => value === "" || safePublicUrl(value, meta.allowPath),
      meta.allowPath ? "Use a path like /shop or an https:// link" : "Use an https:// link",
    ),
  }),
  number: <K extends string>(key: K, label: string, def: number, meta: Meta & { min: number; max: number }): FieldDef<K, "number", number> => ({
    key, label, type: "number", ...meta, default: def, schema: z.coerce.number({ invalid_type_error: "Enter a number" }).int("Whole numbers only").min(meta.min, `Minimum ${meta.min}`).max(meta.max, `Maximum ${meta.max}`),
  }),
  money: <K extends string>(key: K, label: string, def = 0, meta: Meta = {}): FieldDef<K, "money", number> => ({ key, label, type: "money", ...meta, default: def, schema: minorUnits }),
  percent: <K extends string>(key: K, label: string, def = 0, meta: Meta = {}): FieldDef<K, "percent", number> => ({ key, label, type: "percent", ...meta, default: def, schema: basisPoints }),
  switch: <K extends string>(key: K, label: string, def = false, meta: Meta = {}): FieldDef<K, "switch", boolean> => ({ key, label, type: "switch", ...meta, default: def, schema: z.boolean() }),
  select: <K extends string, O extends string>(key: K, label: string, options: readonly { value: O; label: string }[], def: O, meta: Meta = {}): FieldDef<K, "select", O> => ({
    key, label, type: "select", options, ...meta, default: def,
    schema: z.string().refine((value) => options.some((option) => option.value === value), "Choose one of the options") as unknown as z.ZodType<O, z.ZodTypeDef, unknown>,
  }),
  multiselect: <K extends string>(key: K, label: string, options: readonly Option[], def: string[], meta: Meta & { min?: number } = {}): FieldDef<K, "multiselect", string[]> => ({
    key, label, type: "multiselect", options, ...meta, default: def,
    schema: z.array(z.string().refine((value) => options.some((option) => option.value === value), "Unknown option")).min(meta.min ?? 0, "Choose at least one").max(options.length).transform((values) => [...new Set(values)]),
  }),
  list: <K extends string>(key: K, label: string, def: string[] = [], meta: Meta & { item?: z.ZodType<string>; maxItems?: number } = {}): FieldDef<K, "list", string[]> => ({
    key, label, type: "list", ...meta, default: def,
    schema: z.array(meta.item ?? z.string().trim().min(1).max(200)).max(meta.maxItems ?? 20, `Up to ${meta.maxItems ?? 20} entries`),
  }),
  rows: <K extends string, R extends Record<string, unknown>>(key: K, label: string, columns: readonly RowColumn[], row: z.ZodType<R, z.ZodTypeDef, unknown>, def: R[] = [], meta: Meta & { maxItems?: number } = {}): FieldDef<K, "rows", R[]> => ({
    key, label, type: "rows", columns, ...meta, default: def, schema: z.array(row).max(meta.maxItems ?? 30, `Up to ${meta.maxItems ?? 30} rows`),
  }),
  color: <K extends string>(key: K, label: string, def: string, meta: Meta = {}): FieldDef<K, "color", string> => ({
    key, label, type: "color", ...meta, default: def, schema: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #111111").transform((value) => value.toLowerCase()),
  }),
  image: <K extends string>(key: K, label: string, meta: Meta = {}): FieldDef<K, "image", string> => ({
    key, label, type: "image", ...meta, default: "",
    schema: z.string().trim().max(500).refine((value) => value === "" || /^\/(media|images)\/[A-Za-z0-9/_.-]+$/.test(value) || /^https:\/\/\S+$/.test(value), "Upload an image or use an https:// link"),
  }),
  datetime: <K extends string>(key: K, label: string, meta: Meta = {}): FieldDef<K, "datetime", string> => ({
    key, label, type: "datetime", ...meta, default: "", schema: z.string().trim().refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Enter a valid date and time"),
  }),
  /** Encrypted at rest. The value never leaves the server after saving. */
  secret: <K extends string>(key: K, label: string, meta: Omit<Meta, "public"> & { format?: [RegExp, string] } = {}): FieldDef<K, "secret", never> => ({
    key, label, type: "secret", ...meta, sensitive: true, default: undefined as never,
    secretFormat: meta.format ? { pattern: meta.format[0], message: meta.format[1] } : undefined,
    schema: z.never(),
  }),
};

export const secretValueSchema = z.string().trim().min(1, "Enter a value").max(4000, "That value is too long");

/** Display helpers shared by forms (client) and history (server). */
export const minorToDecimal = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));
export const bpsToPercent = (bps: number) => (bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2).replace(/0$/, ""));
